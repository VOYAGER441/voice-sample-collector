export interface RespondentForm {
  name: string;
  email?: string;
}

export interface AudioRecording {
  blob: Blob;
  url: string;
  duration: number; // in seconds
  mimeType: string;
  fileName: string;
  fileSize: number;
}

export interface SubmissionRecord {
  id: string;
  name: string;
  email?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  duration: number;
  mimeType: string;
  submittedAt: string;
  storageDestination: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveStatus?: 'uploaded' | 'pending' | 'failed';
  driveError?: string;
}

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message: string;
}
