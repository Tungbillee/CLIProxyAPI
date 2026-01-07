# Vue 3 + Composition API + Pinia - SSE Streaming Patterns

**Ngày**: 2025-01-04
**Chủ đề**: Vue 3 & Pinia cho Server-Sent Events (SSE)
**Mục đích**: Hướng dẫn chi tiết các pattern & best practices cho chat/streaming apps

---

## 1. SSE trong Vue 3 Composition API

### 1.1 Cách tiếp cận cơ bản với EventSource

**Native EventSource API** (khuyến nghị cho đơn giản):

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const messages = ref<string[]>([])
const isConnected = ref(false)
const error = ref<Error | null>(null)

let eventSource: EventSource | null = null

onMounted(() => {
  try {
    eventSource = new EventSource('/api/chat/stream')

    eventSource.onopen = () => {
      isConnected.value = true
      error.value = null
    }

    eventSource.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      messages.value.push(msg.content)
    }

    eventSource.onerror = (err) => {
      error.value = err as Error
      isConnected.value = false
      // EventSource tự động reconnect, không cần xử lý thủ công
    }
  } catch (err) {
    error.value = err as Error
  }
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})
</script>
```

**Vấn đề**: Hạn chế khi có nhiều connection hoặc cần multiplexing.

### 1.2 VueUse useEventSource Composable (Khuyến nghị)

VueUse cung cấp reactive wrapper cho EventSource API - đây là approach **tốt nhất** cho Vue 3 Composition API:

```vue
<script setup lang="ts">
import { useEventSource } from '@vueuse/core'
import { computed } from 'vue'

// Basic setup
const { status, data, error, close } = useEventSource('/api/chat/stream')

// Với named events
const { event, data: eventData } = useEventSource(
  '/api/chat/stream',
  ['message', 'typing', 'user-joined']
)

// Với auto-reconnect
const { status, data } = useEventSource(
  '/api/chat/stream',
  [],
  { autoReconnect: true }
)

// Parse JSON automatically
const { data: parsedData } = useEventSource(
  '/api/chat/stream',
  [],
  {
    serializer: {
      read: (raw: string) => JSON.parse(raw),
    },
  }
)

// Computed cho UI
const isOpen = computed(() => status.value === 'OPEN')
const isConnecting = computed(() => status.value === 'CONNECTING')
</script>

<template>
  <div>
    <div v-if="isConnecting" class="text-yellow-500">Đang kết nối...</div>
    <div v-if="isOpen" class="text-green-500">Đã kết nối</div>
    <div v-if="error" class="text-red-500">{{ error.message }}</div>

    <button @click="close" v-if="isOpen">Ngắt kết nối</button>
  </div>
</template>
```

**Ưu điểm**:
- Reactive trực tiếp với Vue 3
- Xử lý lifecycle tự động
- Hỗ trợ named events & custom serializer
- Cleanup tự động

### 1.3 Composable tùy chỉnh cho SSE

Khi cần logic phức tạp hơn:

```typescript
// composables/useSSEStream.ts
import { ref, onMounted, onUnmounted, Ref } from 'vue'

interface SSEStreamOptions {
  url: string
  autoReconnect?: boolean
  maxRetries?: number
  retryDelay?: number
}

export function useSSEStream<T>(options: SSEStreamOptions) {
  const data = ref<T[]>([])
  const status = ref<'connecting' | 'open' | 'closed'>('closed')
  const error = ref<Error | null>(null)
  const retryCount = ref(0)

  let eventSource: EventSource | null = null
  let retryTimeout: ReturnType<typeof setTimeout>

  const connect = () => {
    try {
      status.value = 'connecting'
      eventSource = new EventSource(options.url)

      eventSource.onopen = () => {
        status.value = 'open'
        error.value = null
        retryCount.value = 0
      }

      eventSource.onmessage = (event) => {
        const newData = JSON.parse(event.data) as T
        data.value.push(newData)
      }

      eventSource.onerror = (err) => {
        error.value = err as Error
        status.value = 'closed'

        if (options.autoReconnect && retryCount.value < (options.maxRetries ?? 5)) {
          const delay = Math.min(
            (options.retryDelay ?? 1000) * Math.pow(2, retryCount.value),
            30000
          )
          retryCount.value++
          retryTimeout = setTimeout(connect, delay)
        }
      }
    } catch (err) {
      error.value = err as Error
      status.value = 'closed'
    }
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout)
    }
    status.value = 'closed'
  }

  const clear = () => {
    data.value = []
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    data,
    status,
    error,
    connect,
    disconnect,
    clear,
    isOpen: computed(() => status.value === 'open'),
  }
}
```

**Sử dụng**:

```vue
<script setup lang="ts">
import { useSSEStream } from '@/composables/useSSEStream'

