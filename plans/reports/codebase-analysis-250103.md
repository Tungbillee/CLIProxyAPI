# Báo Cáo Phân Tích CLIProxyAPI - 03/01/2025

## Tóm Tắt Dự Án

CLIProxyAPI là một proxy server hoàn chỉnh cấp production cho phép sử dụng nhiều tài khoản CLI (Google Gemini, Claude, OpenAI Codex, Qwen, iFlow, Antigravity) thông qua các API endpoint tương thích với OpenAI/Gemini/Claude.

**Phiên bản**: v6  
**Ngôn ngữ**: Go 1.24.0  
**Kiến trúc**: Microservices dựa trên SDK có thể nhúng (Embeddable SDK)

---

## 1. SERVER STARTUP & ARCHITECTURE (cmd/server/main.go)

### 1.1 Entry Point & Initialization

**File**: `/cmd/server/main.go` (480 dòng)

#### Quy trình khởi động chính:

```
1. Load environment variables từ .env file
2. Parse command-line flags
3. Khởi tạo token storage (Postgres/Git/Object Store hoặc File-based)
4. Load configuration từ file YAML
5. Đăng ký providers và token stores
6. Xử lý các chế độ login (OAuth hoặc server mode)
7. Khởi động service proxy
```

#### Command-line Flags:

| Flag | Mục Đích | Mô Tả |
|------|----------|-------|
| `-login` | Google/Gemini OAuth | Đăng nhập tài khoản Google |
| `-codex-login` | OpenAI OAuth | Đăng nhập OpenAI Codex |
| `-claude-login` | Claude OAuth | Đăng nhập Anthropic Claude |
| `-qwen-login` | Qwen OAuth | Đăng nhập Alibaba Qwen |
| `-iflow-login` | iFlow OAuth | Đăng nhập iFlow |
| `-iflow-cookie` | iFlow Cookie Auth | Xác thực cookie iFlow |
| `-antigravity-login` | Antigravity OAuth | Đăng nhập Antigravity |
| `-no-browser` | No Browser Auto-Open | Không tự động mở trình duyệt |
| `-project_id` | Gemini Project ID | ID dự án Gemini (tùy chọn) |
| `-config` | Config File Path | Đường dẫn file cấu hình |
| `-vertex-import` | Vertex SA Import | Import Vertex service account JSON |
| `-password` | Management Password | Mật khẩu quản lý |

#### Token Storage Options:

Ưu tiên lưu trữ (từ cao đến thấp):
1. **Postgres Store** (PGSTORE_DSN) - lưu trữ trên database PostgreSQL
2. **Object Store** (OBJECTSTORE_ENDPOINT) - lưu trữ S3/MinIO
3. **Git Store** (GITSTORE_GIT_URL) - lưu trữ trên Git repository
4. **File Store** (Mặc định) - lưu trữ trên hệ thống tệp (~/.cli-proxy-api)

#### Cloud Deploy Mode:

- Kích hoạt khi `DEPLOY=cloud`
- Server chờ cấu hình hợp lệ mà không khởi động API
- Cho phép cấu hình động thông qua Management API

### 1.2 Configuration Loading

**Config File**: `config.yaml`

```yaml
# Server binding
host: ""           # Bind tất cả interfaces (0.0.0.0)
port: 8317

# TLS
tls:
  enable: false
  cert: ""
  key: ""

# Management API
remote-management:
  allow-remote: false       # Chỉ localhost
  secret-key: ""           # Bắt buộc cho /v0/management

# Authentication
auth-dir: "~/.cli-proxy-api"  # Thư mục lưu token
api-keys: []                  # API keys để xác thực requests

# Behavior
debug: false
commercial-mode: false        # Performance optimization
logging-to-file: false
request-retry: 3
max-retry-interval: 30

# Routing strategy
routing:
  strategy: "round-robin"     # hoặc "fill-first"

# Advanced
ws-auth: false               # WebSocket authentication
quota-exceeded:
  switch-project: true
  switch-preview-model: true
```

---

## 2. SDK STRUCTURE & USAGE

### 2.1 Core SDK Architecture

**Thư mục**: `/sdk/` - Chứa embeddable SDK cho phép nhúng proxy vào ứng dụng khác

