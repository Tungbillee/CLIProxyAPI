# Vue 3 File Upload Patterns - Research Report

**Ngày:** 04/01/2026 | **Chủ đề:** Vue 3 Composition API file upload patterns

---

## Executive Summary

Vue 3 Composition API cung cấp framework tối ưu để xây dựng file upload features với drag & drop, clipboard paste, preview generation, và base64 encoding. Research này tập trung vào:

1. **Drag & Drop Implementation** - Event handling patterns, dropzone state management
2. **Clipboard Paste Handling** - File extraction từ clipboard, VueUse `useClipboard`
3. **Image/Video Preview** - Base64 encoding, Blob URLs, GIF generation
4. **Performance Optimization** - Large file handling, memory management, chunking strategies
5. **TypeScript Integration** - Type-safe file handling, composable patterns

**Key Takeaway:** Sử dụng VueUse composables (`useClipboard`, `useBase64`) + composition functions để maintain clean, reusable, testable code.

---

## Key Findings

### 1. Drag & Drop Pattern (Composition API)

**Core Pattern - DropZone Composable:**

```typescript
// composables/useDropZone.ts
import { ref, computed } from 'vue'

export interface UploadableFile {
  id: string
  file: File
  preview: string
  status: null | 'loading' | 'success' | 'error'
}

export function useDropZone() {
  const isDragging = ref(false)
  const files = ref<UploadableFile[]>([])

  const handleDragover = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = true
  }

  const handleDragleave = (event: DragEvent) => {
    event.preventDefault()
    if (event.target === event.currentTarget) {
      isDragging.value = false
    }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = false

    const droppedFiles = event.dataTransfer?.files || new FileList()
    addFiles(droppedFiles)
  }

  const addFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => {
      // Prevent duplicates via Set
      const exists = files.value.some(f => f.file.name === file.name && f.file.size === file.size)
      if (exists) return

      const id = generateId()
      const preview = generatePreview(file)

      files.value.push({
        id,
        file,
        preview,
        status: null
      })
    })
  }

  const removeFile = (id: string) => {
    const index = files.value.findIndex(f => f.id === id)
    if (index > -1) {
      const preview = files.value[index].preview
      // Cleanup object URL to prevent memory leak
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
      files.value.splice(index, 1)
    }
  }

  return {
    isDragging,
    files,
    handleDragover,
    handleDragleave,
    handleDrop,
    addFiles,
    removeFile
  }
}
```

**Template Usage:**

```vue
<template>
  <div
    @dragover="handleDragover"
    @dragleave="handleDragleave"
    @drop="handleDrop"
    :class="{ 'is-dragging': isDragging }"
    class="dropzone"
  >
    <input
      type="file"
      multiple
      hidden
      @change="e => addFiles(e.target?.files || new FileList())"
      ref="fileInput"
    />
    <label>
      <p v-if="!isDragging">Drag files here or click to select</p>
      <p v-else class="text-primary">Drop files now</p>
    </label>
  </div>

  <div v-if="files.length" class="file-list">
    <div v-for="uploadableFile in files" :key="uploadableFile.id" class="file-item">
      <img v-if="uploadableFile.preview" :src="uploadableFile.preview" class="preview" />
      <div class="info">
        <p>{{ uploadableFile.file.name }}</p>
        <p class="size">{{ formatFileSize(uploadableFile.file.size) }}</p>
      </div>
      <button @click="removeFile(uploadableFile.id)" class="btn-remove">×</button>
    </div>
  </div>
</template>
```

**Best Practices:**
- Prevent duplicate files bằng Set (kiểm tra name + size)
- Timeout trên `handleDragleave` để prevent flicker (100-200ms)
- Cleanup Blob URLs via `URL.revokeObjectURL()` khi remove file
- Separate dropzone từ file upload logic

---

### 2. Clipboard Paste Handling

**Pattern 1: Native Clipboard API**

```typescript
// composables/useClipboardPaste.ts
import { ref } from 'vue'

export function useClipboardPaste() {
  const pastedFiles = ref<File[]>([])

  const handlePaste = async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items || []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Check if item is file
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file && isValidFileType(file)) {
          pastedFiles.value.push(file)
        }
      }
    }
  }

  const isValidFileType = (file: File): boolean => {
    const validTypes = ['image/', 'video/', 'application/pdf']
    return validTypes.some(type => file.type.startsWith(type))
  }

  return {
    pastedFiles,
    handlePaste
  }
}
```

