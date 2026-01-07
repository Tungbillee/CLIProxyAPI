# Phân Tích React Chat-UI Implementation

**Ngày:** 2026-01-04  
**Mục đích:** Ánh xạ React pattern sang Vue 3 Composition API  
**Nguồn:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/`

---

## 1. CẤU TRÚC COMPONENT & TRÁCH NHIỆM

### 1.1 Component Hierarchy
```
App.tsx (Root)
├── Header.tsx
│   ├── ModelSelector.tsx
│   ├── ApiKeyInput.tsx
│   └── Settings Toggle (UI)
├── ErrorBanner.tsx (Global error display)
├── MessageList.tsx
│   └── MessageBubble.tsx (Sub-component)
└── ChatInput.tsx
    ├── File upload handlers
    ├── Attachment preview
    └── Message sending
```

### 1.2 Component Thành Phần

| Component | Trách Nhiệm | Props | State |
|-----------|------------|-------|-------|
| **App** | Root layout | None | None |
| **Header** | Navigation, model selector, settings | None | `showSettings` (local) |
| **ModelSelector** | Dropdown chọn model | None | `isOpen` (local) |
| **ApiKeyInput** | Quản lý API key, toggle show/hide | None | `showKey`, `tempKey`, `saved` (local) |
| **MessageList** | Render danh sách tin nhắn | None | None (từ store) |
| **MessageBubble** | Render single message | `message: Message` | `lightboxImage` (local) |
| **ChatInput** | Input & gửi tin nhắn | None | 5 local states |
| **ErrorBanner** | Hiển thị lỗi global | None | None (từ store) |

---

## 2. STATE MANAGEMENT PATTERNS (ZUSTAND)

### 2.1 Store Structure (chatStore.ts)

**Pattern:** Zustand store centralized với React hooks

```typescript
// React Pattern
const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messages: [],
  isLoading: false,
  selectedModel: GEMINI_MODELS[0].id,
  apiKey: localStorage.getItem(STORAGE_KEY) || '',
  sendContext: localStorage.getItem(CONTEXT_KEY) !== 'false',
  
  // Actions (methods)
  addMessage: (message) => { /* ... */ },
  updateMessage: (id, content) => { /* ... */ },
  appendToMessage: (id, chunk) => { /* ... */ },
  setMessageStreaming: (id, isStreaming) => { /* ... */ },
  clearMessages: () => { /* ... */ },
  setLoading: (loading) => { /* ... */ },
  setSelectedModel: (model) => { /* ... */ },
  setError: (error) => { /* ... */ },
  setAbortController: (controller) => { /* ... */ },
  abortRequest: () => { /* ... */ },
  setApiKey: (key) => { /* ... */ },
  setSendContext: (send) => { /* ... */ },
  getMessagesForApi: (excludeId) => { /* ... */ },
  addGeneratedImage: (id, image) => { /* ... */ },
}))
```

### 2.2 Key Features

| Feature | Cách Sử Dụng React |
|---------|------------------|
| **Hook Usage** | `const { messages, addMessage, setLoading } = useChatStore()` |
| **Persistence** | localStorage.getItem/setItem trong initial state & actions |
| **Selectors** | Trực tiếp từ hook - tự động track dependency |
| **Async Operations** | Không async trong store, async xử lý ở component |
| **Message Context** | `getMessagesForApi()` với logic filtering/limiting |
| **Abort Control** | AbortController lưu trong state để cancel requests |

### 2.3 Data Flow

1. **Add Message:** User gửi → `addMessage()` → append vào messages array
2. **Update Message:** Streaming nhận → `appendToMessage()` hoặc `updateMessage()`
3. **Clear Messages:** Người dùng click clear → `clearMessages()` → abort request
4. **Context Filter:** Gửi tin → `getMessagesForApi()` → filter based on settings

---

## 3. API INTEGRATION PATTERNS

### 3.1 API Utilities (api.ts)

**Pattern:** Async generators cho streaming, type-safe message conversion

#### convertToOpenAIMessages()
- Input: `Message[]` (custom type)
- Output: `OpenAIMessage[]` (OpenAI API format)
- Logic: Handle multimodal (text + images + videos)
- Encoding: Base64 data URLs

#### streamChatCompletion()
```typescript
async function* streamChatCompletion(
  model: string,
  messages: Message[],
  signal: AbortSignal,  // Từ AbortController
  apiKey: string
): AsyncGenerator<StreamChunk>
```

**Features:**
- Streaming response handling (ReadableStream)
- Server-Sent Events (SSE) parsing (data: format)
- Line buffering để handle incomplete chunks
- Type-safe chunk yielding (text | image)
- Error handling & cleanup (reader.releaseLock)

#### fetchModels()
- Simple GET request
- Fallback empty array nếu error

### 3.2 Request Details

| Aspect | Giá Trị |
|--------|--------|
| **Base URL** | `/v1` (proxy endpoint) |
| **Endpoint** | POST `/v1/chat/completions` |
| **Auth** | Bearer token (apiKey) trong header |
| **Stream** | true |
| **Max Tokens** | 8192 |
| **Abort Signal** | AbortSignal từ AbortController |

### 3.3 Response Handling

```
Raw Stream → Line Parser → JSON Parse → Type Check → Yield to Component
                ↓
            [DONE] = Stop
            delta.content = Append to message
            delta.images = Add generated image