const { data: messages, status, error, disconnect } = useSSEStream({
  url: '/api/chat/stream',
  autoReconnect: true,
  maxRetries: 5,
  retryDelay: 1000,
})
</script>
```

---

## 2. Pinia Store cho Chat State Management

### 2.1 Setup Store Pattern (Khuyến nghị cho Vue 3)

```typescript
// stores/chatStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSSEStream } from '@/composables/useSSEStream'

export interface Message {
  id: string
  content: string
  sender: string
  timestamp: number
  status: 'sending' | 'sent' | 'failed'
}

export interface ChatUser {
  id: string
  name: string
  isTyping: boolean
}

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<Message[]>([])
  const activeUsers = ref<Map<string, ChatUser>>(new Map())
  const currentUser = ref<{ id: string; name: string } | null>(null)
  const connectionStatus = ref<'idle' | 'connecting' | 'open' | 'closed'>('idle')
  const error = ref<string | null>(null)

  // Composable cho SSE
  const {
    data: sseMessages,
    status: sseStatus,
    error: sseError,
    disconnect: sseDisconnect,
  } = useSSEStream<{
    type: 'message' | 'typing' | 'user-joined' | 'user-left'
    payload: any
  }>({
    url: '/api/chat/stream',
    autoReconnect: true,
  })

  // Computed
  const sortedMessages = computed(() =>
    [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  )

  const userCount = computed(() => activeUsers.value.size)

  const isConnected = computed(() => connectionStatus.value === 'open')

  // Actions
  const initializeConnection = (userId: string, userName: string) => {
    currentUser.value = { id: userId, name: userName }
    connectionStatus.value = 'connecting'
  }

  const addMessage = (message: Message) => {
    messages.value.push(message)
    // Giữ chỉ 500 message gần nhất để tránh memory leak
    if (messages.value.length > 500) {
      messages.value = messages.value.slice(-500)
    }
  }

  const updateMessageStatus = (messageId: string, status: Message['status']) => {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) {
      msg.status = status
    }
  }

  const setUserTyping = (userId: string, isTyping: boolean) => {
    const user = activeUsers.value.get(userId)
    if (user) {
      user.isTyping = isTyping
    }
  }

  const addActiveUser = (user: ChatUser) => {
    activeUsers.value.set(user.id, user)
  }

  const removeActiveUser = (userId: string) => {
    activeUsers.value.delete(userId)
  }

  const handleSSEMessage = (data: any) => {
    switch (data.type) {
      case 'message':
        addMessage(data.payload)
        break
      case 'typing':
        setUserTyping(data.payload.userId, data.payload.isTyping)
        break
      case 'user-joined':
        addActiveUser(data.payload)
        break
      case 'user-left':
        removeActiveUser(data.payload.userId)
        break
    }
  }

  const disconnect = () => {
    sseDisconnect()
    connectionStatus.value = 'closed'
    messages.value = []
    activeUsers.value.clear()
  }

  return {
    // State
    messages,
    sortedMessages,
    activeUsers,
    currentUser,
    connectionStatus,
    error,
    userCount,
    isConnected,

    // Actions
    initializeConnection,
    addMessage,
    updateMessageStatus,
    setUserTyping,
    addActiveUser,
    removeActiveUser,
    handleSSEMessage,
    disconnect,
  }
})
```

### 2.2 Option Store Pattern (Nếu cần)

```typescript
// stores/chatStore.ts (Option pattern)
import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as Message[],
    activeUsers: new Map<string, ChatUser>(),
    currentUser: null as { id: string; name: string } | null,
    connectionStatus: 'idle' as 'idle' | 'connecting' | 'open' | 'closed',
    error: null as string | null,
  }),

  getters: {
    sortedMessages: (state) =>
      [...state.messages].sort((a, b) => a.timestamp - b.timestamp),

    userCount: (state) => state.activeUsers.size,

    isConnected: (state) => state.connectionStatus === 'open',
  },

  actions: {
    addMessage(message: Message) {
      this.messages.push(message)
      if (this.messages.length > 500) {
        this.messages = this.messages.slice(-500)
      }
    },

    updateMessageStatus(messageId: string, status: Message['status']) {
      const msg = this.messages.find(m => m.id === messageId)
      if (msg) {
        msg.status = status
      }
    },
  },
})
```

### 2.3 Watching Store Changes & Effects

```typescript
export const useChatStore = defineStore('chat', () => {
  // ... state & actions ...

  // Watch SSE updates & update store
  watch(
    () => sseMessages.value,
    (newMessages) => {
      if (newMessages) {
        newMessages.forEach(msg => handleSSEMessage(msg))
      }
    },
    { deep: true }
  )

  // Track status changes
  watch(
    () => sseStatus.value,
    (status) => {
      connectionStatus.value = status as any
    }
  )

  // Subscribe to store mutations (alternative approach)
  const unsubscribe = $subscribe(
    (mutation, state) => {
      console.log('Store mutation:', mutation.events)
    },
    { deep: true }
  )

  // Track action outcomes
  $onAction(({ name, store, args, after, onError }) => {
    console.log(`Action ${name} started`)

    after((result) => {
      console.log(`Action ${name} finished`)
    })

    onError((error) => {
      console.error(`Action ${name} failed:`, error)
    })
  })

  onScopeDispose(() => {
    unsubscribe()
  })

  return { /* ... */ }
})
```

---

## 3. Async Generators với Vue 3 Reactivity

### 3.1 Async Generator Pattern cho Streaming

```typescript
// composables/useChatStream.ts
import { ref, onMounted, onUnmounted } from 'vue'

