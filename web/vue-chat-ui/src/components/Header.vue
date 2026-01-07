<script setup lang="ts">
import { ref } from 'vue'
import { Settings, Trash2, ExternalLink, MessageSquare, ToggleLeft, ToggleRight } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'
import ModelSelector from './ModelSelector.vue'
import ApiKeyInput from './ApiKeyInput.vue'

const store = useChatStore()
const showSettings = ref(false)

const toggleSettings = () => {
  showSettings.value = !showSettings.value
}
</script>

<template>
  <header class="sticky top-0 z-20 bg-dark-800 border-b border-dark-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <MessageSquare class="w-6 h-6 text-primary-400" />
        <h1 class="text-lg font-semibold text-dark-100">Vue Gemini Chat</h1>
      </div>
      <ModelSelector />
    </div>

    <div class="flex items-center gap-2">
      <!-- Context Toggle -->
      <button
        @click="store.setSendContext(!store.sendContext)"
        class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        :class="store.sendContext ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-700 text-dark-400'"
        :title="store.sendContext ? 'Đang gửi lịch sử chat' : 'Chỉ gửi tin nhắn mới'"
      >
        <ToggleRight v-if="store.sendContext" class="w-5 h-5" />
        <ToggleLeft v-else class="w-5 h-5" />
        <span class="text-sm hidden sm:inline">Context</span>
      </button>

      <!-- Clear Messages -->
      <button
        @click="store.clearMessages"
        class="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
        title="Xóa tất cả tin nhắn"
        :disabled="store.messages.length === 0"
      >
        <Trash2 class="w-5 h-5" />
      </button>

      <!-- Settings -->
      <button
        @click="toggleSettings"
        class="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors"
        :class="{ 'bg-dark-700 text-dark-100': showSettings }"
        title="Cài đặt"
      >
        <Settings class="w-5 h-5" />
      </button>

      <!-- Management Link -->
      <a
        href="/"
        class="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors"
        title="Quản lý"
      >
        <ExternalLink class="w-5 h-5" />
      </a>
    </div>
  </header>

  <!-- Settings Panel -->
  <div
    v-if="showSettings"
    class="sticky top-[57px] z-20 bg-dark-800 border-b border-dark-700 px-4 py-4 flex-shrink-0"
  >
    <div class="max-w-md">
      <ApiKeyInput />
    </div>
  </div>
</template>