```

---

## 4. TYPE DEFINITIONS

### 4.1 Core Types

```typescript
// Message
interface Message {
  id: string;                           // Generated: msg_${timestamp}_${random}
  role: 'user' | 'assistant' | 'system';
  content: string;                      // Plain text, markdown-ready
  images?: ImageAttachment[];           // User uploads
  videos?: VideoAttachment[];           // User uploads
  generatedImages?: GeneratedImage[];   // AI-generated
  timestamp: number;                    // Date.now()
  isStreaming?: boolean;                // For UI placeholder
}

// Attachments
interface ImageAttachment {
  id: string;                           // img_${timestamp}_${random}
  data: string;                         // Base64 (no prefix)
  mimeType: string;                     // e.g., 'image/jpeg'
  name: string;
  preview: string;                      // data:mime;base64,... (full URL)
}

interface VideoAttachment {
  id: string;                           // vid_${timestamp}_${random}
  data: string;                         // Base64
  mimeType: string;
  name: string;
  preview: string;                      // Generated thumbnail
  duration?: number;                    // Optional
}

interface GeneratedImage {
  url: string;                          // data:image/png;base64,...
  index: number;                        // Position in response
}

// Model
interface Model {
  id: string;                           // e.g., 'gemini-2.5-flash'
  name: string;
  provider: string;
  supportsVision: boolean;
  supportsVideo: boolean;
}
```

### 4.2 OpenAI API Types

```typescript
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContentPart[];
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface ChatCompletionChunk {
  choices: [{
    delta: {
      role?: string;
      content?: string;
      images?: [{
        index: number;
        type: string;
        image_url: { url: string };
      }];
    };
  }];
}
```

---

## 5. FILE UPLOAD UTILITIES

### 5.1 Constraints

| Item | Value |
|------|-------|
| Max Image Size | 20 MB |
| Max Video Size | 100 MB |
| Image Types | jpeg, png, gif, webp |
| Video Types | mp4, webm, quicktime, avi, mpeg |

### 5.2 Functions

#### isImageFile() / isVideoFile()
- Input: `File`
- Output: `boolean` based on MIME type

#### fileToBase64()
```typescript
// File → Promise<base64_string> (without data: prefix)
const reader = new FileReader()
reader.readAsDataURL(file)
// Extract second part: "data:...,BASE64_HERE"
```

#### processImageFile() / processVideoFile()
- Validation: Type & size
- Conversion: file → base64
- Return: Attachment object with preview

#### generateVideoThumbnail()
```
Video element → Canvas → Draw frame @ 0.1s → toDataURL()
Fallback: SVG play icon (base64)
```

#### formatFileSize()
- Bytes → Human-readable (B/KB/MB)

### 5.3 Attachment ID Generation

Pattern: `{prefix}_{timestamp}_{random_9chars}`
- Images: `img_1704341234567_abc123def`
- Videos: `vid_1704341234567_xyz789uvw`

---

## 6. REACT PATTERN → VUE 3 MAPPING

### 6.1 State Management

| React (Zustand) | Vue 3 (Pinia) | Keterangan |
|-----------------|---------------|-----------|
| `create<T>((set, get) => {})` | `defineStore('chat', () => {})` | Store definition |
| `const state = useStore()` | `const store = useChatStore()` | Hook usage sama |
| `set({ key: value })` | `this.key = value` hoặc ref mutasi | State update |
| `get()` | `computed()` / getter | Access current state |
| localStorage persistence | `watch()` + localStorage.setItem | Reactive persistence |

### 6.2 Component Patterns

| React | Vue 3 | Mapping |
|-------|-------|---------|
| `useState()` | `ref()` / `reactive()` | Local state |
| `useEffect()` | `watchEffect()` / `onMounted()` | Side effects |
| `useCallback()` | Hàm định nghĩa trực tiếp | Event handlers |
| `useRef()` | `ref<HTMLElement>(null)` | DOM references |
| Hook cleanup return | onBeforeUnmount | Cleanup |
| Props passing | `defineProps()` | Props |
| Emit | `emit()` từ `defineEmits()` | Event emitting |

### 6.3 Async/Streaming

| React | Vue 3 | Mapping |
|-------|-------|---------|
| `async function* generator` | `async function*` (same) | Async generators |
| `for await (chunk of generator)` | `for await (chunk of generator)` | Same |
| `AbortSignal` | `AbortSignal` (same) | Abort control |
| Error handling try/catch | `try/catch` (same) | Same |

### 6.4 Event Handling

| React | Vue 3 | Mapping |
|-------|-------|---------|
| `onChange={(e) => setState(e.target.value)}` | `@input="(e) => state = e.target.value"` | Input binding |
| `onClick={() => handler()}` | `@click="handler"` | Click event |
| `onKeyDown={(e) => if (e.key === 'Enter')}` | `@keydown.enter="handler"` | Key modifiers |
| `onDragOver`, `onDragLeave`, `onDrop` | `@dragover`, `@dragleave`, `@drop` | Drag events |
| `onPaste` | `@paste` | Paste event |
| `onClipboardData.items` | `event.clipboardData.items` (same) | Same |

### 6.5 DOM Interaction

| React | Vue 3 | Mapping |
|-------|-------|---------|
| `const ref = useRef<HTMLInputElement>(null)` | `const ref = ref<HTMLInputElement>(null)` | Ref creation |
| `imageInputRef.current?.click()` | `imageInputRef.value?.click()` | Ref access |
| `document.createElement('video')` | `document.createElement('video')` | Same |
| `document.body.appendChild()` | `document.body.appendChild()` | Same |
| `URL.createObjectURL(file)` | `URL.createObjectURL(file)` | Same |

### 6.6 Conditional Rendering

| React | Vue 3 | Mapping |
|-------|-------|---------|
| `{condition && <Component />}` | `<Component v-if="condition" />` | Conditional render |
| `{array.map(item => <Item />)}` | `<Item v-for="item in array" :key="item.id" />` | List render |
| Ternary operator `? :` | `v-if` / `v-show` / ternary in template | Conditional class |

### 6.7 Styling

| React | Vue 3 | Mapping |
|-------|-------|---------|
| className string interpolation | class binding + Tailwind | Class binding |
| `className={isUser ? 'class-a' : 'class-b'}` | `:class="isUser ? 'class-a' : 'class-b'"` | Dynamic class |
| Inline styles object | `:style="{ key: value }"` | Style binding |

---

## 7. COMPONENT USAGE PATTERNS

### 7.1 ChatInput Usage Pattern
```typescript
// React
const {
  addMessage,
  appendToMessage,
  setMessageStreaming,
  setLoading,
  setError,
  setAbortController,
  abortRequest,
  isLoading,
  selectedModel,
  apiKey,
  getMessagesForApi,
  addGeneratedImage,
} = useChatStore();