**Pattern 2: VueUse `useClipboard` + Manual File Handling**

```typescript
import { useClipboard } from '@vueuse/core'
import { ref, watch } from 'vue'

export function useClipboardWithFiles() {
  const { text, copy, copied, isSupported } = useClipboard()
  const files = ref<File[]>([])

  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    Array.from(items).forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.value.push(file)
      }
    })
  }

  return {
    files,
    handlePaste,
    isSupported
  }
}
```

**Template Integration:**

```vue
<div @paste="handlePaste" contenteditable tabindex="0" class="paste-area">
  Click here and paste files (Ctrl+V / Cmd+V)
</div>

<div v-if="pastedFiles.length" class="pasted-files">
  <div v-for="(file, idx) in pastedFiles" :key="idx">
    {{ file.name }} ({{ formatFileSize(file.size) }})
  </div>
</div>
```

**Security Note:** Validate file types + sizes trước xử lý.

---

### 3. Image/Video Preview Generation

**Pattern 1: Image Preview với Object URL (Fast)**

```typescript
// composables/useImagePreview.ts
import { ref, computed } from 'vue'

export function useImagePreview(file: File) {
  const objectUrl = ref<string>('')

  const generatePreview = () => {
    if (file.type.startsWith('image/')) {
      objectUrl.value = URL.createObjectURL(file)
    }
  }

  const cleanup = () => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = ''
    }
  }

  // Auto-cleanup on unmount
  onBeforeUnmount(() => cleanup())

  return {
    objectUrl: computed(() => objectUrl.value),
    generatePreview,
    cleanup
  }
}
```

**Pattern 2: Base64 Encoding với VueUse**

```typescript
import { useBase64 } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

export function useFileAsBase64(file: Ref<File | undefined>) {
  const { base64, promise, execute } = useBase64(file)

  // Returns data URL format: "data:image/png;base64,..."
  return {
    base64, // Reactive ref to base64 string
    promise, // For async operations
    execute // Manual trigger
  }
}

// Usage:
const fileRef = shallowRef<File>()
const { base64 } = useFileAsBase64(fileRef)

watch(() => base64.value, (encoded) => {
  if (encoded) {
    api.uploadFile({ data: encoded })
  }
})
```

**Pattern 3: Video Thumbnail Generation**

```typescript
export function useVideoThumbnail(file: File) {
  const thumbnail = ref<string>('')

  const generateThumbnail = async () => {
    return new Promise<void>((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        video.currentTime = 0 // Capture first frame
      }

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          thumbnail.value = canvas.toDataURL('image/jpeg', 0.8)
        }
        URL.revokeObjectURL(video.src)
        resolve()
      }

      video.src = URL.createObjectURL(file)
    })
  }

  return {
    thumbnail,
    generateThumbnail
  }
}
```

---

### 4. Base64 Encoding for API Submission

**Key Considerations:**

| Aspect | Details |
|--------|---------|
| **Size overhead** | Base64 tăng kích thước ~33% so với binary |
| **Use case** | Chỉ dùng khi API yêu cầu, không phải default |
| **Performance** | Encoding diễn ra trong browser (consume CPU/Memory) |
| **Large files** | Cân nhắc chunking hoặc server-side processing |

**Recommended Pattern: Conditional Base64**

```typescript
// composables/useFileUpload.ts
import { useBase64 } from '@vueuse/core'
import { ref } from 'vue'

export interface UploadOptions {
  requireBase64?: boolean
  maxFileSizeMB?: number
  allowedTypes?: string[]
}

export function useFileUpload(options: UploadOptions = {}) {
  const {
    requireBase64 = false,
    maxFileSizeMB = 10,
    allowedTypes = ['image/*', 'video/*']
  } = options

  const validateFile = (file: File): boolean => {
    // Check size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      throw new Error(`File exceeds ${maxFileSizeMB}MB limit`)
    }

    // Check type
    if (!allowedTypes.some(type => {
      if (type.endsWith('*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })) {
      throw new Error('File type not allowed')
    }

    return true
  }

  const prepareForUpload = async (file: File) => {
    validateFile(file)

    if (requireBase64) {
      // Sử dụng useBase64 cho encoding
      const fileRef = shallowRef(file)
      const { base64, promise } = useBase64(fileRef)
      await promise

      return {
        data: base64.value, // data:image/png;base64,...
        type: 'base64'
      }
    } else {
      // Use FormData (preferred for large files)
      const formData = new FormData()
      formData.append('file', file)

      return {
        data: formData,
        type: 'formdata'
      }
    }
  }

  return {
    validateFile,
    prepareForUpload
  }
}
```