#### Cấu trúc SDK:

```
sdk/
├── cliproxy/              # Core service implementation
│   ├── builder.go         # Builder pattern for service creation
│   ├── service.go         # Service lifecycle & HTTP server management
│   ├── providers.go       # Provider registry
│   ├── auth/              # Core authentication management
│   │   ├── conductor.go   # Execution orchestration
│   │   ├── manager.go     # Auth state management
│   │   ├── selector.go    # Account selection strategies
│   │   ├── store.go       # Persistence layer
│   │   └── types.go       # Data types
│   ├── executor/          # Request execution
│   └── usage/             # Usage tracking
├── auth/                  # Legacy authentication providers
│   ├── gemini.go
│   ├── claude.go
│   ├── codex.go
│   ├── qwen.go
│   ├── iflow.go
│   ├── antigravity.go
│   ├── manager.go
│   └── filestore.go
├── api/                   # HTTP handlers
│   ├── handlers/          # Request/response handlers
│   ├── management.go      # Management API
│   └── options.go
├── access/                # Request authentication providers
│   ├── manager.go
│   ├── registry.go
│   └── errors.go
├── translator/            # Request/response format translation
│   ├── format.go
│   ├── registry.go
│   ├── pipeline.go
│   ├── builtin/           # Built-in translators
│   └── types.go
├── config/
│   └── config.go
└── logging/
    └── request_logger.go
```

### 2.2 Service Builder Pattern

**File**: `/sdk/cliproxy/builder.go` (234 dòng)

Sử dụng builder pattern fluent API để khởi tạo service:

```go
service, err := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithConfigPath("config.yaml").
    WithTokenClientProvider(customProvider).
    WithAPIKeyClientProvider(customAPIKeyProvider).
    WithCoreAuthManager(authMgr).
    WithHooks(cliproxy.Hooks{
        OnBeforeStart: func(cfg *config.Config) {
            // Pre-startup initialization
        },
        OnAfterStart: func(s *cliproxy.Service) {
            // Post-startup operations
        },
    }).
    WithServerOptions(
        api.WithLocalManagementPassword("secret"),
        api.WithMiddleware(customMiddleware),
    ).
    Build()

if err := service.Run(ctx); err != nil {
    log.Fatal(err)
}
```

#### Builder Methods:

| Method | Mục Đích |
|--------|----------|
| `WithConfig()` | Đặt cấu hình ứng dụng |
| `WithConfigPath()` | Đặt đường dẫn file cấu hình (bắt buộc) |
| `WithTokenClientProvider()` | Tùy chỉnh provider token clients |
| `WithAPIKeyClientProvider()` | Tùy chỉnh provider API key clients |
| `WithWatcherFactory()` | Tùy chỉnh file watcher |
| `WithHooks()` | Đăng ký lifecycle hooks |
| `WithAuthManager()` | Tùy chỉnh auth manager |
| `WithRequestAccessManager()` | Tùy chỉnh request access provider |
| `WithCoreAuthManager()` | Tùy chỉnh core auth execution manager |
| `WithServerOptions()` | Thêm HTTP server options |
| `WithLocalManagementPassword()` | Đặt mật khẩu quản lý localhost |

### 2.3 Service Lifecycle

**File**: `/sdk/cliproxy/service.go` (1285 dòng)

#### Service Structure:

```go
type Service struct {
    cfg              *config.Config      // Current configuration
    cfgMu            sync.RWMutex        // Configuration read/write lock
    configPath       string              // Config file path
    tokenProvider    TokenClientProvider
    apiKeyProvider   APIKeyClientProvider
    watcherFactory   WatcherFactory
    hooks            Hooks
    serverOptions    []api.ServerOption
    server           *api.Server         // HTTP server instance
    serverErr        chan error
    watcher          *WatcherWrapper     // File system monitor
    authUpdates      chan watcher.AuthUpdate
    authManager      *sdkAuth.Manager    // Legacy auth operations
    accessManager    *sdkaccess.Manager
    coreManager      *coreauth.Manager   // Core auth & execution
    wsGateway        *wsrelay.Manager    // WebSocket support
    shutdownOnce     sync.Once
}
```