// Vue 3 equivalent
const {
  addMessage,
  appendToMessage,
  setMessageStreaming,
  setLoading,
  setError,
  setAbortController,
  abortRequest,
  isLoading,
  selectedModel,
  apiKey,
  getMessagesForApi,
  addGeneratedImage,
} = useChatStore();
// (Hook usage pattern is identical!)
```

### 7.2 Message Streaming Pattern

```typescript
// React
try {
  const messagesToSend = getMessagesForApi(assistantMsgId);
  for await (const chunk of streamChatCompletion(
    selectedModel,
    messagesToSend,
    controller.signal,
    apiKey
  )) {
    if (chunk.type === 'text' && chunk.content) {
      appendToMessage(assistantMsgId, chunk.content);
    } else if (chunk.type === 'image' && chunk.image) {
      addGeneratedImage(assistantMsgId, chunk.image);
    }
  }
} catch (err) {
  if (err instanceof Error && err.name !== 'AbortError') {
    setError(err.message);
  }
} finally {
  setMessageStreaming(assistantMsgId, false);
  setLoading(false);
}
```

Pattern ini akan **identik di Vue 3** - tidak perlu adaptasi!

### 7.3 File Upload Pattern

```typescript
// React
const [images, setImages] = useState<ImageAttachment[]>([]);