**API Submission:**

```typescript
// composables/useApiUpload.ts
export async function uploadFile(file: File, endpoint: string) {
  const { prepareForUpload } = useFileUpload({
    requireBase64: false, // Prefer FormData
    maxFileSizeMB: 100,
    allowedTypes: ['image/*', 'video/*']
  })

  try {
    const { data, type } = await prepareForUpload(file)

    if (type === 'formdata') {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: data as FormData
      })
      return response.json()
    } else {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: data })
      })
      return response.json()
    }
  } catch (error) {
    console.error('Upload failed:', error)
    throw error
  }
}
```

---

### 5. Performance Optimization cho Large Files

**Pattern 1: Chunked Upload**

```typescript
export async function uploadFileChunked(
  file: File,
  endpoint: string,
  chunkSize: number = 5 * 1024 * 1024 // 5MB
) {
  const totalChunks = Math.ceil(file.size / chunkSize)
  const uploadId = generateUUID()

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('chunkIndex', String(i))
    formData.append('totalChunks', String(totalChunks))
    formData.append('uploadId', uploadId)

    await fetch(endpoint, {
      method: 'POST',
      body: formData
    })
  }

  // Signal completion
  return fetch(`${endpoint}/complete`, {
    method: 'POST',
    body: JSON.stringify({ uploadId, totalChunks })
  })
}
```

**Pattern 2: Lazy Preview Generation**

```typescript
export function useLazyImagePreview(file: Ref<File | null>) {
  const preview = ref<string>('')
  const isGenerating = ref(false)

  const generatePreview = async () => {
    if (!file.value?.type.startsWith('image/')) return

    isGenerating.value = true
    try {
      // Defer to next frame để không block UI
      await new Promise(resolve => setTimeout(resolve, 0))
      preview.value = URL.createObjectURL(file.value)
    } finally {
      isGenerating.value = false
    }
  }

  // Auto-generate with debounce
  const debouncedGenerate = debounce(generatePreview, 300)
  watch(file, debouncedGenerate)

  onBeforeUnmount(() => {
    if (preview.value.startsWith('blob:')) {
      URL.revokeObjectURL(preview.value)
    }
  })

  return { preview, isGenerating }
}
```

**Memory Management - Critical:**

```typescript
// Always cleanup Blob URLs!
function cleanupBlobUrl(url: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

// Use in component:
onBeforeUnmount(() => {
  files.value.forEach(file => {
    cleanupBlobUrl(file.preview)
  })
})
```

---

### 6. Complete TypeScript-First Composable

```typescript
// composables/useFileUploadManager.ts
import { ref, computed, Ref, onBeforeUnmount } from 'vue'
import { useClipboard } from '@vueuse/core'

export interface UploadableFile {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

export interface FileUploadManagerOptions {
  maxFiles?: number
  maxFileSizeMB?: number
  allowedTypes?: string[]
  autoCleanupBlobs?: boolean
}

export function useFileUploadManager(options: FileUploadManagerOptions = {}) {
  const {
    maxFiles = 10,
    maxFileSizeMB = 100,
    allowedTypes = ['image/*', 'video/*'],
    autoCleanupBlobs = true
  } = options

  const files = ref<UploadableFile[]>([])
  const isDragging = ref(false)
  const { isSupported: clipboardSupported } = useClipboard()

  const filesCount = computed(() => files.value.length)
  const canAddMore = computed(() => filesCount.value < maxFiles)
  const totalSize = computed(() =>
    files.value.reduce((sum, f) => sum + f.file.size, 0)
  )

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return { valid: false, error: `File exceeds ${maxFileSizeMB}MB` }
    }

    const typeValid = allowedTypes.some(type => {
      if (type.endsWith('*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type
    })

    if (!typeValid) {
      return { valid: false, error: 'File type not allowed' }
    }

    return { valid: true }
  }

  const addFiles = (fileList: FileList | File[]) => {
    if (!canAddMore.value) return

    Array.from(fileList).forEach(file => {
      const { valid, error } = validateFile(file)
      if (!valid) {
        console.warn(`Skipped ${file.name}: ${error}`)
        return
      }

      const id = generateUUID()
      const preview = generatePreview(file)

      files.value.push({
        id,
        file,
        preview,
        status: 'pending',
        progress: 0
      })
    })
  }

  const removeFile = (id: string) => {
    const idx = files.value.findIndex(f => f.id === id)
    if (idx > -1) {
      const { preview } = files.value[idx]
      if (autoCleanupBlobs) {
        cleanupBlobUrl(preview)
      }
      files.value.splice(idx, 1)
    }
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    isDragging.value = false
    const droppedFiles = event.dataTransfer?.files
    if (droppedFiles) addFiles(droppedFiles)
  }

  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    const pastedFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile()
        if (file) pastedFiles.push(file)
      }
    }

    if (pastedFiles.length) addFiles(pastedFiles)
  }

  const cleanup = () => {
    if (!autoCleanupBlobs) return
    files.value.forEach(f => cleanupBlobUrl(f.preview))
  }

  onBeforeUnmount(() => cleanup())

  return {
    // State
    files,
    isDragging,
    filesCount,
    canAddMore,
    totalSize,
    clipboardSupported,

    // Methods
    addFiles,
    removeFile,
    handleDrop,
    handlePaste,
    validateFile,
    cleanup
  }
}
```

