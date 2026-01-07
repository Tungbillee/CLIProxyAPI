# Scout Report: Phân Tích Multimodal API & Chat Completions

**Ngày:** 2026-01-03  
**Plan:** 260103-1215-gemini-media-chat-ui  
**Mục đích:** Tìm và phân tích code liên quan đến Multimodal API, Chat completions, Gemini translator, và Static file serving

---

## 1. CHAT COMPLETIONS ENDPOINT (POST /v1/chat/completions)

### File chính:
- **`/internal/api/server.go`** (dòng 324)
  ```go
  v1.POST("/chat/completions", openaiHandlers.ChatCompletions)
  ```

- **`/sdk/api/handlers/openai/openai_handlers.go`**
  - Hàm `ChatCompletions()` xử lý request OpenAI Chat Completions
  - Tự động phát hiện streaming vs non-streaming request
  - Hỗ trợ conversion từ OpenAI Responses format sang Chat Completions format

### Luồng xử lý:
1. **Request Entry**: `ChatCompletions()` nhận raw JSON từ client
2. **Format Detection**: Kiểm tra field `stream` để determine response type
3. **Response Format Handling**: 
   - Nếu client gửi "OpenAI Responses" format → convert to Chat Completions
   - Gọi `convertOpenAIResponsesRequestToOpenAIChatCompletions()`
4. **Handler Selection**:
   - Streaming: `handleStreamingResponse()`
   - Non-streaming: `handleNonStreamingResponse()`

### Key Code Patterns:
```go
// Detect streaming request
streamResult := gjson.GetBytes(rawJSON, "stream")
stream := streamResult.Type == gjson.True

// Format detection & conversion
if shouldTreatAsResponsesFormat(rawJSON) {
    modelName := gjson.GetBytes(rawJSON, "model").String()
    rawJSON = responsesconverter.ConvertOpenAIResponsesRequestToOpenAIChatCompletions(modelName, rawJSON, stream)
}
```

---

## 2. IMAGE/VIDEO PROCESSING & MULTIMODAL SUPPORT

### 2.1 Image Data Encoding (Base64 in OpenAI format)

**File:** `/internal/translator/openai/claude/openai_claude_request.go` (dòng 309-358)

```go
func convertClaudeContentPart(part gjson.Result) (string, bool) {
    partType := part.Get("type").String()
    
    switch partType {
    case "image":
        var imageURL string
        if source := part.Get("source"); source.Exists() {
            sourceType := source.Get("type").String()
            switch sourceType {
            case "base64":
                mediaType := source.Get("media_type").String()
                data := source.Get("data").String()
                // Convert: data:mediaType;base64,data
                imageURL = "data:" + mediaType + ";base64," + data
            case "url":
                imageURL = source.Get("url").String()
            }
        }
        // Build image_url content part
        imageContent := `{"type":"image_url","image_url":{"url":""}}`
        imageContent, _ = sjson.Set(imageContent, "image_url.url", imageURL)
        return imageContent, true
    }
}
```

### 2.2 Inline Data trong Gemini Format

**File:** `/internal/translator/gemini/openai/chat-completions/gemini_openai_request.go` (dòng 203-232)

Xử lý OpenAI image_url → Gemini inlineData conversion:

```go
case "image_url":
    imageURL := item.Get("image_url.url").String()
    if len(imageURL) > 5 {
        // Parse: data:mime/type;base64,base64data
        pieces := strings.SplitN(imageURL[5:], ";", 2)
        if len(pieces) == 2 && len(pieces[1]) > 7 {
            mime := pieces[0]
            data := pieces[1][7:]  // Skip "base64,"
            // Set Gemini format
            node, _ = sjson.SetBytes(node, "parts."+itoa(p)+".inlineData.mime_type", mime)
            node, _ = sjson.SetBytes(node, "parts."+itoa(p)+".inlineData.data", data)
            p++
        }
    }
```

### 2.3 File Upload & MIME Type Handling

**File:** `/internal/translator/gemini/openai/chat-completions/gemini_openai_request.go` (dòng 215-228)

```go
case "file":
    filename := item.Get("file.filename").String()
    fileData := item.Get("file.file_data").String()
    ext := ""
    if sp := strings.Split(filename, "."); len(sp) > 1 {
        ext = sp[len(sp)-1]
    }
    if mimeType, ok := misc.MimeTypes[ext]; ok {
        node, _ = sjson.SetBytes(node, "parts."+itoa(p)+".inlineData.mime_type", mimeType)
        node, _ = sjson.SetBytes(node, "parts."+itoa(p)+".inlineData.data", fileData)
        p++
    }
```

### 2.4 Gemini System Instruction với Images

**File:** `/internal/translator/openai/gemini/openai_gemini_request.go` (dòng 95-140)

Hỗ trợ inline data trong system instruction:

```go
// SystemInstruction có thể chứa parts với inlineData
if systemInstruction.Exists() {
    parts := systemInstruction.Get("parts")
    if parts.Exists() && parts.IsArray() {
        parts.ForEach(func(_, part gjson.Result) bool {
            if text := part.Get("text"); text.Exists() {
                // ... handle text
            }
            if inlineData := part.Get("inlineData"); inlineData.Exists() {
                mimeType := inlineData.Get("mimeType").String()
                data := inlineData.Get("data").String()
                // Convert to data:mime;base64,data format
                imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, data)
            }
        })
    }
}
```

---

## 3. GEMINI TRANSLATOR (OpenAI → Gemini Format Conversion)

### 3.1 Main Translation Function

**File:** `/internal/translator/openai/gemini/openai_gemini_request.go`

```go
func ConvertOpenAIRequestToGemini(modelName string, inputRawJSON []byte, _ bool) []byte
```

**Flow:**
1. Clone input JSON để tránh mutation
2. Initialize Gemini request structure: `{"contents":[]}`
3. Set model name
4. Handle reasoning effort (OpenAI `reasoning_effort` → Gemini `thinkingBudget`)
5. Convert messages: OpenAI messages array → Gemini contents array
6. Map image_url content:
   - Extract base64 data từ data URI
   - Convert sang Gemini `parts.inlineData.mime_type` + `parts.inlineData.data`
7. Convert tools (function calling)
8. Apply safety settings

### 3.2 Message Role Conversion

OpenAI → Gemini role mapping:
```
"system" → part of systemInstruction (role="user")
"user" → role="user"
"assistant" → role="model"
"tool" → embedded trong user content sau assistant response
```

### 3.3 Image Processing Pipeline

**Summary:**
1. OpenAI format: `{"type":"image_url","image_url":{"url":"data:image/png;base64,ABC..."}}`
2. Extract: mime type = `image/png`, data = `ABC...`
3. Gemini format: `{"inlineData":{"mimeType":"image/png","data":"ABC..."}}`

---

## 4. STATIC FILE SERVING (Management Control Panel)

### 4.1 Management HTML Route

**File:** `/internal/api/server.go` (dòng 312)

```go
func (s *Server) setupRoutes() {
    s.engine.GET("/management.html", s.serveManagementControlPanel)
}
```

### 4.2 Serve Implementation

**File:** `/internal/api/server.go` (dòng 616-641)

```go
func (s *Server) serveManagementControlPanel(c *gin.Context) {
    cfg := s.cfg
    if cfg == nil || cfg.RemoteManagement.DisableControlPanel {
        c.AbortWithStatus(http.StatusNotFound)
        return
    }
    filePath := managementasset.FilePath(s.configFilePath)
    if strings.TrimSpace(filePath) == "" {
        c.AbortWithStatus(http.StatusNotFound)
        return
    }

    if _, err := os.Stat(filePath); err != nil {
        if os.IsNotExist(err) {
            // Auto-download latest HTML if missing
            go managementasset.EnsureLatestManagementHTML(...)
            c.AbortWithStatus(http.StatusNotFound)
            return
        }
        c.AbortWithStatus(http.StatusInternalServerError)
        return
    }

    c.File(filePath)  // Serve file
}
```

### 4.3 Static File Location

