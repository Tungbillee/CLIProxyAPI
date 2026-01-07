# Vue.js Chat UI Implementation Plan

**Ngày tạo:** 2026-01-04
**Active Plan:** `plans/260104-1053-vuejs-chat-ui`
**Mục tiêu:** Tạo dự án Vue.js Chat UI độc lập, clone tính năng từ React app hiện tại

---

## Executive Summary

Tạo Vue 3 Chat UI với đầy đủ tính năng:
- SSE streaming chat với Gemini AI models
- Upload images/videos với drag & drop, paste clipboard
- Hiển thị AI-generated images
- Model selector, context toggle, API key management
- Dark theme modern, responsive design
- Single HTML file output để serve từ backend

**Estimated Effort:** 3-4 ngày
**Tech Stack:** Vue 3 + Composition API + Pinia + TypeScript + TailwindCSS

---

## 1. Project Structure

```
CLIProxyAPI/web/vue-chat-ui/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── types/
│   │   └── index.ts              # Copy từ React (unchanged)
│   ├── utils/
│   │   ├── api.ts                # Copy từ React (unchanged)
│   │   └── fileUtils.ts          # Copy từ React (unchanged)
│   ├── stores/
│   │   └── chatStore.ts          # Pinia store (refactored từ Zustand)
│   ├── composables/
│   │   ├── useDropZone.ts        # Drag & drop logic
│   │   └── useClipboardPaste.ts  # Clipboard paste logic
│   ├── components/
│   │   ├── Header.vue
│   │   ├── ModelSelector.vue
│   │   ├── ApiKeyInput.vue
│   │   ├── MessageList.vue
│   │   ├── MessageBubble.vue
│   │   ├── ChatInput.vue
│   │   └── ErrorBanner.vue
│   └── assets/
│       └── styles/
│           └── main.css          # Tailwind + custom styles
└── env.d.ts
```

---

## 2. Phase Breakdown

### Phase 1: Project Setup (0.5 ngày)

**Mục tiêu:** Khởi tạo Vue 3 project với Vite, cấu hình TypeScript, Tailwind

**Tasks:**
1. Tạo project folder `web/vue-chat-ui/`
2. Khởi tạo package.json với dependencies
3. Cấu hình TypeScript (tsconfig.json)
4. Cấu hình Vite (vite.config.ts) với vite-plugin-singlefile
5. Setup TailwindCSS (config + postcss)
6. Copy CSS styles từ React app

**Files tạo mới:**
- `package.json`
- `tsconfig.json`, `tsconfig.node.json`
- `vite.config.ts`
- `tailwind.config.js`, `postcss.config.js`
- `index.html`
- `src/main.ts`
- `src/assets/styles/main.css`
- `env.d.ts`

**Dependencies:**
```json
{
  "dependencies": {
    "vue": "^3.5.0",
    "pinia": "^2.2.0",
    "lucide-vue-next": "^0.460.0",
    "vite-plugin-singlefile": "^2.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/tsconfig": "^0.5.0",
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "vue-tsc": "^2.2.0",
    "tailwindcss": "^3.4.19",
    "postcss": "^8.5.6",
    "autoprefixer": "^10.4.23"
  }
}
```

---

### Phase 2: Copy Utilities (0.5 ngày)

**Mục tiêu:** Copy code unchanged từ React (types, API, file utilities)

**Tasks:**
1. Copy `types/index.ts` (unchanged - TypeScript compatible)
2. Copy `utils/api.ts` (unchanged - pure async functions)
3. Copy `utils/fileUtils.ts` (unchanged - DOM APIs only)
4. Verify imports work correctly

**Files:**
- `src/types/index.ts` - **COPY** từ React
- `src/utils/api.ts` - **COPY** từ React
- `src/utils/fileUtils.ts` - **COPY** từ React

**Note:** Không cần sửa đổi gì vì đây là pure TypeScript/JavaScript functions.

---

### Phase 3: Store Implementation (1 ngày)

**Mục tiêu:** Tạo Pinia store thay thế Zustand store

**Tasks:**
1. Tạo `stores/chatStore.ts` với Pinia defineStore
2. Migrate all state properties (messages, isLoading, selectedModel, etc.)
3. Migrate all actions (addMessage, appendToMessage, etc.)
4. Implement localStorage persistence với `watch()`
5. Test store functionality

