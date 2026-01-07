<script setup lang="ts">
import { X, AlertCircle } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
</script>

<template>
  <div
    v-if="store.error"
    class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 flex items-center justify-between"
  >
    <div class="flex items-center gap-2">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <span class="text-sm">{{ store.error }}</span>
    </div>
    <button
      @click="store.setError(null)"
      class="p-1 hover:bg-red-500/20 rounded transition-colors"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
