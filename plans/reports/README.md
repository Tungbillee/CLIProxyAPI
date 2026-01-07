# Báo Cáo Phân Tích CLIProxyAPI

Thư mục này chứa các báo cáo chi tiết về codebase CLIProxyAPI v6.

## Tệp Báo Cáo

### 1. **codebase-analysis-250103.md**
Báo cáo phân tích toàn diện về codebase:
- Cách khởi động server và cấu trúc entry point
- Chi tiết SDK structure & usage patterns
- Authentication providers & token stores
- Request/Response translators
- Testing patterns & examples
- Advanced features (Model registry, Quota management, etc.)
- Deployment options & API endpoints
- Performance & scalability considerations
- Security considerations
- Troubleshooting guide

**File chính:**
- `cmd/server/main.go` - Entry point (480 dòng)
- `sdk/cliproxy/service.go` - Service lifecycle (1285 dòng)
- `sdk/cliproxy/builder.go` - Builder pattern (234 dòng)
- `sdk/cliproxy/auth/conductor.go` - Auth management
- `config.yaml` - Configuration structure

### 2. **architecture-diagram-250103.md**
Sơ đồ chi tiết về kiến trúc hệ thống:
1. Request Flow Diagram - Dòng chảy từ client đến provider
2. Service Lifecycle Diagram - Quá trình khởi động và shutdown
3. Authentication State Machine - Trạng thái của auth accounts
4. Data Flow & Storage - Cấu trúc dữ liệu
5. Token Storage Options - Các backend lưu trữ (PostgreSQL, Git, S3, File)
6. Executor Selection & Routing - Lựa chọn executor cho provider
7. Configuration Reload Architecture - Cơ chế hot-reload
8. Multi-Tenant Orchestration - Quản lý nhiều tài khoản
9. Request Retry & Failover Logic - Xử lý lỗi & retry
10. Component Dependency Graph - Sơ đồ phụ thuộc component

## Tóm Tắt Nhanh

### Entry Point: cmd/server/main.go
```bash
./cli-proxy-api -config config.yaml      # Run server
./cli-proxy-api -login                   # Gemini OAuth
./cli-proxy-api -claude-login            # Claude OAuth
./cli-proxy-api -codex-login             # OpenAI OAuth
DEPLOY=cloud ./cli-proxy-api             # Cloud mode
```

### Service Architecture
```
Builder Pattern ──► Service Instance ──► HTTP Server (Gin)
                        │
                        ├─ Core Auth Manager (Account selection & execution)
                        ├─ Request Translator (Format conversion)
                        ├─ Provider Executors (10+ providers supported)
                        ├─ File Watcher (Config auto-reload)
                        ├─ Token Store (Multiple backend options)
                        └─ WebSocket Gateway (AI Studio support)
```

### Request Flow
```
Client Request (OpenAI format)
    ↓
API Handler
    ↓
Request Translator (OpenAI ──► Provider format)
    ↓
Core Auth Manager (Select account using round-robin/fill-first)
    ↓
Provider Executor (Gemini, Claude, OpenAI, etc.)
    ↓
HTTP Client (to provider API)
    ↓
Response Translator (Provider format ──► OpenAI)
    ↓
Client Response (OpenAI format)
```

### Token Storage Priority
1. PostgreSQL (PGSTORE_DSN)
2. S3/MinIO (OBJECTSTORE_ENDPOINT)
3. Git Repository (GITSTORE_GIT_URL)
4. File System (Default: ~/.cli-proxy-api/)

### Key Features
- ✅ Multiple AI providers (Gemini, Claude, OpenAI, Qwen, iFlow, Antigravity)
- ✅ Multi-account load balancing (Round-robin, Fill-first)
- ✅ Zero-downtime config reload
- ✅ Quota management with exponential backoff
- ✅ Request retry logic with failover
- ✅ Format translation pipeline
- ✅ Embeddable SDK for Go applications
- ✅ Management API for runtime configuration
- ✅ WebSocket support (AI Studio)
- ✅ Usage statistics & tracking

## File Locations