#### Run() Method Lifecycle:

```
1. Initialize usage tracking
2. Ensure auth directory exists
3. Load token & API key clients
4. Create HTTP server
5. Setup WebSocket gateway
6. Call OnBeforeStart hook
7. Start HTTP server (background goroutine)
8. Call OnAfterStart hook
9. Start file watcher for config changes
10. Start auth auto-refresh (15 min interval)
11. Block until context cancelled or server error
12. Call Shutdown() on exit
```

#### Key Features:

**File Watching**: Monitors `config.yaml` and auth directory for changes
- Auto-reloads config without server restart
- Updates routing strategy, retry config, executor bindings
- Processes auth file add/modify/delete events

**Authentication Handling**:
- Manages multiple provider credentials (Gemini, Claude, OpenAI, etc.)
- Round-robin or fill-first selection strategy
- Auto-refresh tokens on schedule (15 min)
- Quota cooldown & intelligent retry logic

**Model Registry**:
- Registers available models per authentication
- Supports model mapping & prefix aliasing
- OAuth-specific model exclusion rules

### 2.4 Core Authentication Manager

**File**: `/sdk/cliproxy/auth/conductor.go`

Orchestrates request execution across multiple providers:

```go
type Manager struct {
    // Manages auth selection & persistence
    // Coordinates with provider executors
    // Handles refresh scheduling
    // Tracks execution results
}

// Selection Strategies:
// 1. RoundRobinSelector - distributes requests evenly
// 2. FillFirstSelector  - fills first account before switching
```

#### Auth State Machine:

```
StatusActive
├─ Normal operation
├─ Can execute requests
└─ Subject to refresh scheduling

StatusDisabled
├─ Account disabled/removed
└─ No requests routed

StatusRefreshPending
├─ Waiting to refresh credentials
└─ Backoff: 1 minute

StatusRefreshFailed
├─ Refresh attempt failed
└─ Backoff: 5 minutes

StatusQuotaExceeded
├─ Hit quota limit
└─ Backoff: exponential (1s - 30min)
```

---

## 3. SDK IMPLEMENTATION DETAILS

### 3.1 Authentication Providers

**SDK Auth Files**: `/sdk/auth/` - Hỗ trợ OAuth login cho các providers

#### Supported Providers:

1. **Gemini** (`gemini.go`)
   - OAuth login flow
   - Service account support
   - Project-based key management

2. **Claude** (`claude.go`)
   - OAuth via Anthropic
   - Token-based auth

3. **Codex** (`codex.go`)
   - OpenAI OAuth
   - API key support

4. **Qwen** (`qwen.go`)
   - Alibaba Qwen OAuth

5. **iFlow** (`iflow.go`)
   - Cookie & OAuth support

6. **Antigravity** (`antigravity.go`)
   - OAuth authentication

#### Token Store Hierarchy:

```go
type TokenStore interface {
    Save(ctx context.Context, auth *coreauth.Auth) (string, error)
    Load(ctx context.Context) ([]*coreauth.Auth, error)
    Delete(ctx context.Context, id string) error
    // + SetBaseDir() optional
}

// Implementations:
// 1. FileTokenStore   - ~/.cli-proxy-api/auths/*.json
// 2. PostgresStore    - PostgreSQL database
// 3. GitTokenStore    - Git repository
// 4. ObjectTokenStore - S3/MinIO bucket
```

### 3.2 Request/Response Translator

**Files**: `/sdk/translator/` - Format translation pipeline

#### Supported Formats:

```
openai.chat      <- OpenAI format
gemini.chat      <- Google Gemini format
claude.chat      <- Anthropic Claude format
codex.chat       <- OpenAI Codex format
qwen.chat        <- Alibaba Qwen format
iflow.chat       <- iFlow format
antigravity.chat <- Antigravity format
```

#### Translation Pipeline:

```
Client Request (OpenAI format)
    ↓
[Request Translator]
    ↓
Provider-specific format
    ↓
[Execute via Provider]
    ↓
Provider Response
    ↓
[Response Translator]
    ↓
OpenAI format response
    ↓
Client Response
```

#### Register Custom Translator:

