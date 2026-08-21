export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
export const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024;
export const MEDIA_UPLOAD_PART_SIZE_BYTES = 10 * 1024 * 1024;
export const MEDIA_UPLOAD_URL_EXPIRES_IN = 3600;
export const MEDIA_PREVIEW_SIZE = 320;
export const MEDIA_PREVIEW_QUALITY = 82;

export const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/3gpp',
  'video/3gpp2',
  'video/x-flv',
  'video/mp2t',
]);

export const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
  'audio/vnd.wave',
]);

export type MediaKindValue = 'IMAGE' | 'VIDEO' | 'AUDIO';

export function getMediaKind(mimeType: string): MediaKindValue | null {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'VIDEO';
  if (AUDIO_MIME_TYPES.has(mimeType)) return 'AUDIO';
  return null;
}

export function getMediaMaxSize(kind: MediaKindValue): number {
  if (kind === 'IMAGE') return MAX_IMAGE_SIZE_BYTES;
  if (kind === 'VIDEO') return MAX_VIDEO_SIZE_BYTES;
  return MAX_AUDIO_SIZE_BYTES;
}

export function getMediaStoragePrefix(kind: MediaKindValue): string {
  return kind === 'IMAGE' ? 'images' : kind === 'VIDEO' ? 'videos' : 'audio';
}
