# File List: Multimodal API & Chat Completions Implementation

## TIER 1: CRITICAL FILES (Xử lý Chat Completions & Multimodal)

### Chat Completions Entry Points
- `/internal/api/server.go` - Route setup + Management HTML serving
- `/sdk/api/handlers/openai/openai_handlers.go` - ChatCompletions endpoint

### Image/Multimodal Processing
- `/internal/translator/openai/gemini/openai_gemini_request.go` - OpenAI → Gemini conversion (images in system/messages)
- `/internal/translator/gemini/openai/chat-completions/gemini_openai_request.go` - OpenAI → Gemini (multipart content)
- `/internal/translator/openai/claude/openai_claude_request.go` - Claude image handling

### Static File Serving
- `/static/management.html` - React SPA management UI (1.4 MB)

---

## TIER 2: SUPPORT FILES (Base handlers, utilities)

### Base Handler & Stream Management
- `/sdk/api/handlers/handlers.go` - BaseAPIHandler, ExecuteWithAuthManager
- `/sdk/api/handlers/stream_forwarder.go` - Stream forwarding utilities

### Translator Common
- `/internal/translator/gemini/common/` - Shared Gemini utilities
- `/internal/util/gemini_schema.go` - Schema transformation
- `/internal/misc/mime-type.go` - MIME type mappings

### Request/Response Handlers
- `/sdk/api/handlers/gemini/gemini_handlers.go` - Gemini API handlers
- `/sdk/api/handlers/gemini/gemini-cli_handlers.go` - Gemini CLI handlers
- `/sdk/api/handlers/claude/code_handlers.go` - Claude Code handlers

---

## TIER 3: MANAGEMENT & CONFIGURATION

### File Upload/Management
- `/internal/api/handlers/management/auth_files.go` - File upload handling
- `/internal/api/handlers/management/vertex_import.go` - Vertex AI credential upload

### Management Routes & API
- `/internal/api/handlers/management/handler.go` - Main management handler
- `/internal/api/handlers/management/config_basic.go` - Config endpoints
- `/internal/api/handlers/management/usage.go` - Usage statistics

### Modules & Routing
- `/internal/api/modules/amp/routes.go` - Amp module routing
- `/internal/api/modules/modules.go` - Module registration

---

## TIER 4: PERIPHERAL FILES

### Authentication
- `/internal/auth/gemini/gemini_auth.go` - Gemini authentication
- `/sdk/auth/gemini.go` - Token management

### Logging & Middleware
- `/internal/api/middleware/request_logging.go` - Request logging
- `/internal/api/middleware/response_writer.go` - Response handling

### Configuration
- `/internal/config/config.go` - Main config struct
- `/internal/config/sdk_config.go` - SDK configuration

### Utilities
- `/internal/util/` - Thinking budget conversion, logging utilities
- `/internal/constant/constant.go` - Constants (OpenAI, Gemini, etc.)

---

## DETAILED FILE DEPENDENCY GRAPH

```
POST /v1/chat/completions
│
├─ openaiHandlers.ChatCompletions()
│  └─ /sdk/api/handlers/openai/openai_handlers.go
│     ├─ BaseAPIHandler.ExecuteWithAuthManager()
│     │  └─ /sdk/api/handlers/handlers.go
│     │     └─ Gemini/Claude/Codex executors
│     │
│     └─ handleStreamingResponse()
│        └─ BaseAPIHandler.ForwardStream()
│           └─ /sdk/api/handlers/stream_forwarder.go
│
├─ Format Conversion
│  └─ ConvertOpenAIRequestToGemini()
│     └─ /internal/translator/openai/gemini/openai_gemini_request.go
│        ├─ Image handling (base64 → inlineData)
│        ├─ Tool conversion (function → functionCall)
│        └─ /internal/util/gemini_schema.go (schema transform)
│
└─ Response Handling
   ├─ JSON formatting
   └─ SSE stream formatting (text/event-stream)

GET /management.html
│
└─ serveManagementControlPanel()
   └─ /internal/api/server.go (dòng 616)
      └─ managementasset.FilePath()
         └─ /static/management.html
```

---

## FILE COUNTS BY CATEGORY

| Category | Count | Examples |
|----------|-------|----------|
| Translator (multi-direction) | 30+ | openai→gemini, gemini→openai, etc. |
| Management handlers | 15+ | config, usage, auth, oauth |
| Executor/runtime | 10+ | gemini_executor, claude_executor, etc. |
| Middleware/utility | 20+ | logging, auth, caching |
| Configuration | 5+ | config.go, sdk_config.go |
| **TOTAL GO FILES** | **80+** | |

---

## KEY PATTERNS IN IMAGE HANDLING

### Pattern 1: Base64 Data URI
```
data:image/png;base64,iVBORw0KGgoAAAANS...
```
Used in: OpenAI format, Claude format, system instructions

### Pattern 2: Gemini inlineData
```json
{
  "inlineData": {
    "mimeType": "image/png",
    "data": "iVBORw0KGgoAAAANS..."
  }
}
```

### Pattern 3: File Upload
```
multipart/form-data
├─ file (binary)
└─ filename (string)
```
Handlers: `/auth-files`, `/vertex/import`

---

## CODE SEARCH PATTERNS FOR EXTENDING

### To add new image type support:
```bash
grep -r "inlineData" /internal/translator/
grep -r "mimeType" /internal/misc/
```

### To add new static route:
```bash
grep -r "GET.*management" /internal/api/server.go
```

### To add image validation:
```bash
grep -r "source.*type.*base64" /internal/translator/
```

---

## UNRESOLVED DEPENDENCIES

1. **managementasset.FilePath()** - Implementation not in provided files
2. **imageMimeTypes mapping** - In `/internal/misc/mime-type.go` (not shown)
3. **Vertex AI schema** - In `/internal/auth/vertex/` (not shown)