**Store Structure:**
```typescript
// stores/chatStore.ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Message, Model, GeneratedImage } from '../types'

const GEMINI_MODELS: Model[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', provider: 'google', supportsVision: true, supportsVideo: true },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', provider: 'google', supportsVision: true, supportsVideo: false },
  { id: 'gemini-2.5-computer-use-preview-10-2025', name: 'Gemini 2.5 Computer Use', provider: 'google', supportsVision: true, supportsVideo: true },
]

const STORAGE_KEY = 'gemini-chat-api-key'
const CONTEXT_KEY = 'gemini-chat-send-context'
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const selectedModel = ref(GEMINI_MODELS[0].id)
  const models = ref<Model[]>(GEMINI_MODELS)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const apiKey = ref(localStorage.getItem(STORAGE_KEY) || '')
  const sendContext = ref(localStorage.getItem(CONTEXT_KEY) !== 'false')
  const maxContextMessages = ref(10)

  // Actions
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const id = generateId()
    const newMessage: Message = { ...message, id, timestamp: Date.now() }
    messages.value.push(newMessage)
    return id
  }

  const updateMessage = (id: string, content: string) => {
    const msg = messages.value.find(m => m.id === id)
    if (msg) msg.content = content
  }

  const appendToMessage = (id: string, chunk: string) => {
    const msg = messages.value.find(m => m.id === id)
    if (msg) msg.content += chunk
  }

  const setMessageStreaming = (id: string, isStreaming: boolean) => {
    const msg = messages.value.find(m => m.id === id)
    if (msg) msg.isStreaming = isStreaming
  }

  const clearMessages = () => {
    if (abortController.value) abortController.value.abort()
    messages.value = []
    error.value = null
    abortController.value = null
  }

  const setLoading = (loading: boolean) => { isLoading.value = loading }
  const setSelectedModel = (model: string) => { selectedModel.value = model }
  const setError = (err: string | null) => { error.value = err }
  const setAbortController = (controller: AbortController | null) => { abortController.value = controller }

  const abortRequest = () => {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
      isLoading.value = false
    }
  }

  const setApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key)
    apiKey.value = key
  }

  const setSendContext = (send: boolean) => {
    localStorage.setItem(CONTEXT_KEY, String(send))
    sendContext.value = send
  }

  const getMessagesForApi = (excludeId?: string): Message[] => {
    let filtered = messages.value.filter(m => m.id !== excludeId)
    if (!sendContext.value) {
      const lastUserMsg = [...filtered].reverse().find(m => m.role === 'user')
      return lastUserMsg ? [lastUserMsg] : []
    }
    if (filtered.length > maxContextMessages.value) {
      filtered = filtered.slice(-maxContextMessages.value)
    }
    return filtered.map((msg, idx) => {
      if (idx < filtered.length - 1) {
        return { ...msg, images: undefined, videos: undefined }
      }
      return msg
    })
  }

  const addGeneratedImage = (id: string, image: GeneratedImage) => {
    const msg = messages.value.find(m => m.id === id)
    if (msg) {
      if (!msg.generatedImages) msg.generatedImages = []
      msg.generatedImages.push(image)
    }
  }

  return {
    // State
    messages,
    isLoading,
    selectedModel,
    models,
    error,
    abortController,
    apiKey,
    sendContext,
    maxContextMessages,
    // Actions
    addMessage,
    updateMessage,
    appendToMessage,
    setMessageStreaming,
    clearMessages,
    setLoading,
    setSelectedModel,
    setError,
    setAbortController,
    abortRequest,
    setApiKey,
    setSendContext,
    getMessagesForApi,
    addGeneratedImage,
  }
})
```

---

### Phase 4: Composables (0.5 ngày)

**Mục tiêu:** Tạo reusable composables cho drag & drop và clipboard paste

**Tasks:**
1. Tạo `composables/useDropZone.ts`
2. Tạo `composables/useClipboardPaste.ts`

