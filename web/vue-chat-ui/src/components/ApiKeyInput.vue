<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, EyeOff, Check } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
const localKey = ref(store.apiKey)
const showKey = ref(false)
const saved = ref(false)

watch(() => store.apiKey, (newVal) => {
  localKey.value = newVal
})

const saveKey = () => {
  store.setApiKey(localKey.value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    saveKey()
  }
}
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-dark-300">API Key</label>
    <div class="relative">
      <input
        v-model="localKey"
        :type="showKey ? 'text' : 'password'"
        @blur="saveKey"
        @keydown="handleKeydown"
        placeholder="Nhập API key..."
        class="w-full px-3 py-2 pr-20 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500 text-sm"
      />
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          @click="showKey = !showKey"
          class="p-1.5 text-dark-400 hover:text-dark-200 transition-colors"
          type="button"
        >
          <Eye v-if="!showKey" class="w-4 h-4" />
          <EyeOff v-else class="w-4 h-4" />
        </button>
        <span
          v-if="saved"
          class="text-green-400 text-xs flex items-center gap-1"
        >
          <Check class="w-3 h-3" />
          Đã lưu
        </span>
      </div>
    </div>
    <p class="text-xs text-dark-500">
      Key được lưu trong localStorage của trình duyệt
    </p>
  </div>
</template>