```go
import sdktr "github.com/router-for-me/CLIProxyAPI/v6/sdk/translator"

sdktr.Register(
    sdktr.Format("myformat.chat"),
    sdktr.Format("openai.chat"),
    // Request transformer
    func(model string, raw []byte, stream bool) []byte {
        return transformRequest(raw)
    },
    // Response transformer
    sdktr.ResponseTransform{
        Stream: func(ctx context.Context, model, origReq, transReq, raw []byte, param *any) []string {
            return streamTransform(raw)
        },
        NonStream: func(ctx context.Context, model, origReq, transReq, raw []byte, param *any) string {
            return nonStreamTransform(raw)
        },
    },
)
```

### 3.3 Request Access Providers

**Files**: `/sdk/access/` - Xác thực yêu cầu (API keys, OAuth tokens)

```go
type Provider interface {
    Match(req *http.Request) bool           // Check if this provider handles request
    IsAuthorized(req *http.Request) bool    // Validate authorization
    GetClientID(req *http.Request) string   // Extract client identifier
    OnUnauthorized(w http.ResponseWriter)   // Handle auth failure
}
```

#### Built-in Providers:

1. **API Key Provider** - `Authorization: Bearer <key>`
2. **Custom Providers** - Extensible via config

---

## 4. TESTING PATTERNS

### 4.1 Test Files Overview

**Location**: `/test/`

| File | Mục Đích | Mô Tả |
|------|----------|-------|
| `amp_management_test.go` | Amp CLI Management API | Kiểm tra endpoints quản lý Amp |
| `config_migration_test.go` | Config migration | Kiểm tra nâng cấp config |
| `gemini3_thinking_level_test.go` | Gemini 3 thinking | Kiểm tra deepseek thinking levels |
| `model_alias_thinking_suffix_test.go` | Model aliasing | Kiểm tra suffix aliasing |
| `thinking_conversion_test.go` | Thinking format conversion | Kiểm tra conversion between formats |

### 4.2 Test Pattern Analysis

**Amp Management Test** (`amp_management_test.go`):

```go
// Test setup pattern
func newAmpTestHandler(t *testing.T) (*management.Handler, string) {
    tmpDir := t.TempDir()           // Use temp directory
    cfg := &config.Config{ ... }    // Create test config
    h := management.NewHandler(cfg, configPath, nil)
    return h, configPath
}

// Router setup
func setupAmpRouter(h *management.Handler) *gin.Engine {
    r := gin.New()
    mgmt := r.Group("/v0/management")
    // Register handlers
    return r
}

// Test method pattern
func TestGetAmpCode(t *testing.T) {
    h, _ := newAmpTestHandler(t)
    r := setupAmpRouter(h)
    
    req := httptest.NewRequest(http.MethodGet, "/v0/management/ampcode", nil)
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    
    // Assert response
    if w.Code != http.StatusOK {
        t.Fatalf("expected %d, got %d", http.StatusOK, w.Code)
    }
}
```

#### Test Coverage Areas:

- **Handler Testing**: Unit tests for HTTP handlers
- **Config Testing**: Migration & parsing validation
- **Model Translation**: Format conversion verification
- **Integration**: Multi-component workflow testing

#### Testing Tools:

- `testing` package - Standard Go testing
- `httptest` - HTTP request/response testing
- `testify/assert` - Assertions (if used)
- Gin TestMode - Lightweight router testing

---

## 5. EXAMPLE USE CASES

### 5.1 Custom Provider Example

**File**: `/examples/custom-provider/main.go` (208 dòng)

Demonstrates creating a custom AI provider executor:

```go
// Step 1: Implement Executor interface
type MyExecutor struct{}

func (MyExecutor) Identifier() string { return "myprov" }

func (MyExecutor) PrepareRequest(req *http.Request, a *coreauth.Auth) error {
    if ak := a.Attributes["api_key"]; ak != "" {
        req.Header.Set("Authorization", "Bearer "+ak)
    }
    return nil
}

func (MyExecutor) Execute(ctx context.Context, a *coreauth.Auth, 
    req clipexec.Request, opts clipexec.Options) (clipexec.Response, error) {
    // Implement request execution
    client := buildHTTPClient(a)
    endpoint := upstreamEndpoint(a)
    
    httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, ...)
    resp, _ := client.Do(httpReq)
    body, _ := io.ReadAll(resp.Body)
    return clipexec.Response{Payload: body}, nil
}

func (MyExecutor) ExecuteStream(...) (<-chan clipexec.StreamChunk, error) {
    // Implement streaming
}

func (MyExecutor) Refresh(...) (*coreauth.Auth, error) {
    // Implement token refresh
    return a, nil
}

// Step 2: Register custom translator
func init() {
    sdktr.Register(
        sdktr.Format("openai.chat"),
        sdktr.Format("myprov.chat"),
        requestTransformer,
        responseTransformer,
    )
}

// Step 3: Build & run service
func main() {
    cfg, _ := config.LoadConfig("config.yaml")
    core := coreauth.NewManager(tokenStore, nil, nil)
    core.RegisterExecutor(MyExecutor{})
    
    hooks := cliproxy.Hooks{
        OnAfterStart: func(s *cliproxy.Service) {
            // Register custom models
            models := []*cliproxy.ModelInfo{{
                ID: "myprov-pro-1",
                Object: "model",
                Type: "myprov",
                DisplayName: "MyProv Pro 1",
            }}
            cliproxy.GlobalModelRegistry().RegisterClient(authID, "myprov", models)
        },
    }
    
    svc, _ := cliproxy.NewBuilder().
        WithConfig(cfg).
        WithConfigPath("config.yaml").
        WithCoreAuthManager(core).
        WithHooks(hooks).
        Build()
    
    svc.Run(context.Background())
}
```

### 5.2 Translator Example

**File**: `/examples/translator/main.go` (43 dòng)

Demonstrates request/response translation:

```go
func main() {
    // Check if translator exists
    has := translator.HasResponseTransformerByFormatName(
        translator.FormatGemini,
        translator.FormatOpenAI,
    )
    fmt.Println("Has gemini->openai:", has)
    
    // Translate OpenAI request to Gemini format
    rawRequest := []byte(`{...}`)
    translatedRequest := translator.TranslateRequestByFormatName(
        translator.FormatOpenAI,
        translator.FormatGemini,
        "gemini-2.5-pro",
        rawRequest,
        false,
    )
    
    // Translate Gemini response back to OpenAI format
    geminiResponse := []byte(`{...}`)
    convertedResponse := translator.TranslateNonStreamByFormatName(
        context.Background(),
        translator.FormatGemini,
        translator.FormatOpenAI,
        "gemini-2.5-pro",
        rawRequest,
        translatedRequest,
        geminiResponse,
        nil,
    )
}
```

---

## 6. ADVANCED FEATURES

### 6.1 Model Registry & Mapping

**Features**:

```
1. Dynamic Model Registration
   - Per-auth model availability
   - OAuth-specific exclusion rules
   - Model prefix aliasing

2. Model Mapping
   - Alias one model name to another
   - OAuth-specific model substitution
   - Wildcard pattern matching

3. Thinking Model Support
   - Detect "thinking" capability per model
   - Gemini 3 deepseek thinking levels
   - Automatic level mapping

Example config:
oauth-model-mappings:
  "claude|oauth": 
    - name: "claude-opus-4"
      alias: "claude-opus-4.5"    # Map to alternative model
```

### 6.2 Configuration Reload

**Zero-Downtime Reloads**:

- File watcher monitors `config.yaml` & auth directory
- Config changes reload without server restart
- Auth file changes apply immediately (within 256-event buffer)
- Routing strategy switch reapplies auth selection logic

### 6.3 Provider Executor System

**Architecture**:

```
Request → [Core Auth Manager] 
           ↓
         [Select Auth Account using Strategy]
           ↓
         [Get Executor for Provider Type]
           ↓
         [Request Translator]
           ↓
         [Execute with HTTP Client]
           ↓
         [Response Translator]
           ↓
         Response
```

#### Executor Types:

1. **GeminiExecutor** - Google Gemini API
2. **GeminiVertexExecutor** - Google Vertex AI
3. **GeminiCLIExecutor** - Gemini CLI
4. **ClaudeExecutor** - Anthropic Claude API
5. **CodexExecutor** - OpenAI Codex
6. **QwenExecutor** - Alibaba Qwen
7. **IFlowExecutor** - iFlow provider
8. **AntigravityExecutor** - Antigravity provider
9. **AIStudioExecutor** - Google AI Studio (WebSocket)
10. **OpenAICompatExecutor** - Generic OpenAI-compatible