**useDropZone.ts:**
```typescript
import { ref } from 'vue'
import { processImageFile, processVideoFile, isImageFile, isVideoFile } from '../utils/fileUtils'
import type { ImageAttachment, VideoAttachment } from '../types'

export function useDropZone() {
  const isDragOver = ref(false)
  const uploadError = ref<string | null>(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    isDragOver.value = true
  }

  const handleDragLeave = () => {
    isDragOver.value = false
  }

  const handleDrop = async (
    e: DragEvent,
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    e.preventDefault()
    isDragOver.value = false

    const files = e.dataTransfer?.files
    if (!files) return

    await processFiles(files, onImage, onVideo)
  }

  const processFiles = async (
    files: FileList | File[],
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    uploadError.value = null
    for (const file of Array.from(files)) {
      try {
        if (isImageFile(file)) {
          const img = await processImageFile(file)
          onImage(img)
        } else if (isVideoFile(file)) {
          const vid = await processVideoFile(file)
          onVideo(vid)
        } else {
          uploadError.value = `Định dạng không hỗ trợ: ${file.name}`
        }
      } catch (err) {
        uploadError.value = err instanceof Error ? err.message : 'Upload thất bại'
      }
    }
  }

  return {
    isDragOver,
    uploadError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFiles,
  }
}
```

**useClipboardPaste.ts:**
```typescript
import { processImageFile, processVideoFile, isImageFile, isVideoFile } from '../utils/fileUtils'
import type { ImageAttachment, VideoAttachment } from '../types'

export function useClipboardPaste() {
  const handlePaste = async (
    e: ClipboardEvent,
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length === 0) return
    e.preventDefault()

    for (const file of files) {
      try {
        if (isImageFile(file)) {
          const img = await processImageFile(file)
          onImage(img)
        } else if (isVideoFile(file)) {
          const vid = await processVideoFile(file)
          onVideo(vid)
        }
      } catch (err) {
        console.error('Paste failed:', err)
      }
    }
  }

  return { handlePaste }
}
```

---

### Phase 5: Component Implementation (2 ngày)

**Mục tiêu:** Migrate tất cả React components sang Vue 3 SFC

#### 5.1 App.vue
```vue
<script setup lang="ts">
import Header from './components/Header.vue'
import ErrorBanner from './components/ErrorBanner.vue'
import MessageList from './components/MessageList.vue'
import ChatInput from './components/ChatInput.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-dark-900">
    <Header />
    <ErrorBanner />
    <MessageList />
    <ChatInput />
  </div>
</template>
```

#### 5.2 Header.vue
- ModelSelector dropdown
- Context toggle button
- Settings panel (API Key)
- Clear messages button
- Link to management panel

#### 5.3 ModelSelector.vue
- Dropdown với Gemini models
- Show Vision/Video badges
- Click outside to close

#### 5.4 ApiKeyInput.vue
- Password input with show/hide toggle
- Auto-save on blur/Enter
- "Đã lưu" feedback

#### 5.5 MessageList.vue
- Loop over messages
- Auto-scroll to bottom
- Empty state welcome message

#### 5.6 MessageBubble.vue (sub-component)
- User/Assistant styling
- Image/video attachments
- Generated images with lightbox
- Download button
- Timestamp

#### 5.7 ChatInput.vue
- Textarea với v-model
- Image/video upload buttons
- Drag & drop zone
- Paste handling
- Send/Stop buttons
- Attachment previews

#### 5.8 ErrorBanner.vue
- Display error from store
- Dismiss button

---

### Phase 6: Build & Integration (0.5 ngày)

**Mục tiêu:** Build single HTML file và integrate với backend

**Tasks:**
1. Test development mode (`npm run dev`)
2. Build production (`npm run build`)
3. Verify output là single HTML file
4. Update backend route nếu cần
5. Test với backend thật

**Vite Config:**
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: '../../static',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'vue-chat-ui.js',
      },
    },
  },
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:8317',
        changeOrigin: true,
      },
    },
  },
})
```

**Build Script:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build && mv ../../static/index.html ../../static/vue-chat.html",
    "preview": "vite preview"
  }
}
```

---

## 3. UI/UX Design

### Color Palette (Tailwind Custom)
```javascript
colors: {
  primary: { /* blue shades 50-950 */ },
  dark: {
    50: '#f8fafc',
    // ... dark theme grays
    900: '#0f172a',
    950: '#020617',
  },
}
```

