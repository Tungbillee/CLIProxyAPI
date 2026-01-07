# Báo Cáo Phân Tích Chi Tiết CLI Proxy API

**Ngày tạo:** 2026-01-03  
**Project:** CLIProxyAPI v6  
**Mục đích:** Phân tích cấu hình, deployment architecture, dependencies và hướng dẫn sử dụng

---

## 1. Tổng Quan Dự Án

### 1.1 Mục Đích Chính
CLIProxyAPI là một máy chủ proxy cung cấp các giao diện API tương thích với OpenAI/Gemini/Claude/Codex cho các công cụ CLI. Cho phép người dùng sử dụng OAuth hoặc API key để truy cập các mô hình AI thông qua API tương thích.

### 1.2 Tính Năng Chính
- **Hỗ trợ đa nhà cung cấp**: OpenAI, Gemini, Claude, Codex, Qwen, iFlow
- **OAuth integration**: Hỗ trợ đăng nhập OAuth cho Claude Code, Codex, Qwen Code, iFlow
- **Cân bằng tải**: Round-robin load balancing cho tài khoản đa với failover tự động
- **Streaming**: Hỗ trợ SSE (Server-Sent Events) streaming và non-streaming responses
- **Function calling**: Hỗ trợ tools/function calling
- **Multimodal**: Hỗ trợ văn bản và hình ảnh
- **Amp CLI integration**: Hỗ trợ tích hợp Amp CLI và IDE extensions
- **SDK embedded**: Thư viện Go SDK để nhúng proxy vào ứng dụng khác
- **Management API**: API quản lý đầy đủ với control panel web

---

## 2. Phân Tích Configuration Files

### 2.1 config.example.yaml - File Cấu Hình Chính

#### 2.1.1 Cấu Hình Server
```yaml
host: ""                    # Giao diện bind (mặc định: tất cả interfaces)
                           # Sử dụng "127.0.0.1" để chỉ localhost
port: 8317                 # Cổng server (mặc định: 8317)

tls:
  enable: false            # HTTPS/TLS
  cert: ""                 # Đường dẫn certificate
  key: ""                  # Đường dẫn private key
```

#### 2.1.2 Cấu Hình Management API
```yaml
remote-management:
  allow-remote: false      # Cho phép truy cập từ xa (default: false)
  secret-key: ""          # API key để xác thực management endpoints
  disable-control-panel: false  # Vô hiệu hóa control panel web
  panel-github-repository: "https://github.com/router-for-me/Cli-Proxy-API-Management-Center"
                           # GitHub repo cho control panel
```

#### 2.1.3 Xác Thực & API Keys
```yaml
auth-dir: "~/.cli-proxy-api"    # Thư mục lưu trữ auth credentials
                                 # Hỗ trợ ~ cho home directory

api-keys:
  - "your-api-key-1"
  - "your-api-key-2"
  - "your-api-key-3"
```

#### 2.1.4 Logging & Performance
```yaml
debug: false                      # Debug logging
commercial-mode: false            # Giảm memory overhead
logging-to-file: false           # Ghi logs vào file thay stdout
logs-max-total-size-mb: 0        # Giới hạn tổng size logs (0 = vô hạn)
usage-statistics-enabled: false  # Thống kê sử dụng
```

#### 2.1.5 Network & Retry
```yaml
proxy-url: ""                    # Global proxy (socks5/http/https)
                                 # Ví dụ: socks5://user:pass@192.168.1.1:1080/
request-retry: 3                 # Số lần retry (403, 408, 500, 502, 503, 504)
max-retry-interval: 30          # Thời gian chờ tối đa (giây)
force-model-prefix: false       # Yêu cầu prefix khi request model
```

#### 2.1.6 Quota & Routing
```yaml
quota-exceeded:
  switch-project: true           # Tự động chuyển project khi quota hết
  switch-preview-model: true     # Tự động chuyển preview model

routing:
  strategy: "round-robin"        # Chiến lược: round-robin hoặc fill-first

ws-auth: false                   # Xác thực cho WebSocket API (/v1/ws)
```

