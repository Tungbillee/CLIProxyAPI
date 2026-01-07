<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ChevronDown, Eye, Video } from 'lucide-vue-next'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
const isOpen = ref(false)
const selectorRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref({ top: 0, left: 0 })

const selectedModelName = computed(() => {
  const model = store.models.find(m => m.id === store.selectedModel)
  return model?.name || store.selectedModel
})

const selectedModelInfo = computed(() => {
  return store.models.find(m => m.id === store.selectedModel)
})

const dropdownStyle = computed(() => ({
  top: `${dropdownPosition.value.top}px`,
  left: `${dropdownPosition.value.left}px`,
}))

const updateDropdownPosition = () => {
  if (selectorRef.value) {
    const rect = selectorRef.value.getBoundingClientRect()
    dropdownPosition.value = {
      top: rect.bottom + 8,
      left: rect.left,
    }
  }
}

watch(isOpen, (open) => {
  if (open) {
    nextTick(updateDropdownPosition)
  }
})

const selectModel = (modelId: string) => {
  store.setSelectedModel(modelId)
  isOpen.value = false
}

// Close on escape
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') isOpen.value = false
}
</script>

<template>
  <div
    ref="selectorRef"
    class="relative model-selector"
    @keydown="handleKeydown"
  >
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg border border-dark-600 transition-colors"
    >
      <span class="text-sm font-medium text-dark-100">{{ selectedModelName }}</span>
      <div class="flex items-center gap-1">
        <Eye
          v-if="selectedModelInfo?.supportsVision"
          class="w-3.5 h-3.5 text-primary-400"
          title="Hỗ trợ hình ảnh"
        />
        <Video
          v-if="selectedModelInfo?.supportsVideo"
          class="w-3.5 h-3.5 text-green-400"
          title="Hỗ trợ video"
        />
      </div>
      <ChevronDown
        class="w-4 h-4 text-dark-400 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>
  </div>

  <!-- Teleport dropdown & overlay to body to avoid z-index stacking context issues -->
  <Teleport to="body">
    <!-- Click outside listener -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    />
    <!-- Dropdown menu -->
    <div
      v-if="isOpen"
      class="fixed w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto"
      :style="dropdownStyle"
    >
      <button
        v-for="model in store.models"
        :key="model.id"
        @click="selectModel(model.id)"
        class="w-full px-3 py-2 text-left hover:bg-dark-700 flex items-center justify-between transition-colors"
        :class="{ 'bg-primary-500/10': model.id === store.selectedModel }"
      >
        <span class="text-sm text-dark-100">{{ model.name }}</span>
        <div class="flex items-center gap-1">
          <Eye
            v-if="model.supportsVision"
            class="w-3.5 h-3.5 text-primary-400"
          />
          <Video
            v-if="model.supportsVideo"
            class="w-3.5 h-3.5 text-green-400"
          />
        </div>
      </button>
    </div>
  </Teleport>
</template>