async function* fetchChatStream(url: string) {
  const response = await fetch(url)

  if (!response.body) {
    throw new Error('Response body không tồn tại')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          yield JSON.parse(data)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function useChatStream(url: string) {
  const messages = ref<any[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  let abortController: AbortController

  const start = async () => {
    isLoading.value = true
    error.value = null

    try {
      for await (const msg of fetchChatStream(url)) {
        messages.value.push(msg)
      }
    } catch (err) {
      error.value = err as Error
    } finally {
      isLoading.value = false
    }
  }

  const stop = () => {
    abortController?.abort()
  }

  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return { messages, isLoading, error, start, stop }
}
```

### 3.2 Async Computed Pattern

Khi cần reactive async value:

```typescript
import { computedAsync } from '@vueuse/core'

export const useChatStore = defineStore('chat', () => {
  const userId = ref('user-123')

  // Async computed - tự động fetch khi userId thay đổi
  const userProfile = computedAsync(
    async () => {
      const res = await fetch(`/api/users/${userId.value}`)
      return res.json()
    },
    null,
    {
      shallow: false,
      onError: (err) => console.error(err),
    }
  )

  return { userProfile }
})
```

---

## 4. Error Handling & Reconnection

### 4.1 Exponential Backoff Retry

```typescript
// composables/useSSEWithRetry.ts
export function useSSEWithRetry(url: string, maxRetries = 5) {
  const data = ref<any[]>([])
  const status = ref<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle')
  const error = ref<Error | null>(null)
  const retryCount = ref(0)

  let eventSource: EventSource | null = null
  let retryTimeout: ReturnType<typeof setTimeout>

  const calculateBackoff = (attempt: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const baseDelay = 1000
    const maxDelay = 30000
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    // Thêm jitter để tránh thundering herd
    return delay + Math.random() * 1000
  }

  const connect = () => {
    try {
      status.value = 'connecting'
      eventSource = new EventSource(url)

      eventSource.onopen = () => {
        status.value = 'open'
        error.value = null
        retryCount.value = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data)
          data.value.push(newData)
        } catch (parseErr) {
          console.error('Error parsing SSE data:', parseErr)
        }
      }

      eventSource.onerror = () => {
        status.value = 'error'
        error.value = new Error('SSE connection error')

        if (retryCount.value < maxRetries) {
          const delay = calculateBackoff(retryCount.value)
          retryCount.value++
          retryTimeout = setTimeout(connect, delay)
        } else {
          status.value = 'closed'
          error.value = new Error('Max retries reached')
        }
      }
    } catch (err) {
      error.value = err as Error
      status.value = 'closed'
    }
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout)
    }
    status.value = 'closed'
  }

  onMounted(() => connect())
  onUnmounted(() => disconnect())

  return { data, status, error, retryCount, connect, disconnect }
}
```

### 4.2 Error Handling trong Component

```vue
<script setup lang="ts">
import { useChatStore } from '@/stores/chatStore'