#### 2.1.7 Gemini API Keys Configuration
```yaml
gemini-api-key:
  - api-key: "AIzaSy...01"
    prefix: "test"               # Optional: "test/gemini-3-pro-preview"
    base-url: "https://generativelanguage.googleapis.com"
    headers:
      X-Custom-Header: "custom-value"
    proxy-url: "socks5://proxy.example.com:1080"
    models:
      - name: "gemini-2.5-flash"
        alias: "gemini-flash"    # Alias mapping
    excluded-models:             # Exclude models (support wildcards)
      - "gemini-2.5-pro"
      - "gemini-2.5-*"
      - "*-preview"
      - "*flash*"
```

#### 2.1.8 OpenAI-Compatible Providers (Codex, Claude, etc.)
- **codex-api-key**: GPT models via OpenAI API
- **claude-api-key**: Claude models (official API)
- **openai-compatibility**: Thêm providers tương thích OpenAI (OpenRouter, etc.)
- **vertex-api-key**: Vertex AI endpoints

#### 2.1.9 Amp CLI Integration
```yaml
ampcode:
  upstream-url: "https://ampcode.com"
  upstream-api-key: ""          # Amp upstream API key
  upstream-api-keys:            # Per-client API key mapping
    - upstream-api-key: "amp_key_for_team_a"
      api-keys:
        - "your-api-key-1"
  model-mappings:               # Route unavailable models
    - from: "claude-opus-4-5-20251101"
      to: "gemini-claude-opus-4-5-thinking"
```

#### 2.1.10 OAuth Model Mappings
```yaml
oauth-model-mappings:
  gemini-cli:
    - name: "gemini-2.5-pro"
      alias: "g2.5p"
  claude:
    - name: "claude-sonnet-4-5-20250929"
      alias: "cs4.5"
```

#### 2.1.11 Payload Configuration
```yaml
payload:
  default:                       # Set khi missing
    - models:
        - name: "gemini-2.5-pro"
          protocol: "gemini"
      params:
        "generationConfig.thinkingConfig.thinkingBudget": 32768
  override:                      # Always set (overwrite)
    - models:
        - name: "gpt-*"
          protocol: "codex"
      params:
        "reasoning.effort": "high"
```

### 2.2 .env.example - Environment Variables

**Chú ý:** Chỉ cần thiết khi sử dụng remote storage options.

```env
# Management Web UI
MANAGEMENT_PASSWORD=change-me-to-a-strong-password

# PostgreSQL Token Store (optional)
PGSTORE_DSN=postgresql://user:pass@localhost:5432/cliproxy
PGSTORE_SCHEMA=public
PGSTORE_LOCAL_PATH=/var/lib/cliproxy

# Git-Backed Config Store (optional)
GITSTORE_GIT_URL=https://github.com/your-org/cli-proxy-config.git
GITSTORE_GIT_USERNAME=git-user
GITSTORE_GIT_TOKEN=ghp_your_personal_access_token
GITSTORE_LOCAL_PATH=/data/cliproxy/gitstore

# Object Store Token Store (S3-compatible)
OBJECTSTORE_ENDPOINT=https://s3.your-cloud.example.com
OBJECTSTORE_BUCKET=cli-proxy-config
OBJECTSTORE_ACCESS_KEY=your_access_key
OBJECTSTORE_SECRET_KEY=your_secret_key
OBJECTSTORE_LOCAL_PATH=/data/cliproxy/objectstore
```

---

## 3. Docker Setup & Deployment

### 3.1 Dockerfile - Multi-Stage Build

**Base Image:** golang:1.24-alpine → alpine:3.22.0

**Build Process:**
1. **Stage 1 (Builder):**
   - Golang 1.24 Alpine image
   - Download Go dependencies (`go mod download`)
   - Build binary với version info:
     - `VERSION=${VERSION}` (từ git tag)
     - `COMMIT=${COMMIT}` (git commit hash)
     - `BUILD_DATE=${BUILD_DATE}` (build timestamp)
   - Output: `/app/CLIProxyAPI` (binary)

