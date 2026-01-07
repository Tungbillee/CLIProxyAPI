<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Send, Square, Image, Film, X } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'
import { useDropZone } from '../composables/useDropZone'
import { useClipboardPaste } from '../composables/useClipboardPaste'
import { streamChatCompletion } from '../utils/api'
import type { ImageAttachment, VideoAttachment } from '../types'

const store = useChatStore()
const inputText = ref('')
const images = ref<ImageAttachment[]>([])
const videos = ref<VideoAttachment[]>([])
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)

const { isDragOver, uploadError, handleDragOver, handleDragLeave, handleDrop, processFiles } = useDropZone()
const { handlePaste } = useClipboardPaste()

const canSend = computed(() => {
  return (inputText.value.trim() || images.value.length > 0 || videos.value.length > 0) && !store.isLoading
})

const addImage = (img: ImageAttachment) => {
  images.value.push(img)
}

const addVideo = (vid: VideoAttachment) => {
  videos.value.push(vid)
}

const removeImage = (id: string) => {
  images.value = images.value.filter(img => img.id !== id)
}

const removeVideo = (id: string) => {
  videos.value = videos.value.filter(vid => vid.id !== id)
}

const handleImageUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    await processFiles(input.files, addImage, addVideo)
    input.value = ''
  }
}

const handleVideoUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    await processFiles(input.files, addImage, addVideo)
    input.value = ''
  }
}

const onDrop = (e: DragEvent) => {
  handleDrop(e, addImage, addVideo)
}

const onPaste = (e: ClipboardEvent) => {
  handlePaste(e, addImage, addVideo)
}

const sendMessage = async () => {
  if (!canSend.value) return

  const content = inputText.value.trim()
  const messageImages = [...images.value]
  const messageVideos = [...videos.value]

  // Clear input
  inputText.value = ''
  images.value = []
  videos.value = []

  // Add user message
  store.addMessage({
    role: 'user',
    content,
    images: messageImages.length > 0 ? messageImages : undefined,
    videos: messageVideos.length > 0 ? messageVideos : undefined,
  })

  // Add assistant message placeholder
  const assistantMsgId = store.addMessage({
    role: 'assistant',
    content: '',
    isStreaming: true,
  })

  store.setLoading(true)
  store.setError(null)

  const controller = new AbortController()
  store.setAbortController(controller)

  try {
    const messagesForApi = store.getMessagesForApi(assistantMsgId)

    for await (const chunk of streamChatCompletion(
      store.selectedModel,
      messagesForApi,
      controller.signal,
      store.apiKey
    )) {
      if (chunk.type === 'text' && chunk.content) {
        store.appendToMessage(assistantMsgId, chunk.content)
      } else if (chunk.type === 'image' && chunk.image) {
        store.addGeneratedImage(assistantMsgId, chunk.image)
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      store.setError((err as Error).message || 'Đã xảy ra lỗi')
    }
  } finally {
    store.setMessageStreaming(assistantMsgId, false)
    store.setLoading(false)
    store.setAbortController(null)
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// Auto-resize textarea
const adjustTextareaHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
  }
}

// Global paste handler
const globalPasteHandler = (e: ClipboardEvent) => {
  onPaste(e)
}

onMounted(() => {
  document.addEventListener('paste', globalPasteHandler)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', globalPasteHandler)
})
</script>

<template>
  <div
    class="sticky bottom-0 z-20 border-t border-dark-700 bg-dark-800 p-4 flex-shrink-0"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="onDrop"
  >
    <!-- Drag overlay -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 bg-primary-500/10 border-2 border-dashed border-primary-500 flex items-center justify-center z-10"
    >
      <div class="text-primary-400 text-lg font-medium">
        Thả file vào đây
      </div>
    </div>

    <!-- Upload error -->
    <div
      v-if="uploadError"
      class="mb-2 text-sm text-red-400"
    >
      {{ uploadError }}
    </div>

    <!-- Attachments preview -->
    <div
      v-if="images.length > 0 || videos.length > 0"
      class="flex flex-wrap gap-2 mb-3"
    >
      <!-- Images -->
      <div
        v-for="img in images"
        :key="img.id"
        class="relative group"
      >
        <img
          :src="img.preview"
          :alt="img.name"
          class="w-20 h-20 rounded-lg object-cover border border-dark-600"
        />
        <button
          @click="removeImage(img.id)"
          class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X class="w-3 h-3 text-white" />
        </button>
      </div>

      <!-- Videos -->
      <div
        v-for="vid in videos"
        :key="vid.id"
        class="relative group"
      >
        <img
          :src="vid.preview"
          :alt="vid.name"
          class="w-20 h-20 rounded-lg object-cover border border-dark-600"
        />
        <div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <Film class="w-6 h-6 text-white" />
        </div>
        <button
          @click="removeVideo(vid.id)"
          class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X class="w-3 h-3 text-white" />
        </button>
      </div>
    </div>

    <!-- Input area -->
    <div class="flex items-end gap-2">
      <!-- File upload buttons -->
      <div class="flex gap-1">
        <input
          ref="imageInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handleImageUpload"
        />
        <button
          @click="imageInputRef?.click()"
          class="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors"
          title="Upload hình ảnh"
          :disabled="store.isLoading"
        >
          <Image class="w-5 h-5" />
        </button>

        <input
          ref="videoInputRef"
          type="file"
          accept="video/*"
          multiple
          class="hidden"
          @change="handleVideoUpload"
        />
        <button
          @click="videoInputRef?.click()"
          class="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors"
          title="Upload video"
          :disabled="store.isLoading"
        >
          <Film class="w-5 h-5" />
        </button>
      </div>

      <!-- Textarea -->
      <div class="flex-1 relative">
        <textarea
          ref="textareaRef"
          v-model="inputText"
          @input="adjustTextareaHeight"
          @keydown="handleKeydown"
          placeholder="Nhập tin nhắn... (Shift+Enter để xuống dòng)"
          rows="1"
          class="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500 resize-none"
          :disabled="store.isLoading"
        />
      </div>

      <!-- Send/Stop button -->
      <button
        v-if="store.isLoading"
        @click="store.abortRequest"
        class="p-3 bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
        title="Dừng"
      >
        <Square class="w-5 h-5 text-white" />
      </button>
      <button
        v-else
        @click="sendMessage"
        :disabled="!canSend"
        class="p-3 rounded-xl transition-colors"
        :class="canSend ? 'bg-primary-500 hover:bg-primary-600' : 'bg-dark-700 cursor-not-allowed'"
        title="Gửi"
      >
        <Send class="w-5 h-5 text-white" />
      </button>
    </div>

    <!-- Helper text -->
    <div class="mt-2 text-xs text-dark-500 text-center">
      Kéo thả hoặc paste (Ctrl+V) để upload hình ảnh/video
    </div>
  </div>
</template>
