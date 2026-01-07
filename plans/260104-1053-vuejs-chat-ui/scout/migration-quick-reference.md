# Vue 3 Chat UI - Migration Quick Reference

## React Source Files Analysis
**Location:** `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/`  
**Total LOC:** ~1345 lines  
**Build Tool:** Vite 7.2.4  
**Styling:** Tailwind CSS 3.4.19  

---

## Component Structure Map

```
React Components (6)          Vue 3 Equivalents
├── App.tsx                   → App.vue
├── Header.tsx                → Header.vue
│   ├── ModelSelector.tsx     │   ├── ModelSelector.vue
│   └── ApiKeyInput.tsx       │   └── ApiKeyInput.vue
├── MessageList.tsx           → MessageList.vue
│   └── MessageBubble (sub)   │   └── MessageBubble.vue (sub)
├── ChatInput.tsx             → ChatInput.vue
└── ErrorBanner.tsx           → ErrorBanner.vue
```

---

## State Management

### React (Zustand)
```typescript
const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  // ... 11 actions
}))
```

### Vue 3 (Pinia)
```typescript
export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  // ... 11 actions
  return { messages, isLoading, /* ... */ }
})
```

---

## Hook Mapping Reference

| React Hook | Vue 3 Equivalent | Usage |
|-----------|-----------------|-------|
| `useState(value)` | `ref(value)` | Local state |
| `useState(object)` | `reactive(object)` | Object state |
| `useEffect(fn, [])` | `onMounted(fn)` | Mount side effect |
| `useEffect(fn, [dep])` | `watch(dep, fn)` | Dependency effect |
| `useCallback(fn, [])` | `const fn = () => {}` | Event handler |
| `useRef(null)` | `ref(null)` | DOM reference |
| `useChatStore()` | `const store = useChatStore()` | Store hook (same!) |

---

## Type Definitions - Direct Copy

All 5 TypeScript interfaces can be copied directly:

1. `Message` - Chat message structure
2. `ImageAttachment` / `VideoAttachment` - File attachments
3. `Model` - AI model metadata
4. `OpenAIMessage` / `OpenAIContentPart` - API format
5. `ChatCompletionChunk` - Streaming response

**Action:** Copy `/types/index.ts` → `/src/types/index.ts` (no changes needed)

---

## Utilities - Direct Copy

These pure functions have zero dependencies on framework:

| File | LOC | Changes | Action |
|------|-----|---------|--------|
| `utils/fileUtils.ts` | 122 | None | Copy directly |
| `utils/api.ts` | 163 | None | Copy directly |

**Key functions:**
- `fileToBase64()` - File → Base64 conversion
- `processImageFile()` / `processVideoFile()` - File processing
- `generateVideoThumbnail()` - Video thumbnail generation
- `streamChatCompletion()` - Async generator for streaming
- `convertToOpenAIMessages()` - Message format conversion

---

## Component Refactoring Pattern

### Example: ChatInput.tsx → ChatInput.vue

**React Template:**
```tsx
<textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  disabled={isLoading}
/>
```

**Vue Template:**
```vue
<textarea
  v-model="input"
  @keydown="handleKeyDown"
  :disabled="isLoading"
/>
```

**React State:**
```typescript
const [input, setInput] = useState('')
const [images, setImages] = useState<ImageAttachment[]>([])
```

**Vue State:**
```typescript
const input = ref('')
const images = ref<ImageAttachment[]>([])
```

---

## Store Refactoring Example

### Message Add Function

**React (Zustand):**
```typescript
addMessage: (message) => {
  const id = generateId()
  const newMessage: Message = {
    ...message,
    id,
    timestamp: Date.now(),
  }
  set((state) => ({
    messages: [...state.messages, newMessage],
  }))
  return id
}
```

**Vue 3 (Pinia):**
```typescript
const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
  const id = generateId()
  const newMessage: Message = {
    ...message,
    id,
    timestamp: Date.now(),
  }
  messages.value.push(newMessage)
  return id
}
```

---

## Common Patterns Conversion

### File Upload Handler

**React:**
```typescript
const handleImageUpload = useCallback(async (files: FileList | File[]) => {
  for (const file of Array.from(files)) {
    const img = await processImageFile(file)
    setImages((prev) => [...prev, img])
  }
}, [])
```

**Vue 3:**
```typescript
const handleImageUpload = async (files: FileList | File[]) => {
  for (const file of Array.from(files)) {
    const img = await processImageFile(file)
    images.value.push(img)
  }
}
```

### Streaming Message Response

**React & Vue 3 (Identical):**
```typescript
for await (const chunk of streamChatCompletion(...)) {
  if (chunk.type === 'text') {
    appendToMessage(assistantMsgId, chunk.content)
  } else if (chunk.type === 'image') {
    addGeneratedImage(assistantMsgId, chunk.image)
  }
}
```

---

## CSS Class Binding