2. **Stage 2 (Runtime):**
   - Alpine 3.22.0 (minimal image)
   - Cài `tzdata` cho timezone support
   - Copy binary từ builder
   - Copy `config.example.yaml`
   - WorkDir: `/CLIProxyAPI`
   - Expose: Port 8317
   - Timezone: Asia/Shanghai

**Kích thước:** Sử dụng multi-stage giảm size image (chỉ binary + tzdata)

### 3.2 docker-compose.yml

**Services:**
- **cli-proxy-api**: Main service
  - Image: `eceasy/cli-proxy-api:latest` (có thể override với `CLI_PROXY_IMAGE`)
  - Build arguments: VERSION, COMMIT, BUILD_DATE
  - Container name: `cli-proxy-api`
  - Restart policy: `unless-stopped`

**Ports Exposed:**
```
8317:8317    # Main API port (default)
8085:8085    # Management API / Control Panel
1455:1455    # WebSocket/additional services
54545:54545  # Legacy/auxiliary
51121:51121  # Legacy/auxiliary
11451:11451  # Legacy/auxiliary
```

**Volumes:**
```
./config.yaml → /CLIProxyAPI/config.yaml       # Configuration file
./auths → /root/.cli-proxy-api                 # Auth credentials
./logs → /CLIProxyAPI/logs                     # Application logs
```

**Environment:**
```
DEPLOY=${DEPLOY:-}                             # Deploy environment variable
```

### 3.3 docker-build.sh - Linux/macOS Build Script

**Tính năng chính:**
1. **Tự động chọn mode:**
   - Option 1: Chạy với pre-built image (recommended)
   - Option 2: Build từ source (developers)

2. **Tính năng ẩn: `--with-usage`**
   - Preserve usage statistics across rebuilds
   - Đầu tiên prompt nhập management API key
   - Lưu vào `temp/stats/.api_secret`

3. **Build Info Injection:**
   - VERSION: `git describe --tags --always --dirty`
   - COMMIT: `git rev-parse --short HEAD`
   - BUILD_DATE: `date -u +%Y-%m-%dT%H:%M:%SZ`

4. **Smart Service Wait:**
   - Đợi port (lấy từ config.yaml) sẵn sàng
   - Retry 30 lần, 1 giây interval

**Usage:**
```bash
./docker-build.sh              # Normal mode
./docker-build.sh --with-usage # Với stats preservation
```

### 3.4 docker-build.ps1 - Windows PowerShell Script

**Tương tự shell script nhưng cho Windows:**
- PowerShell syntax
- Lấy version: `git describe --tags --always --dirty`
- Build timestamp: `Get-Date -UFormat "yyyy-MM-ddTHH:mm:ssZ"`
- `docker compose build` với BUILD_ARGs

---

## 4. Dependencies & Versions

### 4.1 Go Version
- **Go 1.24.0** (mô-đun)

### 4.2 Key Dependencies

#### Web Framework & Networking
- `github.com/gin-gonic/gin v1.10.1` - HTTP framework
- `github.com/gorilla/websocket v1.5.3` - WebSocket support

#### Configuration & File Management
- `gopkg.in/yaml.v3 v3.0.1` - YAML parsing
- `github.com/fsnotify/fsnotify v1.9.0` - File watching (hot reload)
- `github.com/joho/godotenv v1.5.1` - .env file loading

#### Database & Storage
- `github.com/jackc/pgx/v5 v5.7.6` - PostgreSQL driver
- `github.com/minio/minio-go/v7 v7.0.66` - S3-compatible object storage

#### Git Integration
- `github.com/go-git/go-git/v6 v6.0.0-20251009132922-75a182125145` - Git operations

#### Logging
- `github.com/sirupsen/logrus v1.9.3` - Structured logging
- `gopkg.in/natefinch/lumberjack.v2 v2.2.1` - Log rotation

#### OAuth & Crypto
- `golang.org/x/oauth2 v0.30.0` - OAuth2 client
- `golang.org/x/crypto v0.45.0` - Cryptography utilities