### Component Styling
- **Background:** `bg-dark-900` (main), `bg-dark-800` (cards)
- **Borders:** `border-dark-700`
- **Text:** `text-dark-100` (primary), `text-dark-400` (secondary)
- **Accent:** `primary-500`, `primary-600`
- **User messages:** `bg-primary-600`
- **Assistant messages:** `bg-dark-700`

### Animations
- Streaming cursor pulse
- Button hover transitions
- Dropdown open/close
- Lightbox fade
- Drag overlay appearance

---

## 4. API Integration

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Send message (SSE streaming) |
| GET | `/v1/models` | Fetch available models |

### Request Format
```typescript
{
  model: string,
  messages: OpenAIMessage[],
  stream: true,
  max_tokens: 8192
}
```

### Response Handling
- SSE parsing (data: prefix)
- Line buffering for incomplete chunks
- Handle text chunks → `appendToMessage()`
- Handle image chunks → `addGeneratedImage()`
- Handle [DONE] signal

---

## 5. Key Implementation Notes

### Vue 3 Patterns
1. **State:** Use `ref()` cho primitives, store cho global state
2. **Effects:** Use `watchEffect()` cho auto-scroll
3. **Cleanup:** Use `onBeforeUnmount()` cho abort controller
4. **Templates:** Use `v-model`, `@click`, `:class` bindings
5. **Props:** Use `defineProps()` với TypeScript

### Streaming Pattern (unchanged from React)
```typescript
for await (const chunk of streamChatCompletion(...)) {
  if (chunk.type === 'text') {
    store.appendToMessage(assistantMsgId, chunk.content)
  } else if (chunk.type === 'image') {
    store.addGeneratedImage(assistantMsgId, chunk.image)
  }
}
```

### File Upload Pattern
```typescript
const handleImageUpload = async (files: FileList | File[]) => {
  for (const file of Array.from(files)) {
    if (isImageFile(file)) {
      const img = await processImageFile(file)
      images.value.push(img)
    }
  }
}
```

---

## 6. Testing Checklist

- [ ] Chat gửi nhận messages
- [ ] Streaming response hiển thị realtime
- [ ] Model selector hoạt động
- [ ] Image upload (click, drag, paste)
- [ ] Video upload
- [ ] Generated images display
- [ ] Lightbox view
- [ ] Download images
- [ ] Context toggle
- [ ] API key save/load
- [ ] Clear messages
- [ ] Stop request
- [ ] Error handling
- [ ] Responsive design
- [ ] Dark theme styling

---

## 7. Dependencies Summary

### Production
- vue@3.5.0
- pinia@2.2.0
- lucide-vue-next@0.460.0
- vite-plugin-singlefile@2.3.0

### Development
- @vitejs/plugin-vue@5.2.0
- typescript@5.9.3
- vue-tsc@2.2.0
- vite@7.2.4
- tailwindcss@3.4.19
- postcss@8.5.6
- autoprefixer@10.4.23

---

## 8. Risk Assessment

### Low Risk
- ✅ Types & utilities (copy unchanged)
- ✅ Async streaming (works identical)
- ✅ File upload (DOM APIs)

### Medium Risk
- ⚠️ Store refactor (Zustand → Pinia pattern change)
- ⚠️ Component migration (hooks → Composition API)

### Mitigations
- Use Pinia Setup Store pattern (most similar to Zustand)
- Reference scout reports for mapping tables
- Test incrementally per component

---

## 9. Unresolved Questions

1. **Route naming:** `/vue-chat.html` hay tên khác?
2. **Sidebar integration:** Thêm link vào management sidebar?
3. **Feature parity:** Có cần thêm features mới không?

---

## References

- **Research reports:**
  - `research/vue3-sse-pinia.md` - SSE & Pinia patterns
  - `research/vue3-file-upload.md` - File upload patterns
- **Scout reports:**
  - `scout/react-analysis.md` - Full React analysis
  - `scout/migration-quick-reference.md` - Quick reference
- **React source:** `/CLIProxyAPI/web/chat-ui/src/`

---

**Status:** Ready for implementation
**Next step:** Phase 1 - Project Setup
