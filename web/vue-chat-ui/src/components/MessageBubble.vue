<script setup lang="ts">
import { ref } from 'vue'
import { User, Bot, Download, X } from 'lucide-vue-next'
import type { Message } from '../types'

const props = defineProps<{
  message: Message
}>()

const lightboxImage = ref<string | null>(null)

const isUser = props.message.role === 'user'

const downloadImage = (url: string, index: number) => {
  const link = document.createElement('a')
  link.href = url
  link.download = `generated-image-${index + 1}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <!-- Lightbox -->
  <Teleport to="body">
    <div
      v-if="lightboxImage"
      class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      @click="lightboxImage = null"
    >
      <button
        class="absolute top-4 right-4 text-white hover:text-gray-300"
        @click="lightboxImage = null"
      >
        <X class="w-8 h-8" />
      </button>
      <img
        :src="lightboxImage"
        alt="Generated"
        class="max-w-full max-h-full object-contain rounded-lg"
        @click.stop
      />
    </div>
  </Teleport>

  <div :class="['flex gap-3', isUser ? 'justify-end' : 'justify-start']">
    <!-- Bot Avatar -->
    <div
      v-if="!isUser"
      class="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center"
    >
      <Bot class="w-5 h-5 text-primary-400" />
    </div>

    <div :class="['max-w-[80%]', isUser ? 'order-first' : '']">
      <!-- Image/Video attachments -->
      <div
        v-if="message.images?.length || message.videos?.length"
        class="flex flex-wrap gap-2 mb-2"
      >
        <div v-for="img in message.images" :key="img.id" class="relative">
          <img
            :src="img.preview"
            :alt="img.name"
            class="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-dark-600"
          />
        </div>
        <div v-for="vid in message.videos" :key="vid.id" class="relative">
          <img
            :src="vid.preview"
            :alt="vid.name"
            class="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-dark-600"
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <div class="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
            </div>
          </div>
        </div>
      </div>

      <!-- Message content -->
      <div
        :class="[
          'px-4 py-3 rounded-2xl',
          isUser
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-dark-700 text-dark-100 rounded-bl-md'
        ]"
      >
        <div class="markdown-content whitespace-pre-wrap break-words">
          {{ message.content }}
          <span v-if="message.isStreaming" class="streaming-cursor" />
        </div>
      </div>

      <!-- Generated images from AI -->
      <div
        v-if="message.generatedImages?.length"
        class="flex flex-wrap gap-2 mt-2"
      >
        <div
          v-for="img in message.generatedImages"
          :key="img.index"
          class="relative group"
        >
          <img
            :src="img.url"
            :alt="`Generated ${img.index + 1}`"
            class="max-w-[300px] max-h-[300px] rounded-lg object-cover border border-dark-600 cursor-pointer hover:opacity-90 transition-opacity"
            @click="lightboxImage = img.url"
          />
          <button
            @click="downloadImage(img.url, img.index)"
            class="absolute bottom-2 right-2 p-2 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            title="Tải xuống"
          >
            <Download class="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <!-- Timestamp -->
      <div :class="['text-xs text-dark-500 mt-1', isUser ? 'text-right' : 'text-left']">
        {{ formatTime(message.timestamp) }}
      </div>
    </div>

    <!-- User Avatar -->
    <div
      v-if="isUser"
      class="flex-shrink-0 w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center"
    >
      <User class="w-5 h-5 text-dark-300" />
    </div>
  </div>
</template>
