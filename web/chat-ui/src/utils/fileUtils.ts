import type { ImageAttachment, VideoAttachment } from '../types';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
];

export function isImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

export function isVideoFile(file: File): boolean {
  return SUPPORTED_VIDEO_TYPES.includes(file.type);
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function processImageFile(file: File): Promise<ImageAttachment> {
  if (!isImageFile(file)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
  }

  const data = await fileToBase64(file);
  const preview = `data:${file.type};base64,${data}`;

  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    data,
    mimeType: file.type,
    name: file.name,
    preview,
  };
}

export async function processVideoFile(file: File): Promise<VideoAttachment> {
  if (!isVideoFile(file)) {
    throw new Error(`Unsupported video type: ${file.type}`);
  }

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(`Video too large. Max size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
  }

  const data = await fileToBase64(file);

  // Create video thumbnail
  const preview = await generateVideoThumbnail(file);

  return {
    id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    data,
    mimeType: file.type,
    name: file.name,
    preview,
  };
}

async function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadeddata = () => {
      video.currentTime = 0.1; // Seek to 0.1s for thumbnail
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      // Return placeholder if thumbnail generation fails
      resolve('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5Z29uIHBvaW50cz0iNSAzIDE5IDEyIDUgMjEgNSAzIj48L3BvbHlnb24+PC9zdmc+');
    };

    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
