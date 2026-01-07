# Implementation Plan: Gemini Media Chat UI

**Plan ID:** 260103-1215-gemini-media-chat-ui
**Ngày tạo:** 2026-01-03
**Phiên bản:** 1.0
**Trạng thái:** Ready for Approval

---

## 1. Executive Summary

### Mục tiêu
Xây dựng Chat UI tích hợp vào CLIProxyAPI server cho phép:
1. Upload ảnh/video để Gemini phân tích
2. Chat với Gemini qua giao diện web
3. Chọn model để khởi tạo conversation

### Approach
- **Frontend:** React 18 + TypeScript + Tailwind CSS (tương tự CPAMC)
- **Backend:** Sử dụng API có sẵn `/v1/chat/completions` (đã hỗ trợ multimodal)
- **Deployment:** Tích hợp vào CLIProxyAPI server, serve static HTML tại `/chat.html`

### Phạm vi
- Single-page chat application
- Upload image/video inline (base64)
- Model selector dropdown
- SSE streaming responses
- Responsive mobile design

---

## 2. Research Summary

### 2.1 Existing API Capabilities (từ Scout Report)

**CLIProxyAPI đã hỗ trợ:**
- ✅ `POST /v1/chat/completions` - OpenAI-compatible endpoint
- ✅ Multimodal content: `image_url` với base64 data URI
- ✅ Translator: OpenAI format → Gemini `inlineData` format
- ✅ Streaming: SSE format (`data: {...}\n\n`)
- ✅ Static file serving: Pattern từ `/management.html`

**Image/Video Flow đã implement:**
```
Client Request (OpenAI format):
{
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Describe this"},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
    ]
  }]
}
    ↓
Translator converts to Gemini:
{
  "contents": [{
    "parts": [
      {"text": "Describe this"},
      {"inlineData": {"mimeType": "image/png", "data": "..."}}
    ]
  }]
}
```

### 2.2 Gemini API Capabilities (từ Research Report)

- **MIME Types hỗ trợ:** image/png, jpeg, webp, heic, heif; video/mp4, mpeg, mov, avi, webm
- **Inline limit:** 20MB tổng request
- **Video duration:** Tới 3 giờ (Gemini 2.5 Pro)
- **Models:** gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash

### 2.3 React Chat UI Patterns (từ Research Report)

- **Composable primitives** thay vì monolithic components
- **Zustand** cho state management
- **SSE streaming** với Vercel AI SDK pattern
- **shadcn/ui** style cho Tailwind components

---

## 3. Architecture Design

### 3.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    BROWSER (Chat UI)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React SPA (/chat.html)                              │   │
│  │  ├── ChatInterface                                   │   │
│  │  │   ├── MessageList (virtualized)                   │   │
│  │  │   ├── ChatInput + FileDropZone                    │   │
│  │  │   └── ModelSelector                               │   │
│  │  └── Zustand Store (messages, model, sessions)       │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                            │
                            │ POST /v1/chat/completions
                            │ (multipart content + streaming)
                            ↓
┌────────────────────────────────────────────────────────────┐
│                 CLIProxyAPI SERVER (:8317)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Static: GET /chat.html → chat.html (React SPA)      │   │
│  │  API:    POST /v1/chat/completions                   │   │
│  │  Models: GET /v1/models                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│            ┌───────────────┴───────────────┐               │
│            ↓                               ↓                │
│      OpenAI Handler              Gemini Translator         │
│      (streaming SSE)             (inlineData conversion)   │
└────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌────────────────────────────────────────────────────────────┐
│              UPSTREAM API (Gemini/Claude/etc.)              │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx      # Main container
│   │   ├── MessageList.tsx        # Virtualized message display
│   │   ├── MessageItem.tsx        # Single message component
│   │   ├── ChatInput.tsx          # Input + file upload trigger
│   │   ├── ModelSelector.tsx      # Dropdown model selection
│   │   └── StreamingMessage.tsx   # Animated streaming text
│   ├── ui/
│   │   ├── FileDropZone.tsx       # Drag & drop zone
│   │   ├── FilePreview.tsx        # Image/video preview
│   │   ├── Button.tsx             # Styled button
│   │   └── Select.tsx             # Styled select
│
├── hooks/
│   ├── useChat.ts                 # Chat logic + SSE streaming
│   ├── useModels.ts               # Fetch available models
│   └── useFileUpload.ts           # File handling + base64 conversion
│
├── store/
│   └── chatStore.ts               # Zustand store definition
│
├── utils/
│   ├── api.ts                     # API client (fetch wrapper)
│   ├── fileUtils.ts               # File validation, compression
│   └── messageFormatter.ts        # Markdown rendering
│
└── App.tsx                        # Root component
```

### 3.3 Data Flow

```
1. User selects model → store.selectModel()
2. User types message + drops image → store.setInput(), store.addFile()
3. User clicks Send:
   a. Build OpenAI request with image_url parts
   b. POST /v1/chat/completions with stream=true
   c. Parse SSE chunks → store.appendToCurrentMessage()
   d. On [DONE] → store.finalizeMessage()