const handleImageUpload = useCallback(async (files: FileList | File[]) => {
  for (const file of fileArray) {
    if (isImageFile(file)) {
      const img = await processImageFile(file);
      setImages((prev) => [...prev, img]);
    }
  }
}, []);
```

```typescript
// Vue 3 equivalent
const images = ref<ImageAttachment[]>([]);

const handleImageUpload = async (files: FileList | File[]) => {
  for (const file of Array.from(files)) {
    if (isImageFile(file)) {
      const img = await processImageFile(file);
      images.value.push(img);
    }
  }
};
```

---

## 8. KEY POINTS FOR MIGRATION

### 8.1 What Stays the Same
- Type definitions (interfaces) → Vue TypeScript compatible
- API integration logic (async generators) → Direct copy
- File utility functions → Direct copy
- Constants & configurations → Direct copy
- Error handling patterns → Direct copy
- Message filtering logic → Direct copy

### 8.2 What Changes
- Hook system (useState, useEffect, useRef) → ref(), computed(), onMounted()
- Component structure (function component) → `<script setup lang="ts">` or composition functions
- State management (Zustand) → Pinia (same pattern, different API)
- Props passing → `defineProps()` instead of function parameters
- Emit → `defineEmits()` instead of callback props
- Styling → Keep Tailwind classes, use `:class` binding

### 8.3 Zustand → Pinia Conversion Example

```typescript
// React (Zustand)
const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  addMessage: (message) => set(state => ({ messages: [...state.messages, newMessage] })),
  getMessagesForApi: (excludeId) => {
    const { messages, sendContext } = get();
    return messages.filter(m => m.id !== excludeId);
  },
}));
```

```typescript
// Vue 3 (Pinia)
export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const id = generateId();
    messages.value.push({ ...message, id, timestamp: Date.now() });
    return id;
  };
  
  const getMessagesForApi = (excludeId?: string) => {
    return messages.value.filter(m => m.id !== excludeId);
  };
  
  return { messages, isLoading, addMessage, getMessagesForApi };
});
```

---

## 9. COMPONENT MIGRATION CHECKLIST

### MessageList.tsx → MessageList.vue
- [ ] Extract state management to `useChatStore()`
- [ ] Use `ref<HTMLDivElement>(null)` for bottomRef
- [ ] Use `watchEffect()` instead of `useEffect()`
- [ ] Convert MessageBubble to sub-component with props
- [ ] Keep lightboxImage state as local `ref()`
- [ ] Keep conditional rendering logic

### ChatInput.tsx → ChatInput.vue
- [ ] Convert useState to ref/reactive
- [ ] Convert useCallback to regular functions
- [ ] Convert useRef to ref<HTMLInputElement>()
- [ ] Keep file upload logic (100% compatible)
- [ ] Convert event handlers to template directives
- [ ] Keep streaming for-await-of loop (100% compatible)

### Header.tsx → Header.vue
- [ ] Extract ModelSelector & ApiKeyInput as sub-components
- [ ] Local state for showSettings (ref)
- [ ] Pass store methods to child components
- [ ] Keep conditional rendering

---

## 10. UTILITIES TO COPY DIRECTLY

Files có thể copy 100% từ React sang Vue (chỉ đổi import paths nếu cần):

1. ✅ `utils/fileUtils.ts` - Pure functions
2. ✅ `utils/api.ts` - Fetch & async generators
3. ✅ `types/index.ts` - TypeScript interfaces
4. ✅ Constants (SUPPORTED_IMAGE_TYPES, MAX_IMAGE_SIZE, etc.)

---

## 11. ESTIMATED MIGRATION EFFORT

| Item | LOC | Effort | Notes |
|------|-----|--------|-------|
| Type definitions | 92 | Trivial | Direct copy |
| API utilities | 163 | Trivial | Direct copy |
| File utilities | 122 | Trivial | Direct copy |
| Store (Zustand → Pinia) | 168 | Low | Pattern change, similar logic |
| Components refactor | ~800 | Medium | Hook → Composition API |
| **Total** | **~1345** | **2-3 days** | For experienced team |

---

## UNRESOLVED QUESTIONS

1. **Error Banner Component:** ErrorBanner.tsx không được tìm thấy trong đọc file - cần kiểm tra nó hiển thị error từ store như nào
2. **Styling Library:** Xác nhận Tailwind CSS version & cơ chế dark mode
3. **Component Index Export:** `components/index.ts` - cần xem export list để mapping chính xác
4. **Package.json:** Check dependencies để biết exact versions của React, Zustand, TypeScript

---

## REFERENCES

- **React Store:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/store/chatStore.ts`
- **API Integration:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/utils/api.ts`
- **Types:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/types/index.ts`
- **File Utils:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/utils/fileUtils.ts`
- **Components:** MessageList.tsx, ChatInput.tsx, Header.tsx, ModelSelector.tsx, ApiKeyInput.tsx


---

## RESOLVED QUESTIONS (Từ file investigation)

### Q1: Error Banner Component
**Đã tìm:** `ErrorBanner.tsx` (24 lines)
```typescript
export function ErrorBanner() {
  const { error, setError } = useChatStore();
  if (!error) return null;
  return <div>{error}</div>;  // Render error message từ store
}
```
- Pattern: Simple component từ store global error state
- Vue mapping: `<script setup>` + `const { error, setError } = useChatStore()`

### Q2: Styling Library & Dark Mode
**Stack Tech:**
- Tailwind CSS v3.4.19
- PostCSS + Autoprefixer
- Dark mode: Tailwind dark mode classes (`dark-*` color palette custom)
- Color scheme: Custom Tailwind configuration (dark-800, dark-700, primary-500, etc.)

### Q3: Component Export Index
**File:** `components/index.ts`
```typescript
export { Header } from './Header';
export { ModelSelector } from './ModelSelector';
export { MessageList } from './MessageList';
export { ChatInput } from './ChatInput';
export { ErrorBanner } from './ErrorBanner';
export { ApiKeyInput } from './ApiKeyInput';
```
- 6 exported components
- Pattern: Barrel exports

### Q4: Package Dependencies
**Key Versions:**
- React: 19.2.0 (latest major)
- TypeScript: 5.9.3 (recent stable)
- Vite: 7.2.4 (build tool)
- Zustand: 5.0.9 (state management)
- Lucide React: 0.562.0 (icon library)

---

## VUE 3 RECOMMENDED DEPENDENCIES

For feature parity with React version:

```json
{
  "dependencies": {
    "vue": "^3.5.0",
    "pinia": "^2.2.0",
    "lucide-vue-next": "^0.362.0"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "@vitejs/plugin-vue": "^5.1.0",
    "@vue/tsconfig": "^0.5.0",
    "tailwindcss": "^3.4.19",
    "postcss": "^8.5.6",
    "autoprefixer": "^10.4.23"
  }
}
```

---

## QUICK MIGRATION SUMMARY

### Files Ready to Copy (No changes)
1. `types/index.ts` - 92 lines
2. `utils/api.ts` - 163 lines  
3. `utils/fileUtils.ts` - 122 lines
4. Constants & configurations

### Files Requiring Refactoring
1. `store/chatStore.ts` - Zustand → Pinia (168 lines, LOW effort)
2. `components/*.tsx` - React → Vue (varies)

### Effort Breakdown
- Types & Utils: **0.5 days** (copy & verify)
- Store refactor: **1 day** (Pinia rewrite)
- Component migration: **1.5-2 days** (hooks → Composition API)
- Testing & integration: **0.5 days**
- **Total: 3-4 days** for complete Vue implementation

---

**Report Generated:** 2026-01-04  
**Author:** Codebase Scout  
**Status:** COMPLETE - Ready for Vue implementation phase

