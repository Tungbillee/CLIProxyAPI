<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Bot } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'
import MessageBubble from './MessageBubble.vue'

const store = useChatStore()
const bottomRef = ref<HTMLDivElement | null>(null)

// Auto-scroll khi có tin nhắn mới
watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  }
)

// Auto-scroll khi message đang stream được cập nhật
watch(
  () => store.messages.map(m => m.content).join(''),
  async () => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  }
)
</script>

<template>
  <!-- Empty State -->
  <div
    v-if="store.messages.length === 0"
    class="flex-1 flex items-center justify-center p-8"
  >
    <div class="text-center max-w-md">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
        <Bot class="w-8 h-8 text-primary-400" />
      </div>
      <h2 class="text-xl font-semibold text-dark-100 mb-2">
        Chào mừng đến Vue Gemini Chat
      </h2>
      <p class="text-dark-400 text-sm">
        Gửi tin nhắn, hình ảnh hoặc video để bắt đầu cuộc trò chuyện với Gemini.
      </p>
    </div>
  </div>

  <!-- Message List -->
  <div
    v-else
    class="flex-1 overflow-y-auto p-4 space-y-4"
  >
    <MessageBubble
      v-for="message in store.messages"
      :key="message.id"
      :message="message"
    />
    <div ref="bottomRef" />
  </div>
</template>