4. Response displays with streaming animation
```

---

## 4. Implementation Phases

### Phase 1: Backend Setup (Estimate: 2-3 hours)
**Objective:** Enable chat.html static serving

**Tasks:**
1. Add route `GET /chat.html` in `server.go`
2. Create placeholder `static/chat.html` file
3. Test serving works at `http://localhost:8317/chat.html`

**Files to modify:**
- `internal/api/server.go` - Add route
- `static/chat.html` - Create file

**Acceptance criteria:**
- [ ] `curl http://localhost:8317/chat.html` returns HTML
- [ ] No impact on existing routes

---

### Phase 2: React Project Setup (Estimate: 3-4 hours)
**Objective:** Initialize React + TypeScript + Tailwind project

**Tasks:**
1. Create `web/chat-ui/` directory
2. Initialize Vite + React + TypeScript project
3. Configure Tailwind CSS
4. Setup build script to output to `static/chat.html`
5. Configure proxy for development (`/v1/*` → localhost:8317)

**File structure:**
```
web/
└── chat-ui/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        └── index.css
```

**Commands:**
```bash
cd web && npm create vite@latest chat-ui -- --template react-ts
cd chat-ui && npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install zustand
```

**Build output:** `static/chat.html` (single file với inline JS/CSS)

**Acceptance criteria:**
- [ ] `npm run dev` starts dev server
- [ ] `npm run build` outputs single HTML file
- [ ] Tailwind classes work

---

### Phase 3: Core Chat UI (Estimate: 6-8 hours)
**Objective:** Basic chat functionality without file upload

**Tasks:**
1. Implement `ChatInterface` layout
2. Implement `MessageList` with basic styling
3. Implement `ChatInput` with Enter to send
4. Implement `useChat` hook with SSE streaming
5. Implement `chatStore` với Zustand
6. Add loading states và error handling

**Key code:**

```typescript
// hooks/useChat.ts
export function useChat() {
  const { messages, addMessage, updateLastMessage } = useChatStore();
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string, model: string) => {
    addMessage({ role: 'user', content });
    addMessage({ role: 'assistant', content: '', isStreaming: true });

    const response = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // Parse SSE format: data: {...}\n\n
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content || '';
        updateLastMessage(content);
      }
    }

    setIsStreaming(false);
  };

  return { messages, sendMessage, isStreaming };
}
```

**Acceptance criteria:**
- [ ] Can send text message
- [ ] Response streams in real-time
- [ ] Messages persist in state
- [ ] Error handling works

---

### Phase 4: Model Selector (Estimate: 2-3 hours)
**Objective:** Allow selecting Gemini model

**Tasks:**
1. Implement `useModels` hook to fetch `/v1/models`
2. Implement `ModelSelector` dropdown component
3. Store selected model in Zustand
4. Filter to show only Gemini models (or all)

**Key code:**

```typescript
// hooks/useModels.ts
export function useModels() {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    fetch('/v1/models', {
      headers: { 'Authorization': `Bearer ${getApiKey()}` }
    })
      .then(r => r.json())
      .then(data => setModels(data.data || []));
  }, []);

  return models;
}

// components/ModelSelector.tsx
export function ModelSelector() {
  const models = useModels();
  const { selectedModel, selectModel } = useChatStore();

  return (
    <select
      value={selectedModel}
      onChange={e => selectModel(e.target.value)}
      className="px-3 py-2 border rounded-md"
    >
      {models.map(m => (
        <option key={m.id} value={m.id}>{m.id}</option>
      ))}
    </select>
  );
}
```

**Acceptance criteria:**
- [ ] Models load from API
- [ ] Can switch models
- [ ] Selected model used in requests

---

### Phase 5: File Upload - Image (Estimate: 4-5 hours)
**Objective:** Support image upload và preview

**Tasks:**
1. Implement `FileDropZone` with drag & drop
2. Implement `FilePreview` for images
3. Implement `useFileUpload` hook với base64 conversion
4. Modify `ChatInput` to include file attachment button
5. Modify request building to include `image_url` parts

**Key code:**

