import { processImageFile, processVideoFile, isImageFile, isVideoFile } from '../utils/fileUtils'
import type { ImageAttachment, VideoAttachment } from '../types'

export function useClipboardPaste() {
  const handlePaste = async (
    e: ClipboardEvent,
    onImage: (img: ImageAttachment) => void,
    onVideo: (vid: VideoAttachment) => void
  ) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length === 0) return
    e.preventDefault()

    for (const file of files) {
      try {
        if (isImageFile(file)) {
          const img = await processImageFile(file)
          onImage(img)
        } else if (isVideoFile(file)) {
          const vid = await processVideoFile(file)
          onVideo(vid)
        }
      } catch (err) {
        console.error('Paste failed:', err)
      }
    }
  }

  return { handlePaste }
}
