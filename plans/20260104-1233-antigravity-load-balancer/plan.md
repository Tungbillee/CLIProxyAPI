# Plan: Antigravity OAuth Load Balancer

## Tổng quan

Triển khai cơ chế phân phối request tự động qua nhiều Antigravity OAuth tokens để tránh rate limit (2 RPM/token).

## Vấn đề hiện tại

1. **RoundRobinSelector** hiện tại:
   - Chọn credential theo round-robin (selector.go:148-172)
   - **KHÔNG** có awareness về concurrent requests
   - Khi 10 requests đến đồng thời, có thể nhiều request chọn cùng 1 token trước khi rotation được cập nhật

2. **Antigravity Executor** (antigravity_executor.go):
   - Đã có fallback khi gặp 429 (line 155-157: retry với fallback base URL)
   - **KHÔNG** có per-credential rate limiting
   - **KHÔNG** có semaphore/concurrency control

3. **Auth Manager** (conductor.go):
   - Xử lý quota cooldown sau khi nhận 429 (line 858-875)
   - **KHÔNG** có proactive rate limiting

## Giải pháp đề xuất

### Option 1: Concurrency-Aware Selector (Khuyến nghị)

Thêm semaphore per-credential để giới hạn concurrent requests.

**Ưu điểm:**
- Proactive - ngăn 429 trước khi xảy ra
- Minimal changes - chỉ cần modify selector
- Config-driven - có thể điều chỉnh limit qua config

**Nhược điểm:**
- Cần thêm state management
- Có thể tạo bottleneck nếu config sai

### Option 2: Enhanced Quota Tracking

Theo dõi số requests đang xử lý per-credential và chờ đợi khi đạt limit.

**Ưu điểm:**
- Accurate tracking
- Works well với existing cooldown system

**Nhược điểm:**
- More complex implementation
- Need distributed state cho multi-instance

### Option 3: Request Queue với Rate Limiter

Queue requests và release theo rate limit.

**Ưu điểm:**
- Guaranteed rate compliance
- Fair distribution

**Nhược điểm:**
- Adds latency
- Complex queue management

---

## Chi tiết triển khai (Option 1 - Recommended)

### Phase 1: Thêm Concurrency Config

**File:** `internal/config/config.go`

```go
// RoutingConfig - thêm field mới
type RoutingConfig struct {
    Strategy string `yaml:"strategy,omitempty"`
    // MaxConcurrentPerCredential limits concurrent requests per credential
    // Default: 2 (matches Gemini free tier limit)
    MaxConcurrentPerCredential int `yaml:"max-concurrent-per-credential,omitempty"`
}
```

### Phase 2: Implement ConcurrencyAwareSelector

**File:** `sdk/cliproxy/auth/selector.go` (new type)

```go
// ConcurrencyAwareSelector extends RoundRobinSelector with per-credential semaphores
type ConcurrencyAwareSelector struct {
    mu          sync.Mutex
    cursors     map[string]int
    semaphores  map[string]chan struct{} // authID -> semaphore
    maxConcurrent int
}

func NewConcurrencyAwareSelector(maxConcurrent int) *ConcurrencyAwareSelector {
    if maxConcurrent <= 0 {
        maxConcurrent = 2 // default: 2 concurrent per credential
    }
    return &ConcurrencyAwareSelector{
        cursors:       make(map[string]int),
        semaphores:    make(map[string]chan struct{}),
        maxConcurrent: maxConcurrent,
    }
}

func (s *ConcurrencyAwareSelector) Pick(ctx context.Context, provider, model string, opts Options, auths []*Auth) (*Auth, error) {
    // 1. Get available auths (existing logic)
    available, err := getAvailableAuths(auths, provider, model, time.Now())
    if err != nil {
        return nil, err
    }

    // 2. Sort by current usage (least used first)
    s.mu.Lock()
    sorted := s.sortByUsage(available)
    s.mu.Unlock()

    // 3. Try to acquire semaphore for each auth in order
    for _, auth := range sorted {
        sem := s.getOrCreateSemaphore(auth.ID)
        select {
        case sem <- struct{}{}:
            // Successfully acquired
            return auth, nil
        default:
            // This credential is at capacity, try next
            continue
        }
    }

    // 4. All at capacity - wait for first available with timeout
    // Or return cooldown error
    return nil, newModelCooldownError(model, provider, 5*time.Second)
}

// Release must be called after request completes
func (s *ConcurrencyAwareSelector) Release(authID string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    if sem, ok := s.semaphores[authID]; ok {
        select {
        case <-sem:
            // Released
        default:
            // Already empty
        }
    }
}
```

### Phase 3: Integrate với Manager

**File:** `sdk/cliproxy/auth/conductor.go`

Modify `executeWithProvider` để call Release sau khi request hoàn thành:

```go
func (m *Manager) executeWithProvider(ctx context.Context, provider string, req Request, opts Options) (Response, error) {
    auth, executor, err := m.pickNext(ctx, provider, routeModel, opts, tried)
    if err != nil {
        return Response{}, err
    }

    // Release semaphore when done
    defer m.releaseSemaphore(auth.ID)

    // ... existing execution logic
}

func (m *Manager) releaseSemaphore(authID string) {
    if sel, ok := m.selector.(*ConcurrencyAwareSelector); ok {
        sel.Release(authID)
    }
}
```

### Phase 4: Config Integration

**File:** `internal/runtime/setup.go` hoặc tương đương

```go
func setupSelector(cfg *config.Config) auth.Selector {
    if cfg.Routing.MaxConcurrentPerCredential > 0 {
        return auth.NewConcurrencyAwareSelector(cfg.Routing.MaxConcurrentPerCredential)
    }

    switch cfg.Routing.Strategy {
    case "fill-first":
        return &auth.FillFirstSelector{}
    default:
        return &auth.RoundRobinSelector{}
    }
}
```

---

## Implementation Tasks

### Task 1: Add Config Fields
- [ ] Add `MaxConcurrentPerCredential` to `RoutingConfig`
- [ ] Add default value handling
- [ ] Update config documentation

### Task 2: Implement ConcurrencyAwareSelector
- [ ] Create new selector type in `selector.go`
- [ ] Implement semaphore management
- [ ] Add usage tracking
- [ ] Add Release method

### Task 3: Integrate with Manager
- [ ] Modify `pickNext` to work with new selector
- [ ] Add release logic in `executeWithProvider`
- [ ] Add release logic in `executeStreamWithProvider`

### Task 4: Config Integration
- [ ] Update selector initialization
- [ ] Add antigravity-specific defaults

### Task 5: Testing
- [ ] Unit tests for ConcurrencyAwareSelector
- [ ] Integration test với multiple concurrent requests
- [ ] Verify rate limit compliance

---

## Config Example

```yaml
routing:
  strategy: round-robin
  max-concurrent-per-credential: 2  # Limit 2 concurrent requests per Antigravity token
```

---

## Fallback Behavior

Khi tất cả credentials đều đạt limit:
1. Return `429 Too Many Requests` với `Retry-After: 5` header
2. Client có thể retry sau 5 giây
3. Hoặc implement queue với timeout

---

## Giới hạn

- Chỉ hoạt động cho single instance
- Multi-instance cần Redis/shared state (future enhancement)
- Semaphore cleanup cần handle khi credential bị xóa

---

## Ước tính effort

- Phase 1: ~30 phút
- Phase 2: ~2 giờ
- Phase 3: ~1 giờ
- Phase 4: ~30 phút
- Phase 5: ~1 giờ

**Tổng:** ~5 giờ implementation + testing