```typescript
// hooks/useFileUpload.ts
export function useFileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const addFile = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error('Only images and videos supported');
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('File too large (max 20MB)');
    }

    const base64 = await fileToBase64(file);
    setFiles(prev => [...prev, {
      name: file.name,
      type: file.type,
      base64,
      preview: URL.createObjectURL(file)
    }]);
  };

  const buildContentParts = (text: string) => {
    const parts: ContentPart[] = [{ type: 'text', text }];

    for (const file of files) {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${file.type};base64,${file.base64}` }
      });
    }

    return parts;
  };

  return { files, addFile, removeFile, buildContentParts, clearFiles };
}
```

**Acceptance criteria:**
- [ ] Can drag & drop images
- [ ] Image preview displays
- [ ] Can remove attached image
- [ ] Image sent to API correctly
- [ ] Gemini responds with image analysis

---

### Phase 6: File Upload - Video (Estimate: 2-3 hours)
**Objective:** Support video upload

**Tasks:**
1. Extend `FilePreview` for video thumbnails
2. Add video MIME type support
3. Add file size warnings (>20MB)
4. Test with short videos

**Note:** Videos >20MB sẽ cần File API (out of scope cho MVP)

**Acceptance criteria:**
- [ ] Can upload video files
- [ ] Video preview/thumbnail works
- [ ] Gemini analyzes video content
- [ ] Size validation works

---

### Phase 7: UI Polish & Mobile (Estimate: 3-4 hours)
**Objective:** Production-ready UI

**Tasks:**
1. Responsive layout (mobile-first)
2. Dark mode support
3. Loading states và animations
4. Error toast notifications
5. Keyboard shortcuts (Enter to send, Shift+Enter newline)
6. Auto-scroll to bottom
7. Copy message button

**Styling approach:** Tailwind + CSS variables for theming

**Acceptance criteria:**
- [ ] Works on mobile (touch-friendly)
- [ ] Dark mode toggle
- [ ] Smooth streaming animation
- [ ] Good keyboard UX

---

### Phase 8: Build & Integration (Estimate: 2-3 hours)
**Objective:** Final integration into CLIProxyAPI

**Tasks:**
1. Configure Vite for single-file output (viteSingleFile plugin)
2. Build production bundle
3. Copy to `static/chat.html`
4. Test full flow on server
5. Update README với Chat UI documentation

**Build script:**
```bash
#!/bin/bash
cd web/chat-ui
npm run build
cp dist/index.html ../../static/chat.html
echo "Chat UI built successfully!"
```

**Acceptance criteria:**
- [ ] Single HTML file < 500KB
- [ ] Works without dev server
- [ ] All features functional on production build

---

## 5. Technical Specifications

### 5.1 API Integration

**Request format:**
```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What's in this image?"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
      ]
    }
  ],
  "stream": true
}
```

**Response format (SSE):**
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"The"}}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" image"}}]}

data: [DONE]
```

### 5.2 File Handling

| Type | Max Size | Validation | Notes |
|------|----------|------------|-------|
| image/png | 20MB | Required | Best quality |
| image/jpeg | 20MB | Required | Compressed |
| image/webp | 20MB | Optional | Modern format |
| video/mp4 | 20MB | Required | Short clips |
| video/webm | 20MB | Optional | Web-optimized |

### 5.3 State Management (Zustand)

```typescript
interface ChatStore {
  // State
  messages: Message[];
  selectedModel: string;
  isStreaming: boolean;
  pendingFiles: UploadedFile[];

  // Actions
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  selectModel: (modelId: string) => void;
  addFile: (file: UploadedFile) => void;
  removeFile: (fileName: string) => void;
  clearFiles: () => void;
  reset: () => void;
}
```

### 5.4 Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.0.0"
  }
}
```

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large file uploads fail | High | Validate size before upload, show clear error |
| SSE parsing errors | Medium | Robust error handling, reconnect logic |
| Model list empty | Medium | Show helpful message, manual model input |
| Mobile keyboard issues | Low | Test on real devices, safe area handling |
| Build size too large | Low | Code splitting, lazy loading |

---

## 7. Success Criteria

### Must Have (MVP)
- [ ] Text chat với Gemini works
- [ ] Image upload và analysis works
- [ ] Model selection works
- [ ] Streaming responses work
- [ ] Mobile responsive

### Nice to Have
- [ ] Video upload support
- [ ] Dark mode
- [ ] Chat history persistence (localStorage)
- [ ] Copy/share messages
- [ ] Markdown rendering

---

## 8. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend Setup | 2-3h | None |
| Phase 2: React Setup | 3-4h | Phase 1 |
| Phase 3: Core Chat | 6-8h | Phase 2 |
| Phase 4: Model Selector | 2-3h | Phase 3 |
| Phase 5: Image Upload | 4-5h | Phase 3 |
| Phase 6: Video Upload | 2-3h | Phase 5 |
| Phase 7: UI Polish | 3-4h | Phase 5 |
| Phase 8: Build | 2-3h | All |
| **Total** | **24-33 hours** | |

---

## 9. References

### Research Reports
- [scout/scout-multimodal-api.md](scout/scout-multimodal-api.md) - Codebase analysis
- [research/gemini-multimodal-api.md](research/gemini-multimodal-api.md) - Gemini API capabilities
- [research/react-chat-ui-patterns.md](research/react-chat-ui-patterns.md) - UI patterns

### External Docs
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://github.com/pmndrs/zustand)

---

## 10. Approval Checklist

- [ ] Technical approach approved
- [ ] Scope confirmed (MVP vs full)
- [ ] Dependencies acceptable
- [ ] Timeline acceptable

**Ready for implementation upon approval.**
