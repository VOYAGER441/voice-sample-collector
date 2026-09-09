/**
 * Detects the highest quality supported audio MIME type across browsers.
 */
export function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return 'audio/webm';
  }

  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return ''; // Browser default
}

/**
 * Derives file extension from mime type.
 */
export function getExtensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return '.mp4';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  return '.webm';
}

/**
 * Formats seconds into mm:ss format (e.g. 60 -> "01:00", 9 -> "00:09")
 */
export function formatTime(seconds: number): string {
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats bytes to human readable format (KB, MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats a clean export filename adhering to:
 * "[timestamp]_responder_[respondent_name]_voice_sample.[ext]"
 */
export function generateVoiceSampleFilename(respondentName: string, mimeType: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  
  const cleanName = (respondentName || 'Respondent')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);

  const ext = getExtensionForMimeType(mimeType);
  return `${timestamp}_responder_${cleanName}_voice_sample${ext}`;
}