### 6.4 Quota Management

**Automatic Quota Handling**:

```
If quota exceeded:
  1. Mark auth as StatusQuotaExceeded
  2. Apply exponential backoff cooldown
  3. If config allows: switch to next account
  4. If config allows: try preview/test model

Backoff Schedule:
- Base: 1 second
- Max: 30 minutes
- Exponential growth per retry
```

### 6.5 Request Retry Logic

**Intelligent Retry**:

```
Retry on HTTP status: 403, 408, 500, 502, 503, 504

Conditions:
- Max retries: configurable (default: 3)
- Max interval: configurable (default: 30s)
- Respects provider's Retry-After header
- Switches account if available

Round-robin retry ensures fairness across accounts.
```

---

## 7. DEPLOYMENT OPTIONS

### 7.1 Deployment Modes

**Standalone Server**:
```bash
./cli-proxy-api -config /path/to/config.yaml
```

**Cloud Deploy Mode**:
```bash
DEPLOY=cloud ./cli-proxy-api
# Server waits for config via Management API
```

**Embedded in Go Application**:
```go
import "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"

svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithConfigPath(configPath).
    Build()
    
svc.Run(ctx)
```

### 7.2 Storage Backends

**1. File Storage (Default)**:
```
~/.cli-proxy-api/
├── auths/
│   ├── {uuid}-gemini.json
│   ├── {uuid}-claude.json
│   └── ...
└── config.yaml
```

**2. PostgreSQL**:
```bash
PGSTORE_DSN="user=... password=... host=... port=..."
PGSTORE_SCHEMA="clipproxy"
```

**3. Git Repository**:
```bash
GITSTORE_GIT_URL="https://github.com/user/repo"
GITSTORE_GIT_USERNAME="..."
GITSTORE_GIT_TOKEN="..."
```

**4. S3/MinIO Object Store**:
```bash
OBJECTSTORE_ENDPOINT="s3.amazonaws.com"
OBJECTSTORE_ACCESS_KEY="..."
OBJECTSTORE_SECRET_KEY="..."
OBJECTSTORE_BUCKET="my-bucket"
```

---

## 8. API ENDPOINTS

### 8.1 Chat Completion Endpoints

```
POST /v1/chat/completions           # OpenAI format
POST /api/provider/{provider}/v1/... # Amp CLI routing
```

### 8.2 Management Endpoints

```
GET  /v0/management/auth              # List auth accounts
POST /v0/management/auth              # Add auth
GET  /v0/management/models            # List available models
PUT  /v0/management/config            # Update config
GET  /v0/management/ampcode           # Get Amp config
```

### 8.3 WebSocket Endpoint

```
WS /v1/ws                             # WebSocket proxy (AI Studio)
```

---

## 9. PERFORMANCE & SCALABILITY

### 9.1 Commercial Mode

**Enable for High Concurrency**:
```yaml
commercial-mode: true  # Disables high-overhead middleware
```

Benefits:
- Reduced per-request memory allocation
- Optimized for servers >1000 concurrent connections
- Trade-off: some features like detailed request logging disabled

### 9.2 Concurrent Request Handling

**Architecture**:
- Each request handled in separate goroutine
- Auth selection via RWMutex (fast reads)
- Token store accessed concurrently
- Model registry is thread-safe

### 9.3 Usage Statistics

**Optional Feature**:
```yaml
usage-statistics-enabled: true  # Track API usage & tokens
```

Plugins support custom aggregation & reporting.

---

## 10. DEVELOPMENT & INTEGRATION

### 10.1 SDK Dependencies

Key Go modules:
```
github.com/gin-gonic/gin           - HTTP framework
github.com/jackc/pgx/v5            - PostgreSQL driver
github.com/minio/minio-go/v7        - S3 client
github.com/go-git/go-git/v6         - Git operations
github.com/gorilla/websocket        - WebSocket support
github.com/sirupsen/logrus          - Logging
github.com/tidwall/gjson            - JSON parsing
golang.org/x/oauth2                 - OAuth implementation
```

