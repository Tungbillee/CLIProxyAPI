import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  const addGeneratedImage = (id: string, image: GeneratedImage) => {
    const msg = messages.value.find(m => m.id === id)
    if (msg) {
      if (!msg.generatedImages) msg.generatedImages = []
      msg.generatedImages.push(image)
    }
  }

  const clearMessages = () => {
    if (abortController.value) abortController.value.abort()
    messages.value = []
    error.value = null
    abortController.value = null
  }

  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setSelectedModel = (model: string) => {
    selectedModel.value = model
  }

  const setError = (err: string | null) => {
    error.value = err
  }

  const setAbortController = (controller: AbortController | null) => {
    abortController.value = controller
  }

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

    // Strip media từ old messages (chỉ giữ media ở message cuối)
    return filtered.map((msg, idx) => {
      if (idx < filtered.length - 1) {
        return { ...msg, images: undefined, videos: undefined }
      }
      return msg
    })
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
    addGeneratedImage,
    clearMessages,
    setLoading,
    setSelectedModel,
    setError,
    setAbortController,
    abortRequest,
    setApiKey,
    setSendContext,
    getMessagesForApi,
  }
})