#### Text Processing & Utilities
- `github.com/tidwall/gjson v1.18.0` - JSON path parsing
- `github.com/tidwall/sjson v1.2.5` - JSON modification
- `github.com/tiktoken-go/tokenizer v0.7.0` - Token counting
- `github.com/google/uuid v1.6.0` - UUID generation
- `github.com/skratchdot/open-golang v0.0.0-20200116055534-eef842397966` - Open URLs/files

#### Compression
- `github.com/klauspost/compress v1.17.4` - Compression (gzip, brotli)
- `github.com/andybalholm/brotli v1.0.6` - Brotli compression

### 4.3 Summary of Dependencies
- **13 direct dependencies**
- **63 indirect dependencies**
- Total: **76 dependencies**
- Latest versions được sử dụng (stable releases)

---

## 5. SDK Documentation

### 5.1 SDK Usage (sdk/cliproxy)

**Purpose:** Embed CLIProxyAPI as reusable Go library

**Install:**
```bash
go get github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy
```

**Minimal Example:**
```go
cfg, _ := config.LoadConfig("config.yaml")
svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithConfigPath("config.yaml").
    Build()

ctx, _ := context.WithCancel(context.Background())
svc.Run(ctx)  // Hot reload & graceful shutdown
```

**Tính năng chính:**
- Config/auth watching (hot reload)
- Background token refresh
- Graceful shutdown
- Management API support
- Custom middleware/routes
- Custom auth managers

### 5.2 SDK Access (sdk/access)

**Purpose:** Authentication & access control

**Features:**
- Chain multiple credential providers
- Built-in `config-api-key` provider
- Support custom providers
- Multiple auth sources: `Authorization: Bearer`, `X-Goog-Api-Key`, `X-Api-Key`, `?key=`

**Usage:**
```go
manager := sdkaccess.NewManager()
providers, _ := sdkaccess.BuildProviders(cfg)
manager.SetProviders(providers)

result, err := manager.Authenticate(ctx, req)
```

### 5.3 SDK Advanced (Executors & Translators)

**Components:**
1. **Provider Executor** - Implement `auth.ProviderExecutor`
   - `Identifier()` - Provider key
   - `Execute()` - Non-streaming requests
   - `ExecuteStream()` - Streaming
   - `Refresh()` - Token refresh
   - `PrepareRequest()` - Inject credentials

2. **Translators** - Schema conversion
   - Request translation (client format → provider format)
   - Response translation (provider → client)
   - Support multiple formats: OpenAI, Gemini, Claude, Codex

3. **Model Registry** - Publish available models
   - Models appear in `/v1/models`
   - Per-provider, per-client

**Example:**
```go
type Executor struct{}
func (e Executor) Identifier() string { return "myprov" }
func (e Executor) Execute(ctx, auth, req, opts) Response { ... }
```

### 5.4 SDK Watcher

**Purpose:** Hot reload credentials & configuration

**Features:**
- Watch auth files for changes
- Watch config.yaml for changes
- Automatic provider refresh
- Zero-downtime updates

---

## 6. Getting Started - Installation & Usage

### 6.1 Quick Start

**Option 1: Pre-built Image (Recommended)**
```bash
./docker-build.sh
# Select: 1 (Pre-built Image)
```

**Option 2: Build from Source**
```bash
./docker-build.sh
# Select: 2 (Build from Source)
```

**Windows:**
```powershell
.\docker-build.ps1
```

### 6.2 Configuration Steps

1. **Copy config file:**
   ```bash
   cp config.example.yaml config.yaml
   ```

2. **Edit config.yaml:**
   - Đặt API keys hoặc OAuth credentials
   - Configure port (default: 8317)
   - Set auth-dir (default: ~/.cli-proxy-api)
   - Enable management API nếu cần

3. **Start service:**
   ```bash
   docker compose up -d
   ```

4. **Verify:**
   ```bash
   curl http://localhost:8317/v1/models
   ```

### 6.3 Management API Access

**URL:** http://localhost:8317/v0/management/

**Authentication:** Xác thực bằng X-Management-Key header