### 10.2 Extending the SDK

**Steps to Create Custom Provider**:

1. Implement `cliproxyexecutor.Executor` interface
2. Register via `manager.RegisterExecutor(executor)`
3. Create request/response translators (optional)
4. Register in `OnAfterStart` hook
5. Add models to global registry

**Steps to Create Custom Access Provider**:

1. Implement `sdkaccess.Provider` interface
2. Register via `accessManager.SetProviders([]Provider{...})`
3. Define authentication logic in `IsAuthorized()`

**Steps to Create Custom Token Store**:

1. Implement `coreauth.Store` interface
2. Register via builder's token store provider
3. Support async load/save operations

---

## 11. TROUBLESHOOTING & DEBUGGING

### 11.1 Logging Configuration

```yaml
debug: true                    # Enable debug logs
logging-to-file: true          # Write to rotating files
logs-max-total-size-mb: 100    # Max total log size
```

Log format:
```
[LEVEL] [package] message
INFO  [cliproxy] API server started on: 127.0.0.1:8317
DEBUG [auth.conductor] picking auth: account-id, strategy=round-robin
WARN  [watcher] failed to reload config: invalid YAML
ERROR [service] execution failed: quota exceeded
```

### 11.2 Common Issues

**Issue: Token refresh failures**
- Check auth credentials validity
- Verify OAuth credentials haven't expired
- Enable debug logging for detailed error messages

**Issue: Model unavailable**
- Check auth account has access to model
- Verify OAuth-specific exclusion rules
- Check config model mappings

**Issue: Quota exceeded**
- Enable `switch-project: true` in config for auto-switching
- Check account quota limits on provider platform
- Monitor usage via Management API

---

## 12. SECURITY CONSIDERATIONS

### 12.1 Authentication

- **Management API**: Requires secret key (hashed on startup)
- **Remote Access**: Disabled by default (localhost only)
- **API Keys**: Support for client authentication

### 12.1 Token Security

- **File Storage**: Tokens stored in `~/.cli-proxy-api/auths/` (user-readable)
- **Postgres**: Encrypted at database level (recommended)
- **Git**: Requires authentication to access repo
- **S3**: Uses access/secret keys (rotatable)

### 12.3 HTTPS Support

```yaml
tls:
  enable: true
  cert: "/path/to/cert.pem"
  key: "/path/to/key.pem"
```

---

## SUMMARY TABLE

| Khía Cạnh | Chi Tiết |
|-----------|----------|
| **Entry Point** | `cmd/server/main.go` - Command-line interface + server startup |
| **Core Service** | `sdk/cliproxy/service.go` - Service lifecycle & HTTP server management |
| **Auth Management** | `sdk/cliproxy/auth/conductor.go` - Account selection & execution |
| **Token Persistence** | `sdk/auth/filestore.go` + PostgreSQL/Git/S3 backends |
| **Request Translation** | `sdk/translator/` - Format conversion (OpenAI ↔ Provider formats) |
| **Provider Executors** | `internal/runtime/executor/` - Provider-specific implementations |
| **Testing** | `test/` - Unit & integration tests for core features |
| **Examples** | `examples/` - Custom provider & translator demonstrations |
| **Configuration** | `config.yaml` - YAML-based configuration with hot-reload |
| **WebSocket Support** | `internal/wsrelay/` - AI Studio WebSocket streaming |
| **Management API** | `/v0/management/*` - REST API for runtime configuration |
| **Deployment** | Standalone, Cloud, or Embedded SDK |

---

## UNRESOLVED QUESTIONS

1. **Internal Implementation Details**:
   - Detailed description of how each provider executor (Gemini, Claude, etc.) works internally would help understand execution flow
   - Specific details on how thinking model detection and level mapping is implemented

2. **Performance Benchmarks**:
   - No available performance metrics for request throughput under different load
   - Memory consumption patterns not documented

3. **Security Audit**:
   - Token encryption at rest not documented
   - OAuth state validation details not covered

4. **Migration Path**:
   - From v5 to v6 - breaking changes not detailed
   - Config schema evolution strategy unclear