const chatStore = useChatStore()

// Global error handler
const handleError = (error: Error) => {
  console.error('Chat error:', error)
  // Có thể gọi error handler global hoặc hiển thị toast
  showErrorNotification(error.message)
}

// Watch store errors
watch(
  () => chatStore.error,
  (err) => {
    if (err) {
      handleError(new Error(err))
    }
  }
)
</script>

<template>
  <div>
    <div v-if="chatStore.error" class="alert alert-error">
      {{ chatStore.error }}
      <button @click="chatStore.initializeConnection(...)">Thử lại</button>
    </div>
  </div>
</template>
```

---

## 5. Best Practices 2025

### 5.1 Reactive State Management

```typescript
// GOOD - Reactive updates
export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])

  // ✅ Tự động reactive
  const addMessage = (msg: Message) => {
    messages.value.push(msg)
  }

  return { messages, addMessage }
})

// BAD - Non-reactive updates
const messages = reactive({
  items: [] as Message[]
})
// ❌ Mutating object trực tiếp có thể mất reactive
messages.items[0] = newMessage // Có thể không reactive
```

### 5.2 Memory Management

```typescript
// Giới hạn số lượng messages để tránh memory leak
const addMessage = (msg: Message) => {
  messages.value.push(msg)

  // Keep only last 500 messages
  const MAX_MESSAGES = 500
  if (messages.value.length > MAX_MESSAGES) {
    messages.value = messages.value.slice(-MAX_MESSAGES)
  }
}

// Cleanup trong store
onScopeDispose(() => {
  eventSource?.close()
  messages.value = []
  activeUsers.value.clear()
})
```

### 5.3 Type Safety

```typescript
// Luôn dùng TypeScript interfaces
interface Message {
  id: string
  content: string
  sender: string
  timestamp: number
  status: 'sending' | 'sent' | 'failed'
}

interface SSEPayload<T> {
  type: 'message' | 'typing' | 'user-joined'
  payload: T
  timestamp: number
}

// Type-safe SSE handling
const handleSSEMessage = (data: SSEPayload<any>) => {
  switch (data.type) {
    case 'message':
      const msg: Message = data.payload
      addMessage(msg)
      break
  }
}
```

### 5.4 Performance Optimization

```typescript
// Sử dụng computed thay vì methods cho expensive calculations
const sortedMessages = computed(() => {
  return [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
})

// Debounce typing indicators
import { useDebounceFn } from '@vueuse/core'

const handleTyping = useDebounceFn(() => {
  // Gửi typing status lên server
  sendTypingIndicator(true)
}, 300)

// Throttle scroll events
import { useThrottleFn } from '@vueuse/core'

const handleScroll = useThrottleFn(() => {
  // Load more messages
}, 500)
```

### 5.5 SSE vs WebSocket

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| **Direction** | Server → Client | Bi-directional |
| **Reconnect** | Auto | Manual |
| **Overhead** | Low | Medium |
| **Use Case** | Chat notifications, live updates | Real-time chat, gaming |
| **Browser Limit** | ~6 connections/domain | Unlimited |

**Chọn SSE nếu**:
- Chỉ cần push từ server
- Cần auto-reconnect
- Muốn đơn giản, ít overhead

**Chọn WebSocket nếu**:
- Cần bi-directional communication
- Có nhiều users cùng lúc
- Cần latency thấp hơn

### 5.6 Deployment Notes

```typescript
// Theo dõi connection status
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  failedAttempts: 0,
  averageLatency: 0,
}