| Component | Location |
|-----------|----------|
| Entry Point | `/cmd/server/main.go` |
| Core Service | `/sdk/cliproxy/service.go` |
| Builder Pattern | `/sdk/cliproxy/builder.go` |
| Auth Management | `/sdk/cliproxy/auth/conductor.go` |
| Authentication | `/sdk/auth/` |
| Request/Response Translation | `/sdk/translator/` |
| API Handlers | `/sdk/api/handlers/` |
| Request Access | `/sdk/access/` |
| Configuration | `/sdk/config/` |
| Logging | `/sdk/logging/` |
| Tests | `/test/` |
| Examples | `/examples/` |
| Internal API | `/internal/api/` |
| Executors | `/internal/runtime/executor/` |

## SDK Usage Example

```go
import "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"

func main() {
    cfg, _ := config.LoadConfig("config.yaml")
    
    svc, _ := cliproxy.NewBuilder().
        WithConfig(cfg).
        WithConfigPath("config.yaml").
        WithHooks(cliproxy.Hooks{
            OnAfterStart: func(s *cliproxy.Service) {
                // Setup custom models, etc.
            },
        }).
        Build()
    
    if err := svc.Run(context.Background()); err != nil {
        log.Fatal(err)
    }
}
```

## Configuration

Main file: `config.yaml`

```yaml
host: ""                    # Bind address
port: 8317                  # Port
debug: false                # Debug logging
auth-dir: "~/.cli-proxy-api" # Auth directory
routing:
  strategy: "round-robin"   # round-robin | fill-first
request-retry: 3            # Max retries
max-retry-interval: 30      # Max retry wait (seconds)
```

## API Endpoints

```
# Chat Completions
POST /v1/chat/completions

# Models List
GET /v1/models

# Management API
GET  /v0/management/auth
POST /v0/management/auth
GET  /v0/management/models
PUT  /v0/management/config

# WebSocket (AI Studio)
WS /v1/ws
```

## Testing

Test files in `/test/`:
- `amp_management_test.go` - Amp CLI integration tests
- `config_migration_test.go` - Config validation tests
- `thinking_conversion_test.go` - Format conversion tests
- More...

Run tests:
```bash
go test ./test/...
```

## Development

### Create Custom Provider

1. Implement `cliproxyexecutor.Executor` interface
2. Register via `manager.RegisterExecutor(executor)`
3. Add models in `OnAfterStart` hook
4. Register translators if needed

### Create Custom Translator

```go
sdktr.Register(
    sourceFormat, targetFormat,
    requestTransformer,
    responseTransformer,
)
```

### Create Custom Token Store

1. Implement `coreauth.Store` interface
2. Register via builder's token provider

## Troubleshooting

**Enable Debug Logging:**
```yaml
debug: true
logging-to-file: true
```

**Check Auth Status:**
```bash
curl http://localhost:8317/v0/management/auth \
  -H "Authorization: Bearer <password>"
```

**View Available Models:**
```bash
curl http://localhost:8317/v1/models
```

## Deployment

### Standalone
```bash
./cli-proxy-api -config /path/to/config.yaml
```

### Cloud Mode
```bash
DEPLOY=cloud ./cli-proxy-api
# Configure via Management API
```

### Embedded
```go
// Use SDK directly in your Go application
svc := cliproxy.NewBuilder().WithConfig(cfg).Build()
svc.Run(ctx)
```

### Storage Backends

**PostgreSQL:**
```bash
PGSTORE_DSN="postgres://user:pass@localhost/dbname"
```

**Git:**
```bash
GITSTORE_GIT_URL="https://github.com/user/repo"
```

**S3/MinIO:**
```bash
OBJECTSTORE_ENDPOINT="s3.amazonaws.com"
```

---

## Quick Reference

**Key Files to Review:**
1. `cmd/server/main.go` - Entry point & configuration loading
2. `sdk/cliproxy/service.go` - Service lifecycle & HTTP server
3. `sdk/cliproxy/auth/conductor.go` - Auth selection & execution
4. `examples/custom-provider/main.go` - How to create custom executor
5. `test/` - Testing patterns

**Key Concepts:**
- Builder Pattern - Service construction
- Service Lifecycle - Run, shutdown, hooks
- Auth State Machine - Account status management
- Executor Registry - Provider routing
- Translator Pipeline - Format conversion
- File Watcher - Dynamic config reloading
- Token Store - Credential persistence

**Performance Features:**
- Round-robin/fill-first load balancing
- Quota management with exponential backoff
- Connection pooling & reuse
- Streaming response support
- Commercial mode for high concurrency
- Optional usage statistics

---

Generated: 2025-01-03
CLIProxyAPI Version: v6
Language: Go 1.24.0