**React (className):**
```tsx
<div className={`px-4 py-3 ${isUser ? 'bg-primary-600' : 'bg-dark-700'}`}>
```

**Vue 3 (:class):**
```vue
<div :class="[
  'px-4 py-3',
  isUser ? 'bg-primary-600' : 'bg-dark-700'
]">
```

Or with object syntax:
```vue
<div :class="{
  'px-4': true,
  'py-3': true,
  'bg-primary-600': isUser,
  'bg-dark-700': !isUser
}">
```

---

## Event Handling Patterns

### Input Events

| React | Vue 3 |
|-------|-------|
| `onChange={(e) => setState(e.target.value)}` | `@input="(e) => state = e.target.value"` or `v-model` |
| `onClick={() => handler()}` | `@click="handler"` |
| `onKeyDown={(e) => if(e.key==='Enter')}` | `@keydown.enter="handler"` |

### Drag & Drop

| React | Vue 3 |
|-------|-------|
| `onDragOver={(e) => e.preventDefault()}` | `@dragover.prevent` |
| `onDrop={(e) => handleDrop(e.dataTransfer.files)}` | `@drop="handleDrop"` |
| `onPaste={(e) => handlePaste(e.clipboardData.items)}` | `@paste="handlePaste"` |

---

## DOM Reference Pattern

**React:**
```typescript
const imageInputRef = useRef<HTMLInputElement>(null)
imageInputRef.current?.click()
```

**Vue 3:**
```typescript
const imageInputRef = ref<HTMLInputElement>(null)
imageInputRef.value?.click()
```

---

## Package Dependencies Checklist

### Core Packages
- [ ] Vue 3.5.0+ (replace React)
- [ ] Pinia 2.2.0+ (replace Zustand)
- [ ] TypeScript 5.9.3+ (keep version)
- [ ] Vite 7.2.4+ (keep version)

### Icon Library
- [ ] lucide-vue-next 0.362.0+ (replace lucide-react)

### Styling
- [ ] Tailwind CSS 3.4.19+ (keep version)
- [ ] PostCSS 8.5.6+ (keep version)
- [ ] Autoprefixer 10.4.23+ (keep version)

### Vue Build Tools
- [ ] @vitejs/plugin-vue 5.1.0+
- [ ] @vue/tsconfig 0.5.0+
- [ ] vue-tsc (type checking)

---

## Implementation Checklist

### Phase 1: Setup (0.5 day)
- [ ] Create new Vue 3 + Vite project
- [ ] Install dependencies (Pinia, Tailwind, Lucide Vue)
- [ ] Setup TypeScript configuration
- [ ] Configure Vite + Vue plugin
- [ ] Copy Tailwind config

### Phase 2: Core Utilities (0.5 day)
- [ ] Copy `/types/index.ts`
- [ ] Copy `/utils/api.ts`
- [ ] Copy `/utils/fileUtils.ts`
- [ ] Verify imports work correctly

### Phase 3: Store Refactoring (1 day)
- [ ] Create Pinia store (`store/chatStore.ts`)
- [ ] Migrate all state properties
- [ ] Migrate all action methods
- [ ] Add localStorage persistence with `watch()`
- [ ] Test store functionality

### Phase 4: Component Migration (2 days)
- [ ] Create `App.vue` (layout)
- [ ] Migrate `ErrorBanner.vue`
- [ ] Migrate `Header.vue` + sub-components
- [ ] Migrate `MessageList.vue` + `MessageBubble.vue`
- [ ] Migrate `ChatInput.vue`
- [ ] Test all components

### Phase 5: Testing & Polish (0.5 day)
- [ ] Test message streaming
- [ ] Test file uploads (images/videos)
- [ ] Test model selection
- [ ] Test error handling
- [ ] Test responsive design

---

## Critical Implementation Notes

1. **Message Streaming:** Async generators work identically in Vue 3 - no changes needed
2. **File Uploads:** DOM file handling identical - copy logic directly
3. **localStorage:** Use `watch()` with immediate option for persistence
4. **Component cleanup:** Use `onBeforeUnmount()` for cleanup (like useEffect return)
5. **Drag & Drop:** Use Vue event modifiers (`.prevent`, `.stop`) instead of e.preventDefault()

---

## Build & Deployment

### Development
```bash
npm run dev
# Vite dev server on http://localhost:5173
```

### Production Build
```bash
npm run build
# Output: dist/
```

### Type Checking
```bash
vue-tsc --noEmit
```

---

## References

- Full analysis: `react-analysis.md`
- React source: `/Users/tungpc/Documents/Proxy_api/CLIProxyAPI/web/chat-ui/src/`
- Vue 3 docs: https://vuejs.org/
- Pinia docs: https://pinia.vuejs.org/
- Tailwind docs: https://tailwindcss.com/

**Estimated Total Time:** 3-4 days for experienced Vue developer