// Trước khi deploy, test:
// 1. Network failures & reconnection
// 2. Memory leaks qua DevTools
// 3. Browser tab switching behavior
// 4. Long-running connections (24+ hours)
```

---

## 6. Complete Chat App Example

```typescript
// stores/chatStore.ts - Full implementation
import { defineStore } from 'pinia'
import { ref, computed, watch, onScopeDispose } from 'vue'
import { useEventSource } from '@vueuse/core'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const activeUsers = ref<Map<string, ChatUser>>(new Map())
  const currentUser = ref<{ id: string; name: string } | null>(null)
  const connectionStatus = ref<'idle' | 'connecting' | 'open' | 'closed'>('idle')

  // SSE with VueUse
  const { status: sseStatus, data: sseData, close: sseClose } = useEventSource(
    '/api/chat/stream',
    ['message', 'typing', 'user-event'],
    {
      autoReconnect: true,
      serializer: {
        read: (raw: string) => {
          try {
            return JSON.parse(raw)
          } catch {
            return raw
          }
        },
      },
    }
  )

  // Computed
  const sortedMessages = computed(() =>
    [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  )

  const isConnected = computed(() => connectionStatus.value === 'open')
  const userCount = computed(() => activeUsers.value.size)

  // Actions
  const addMessage = (msg: Message) => {
    messages.value.push(msg)
    if (messages.value.length > 500) {
      messages.value = messages.value.slice(-500)
    }
  }

  const handleIncomingMessage = (data: any) => {
    switch (data.type) {
      case 'message':
        addMessage(data.payload)
        break
      case 'typing':
        const user = activeUsers.value.get(data.payload.userId)
        if (user) user.isTyping = data.payload.isTyping
        break
      case 'user-event':
        if (data.payload.action === 'joined') {
          activeUsers.value.set(data.payload.user.id, {
            ...data.payload.user,
            isTyping: false,
          })
        } else if (data.payload.action === 'left') {
          activeUsers.value.delete(data.payload.userId)
        }
        break
    }
  }

  // Watch SSE updates
  watch(
    () => sseData.value,
    (newData) => {
      if (newData) {
        handleIncomingMessage(newData)
      }
    }
  )

  watch(
    () => sseStatus.value,
    (status) => {
      connectionStatus.value = status as any
    }
  )

  const disconnect = () => {
    sseClose()
    connectionStatus.value = 'closed'
    messages.value = []
    activeUsers.value.clear()
  }

  // Cleanup
  onScopeDispose(() => {
    disconnect()
  })

  return {
    messages,
    sortedMessages,
    activeUsers,
    currentUser,
    connectionStatus,
    isConnected,
    userCount,
    addMessage,
    disconnect,
  }
})
```

---

## Nguồn Tham Khảo

- [VueUse - useEventSource](https://vueuse.org/core/useeventsource/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [You Might Not Need WebSockets](https://nicolahibbert.com/you-might-not-need-websockets-server-sent-events-for-real-time-frontend-updates/)
- [Real-Time with SSE & Vue](https://www.iflair.com/real-time-processing-updates-using-server-sent-events-sse-with-vue-js-and-nestjs/)
- [Pinia with Composables](https://pinia.vuejs.org/cookbook/composables.html)

---

## Tóm Tắt Key Takeaways

✅ **SSE Best Choice**: VueUse `useEventSource` composable
✅ **Store Pattern**: Setup store với composables
✅ **Type Safety**: Luôn dùng TypeScript interfaces
✅ **Memory**: Giới hạn message count & cleanup
✅ **Error**: Exponential backoff retry strategy
✅ **Performance**: Dùng computed, debounce/throttle

**Nếu cần bi-directional**: Xem xét WebSocket thay SSE.
**Nếu chỉ push updates**: SSE là đủ & đơn giản hơn.
