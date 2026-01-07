# Sơ Đồ Kiến Trúc CLIProxyAPI - 03/01/2025

## 1. REQUEST FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLIENT REQUEST                                │
│         (OpenAI format, e.g., /v1/chat/completions)              │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API SERVER (Gin)                               │
│                                                                   │
│  ┌─ Request Logging Middleware                                   │
│  ├─ Authentication Middleware (API Key / OAuth)                  │
│  ├─ Request/Response Logging                                     │
│  └─ Custom Middleware                                            │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            API HANDLERS (Request Handling)                        │
│                                                                   │
│  ├─ POST /v1/chat/completions                                    │
│  ├─ POST /v1/embeddings                                          │
│  ├─ GET  /v1/models                                              │
│  ├─ GET  /v0/management/* (Config Management)                    │
│  └─ WS   /v1/ws (WebSocket Gateway)                              │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              REQUEST TRANSLATOR PIPELINE                          │
│                                                                   │
│   Input Format (OpenAI) ──> [Format Detection]                   │
│                              [Request Transformer]               │
│                              [Output Format (Provider)]           │
│                                                                   │
│   Example: OpenAI → Gemini → Gemini Format Request               │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            CORE AUTH MANAGER (conductor.go)                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. SELECT ACCOUNT (using Strategy)                         │  │
│  │    - Round-Robin: distribute requests evenly               │  │
│  │    - Fill-First: fill first account before switching       │  │
│  │                                                             │  │
│  │ 2. VALIDATE ACCOUNT STATE                                  │  │
│  │    - Check if active, disabled, or quota-exceeded          │  │
│  │    - Apply cooldown/backoff if needed                      │  │
│  │                                                             │  │
│  │ 3. GET PROVIDER EXECUTOR                                   │  │
│  │    - Map provider type (Gemini, Claude, OpenAI, etc.)      │  │
│  │    - Register provider-specific executor                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            PROVIDER EXECUTOR (specific provider)                  │
│                                                                   │
│  ┌─ GeminiExecutor                                               │
│  ├─ GeminiVertexExecutor                                         │
│  ├─ GeminiCLIExecutor                                            │
│  ├─ ClaudeExecutor                                               │
│  ├─ CodexExecutor (OpenAI)                                       │
│  ├─ QwenExecutor                                                 │
│  ├─ IFlowExecutor                                                │
│  ├─ AntigravityExecutor                                          │
│  ├─ AIStudioExecutor (WebSocket)                                 │
│  └─ OpenAICompatExecutor (Generic)                               │
│                                                                   │
│  Responsibilities:                                                │
│  • PrepareRequest: Inject auth headers/credentials               │
│  • Execute: Non-streaming request execution                      │
│  • ExecuteStream: Streaming execution                            │
│  • Refresh: Token refresh (OAuth)                                │
│  • CountTokens: Token counting support                           │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              HTTP CLIENT (to Provider API)                        │
│                                                                   │
│  ├─ Build HTTP request with auth                                 │
│  ├─ Apply proxy settings if configured                           │
│  ├─ Timeout handling                                             │
│  └─ Streaming response handling                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PROVIDER API                                   │
│                 (Gemini, Claude, OpenAI, etc.)                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              RESPONSE TRANSLATOR PIPELINE                         │
│                                                                   │
│   Provider Response ──> [Format Detection]                       │
│                         [Response Transformer]                   │
│                         [Output Format (OpenAI)]                 │
│                                                                   │
│   Example: Gemini → OpenAI → OpenAI Format Response              │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│          RESULT TRACKING & STATE UPDATE                           │
│                                                                   │
│  ├─ Record execution result (Success/Failure)                    │
│  ├─ Update account quotas                                        │
│  ├─ Emit hook notifications (OnResult)                           │
│  └─ Trigger quota backoff if needed                              │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  CLIENT RESPONSE                                  │
│          (OpenAI format, OpenAI/Gemini/Claude/etc.)              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. SERVICE LIFECYCLE DIAGRAM

```
┌─────────────────────────────────────────┐
│        APPLICATION STARTUP              │
│      (cmd/server/main.go)               │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   ENVIRONMENT & FLAG PARSING            │
│                                         │
│  ├─ Load .env file                      │
│  ├─ Parse command-line flags            │
│  ├─ Select token store backend:         │
│  │  • PostgreSQL                        │
│  │  • Object Store (S3/MinIO)           │
│  │  • Git Repository                    │
│  │  • File System (default)             │
│  └─ Register token store                │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   CONFIG LOADING & VALIDATION           │
│                                         │
│  ├─ Load config.yaml                    │
│  ├─ Set auth directory                  │
│  ├─ Configure logging                   │
│  └─ Load API keys                       │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   DECISION BRANCH                       │
│                                         │
│  ├─ -login flag?          ─► Gemini OAuth
│  ├─ -claude-login?        ─► Claude OAuth
│  ├─ -codex-login?         ─► OpenAI OAuth
│  ├─ -qwen-login?          ─► Qwen OAuth
│  ├─ -iflow-login?         ─► iFlow OAuth
│  ├─ -antigravity-login?   ─► Antigravity
│  ├─ -vertex-import?       ─► Import Vertex
│  └─ ELSE                  ─► START SERVER
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   SERVICE BUILDER & RUN                 │
│   (cliproxy.NewBuilder().Build().Run()) │
│                                         │
│  ├─ Create Service instance             │
│  ├─ Initialize auth directory           │
│  ├─ Load auth credentials               │
│  ├─ Register built-in executors         │
│  └─ Setup core auth manager             │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   HTTP SERVER START                     │
│                                         │
│  ├─ Bind to host:port                   │
│  ├─ Register middleware                 │
│  ├─ Register handlers                   │
│  ├─ Setup TLS (if enabled)              │
│  └─ Listen for requests                 │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   BACKGROUND SERVICES START             │
│                                         │
│  ├─ OnBeforeStart Hook                  │
│  ├─ Start HTTP Server (goroutine)       │
│  ├─ OnAfterStart Hook                   │
│  ├─ Start File Watcher                  │
│  │  • Monitor config.yaml               │
│  │  • Monitor auth directory            │
│  │  • Auto-reload config                │
│  │  • Process auth updates              │
│  ├─ Auth Update Queue Consumer          │
│  ├─ Core Auth Auto-Refresh (15min)      │
│  └─ Usage Statistics Collection         │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   RUNNING STATE                         │
│                                         │
│  Block until:                           │
│  • Context cancelled (SIGTERM/SIGINT)   │
│  • Server error                         │
│  • Fatal error                          │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│   GRACEFUL SHUTDOWN                     │
│                                         │
│  ├─ Stop file watcher                   │
│  ├─ Stop auth auto-refresh              │
│  ├─ Stop auth update queue              │
│  ├─ Stop WebSocket gateway              │
│  ├─ Stop HTTP server (30s timeout)      │
│  ├─ Stop usage statistics               │
│  └─ Cleanup resources                   │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│        APPLICATION EXIT                 │
└─────────────────────────────────────────┘
```

---

## 3. AUTHENTICATION STATE MACHINE

```
┌────────────────────────────────────────────────────────────────┐
│              AUTH ACCOUNT STATE MACHINE                         │
└────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                ┌──►│   ACTIVE    │◄──┐
                │   └──────┬──────┘   │
                │          │         │
    [can execute │          ├─────────┤
     requests]   │          │         │
                │          ▼         │
                │   ┌──────────────┐ │
                │   │REFRESH       │ │
                │   │PENDING       │ │
                │   │              │ │
                │   │(1min backoff)│ │
                │   └────┬───────┬─┘ │
                │        │       │   │
                │   Success   Failure
                │        │       │   │
                │        └───┬───┘   │
                │            │       │
                │   [No execution]   │
                │            │       │
                │            ▼       │
                │   ┌──────────────┐ │
                │   │REFRESH       │ │
                │   │FAILED        │ │
                └───┤              ├─┘
                    │(5min backoff)│
                    └──────┬───────┘
                           │
        [Exponential Backoff applied]
                           │
                           ▼
                    ┌──────────────┐
                ┌──►│QUOTA         │
                │   │EXCEEDED      │
                │   │              │
                │   │(1s-30m BOE)  │
                │   └──────┬───────┘
                │          │
         [No execution]    │
                │          │
                │    [Retry with
                │     next account]
                │          │
                │   [Success or No
                │    more accounts]
                │          │
                │          ▼
                │   [Switch to
                │    ACTIVE?]
                │          │
                │          ├─────► YES ──┐
                │          │             │
                │          └─ NO ────────┴────┐
                │                            │
                └─ DISABLED ◄────────────────┘
                           │
                    [Manual removal]
                           │
                           ▼
                    [Deleted from registry]

Legend:
• ACTIVE = Can execute, normal refresh schedule
• REFRESH PENDING = Waiting for refresh, backoff active
• REFRESH FAILED = Refresh failed, longer backoff
• QUOTA EXCEEDED = Hit quota limit, exponential backoff
• DISABLED = Account disabled, no execution
```

---

## 4. DATA FLOW & STORAGE

```
┌─────────────────────────────────────────────────────────────────┐
│                 CORE AUTH DATA STRUCTURES                        │
└─────────────────────────────────────────────────────────────────┘

Auth Account (coreauth.Auth)
├─ ID: string                    # UUID identifier
├─ Provider: string              # "gemini", "claude", "codex", etc.
├─ Label: string                 # User-friendly name
├─ Prefix: string                # Model prefix (optional)
├─ Status: string                # Active, Disabled, RefreshPending, etc.
├─ CreatedAt: time.Time
├─ UpdatedAt: time.Time
├─ LastRefreshedAt: time.Time
├─ NextRefreshAfter: time.Time   # Quota cooldown deadline
├─ Disabled: bool
├─ ProxyURL: string              # SOCKS5/HTTP proxy
├─ Attributes: map[string]string # Provider-specific data
│  ├─ "api_key": "..."           # For API key providers
│  ├─ "base_url": "..."          # For custom endpoints
│  ├─ "endpoint": "..."          # Custom provider endpoint
│  ├─ "compat_name": "..."       # OpenAI-compatible name
│  ├─ "provider_key": "..."      # Custom provider identifier
│  ├─ "auth_kind": "token|apikey"
│  └─ "gemini_virtual_primary": "true|false"
├─ Metadata: map[string]any     # User data
│  ├─ "email": "..."             # Account email
│  └─ "usage": {...}             # Usage statistics
└─ Runtime: interface{}          # Provider-specific runtime data

ModelInfo (cliproxy.ModelInfo)
├─ ID: string                    # Model identifier
├─ Object: string                # "model"
├─ Created: int64                # Unix timestamp
├─ OwnedBy: string               # "google", "anthropic", "openai", etc.
├─ Type: string                  # Provider type
├─ DisplayName: string           # Human-readable name
├─ Thinking: *ThinkingInfo       # Thinking capability
│  ├─ Supported: bool
│  ├─ DefaultLevel: string       # Default thinking level
│  └─ AllowedLevels: []string    # Allowed levels
└─ Name: string                  # Alternative name

TokenStore Interface
├─ Save(ctx, auth) → (path, error)
├─ Load(ctx) → ([]*Auth, error)
├─ Delete(ctx, id) → error
└─ SetBaseDir(path) → void       # Optional
```

---

## 5. TOKEN STORAGE OPTIONS ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────┐
│              TOKEN STORE SELECTION PRIORITY                  │
└──────────────────────────────────────────────────────────────┘

                    Check Environment Variables
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   PGSTORE_DSN         OBJECTSTORE_         GITSTORE_GIT_URL
                       ENDPOINT
        │                    │                    │
        ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│PostgreSQL      │  │Object Store    │  │Git Repository  │
│Store           │  │(S3/MinIO)      │  │Store           │
│                │  │                │  │                │
│• DSN Config    │  │• Endpoint      │  │• Remote URL    │
│• Schema        │  │• Access Key    │  │• Username      │
│• Local Spool   │  │• Secret Key    │  │• Token         │
│• Bootstrap     │  │• Bucket        │  │• Local Path    │
│                │  │• Local Path    │  │• Auto-clone    │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                   │
         │         If none configured:           │
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │File Token Store│
                    │(Default)       │
                    │                │
                    │~/.cli-proxy-api│
                    │├─ auths/       │
                    ││  ├─ {id}-*    │
                    ││  └─ .json     │
                    │└─ config/      │
                    │   └─ config.yaml
                    └────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              POSTGRES STORE ARCHITECTURE                     │
└──────────────────────────────────────────────────────────────┘

PostgreSQL Database
│
├─ Schema: clipproxy (default)
│
├─ Table: auths
│  ├─ id UUID (primary key)
│  ├─ provider VARCHAR
│  ├─ label VARCHAR
│  ├─ status VARCHAR
│  ├─ data JSONB
│  ├─ created_at TIMESTAMP
│  └─ updated_at TIMESTAMP
│
├─ Table: config
│  ├─ key VARCHAR (primary key)
│  └─ value TEXT
│
└─ Local Spool Directory
   └─ pgstore/                # Cache + config
      ├─ auths/               # Auth cache
      │  ├─ {id}-{provider}.json
      │  └─ ...
      └─ config/
         └─ config.yaml       # Config copy

┌──────────────────────────────────────────────────────────────┐
│              GIT STORE ARCHITECTURE                          │
└──────────────────────────────────────────────────────────────┘

Git Repository
│
├─ auths/                      # Auth storage
│  ├─ {id}-{provider}.json
│  ├─ {id}-{provider}.json
│  └─ ...
│
└─ config/
   └─ config.yaml             # Main config

Local Clone
│
└─ gitstore/                   # Working directory
   ├─ auths/                   # Checked out auth files
   │  ├─ {id}-{provider}.json
   │  └─ ...
   ├─ config/
   │  └─ config.yaml
   └─ .git/                    # Git metadata

┌──────────────────────────────────────────────────────────────┐
│              OBJECT STORE ARCHITECTURE (S3/MinIO)            │
└──────────────────────────────────────────────────────────────┘

S3/MinIO Bucket
│
├─ auths/                      # Auth key paths
│  ├─ {id}-{provider}.json
│  ├─ {id}-{provider}.json
│  └─ ...
│
└─ config/
   └─ config.yaml             # Main config

Local Cache
│
└─ objectstore/                # Local copy
   ├─ auths/                   # Downloaded auth files
   │  ├─ {id}-{provider}.json
   │  └─ ...
   ├─ config/
   │  └─ config.yaml
   └─ manifest.json            # Sync metadata
```

---

## 6. EXECUTOR SELECTION & ROUTING

```
┌─────────────────────────────────────────────────────────────┐
│         REQUEST TO EXECUTOR MAPPING LOGIC                   │
└─────────────────────────────────────────────────────────────┘

Request Input:
├─ Provider: "gemini" / "claude" / "codex" / etc.
├─ Model: "gpt-4" / "claude-opus-4" / etc.
├─ Format: Determined by client (OpenAI assumed)
└─ Auth Account: Selected by strategy

                          ▼

┌──────────────────────────────────────────┐
│  Executor Registry Lookup                │
│                                          │
│  manager.RegisterExecutor(executor)      │
│                                          │
│  Registered by Provider Type:            │
│  ├─ "gemini" ──► GeminiExecutor          │
│  ├─ "vertex" ──► GeminiVertexExecutor    │
│  ├─ "gemini-cli" ──► GeminiCLIExecutor   │
│  ├─ "claude" ──► ClaudeExecutor          │
│  ├─ "codex" ──► CodexExecutor            │
│  ├─ "qwen" ──► QwenExecutor              │
│  ├─ "iflow" ──► IFlowExecutor            │
│  ├─ "antigravity" ──► AntigravityExecutor│
│  ├─ "aistudio" ──► AIStudioExecutor      │
│  ├─ "openai-compatibility" ──► Generic   │
│  └─ Custom ──► User-defined Executor     │
└──────────────────────────────────────────┘

                          ▼

┌──────────────────────────────────────────┐
│  Executor Method Call Sequence            │
│                                          │
│  1. PrepareRequest(req, auth)            │
│     • Inject credentials                 │
│     • Add auth headers                   │
│     • Setup proxy if needed              │
│                                          │
│  2. (Streaming?) ──► Yes                 │
│     │                                    │
│     └─► ExecuteStream(ctx, auth, req, opt)
│         • Returns <-chan StreamChunk     │
│         • Stream response to client      │
│                                          │
│  3. (Streaming?) ──► No                  │
│     │                                    │
│     └─► Execute(ctx, auth, req, opt)     │
│         • Returns single Response        │
│         • Return response to client      │
│                                          │
│  4. Result Recording                     │
│     • Success/Failure                    │
│     • Response HTTP status               │
│     • Retry-After header                 │
│     • Error tracking                     │
│                                          │
│  5. Hook Notification                    │
│     • OnResult(ctx, Result{...})         │
│     • Update quota tracking              │
│     • Emit usage events                  │
└──────────────────────────────────────────┘

                          ▼

Response to Client
(in original OpenAI format if translated)
```

---

## 7. CONFIGURATION RELOAD ARCHITECTURE

```
┌──────────────────────────────────────────────────────────┐
│            FILE WATCHER MONITORING LOOP                  │
└──────────────────────────────────────────────────────────┘

                    File System Events
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   config.yaml         auth files         .gitkeep
   changed            add/modify/delete     ignored
        │                  │                  │
        ▼                  ▼                  ▼
   Reload Config      Queue AuthUpdate    [Ignore]
        │                  │
        │                  └──► Auth Update Queue
        │                        (256 event buffer)
        │                              │
        ▼                              ▼
   ┌────────────────────┐  ┌─────────────────────┐
   │Validate YAML       │  │Process Auth Updates │
   │                    │  │                     │
   │Parse new config    │  │For each update:     │
   │                    │  │├─ Action: Add       │
   │Check for errors    │  │├─ Action: Modify   │
   └────────┬───────────┘  │├─ Action: Delete   │
            │               │└─ Apply to core    │
            │               └────────┬───────────┘
            │                        │
            └─────────────┬──────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │  Apply Configuration Changes    │
        │                                 │
        │  ├─ Update routing strategy?    │
        │  │  └─ Switch selector          │
        │  │                              │
        │  ├─ Update retry config?        │
        │  │  └─ Apply max intervals      │
        │  │                              │
        │  ├─ Update HTTP server config?  │
        │  │  └─ Recreate client caches   │
        │  │                              │
        │  ├─ Update OAuth model mappings?│
        │  │  └─ Regenerate model list    │
        │  │                              │
        │  └─ Rebind all executors?       │
        │     └─ Re-register with new cfg │
        └─────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │  Lock & Update Service Config   │
        │                                 │
        │  s.cfgMu.Lock()                 │
        │  s.cfg = newCfg                 │
        │  s.cfgMu.Unlock()               │
        │                                 │
        │  (Thread-safe update)           │
        └─────────────────────────────────┘
```

---

## 8. MULTI-TENANT / MULTI-ACCOUNT ORCHESTRATION

```
┌─────────────────────────────────────────────────────────┐
│        MULTIPLE ACCOUNT MANAGEMENT                      │
└─────────────────────────────────────────────────────────┘

Core Auth Manager
│
├─ Account Store (In-Memory + Persistent)
│  ├─ Account [1]
│  │  ├─ Provider: "gemini"
│  │  ├─ Status: Active
│  │  ├─ Email: user1@gmail.com
│  │  └─ NextRefreshAfter: <timestamp>
│  │
│  ├─ Account [2]
│  │  ├─ Provider: "gemini"
│  │  ├─ Status: RefreshPending
│  │  ├─ Email: user2@gmail.com
│  │  └─ NextRefreshAfter: <now + 1min>
│  │
│  ├─ Account [3]
│  │  ├─ Provider: "claude"
│  │  ├─ Status: QuotaExceeded
│  │  ├─ Email: user@anthropic.com
│  │  └─ NextRefreshAfter: <now + 5min>
│  │
│  └─ Account [N]
│     └─ ...
│
├─ Selection Strategy
│  ├─ Round-Robin
│  │  • Distribute load evenly
│  │  • Order: Account[1] ──► [2] ──► [3] ──► [1]...
│  │
│  └─ Fill-First
│     • Fill first account quota
│     • Then switch to next
│     └─ Account[1]...[1] ──► [2]...[2] ──► [3]
│
├─ Auto-Refresh Manager
│  ├─ Check every 15 minutes
│  ├─ For each account:
│  │  ├─ Check if refresh needed
│  │  ├─ Call executor.Refresh()
│  │  └─ Update status
│  └─ Respects NextRefreshAfter
│
└─ Quota Cooldown Manager
   ├─ Exponential backoff formula:
   │  min(maxInterval, baseInterval * 2^retries)
   │
   ├─ Parameters:
   │  ├─ Base: 1 second
   │  └─ Max: 30 minutes (configurable)
   │
   └─ Application:
      ├─ Track consecutive failures per account
      ├─ Apply backoff to NextRefreshAfter
      └─ Switch to next account if available
```

---

## 9. REQUEST RETRY & FAILOVER LOGIC

```
┌─────────────────────────────────────────────────────────┐
│          REQUEST EXECUTION WITH RETRY                   │
└─────────────────────────────────────────────────────────┘

                   Initial Request
                           │
                           ▼
        ┌────────────────────────────────────┐
        │  Select Account (via Strategy)     │
        │                                    │
        │  1. Filter available accounts      │
        │  2. Skip disabled/pending refresh  │
        │  3. Skip quota-exceeded (optional) │
        │  4. Pick next in sequence          │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Get Executor for Provider         │
        │                                    │
        │  account.Provider ──► Executor     │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Execute Request                   │
        │                                    │
        │  executor.Execute(ctx, account, req)
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Analyze Response Status           │
        │                                    │
        │  HTTP Status Code:                 │
        │  ├─ 2xx        ──► Success         │
        │  ├─ 3xx        ──► Redirect        │
        │  ├─ 4xx        ──► Client Error    │
        │  │  ├─ 401     ──► Refresh Token   │
        │  │  ├─ 403     ──► Quota/Permission
        │  │  └─ 429     ──► Rate Limited    │
        │  ├─ 5xx        ──► Retry           │
        │  └─ Timeout    ──► Retry           │
        └────────────┬───────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
        SUCCESS            RETRYABLE?
          │                     │
          │        ┌────────────┴─────────────┐
          │        │                          │
          │   ┌────▼────┐            ┌────────▼────┐
          │   │Retries  │            │Apply        │
          │   │Remaining│            │Cooldown     │
          │   └────┬────┘            │             │
          │        │                 └────┬────────┘
          │   ┌────▼──────┐              │
          │   │>0 (limit) │              │
          │   └────┬──────┘              │
          │        │                     │
          │   Try Next Account (if available)
          │        │                     │
          │        └─────────┬───────────┘
          │                  │
          └──────────┬───────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Return Result to Client           │
        │                                    │
        │  ├─ Response: Success              │
        │  ├─ Response: Error (exhausted)    │
        │  └─ Response: Rate Limited         │
        └────────────────────────────────────┘

Retry Configuration (config.yaml):
├─ request-retry: 3          # Max retries per request
├─ max-retry-interval: 30    # Max wait before retry (seconds)
└─ quota-exceeded:
   ├─ switch-project: true   # Auto-switch on quota hit
   └─ switch-preview-model: true  # Try preview models
```

---

## 10. COMPONENT DEPENDENCY GRAPH

```
┌────────────────────────────────────────────────────────────┐
│              DEPENDENCY ARCHITECTURE                       │
└────────────────────────────────────────────────────────────┘

CLI Entry Point (cmd/server/main.go)
    │
    ├─► Config System
    │   ├─ Load YAML
    │   ├─ Environment Variables
    │   └─ Validation
    │
    ├─► Token Store Selection
    │   ├─ PostgreSQL Driver
    │   ├─ Git Library
    │   ├─ S3 Client
    │   └─ File System
    │
    ├─► SDK Builder (cliproxy.NewBuilder)
    │   │
    │   ├─► Core Auth Manager
    │   │   ├─ Token Store
    │   │   ├─ Provider Executors
    │   │   │  ├─ Gemini Executor
    │   │   │  ├─ Claude Executor
    │   │   │  ├─ OpenAI Executor
    │   │   │  └─ Custom Executors
    │   │   ├─ Auth Selector
    │   │   │  ├─ Round-Robin Selector
    │   │   │  └─ Fill-First Selector
    │   │   └─ Quota Manager
    │   │
    │   ├─► Request Access Manager
    │   │   └─ Access Providers
    │   │      ├─ API Key Provider
    │   │      └─ Custom Providers
    │   │
    │   ├─► Translator Registry
    │   │   ├─ Format Transformers
    │   │   │  ├─ OpenAI ↔ Gemini
    │   │   │  ├─ OpenAI ↔ Claude
    │   │   │  └─ Custom Formats
    │   │   └─ Request/Response Pipelines
    │   │
    │   ├─► HTTP Server (Gin)
    │   │   ├─ Middleware Stack
    │   │   ├─ API Handlers
    │   │   │  ├─ Chat Completion Handler
    │   │   │  ├─ Model List Handler
    │   │   │  ├─ Management Handlers
    │   │   │  └─ WebSocket Handler
    │   │   └─ TLS Support
    │   │
    │   ├─► File Watcher
    │   │   ├─ Config Monitor
    │   │   ├─ Auth Directory Monitor
    │   │   └─ Event Processor
    │   │
    │   ├─► WebSocket Gateway (Optional)
    │   │   └─ AI Studio Relay
    │   │
    │   └─► Logging System
    │       ├─ Logrus Logger
    │       ├─ Request Logger
    │       └─ File Rotation
    │
    └─► Usage Statistics (Optional)
        └─ Token Tracking Plugins
```

---

## SUMMARY

CLIProxyAPI implements a sophisticated multi-tenant proxy architecture with:

1. **Flexible Deployment**: Standalone, cloud-native, or embedded SDK
2. **Multiple Auth Backends**: File, PostgreSQL, Git, S3/MinIO
3. **Provider Abstraction**: Unified interface for different AI providers
4. **Dynamic Configuration**: Zero-downtime reloads
5. **Intelligent Routing**: Round-robin or fill-first account selection
6. **Graceful Error Handling**: Automatic retry, failover, quota management
7. **Extensibility**: Custom executors, translators, and access providers
8. **Observability**: Comprehensive logging, usage tracking, webhooks

This architecture enables efficient multi-account API proxy with advanced scheduling and quota management.
