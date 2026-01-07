import { ref } from 'vue'
import { processImageFile, processVideoFile, isImageFile, isVideoFile } from '../utils/fileUtils'
import type { ImageAttachment, VideoAttachment } from '../types'

export function useDropZone() {
  const isDragOver = ref(false)
  const uploadError = ref<string | null>(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    isDragOver.value = true
  }

  const handleDragLeave = () => {
    isDragOver.value = false
  }

  const handleDrop = async (
    e: DragEvent,
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    e.preventDefault()
    isDragOver.value = false

    const files = e.dataTransfer?.files
    if (!files) return

    await processFiles(files, onImage, onVideo)
  }

  const processFiles = async (
    files: FileList | File[],
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    uploadError.value = null
    for (const file of Array.from(files)) {
      try {
        if (isImageFile(file)) {
          const img = await processImageFile(file)
          onImage(img)
        } else if (isVideoFile(file)) {
          const vid = await processVideoFile(file)
          onVideo(vid)
        } else {
          uploadError.value = `Định dạng không hỗ trợ: ${file.name}`
        }
      } catch (err) {
        uploadError.value = err instanceof Error ? err.message : 'Upload thất bại'
      }
    }
  }

  return {
    isDragOver,
    uploadError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFiles,
  }
}