- **Path:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/static/management.html`
- **Size:** ~1.4 MB (React SPA bundle)
- **Format:** Compiled React JavaScript + HTML

### 4.4 Management Routes Group

**File:** `/internal/api/server.go` (dòng 466-604)

```go
mgmt := s.engine.Group("/v0/management")
mgmt.Use(s.managementAvailabilityMiddleware(), s.mgmt.Middleware())
{
    // GET routes for configuration
    mgmt.GET("/config", s.mgmt.GetConfig)
    mgmt.GET("/config.yaml", s.mgmt.GetConfigYAML)
    
    // PUT routes for updates
    mgmt.PUT("/config.yaml", s.mgmt.PutConfigYAML)
    
    // API endpoints
    mgmt.GET("/usage", s.mgmt.GetUsageStatistics)
    mgmt.POST("/api-call", s.mgmt.APICall)
    
    // Auth management
    mgmt.GET("/gemini-cli-auth-url", s.mgmt.RequestGeminiCLIToken)
    // ... 30+ more routes
}
```

---

## 5. MULTIPART/FORM-DATA UPLOAD HANDLING

### 5.1 Auth Files Upload

**File:** `/internal/api/handlers/management/auth_files.go` (dòng 1-150)

Xử lý file upload cho authentication credentials:

```go
// Management route handlers hỗ trợ:
mgmt.POST("/auth-files", s.mgmt.UploadAuthFile)
mgmt.DELETE("/auth-files", s.mgmt.DeleteAuthFile)
mgmt.GET("/auth-files/download", s.mgmt.DownloadAuthFile)
```

### 5.2 Vertex Credential Import

**File:** `/internal/api/handlers/management/vertex_import.go`

Upload Google Vertex AI credentials files.

---

## 6. KEY TRANSLATOR FILES (Image/Video Content)

### Files Related to Image Processing:

1. **OpenAI → Gemini**
   - `/internal/translator/openai/gemini/openai_gemini_request.go` ✓
   - `/internal/translator/gemini/openai/chat-completions/gemini_openai_request.go` ✓

2. **OpenAI → Claude**
   - `/internal/translator/openai/claude/openai_claude_request.go` ✓ (base64 handling)

3. **Gemini → OpenAI**
   - `/internal/translator/gemini/openai/chat-completions/gemini_openai_request.go` ✓

4. **Claude → Gemini**
   - `/internal/translator/claude/gemini/claude_gemini_request.go`

5. **Utility Functions**
   - `/internal/util/gemini_schema.go` (schema transformation)
   - `/internal/misc/mime-type.go` (MIME type mapping)

---

## 7. REQUEST/RESPONSE HANDLERS STRUCTURE

### Base Handler:
**File:** `/sdk/api/handlers/handlers.go`

```
BaseAPIHandler
├── ExecuteWithAuthManager()    // Non-streaming requests
├── ExecuteStreamWithAuthManager()  // Streaming requests
├── ForwardStream()             // SSE streaming helpers
└── GetContextWithCancel()      // Context management
```

### OpenAI Handler:
**File:** `/sdk/api/handlers/openai/openai_handlers.go`

```
OpenAIAPIHandler
├── ChatCompletions()           // Main endpoint
├── handleStreamingResponse()   // Server-sent events
├── handleNonStreamingResponse() // JSON response
├── convertChatCompletionsStreamChunkToCompletions()
└── convertCompletionsRequestToChatCompletions()
```

---

## 8. STREAMING RESPONSE (SSE)

### Setup:
```go
flusher, ok := c.Writer.(http.Flusher)
c.Header("Content-Type", "text/event-stream")
c.Header("Cache-Control", "no-cache")
c.Header("Connection", "keep-alive")
```

### Format:
```
data: {"object":"chat.completion.chunk","choices":[...]}\n\n
data: [DONE]\n\n
```

---

## 9. ARCHITECTURE DIAGRAM: MULTIMODAL REQUEST FLOW

```
Client Request (OpenAI format with image)
    ↓
POST /v1/chat/completions
    ↓
openaiHandlers.ChatCompletions()
    ↓
detectStreamingFlag()
    ↓
ExecuteWithAuthManager() [non-stream] / ExecuteStreamWithAuthManager() [stream]
    ↓
BaseAPIHandler → Route to backend executor
    ↓
gemini_openai_request.ConvertOpenAIRequestToGemini()
    ├─ Extract image from: {"type":"image_url","image_url":{"url":"data:image/png;base64,..."}}
    ├─ Parse: mime=image/png, data=base64string
    └─ Output: {"parts":[{"inlineData":{"mimeType":"image/png","data":"..."}}]}
    ↓
Gemini API receives:
{
  "contents": [{
    "role": "user",
    "parts": [{
      "text": "Describe this image"
    }, {
      "inlineData": {
        "mimeType": "image/png",
        "data": "iVBORw0KGgoAAAANS..."
      }
    }]
  }]
}
    ↓
Response → Format back to OpenAI format
    ↓
Client receives SSE/JSON response
```

---

## 10. UNRESOLVED QUESTIONS & NOTES

1. **Multipart form handling**: Code không rõ ràng show multipart/form-data parsing. Có thể Gin automatically handles nó via `c.FormFile()`.

2. **Max file size**: Không thấy configuration cho max upload size - cần check management.yaml config.

3. **Video support**: Gemini API support video via `mimeType: "video/mp4"` nhưng code chỉ show image handling.

4. **Streaming image**: Không clear nếu images có thể được stream via chunked encoding.

5. **Security validation**: Không thấy image/file validation (size, type whitelist) trước khi forward to Gemini.

---

## 11. KEY DIRECTORIES

```
/internal/translator/
├── openai/
│   ├── claude/
│   └── gemini/
├── gemini/
│   └── openai/chat-completions/
├── claude/
│   └── gemini/
└── common/

/sdk/api/handlers/
├── openai/
├── gemini/
└── handlers.go (base)

/internal/api/
├── server.go (routing)
└── handlers/management/

/static/
└── management.html (1.4 MB React SPA)
```

---

## SUMMARY

**Multimodal API Status:**
- ✅ OpenAI image_url format → Base64 data URI
- ✅ Gemini inlineData support (image/png, image/jpeg, etc.)
- ✅ System instruction images
- ✅ Chat message images (user + assistant roles)
- ✅ Tool function responses
- ⚠️ Video support (API-level yes, code validation limited)
- ⚠️ Multipart form upload (implicit via Gin)

**Static File Serving:**
- ✅ `/management.html` route implemented
- ✅ Auto-download latest version from GitHub
- ✅ Config-based disable option
- ✅ Proper error handling (404, 500)

**Chat Completions Endpoint:**
- ✅ Full OpenAI API compatibility
- ✅ Streaming & non-streaming support
- ✅ Format auto-detection (Responses vs Chat Completions)
- ✅ Multiple backend routing (Gemini, Claude, etc.)

