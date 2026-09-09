export const DEFAULT_DRIVE_FOLDER_ID = '178-U6uV2OQr3MHgQxiY1ZKJ_2jZJMwN-';
export const DEFAULT_DRIVE_FOLDER_NAME = 'sheild_dataset';

export interface DriveFileInfo {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

/**
 * Lists voice files directly from the user's Google Drive folder
 */
export async function listDriveFolderFiles(
  accessToken: string,
  folderId = DEFAULT_DRIVE_FOLDER_ID
): Promise<DriveFileInfo[]> {
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,size,createdTime,webViewLink)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=createdTime desc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Google Drive folder (${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing Drive folder files:', error);
    throw error;
  }
}

/**
 * Direct upload of audio Blob to Google Drive folder using multipart request
 */
export async function uploadDirectToGoogleDrive(
  audioBlob: Blob,
  filename: string,
  respondentName: string,
  accessToken: string,
  folderId = DEFAULT_DRIVE_FOLDER_ID
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const metadata = {
    name: filename,
    parents: [folderId],
    description: `Voice sample ("sheild activate") submitted by ${respondentName}`,
    properties: {
      phrase: 'sheild activate',
      respondent: respondentName,
      source: 'Voice Sample Collector',
    },
  };

  const boundary = '-------' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const mediaHeader = `${delimiter}Content-Type: ${audioBlob.type || 'audio/webm'}\r\n\r\n`;

  // Read blob as ArrayBuffer
  const fileArrayBuffer = await audioBlob.arrayBuffer();

  const metadataBlob = new Blob([metadataPart], { type: 'text/plain' });
  const mediaHeaderBlob = new Blob([mediaHeader], { type: 'text/plain' });
  const mediaContentBlob = new Blob([fileArrayBuffer], { type: audioBlob.type || 'audio/webm' });
  const closeDelimiterBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  const multipartBody = new Blob(
    [metadataBlob, mediaHeaderBlob, mediaContentBlob, closeDelimiterBlob],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.error?.message || `Google Drive upload failed with status ${res.status}`
    );
  }

  const result = await res.json();
  return result;
}