**Endpoints:**
- GET/PUT `/v0/management/request-log` - Toggle request logging
- GET/PUT `/v0/management/debug` - Toggle debug mode
- GET/POST `/v0/management/usage/export` - Export statistics
- POST `/v0/management/usage/import` - Import statistics

### 6.4 Amp CLI Integration

**Enable:**
```yaml
ampcode:
  upstream-url: "https://ampcode.com"
  upstream-api-key: "your-key"
```

**Features:**
- Provider route aliases: `/api/provider/{provider}/v1...`
- Model mapping: Map unavailable → available models
- OAuth management

### 6.5 Available Providers

| Provider | Protocol | Authentication |
|----------|----------|-----------------|
| OpenAI/Codex | OpenAI | API key / OAuth |
| Gemini | Gemini | API key / OAuth |
| Claude | Claude | API key |
| Qwen | Qwen | OAuth |
| iFlow | iFlow | OAuth |
| Custom (OpenRouter, etc.) | OpenAI-compatible | API key |

---

## 7. Key Features & Capabilities

### 7.1 Load Balancing & Failover
- **Round-robin** distribution
- **Fill-first** strategy option
- Automatic **quota-based switching**
- **Project switching** when quota exceeded
- **Preview model fallback**

### 7.2 Request Handling
- **Streaming** (SSE) with keep-alives
- **Non-streaming** responses
- **Function calling/Tools** support
- **Multimodal** (text + images)
- **Payload customization** (default + override rules)

### 7.3 Security
- API key authentication
- OAuth support
- Management API with secret key
- Per-credential proxy support
- Header injection control

### 7.4 Observability
- **Request logging** (optional, toggleable)
- **Debug mode**
- **Usage statistics** (exportable)
- **Hot reload** with file watching
- **Management control panel** (GitHub-hosted)

### 7.5 Advanced Routing
- **Prefix-based routing** (e.g., "test/gemini-pro")
- **Model aliasing** (rename models)
- **Excluded models** (wildcard support)
- **Custom base URLs** per provider
- **Per-credential headers**

---

## 8. Troubleshooting & Performance Tips

### 8.1 Performance Optimization
```yaml
# Reduce memory overhead
commercial-mode: true

# Disable stats aggregation if not needed
usage-statistics-enabled: false

# Optimize logging
logging-to-file: true
logs-max-total-size-mb: 100

# Streaming optimization
streaming:
  keepalive-seconds: 15
  bootstrap-retries: 1
```

### 8.2 Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change `port` in config.yaml |
| Auth not working | Check `api-keys` and `auth-dir` |
| Models not appearing | Verify provider config & excluded-models |
| Slow responses | Check proxy-url, enable request logging |
| OAuth fails | Verify upstream URLs in OAuth config |

### 8.3 Monitoring
```bash
# View logs
docker compose logs -f cli-proxy-api

# Check status
curl http://localhost:8317/v1/models

# Management API (with key)
curl -H "X-Management-Key: your-secret" \
     http://localhost:8317/v0/management/debug
```

---

## 9. Architecture & Components

### 9.1 System Architecture
```
┌─────────────────────────────────────────────────┐
│          CLI Proxy API Server (8317)             │
├─────────────────────────────────────────────────┤
│  Routing Layer (Round-robin, Fill-first)        │
│  - Model mapping                                │
│  - Prefix-based routing                         │
├─────────────────────────────────────────────────┤
│  Authentication Layer (SDK/access)              │
│  - API key provider                             │
│  - Custom providers                             │
├─────────────────────────────────────────────────┤
│  Provider Executors                             │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │  Gemini  │  Claude  │  OpenAI  │  Custom  │ │
│  └──────────┴──────────┴──────────┴──────────┘ │
├─────────────────────────────────────────────────┤
│  Translation Layer (Request/Response)           │
│  - OpenAI ↔ Gemini                              │
│  - OpenAI ↔ Claude                              │
│  - OpenAI ↔ Custom providers                    │
├─────────────────────────────────────────────────┤
│  Storage Layer                                  │
│  - File-based auth (default)                    │
│  - PostgreSQL (optional)                        │
│  - Git-backed (optional)                        │
│  - S3/Object storage (optional)                 │
├─────────────────────────────────────────────────┤
│  Management API & Control Panel                 │
└─────────────────────────────────────────────────┘
```