---

## Best Practices 2025

### Core Principles

1. **Use VueUse composables** - `useClipboard`, `useBase64`, pre-tested & maintained
2. **Memory management** - Always cleanup Blob URLs, prevent memory leaks
3. **Separate concerns** - Dropzone logic ≠ Upload logic ≠ Preview logic
4. **Type safety** - Use TypeScript enums cho file statuses, not magic strings
5. **Validation first** - Validate size + type BEFORE encoding/upload
6. **Prefer FormData over Base64** - Unless API specifically requires base64
7. **Debounce expensive ops** - Preview generation, paste events
8. **Test file operations** - Mock FileReader, Blob, FormData in tests

### Performance Checklist

- [ ] Cleanup Blob URLs trên unmount
- [ ] Prevent duplicate files (check name + size)
- [ ] Debounce paste events (300ms)
- [ ] Use Object URL for image preview (not base64)
- [ ] Chunk large files (>10MB)
- [ ] Lazy-generate previews (defer to next frame)
- [ ] Monitor memory usage (DevTools)
- [ ] Test with large files (100MB+)

### TypeScript Patterns

```typescript
// Good: Enum for status
enum FileStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  ERROR = 'error'
}

// Bad: Magic strings
status: 'pending' | 'uploading' | 'success' | 'error'

// Good: Separate interfaces
interface FileUploadOptions { ... }
interface UploadableFile { ... }
interface ValidationResult { valid: boolean; error?: string }

// Bad: Everything in one type
interface FileData { [key: string]: any }
```

---

## Implementation Roadmap

**Phase 1: Core Upload (MVP)**
- [ ] Drag & drop composable
- [ ] File validation
- [ ] Image preview (Object URL)
- [ ] FormData upload

**Phase 2: Enhanced UX**
- [ ] Clipboard paste support
- [ ] Upload progress tracking
- [ ] File list management
- [ ] Error handling UI

**Phase 3: Advanced**
- [ ] Chunked upload for large files
- [ ] Video thumbnail generation
- [ ] Base64 support (optional API)
- [ ] Retry mechanism

---

## Key Resources

### Official Documentation
- [Vue.js Event Handling](https://vuejs.org/guide/essentials/event-handling.html)
- [VueUse useClipboard](https://vueuse.org/core/useclipboard/)
- [VueUse useBase64](https://vueuse.org/core/usebase64/)

### Recommended Articles
- [Smashing Magazine - Drag & Drop File Uploader](https://www.smashingmagazine.com/2022/03/drag-drop-file-uploader-vuejs-3/)
- [Vue School - Base64 File Uploads](https://vueschool.io/lessons/handle-file-uploads-as-base64-encoded-data-in-vue-js)

### Community Libraries
- [vue-file-uploader](https://github.com/dafcoe/vue-file-uploader) - Production-ready component
- [V-File-Grid](https://github.com/ha-wa-jajaja/V-File-Grid) - Google Drive-style component

---

## Unresolved Questions

1. **Exact chunking strategy** - Optimal chunk size cho different network conditions? (Recommend research network quality detection)
2. **GIF preview generation** - Timing requirements cho video preview GIFs? (Depends on UX requirements)
3. **Concurrent uploads** - Max concurrent uploads tùy infrastructure, cần define limit
4. **Server-side resumable upload** - Tik-Tok, YouTube handling? (Out of scope - server implementation)
