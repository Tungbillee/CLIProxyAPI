# Báo Cáo Nghiên Cứu: React Chat UI Patterns cho AI Applications 2025

**Ngày nghiên cứu:** 03 Tháng 1, 2026
**Phạm vi:** Chat UI Components, File Upload, Model Selector, SSE Streaming, State Management
**Mục tiêu:** Xác định best practices và khuyến nghị cho ứng dụng Gemini Chat UI

---

## Tóm Tắt Điều Hành

Năm 2025, React chat UI đã trưởng thành với các library specialized như **assistant-ui** (7,800+ stars), **AI Elements** (Vercel), và các component thư viện shadcn/ui. Ecosystem hiện tại ưa thích:
- **Composable primitives** thay vì monolithic components
- **Server-Sent Events (SSE)** cho streaming AI responses
- **Zustand** hoặc **Context API** cho state management chat history
- **Tailwind + shadcn/ui** như foundation styling

Báo cáo này cung cấp actionable recommendations cho việc xây dựng production-grade chat UI.

---

## Phương Pháp Nghiên Cứu

**Nguồn tài liệu:** 13 nguồn chính
**Phạm vi thời gian:** Jan 2024 - Jan 2026
**Tìm kiếm chính:** React chat streaming, SSE implementation, state management, file upload UX, shadcn/ui patterns

---

## Phát Hiện Chính

### 1. Chat UI Components - Best Patterns

#### 1.1 Composable Primitives vs Monolithic Approach

**Xu hướng hiện tại (2025):**
- **Composable primitives** là pattern chiến thắng (Radix UI style)
- Thay vì một component "ChatWindow" khổng lồ, xây dựng các unit nhỏ: `<MessageList>`, `<MessageInput>`, `<Toolbar>`, `<ModelSelector>`
- Cho phép **full customization** và styling ownership

**Ví dụ từ assistant-ui:**
```typescript
export function AssistantChat() {
  return (
    <Thread>
      <div className="flex flex-col h-full">
        <MessageContainer />
        <InputArea />
      </div>
    </Thread>
  );
}
```

#### 1.2 Thư Viện Khuyến Nghị (2025)

| Library | Ưu điểm | Nhược điểm | Dùng khi |
|---------|---------|-----------|---------|
| **assistant-ui** (7.8k⭐) | Production-ready, streaming native, 400k+/mo npm, accessibility first | Learning curve component composition | Build full-featured AI chat |
| **AI Elements** (Vercel) | Official, built on shadcn/ui, modern patterns, Generative UI support | Newer, smaller ecosystem | Using Vercel AI SDK + Next.js |
| **shadcn/ui** | Customizable, Tailwind-first, large component library, owned code | Not chat-specific | As foundation + custom build |
| **shadcn-chat** (1.3k⭐) | Free CLI, quick setup (<5 min), good docs, responsive | Less feature-rich | MVP/startup projects |

#### 1.3 Performance Optimization - Virtualization

**Critical cho chats có 100+ messages:**

```typescript
// Tối ưu: VirtualizedMessageList chỉ render visible messages
<VirtualizedMessageList
  defaultItemHeight={80}
  items={messages}
  // Render chỉ ~20 messages thay vì 1000
/>
```

**Insights từ GetStream.io:**
- `defaultItemHeight` cần set chính xác để minimize recalculations
- Smooth scroll có vấn đề >2-3 msg/sec → dùng "auto" scroll thay thế
- React.memo + lazy loading custom components

---

### 2. File Upload UI Patterns

#### 2.1 HTML5 Drag & Drop Implementation

**No external library needed** - native browser API:

```typescript
interface FileDropZoneProps {
  onDrop: (files: File[]) => void;
}

export function FileDropZone({ onDrop }: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer?.files || []);
    onDrop(files);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50'
      }`}
    >
      <p>Drag files here or click to upload</p>
    </div>
  );
}
```

**4 Events cần override:** `onDragEnter`, `onDragLeave`, `onDragOver`, `onDrop`

#### 2.2 Library Options

**@daveyplate/tailwind-drag-dropzone** - Tailwind + dropzone combo
**Flowbite** - File input component với dark mode
**react-dropzone** - Popular base library

#### 2.3 Preview & Multiple Files

```typescript
export function FilePreview({ files }: { files: File[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {files.map((file) => (
        <div key={file.name} className="relative group">
          {file.type.startsWith('image/') && (
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-full h-32 object-cover rounded"
            />
          )}
          {file.type.startsWith('video/') && (
            <video
              src={URL.createObjectURL(file)}
              className="w-full h-32 object-cover rounded"
            />
          )}
          <button
            onClick={() => removeFile(file.name)}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Best practices:**
- Hiển thị preview cho images/videos inline
- Remove file functionality
- File size + type validation
- Progress indicator cho uploads

---

### 3. Model Selector Pattern

#### 3.1 UI Component Structure

```typescript
interface ModelOption {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  costPer1kTokens?: number;
}

export function ModelSelector({
  models,
  selected,
  onChange
}: {
  models: ModelOption[];
  selected: string;
  onChange: (modelId: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name} {model.contextWindow && `(${model.contextWindow}K)`}
        </option>
      ))}
    </select>
  );
}
```

#### 3.2 Advanced Dropdown Pattern (Combobox)

Với display metadata (context window, cost):

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AdvancedModelSelector() {
  return (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select model..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gpt-4">
          <div className="flex items-center gap-2">
            <span>GPT-4</span>
            <span className="text-xs text-gray-500">128K context</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**Implementation tips:**
- Nếu <6 models → native `<select>` đủ
- Nếu >6 models + metadata → dùng shadcn/ui `<Select>` + combobox
- Position: Fixed top hoặc sticky header
- Disable model switch khi streaming (UX)

---

### 4. Streaming Response Display - SSE Pattern

#### 4.1 Server-Sent Events (SSE) vs WebSockets

| Aspect | SSE | WebSocket |
|--------|-----|-----------|
| Direction | Server → Client (one-way) | Bidirectional |
| Protocol | HTTP | TCP |
| Connection limit | 6/domain (HTTP/1.1), 100/domain (HTTP/2) | No limit |
| Overhead | Lower | Higher |
| Best for | AI streaming, live updates | Real-time chat, multiplayer |

**Khuyến nghị:** Dùng SSE cho AI response streaming (không cần bi-directional)

#### 4.2 SSE Server Implementation (Node.js)

```typescript
// POST /api/chat
app.post('/api/chat', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const message = req.body.message;

  // Gọi AI API (Gemini, OpenAI, etc.)
  callAIAPI(message)
    .on('data', (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    })
    .on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
});
```

**SSE message format:**
```
data: {"content":"Hello"}\n\n
data: {"content":" world"}\n\n
data: [DONE]\n\n
```

#### 4.3 React Client - useEffect + EventSource

```typescript
export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);

    let assistantMessage = '';
    const eventSource = new EventSource(
      `/api/chat?message=${encodeURIComponent(content)}`
    );

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        setIsStreaming(false);
        eventSource.close();
        return;
      }

      const data = JSON.parse(event.data);
      assistantMessage += data.content;

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: assistantMessage,
          isStreaming: true
        }
      ]);
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };
  };

  return { messages, sendMessage, isStreaming };
}
```

#### 4.4 Vercel AI SDK Pattern (Recommended)

```typescript
import { useChat } from 'ai/react';

export function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    streamMode: 'text', // or 'json-delta'
  });

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <p className="text-sm text-gray-600">{msg.role}</p>
            <p className="text-base">{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type message..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Send
        </button>
      </form>
    </div>
  );
}
```

**Ưu điểm Vercel AI SDK:**
- Auto-handles SSE connection pooling
- Exponential backoff + reconnection
- TypeScript support
- Compatible với múltiple AI providers

---

### 5. State Management - Chat History

#### 5.1 Zustand vs Jotai (2025 Landscape)

**Zustand** - Centralized approach:
```typescript
import { create } from 'zustand';

interface ChatStore {
  messages: Message[];
  selectedModel: string;
  addMessage: (msg: Message) => void;
  setModel: (modelId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  selectedModel: 'gpt-4',

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg],
  })),

  setModel: (modelId) => set({ selectedModel: modelId }),
}));

// Usage
function ChatComponent() {
  const { messages, addMessage } = useChatStore();
  // ...
}
```

**Jotai** - Atomic approach:
```typescript
import { atom, useAtom } from 'jotai';

const messagesAtom = atom<Message[]>([]);
const selectedModelAtom = atom('gpt-4');

export function ChatComponent() {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [model, setModel] = useAtom(selectedModelAtom);
  // Chỉ components dùng atoms này sẽ re-render
}
```

#### 5.2 Selection Guide (2025)

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Medium app + connected state | **Zustand** | Simple, centralized, 90% of cases |
| Complex atomic relationships | **Jotai** | Fine-grained re-render control |
| Chat-specific (history + UI state) | **Zustand** | Messages, models, typing indicators interconnected |
| Component-local + cross-tree sharing | **Jotai** | Message editing state, temporary UI flags |
| MVP/Startup | **Context API** | No extra dependency |

#### 5.3 Chat-Specific Store Architecture

```typescript
// store/chat.ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  selectedModel: string;
  createdAt: Date;
}

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Actions
  createSession: () => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, msg: ChatMessage) => void;
  updateMessage: (sessionId: string, msgId: string, content: string) => void;
  selectModel: (modelId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  createSession: () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      selectedModel: 'gemini-2.5-flash',
      createdAt: new Date(),
    };
    set((state) => ({
      sessions: [...state.sessions, newSession],
      activeSessionId: newSession.id,
    }));
  },

  deleteSession: (id) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  })),

  addMessage: (sessionId, msg) => set((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, msg] }
        : s
    ),
  })),

  // ... other actions
}));
```

#### 5.4 Persistence & Hydration

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // ... store definition
    }),
    {
      name: 'chat-store',
      storage: localStorage,
      partialize: (state) => ({
        sessions: state.sessions,
        // Không persist streaming states
      }),
    }
  )
);
```

---

### 6. Mobile Responsive Patterns

#### 6.1 Touch-Friendly UX Requirements

**shadcn/ui React AI Chatbot insights:**
- Minimum touch target: 44px (iOS HIG)
- Virtual keyboard handling
- No hover-dependent interactions
- One-handed operation support

#### 6.2 Responsive Layout

```typescript
export function ChatInterface() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">Chat</h1>
        {!isMobile && <ModelSelector />}
      </header>

      {/* Main content */}
      <div className="flex-1 flex gap-0 md:gap-4 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        {!isMobile && (
          <aside className="w-64 bg-gray-50 border-r p-4 hidden md:block">
            <ChatHistory />
          </aside>
        )}

        {/* Chat area */}
        <main className="flex-1 flex flex-col p-2 md:p-4">
          <MessageList />

          {/* Model selector - dropdown on mobile, select on desktop */}
          {isMobile && (
            <div className="mb-3">
              <ModelSelector />
            </div>
          )}

          <ChatInput />
        </main>
      </div>
    </div>
  );
}
```

#### 6.3 Message Input Mobile

```typescript
export function ChatInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Mobile: Shift+Enter = newline, Enter = send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Send message
    }
  };

  return (
    <div className="border-t bg-white p-2 md:p-4">
      <form className="flex flex-col gap-2 md:flex-row">
        {/* File upload button */}
        <button
          type="button"
          className="px-3 py-2 md:py-3 text-gray-600 hover:bg-gray-100 rounded touch-target"
        >
          📎
        </button>

        {/* Input */}
        <textarea
          ref={inputRef}
          onKeyDown={handleKeyDown}
          rows={1}
          className="flex-1 px-3 py-2 md:py-3 border rounded-lg resize-none focus:outline-none focus:ring-2"
          placeholder="Message..."
        />

        {/* Send button */}
        <button
          type="submit"
          className="px-4 py-2 md:py-3 bg-blue-500 text-white rounded-lg font-medium touch-target"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

---

## Khuyến Nghị Thực Thi

### Quick Start - MVP (2-3 tuần)

**Stack:**
```
Frontend:
- React 18+ với TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- Vercel AI SDK (useChat hook)

Backend:
- Node.js/Express hoặc Next.js API routes
- SSE streaming
- Gemini API integration

Deployment:
- Vercel (Next.js) hoặc Firebase (React)
```

**Component Priority:**
1. MessageList + MessageInput (week 1)
2. SSE streaming integration (week 1-2)
3. File upload + preview (week 2)
4. Model selector (week 2)
5. Chat history/sessions (week 3)
6. Mobile responsive polish (week 3)

### Code Structure

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx      # Main container
│   │   ├── MessageList.tsx         # Virtualized message list
│   │   ├── MessageInput.tsx        # Input + file upload
│   │   ├── ModelSelector.tsx       # Dropdown
│   │   └── StreamingMessage.tsx    # Animation + streaming UX
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Select.tsx
│   │   ├── FileDropZone.tsx
│   │   └── FilePreview.tsx
│
├── hooks/
│   ├── useStreamingChat.ts        # SSE logic
│   ├── useFileUpload.ts           # File handling
│   └── useChatStore.ts            # Export Zustand store
│
├── store/
│   └── chat.ts                    # Zustand store definition
│
├── utils/
│   ├── formatMessage.ts           # Markdown rendering
│   ├── validateFile.ts            # File validation
│   └── sse.ts                     # SSE helpers
│
└── api/
    ├── chat.ts                    # Chat endpoint
    └── upload.ts                  # File upload endpoint
```

### Performance Checklist

- [ ] MessageList virtualization (>50 messages)
- [ ] Lazy load file previews
- [ ] SSE connection pooling + retry logic
- [ ] Message content memoization (React.memo)
- [ ] Infinite scroll pagination
- [ ] Debounce user typing indicators
- [ ] Image compression trước upload
- [ ] Cache models dropdown

### Accessibility Standards

- [ ] Semantic HTML (`<main>`, `<header>`, `<aside>`)
- [ ] ARIA labels cho interactive elements
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader support cho streaming content
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus indicators visible
- [ ] Touch targets ≥ 44px

---

## Tài Liệu & References

### Official Documentation
- [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

### Featured Libraries & Resources
- [assistant-ui GitHub](https://github.com/assistant-ui/assistant-ui) - 7,800+ stars, 400k+ npm downloads
- [AI Elements by Vercel](https://vercel.com/changelog/introducing-ai-elements)
- [shadcn-chat CLI](https://github.com/jakobhoeg/shadcn-chat) - 1,300+ stars
- [Stream Chat React SDK](https://getstream.io/chat/sdk/react/)

### Tutorials & Best Practices
- [Building a Complete React Chat App with CometChat UI kit](https://www.cometchat.com/tutorials/building-react-chat-app)
- [React Chat Tutorial: How to build a chat app (GetStream)](https://getstream.io/chat/react-chat/tutorial/)
- [Real-Time Data Streaming with SSE (DEV Community)](https://dev.to/serifcolakel/real-time-data-streaming-with-server-sent-events-sse-1gb2)
- [Drag-and-Drop File Upload Component Guide (ClarityDev)](https://claritydev.net/blog/react-typescript-drag-drop-file-upload-guide)

### Community & Support
- [Vercel Academy AI SDK](https://vercel.com/academy/ai-sdk/)
- [shadcn/ui Discord Community](https://discord.gg/pqnbqhdS7d)
- [assistant-ui Discord](https://discord.gg/RNJEwb4AZH)

---

## Kết Luận & Next Steps

### Key Takeaways

1. **Composable primitives** (không monolithic) là pattern 2025
2. **Zustand** recommended cho chat state (90% case)
3. **SSE** là best choice cho AI response streaming
4. **shadcn/ui** + Tailwind = best styling foundation
5. **Vercel AI SDK** eliminates boilerplate (useChat, useCompletion)

### Immediate Actions

1. **Evaluate:** Vercel AI SDK vs custom SSE implementation (bộ team decide)
2. **Setup:** Tạo base component structure + store setup
3. **Implement:** MessageList + MessageInput first
4. **Test:** SSE streaming with actual AI API
5. **Polish:** Mobile responsive + accessibility

### Unresolved Questions

Không có câu hỏi chưa giải quyết. Báo cáo cung cấp toàn bộ thông tin cần thiết để bắt đầu implementation.

---

**Report version:** 1.0
**Last updated:** Jan 3, 2026
**Prepared for:** Gemini Media Chat UI Project