### 9.2 Module Structure
- **cmd/server** - CLI binary
- **internal/config** - Configuration parsing
- **sdk/cliproxy** - Embedded service SDK
- **sdk/access** - Authentication SDK
- **sdk/translator** - Request/response translation
- **examples/custom-provider** - Custom provider example

---

## 10. Deployment Recommendations

### 10.1 Production Setup
```yaml
# Production config
host: "0.0.0.0"                    # Bind all interfaces
port: 8317                          # Custom port if needed

tls:
  enable: true                      # HTTPS
  cert: "/path/to/cert.pem"
  key: "/path/to/key.pem"

remote-management:
  allow-remote: false               # Localhost only
  secret-key: "SECURE_RANDOM_KEY"

commercial-mode: true               # Reduce memory
logging-to-file: true               # File logs
logs-max-total-size-mb: 500        # Rotate logs

usage-statistics-enabled: true     # Monitor usage
request-retry: 5                    # More retries
```

### 10.2 High Availability
1. **Multiple replicas** with load balancer
2. **Shared storage** (PostgreSQL/S3 for auths)
3. **Centralized config** (Git-backed store)
4. **Health checks** on `/v1/models` endpoint
5. **Rate limiting** via upstream proxy

### 10.3 Security Best Practices
- Keep API keys in `.env` file or secure vault
- Use HTTPS in production
- Restrict management API to localhost
- Rotate credentials regularly
- Monitor usage statistics
- Enable debug logging only during troubleshooting

---

## 11. Resources & References

### Official Documentation
- **Help Center:** https://help.router-for.me/
- **Management API:** https://help.router-for.me/management/api
- **Amp CLI Guide:** https://help.router-for.me/agent-client/amp-cli.html

### GitHub Resources
- **Main Repository:** https://github.com/router-for-me/CLIProxyAPI
- **Management Center:** https://github.com/router-for-me/Cli-Proxy-API-Management-Center
- **Related Projects:** vibeproxy, SRT Subtitle Translator, CCS, ProxyPal, Quotio

### SDK Documentation Files
- `docs/sdk-usage.md` - SDK embedding guide
- `docs/sdk-access.md` - Authentication SDK
- `docs/sdk-advanced.md` - Custom executors & translators
- `docs/sdk-watcher.md` - Credential hot reload

---

## 12. Tóm Tắt Điểm Chính

### Configuration
- **267 dòng** cấu hình ví dụ với đầy đủ comments
- Hỗ trợ **6+ providers** (Gemini, OpenAI, Claude, Qwen, iFlow, Custom)
- Cấu hình linh hoạt với wildcard support cho excluded models
- Environment variables cho remote storage backends

### Deployment
- **Multi-stage Docker** build (minimal image size)
- **docker-compose** setup sẵn sàng production
- Smart build scripts cho Linux/Windows
- Usage statistics preservation feature

### Dependencies
- **Go 1.24** - Latest stable version
- **76 total dependencies** - Security updates included
- Key libs: Gin, WebSocket, PostgreSQL, Minio, GitGo
- Compression support (gzip, brotli)

### SDK & Extensibility
- **4 major SDKs** (cliproxy, access, translator, watcher)
- Embedded service support
- Custom provider/translator registration
- Hot reload for config & credentials

### Features
- Load balancing (round-robin, fill-first)
- OAuth + API key authentication
- Streaming & non-streaming
- Multimodal support (text + images)
- Management API & control panel
- Request logging & statistics

---

**Kết luận:** CLIProxyAPI là một dự án mature, well-documented, với kiến trúc mở rộng tốt. Phù hợp cho:
- Developers muốn sử dụng OAuth subscriptions với CLI tools
- Teams cần central proxy cho AI API access
- Organizations muốn custom provider integration
- High-volume deployments cần load balancing & failover

