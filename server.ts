import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Ensure directories exist
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([]), 'utf-8');
}

// Google Drive configuration
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '178-U6uV2OQr3MHgQxiY1ZKJ_2jZJMwN-';
const GOOGLE_DRIVE_FOLDER_NAME = 'sheild_dataset';

/**
 * Update existing file name on Google Drive
 */
async function updateGoogleDriveFileName(
  fileId: string,
  newFilename: string,
  accessToken: string
): Promise<void> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newFilename }),
    });
    if (!res.ok) {
      console.warn(`Drive rename warning (${res.status}):`, await res.text());
    }
  } catch (e) {
    console.warn('Could not update file name on Google Drive:', e);
  }
}

/**
 * Upload an audio file to the user's Google Drive folder using Google Drive API v3
 */
async function uploadToGoogleDrive(
  filePath: string,
  filename: string,
  mimeType: string,
  respondentName: string,
  accessToken: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const fileData = fs.readFileSync(filePath);
  const metadata = {
    name: filename,
    parents: [GOOGLE_DRIVE_FOLDER_ID],
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
  const mediaHeader = `${delimiter}Content-Type: ${mimeType || 'audio/webm'}\r\n\r\n`;

  const payload = Buffer.concat([
    Buffer.from(metadataPart, 'utf8'),
    Buffer.from(mediaHeader, 'utf8'),
    fileData,
    Buffer.from(closeDelimiter, 'utf8'),
  ]);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': payload.length.toString(),
        },
        body: payload,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Drive API error:', response.status, errText);
      let errMsg = `Google Drive upload failed (${response.status})`;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.error?.message) errMsg = errObj.error.message;
      } catch {}
      throw new Error(errMsg);
    }

    const data = (await response.json()) as { id: string; name: string; webViewLink?: string };
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate clearly formatted name: timestamp and respondent name
    const rawName = (req.body.name || 'Anonymous').toString();
    const sanitizedName = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) || 'Respondent';
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    
    // Determine extension from file.mimetype or original name
    let ext = '.webm';
    if (file.mimetype.includes('mp4')) ext = '.mp4';
    else if (file.mimetype.includes('ogg')) ext = '.ogg';
    else if (file.mimetype.includes('mp3') || file.mimetype.includes('mpeg')) ext = '.mp3';
    else if (file.mimetype.includes('wav')) ext = '.wav';
    
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const finalFilename = `${timestamp}_responder_${sanitizedName}_voice_sample_${uniqueSuffix}${ext}`;
    cb(null, finalFilename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 35 * 1024 * 1024, // 35 MB max for 1-minute audio
  },
});

// CORS & Preflight middleware for iframe and cross-origin embedding
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Helper to read submissions
function readSubmissions(): any[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
      return JSON.parse(data || '[]');
    }
  } catch (err) {
    console.error('Error reading submissions:', err);
  }
  return [];
}

// Helper to write submissions
function writeSubmissions(submissions: any[]) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing submissions:', err);
  }
}

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload audio endpoint
app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('audio')(req, res, async (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Audio file too large. Maximum allowed size is 35MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Failed to process audio file.' });
    }

    try {
      const file = req.file;
      const { name, email, duration } = req.body;

      if (!file) {
        return res.status(400).json({ error: 'Audio file is required.' });
      }

      if (!name || !name.trim()) {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, () => {});
        }
        return res.status(400).json({ error: 'Respondent name is required.' });
      }

      const durationNum = parseFloat(duration);
      if (isNaN(durationNum) || durationNum < 5) {
        // Clean up uploaded file if validation fails
        if (file.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, () => {});
        }
        return res.status(400).json({ error: 'Recording must be at least 5 seconds long.' });
      }

      // Ensure filename properly includes the respondent's clean name with responder prefix
      let finalFilename = file.filename;
      const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) || 'Respondent';
      if (!finalFilename.includes(`_responder_${sanitizedName}_`)) {
        const ext = path.extname(finalFilename);
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const uniqueSuffix = Math.random().toString(36).substring(2, 7);
        const targetFilename = `${timestamp}_responder_${sanitizedName}_voice_sample_${uniqueSuffix}${ext}`;
        const targetPath = path.join(UPLOADS_DIR, targetFilename);
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.renameSync(file.path, targetPath);
            finalFilename = targetFilename;
          }
        } catch (renameErr) {
          console.warn('Could not rename file, keeping original:', renameErr);
        }
      }

      const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const targetFilePath = path.join(UPLOADS_DIR, finalFilename);

      // Check if client provided a Google OAuth Bearer access token
      let driveUploadResult: { id: string; name: string; webViewLink?: string } | null = null;
      let driveStatus: 'uploaded' | 'pending' | 'failed' = 'pending';
      let driveError: string | undefined;

      const authHeader = req.headers.authorization;
      const accessToken =
        authHeader?.startsWith('Bearer ') && authHeader.length > 17
          ? authHeader.slice(7).trim()
          : null;

      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined' && accessToken.length > 10) {
        try {
          driveUploadResult = await uploadToGoogleDrive(
            targetFilePath,
            finalFilename,
            file.mimetype || 'audio/webm',
            name.trim(),
            accessToken
          );
          driveStatus = 'uploaded';
        } catch (dErr: any) {
          console.error('Direct Google Drive upload on submission failed:', dErr);
          driveStatus = 'failed';
          driveError = dErr.message || 'Google Drive upload failed';
        }
      }

      const storageLocation =
        driveStatus === 'uploaded'
          ? `Google Drive (${GOOGLE_DRIVE_FOLDER_NAME})`
          : `Local Server Storage (Pending Google Drive Sync)`;

      const newSubmission = {
        id,
        name: name.trim(),
        email: (email || '').trim(),
        fileName: finalFilename,
        originalFilename: file.originalname,
        fileUrl: `/api/uploads/${finalFilename}`,
        fileSize: file.size,
        duration: Math.round(durationNum * 10) / 10,
        mimeType: file.mimetype,
        submittedAt: new Date().toISOString(),
        storageDestination: storageLocation,
        driveFileId: driveUploadResult?.id,
        driveWebViewLink:
          driveUploadResult?.webViewLink ||
          (driveUploadResult?.id ? `https://drive.google.com/file/d/${driveUploadResult.id}/view` : undefined),
        driveStatus,
        driveError,
      };

      const submissions = readSubmissions();
      submissions.unshift(newSubmission);
      writeSubmissions(submissions);

      return res.status(201).json({
        success: true,
        message:
          driveStatus === 'uploaded'
            ? 'Audio sample uploaded directly to Google Drive sheild_dataset folder!'
            : 'Audio sample uploaded to server (Sign in with Google to sync with Drive).',
        submission: newSubmission,
      });
    } catch (err: any) {
      console.error('Upload processing error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process audio upload.' });
    }
  });
});

// Download full codebase archive
app.get('/api/download-codebase', (req: Request, res: Response) => {
  const zipPath = path.resolve(process.cwd(), 'public', 'voice-collector-app.zip');
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'Codebase archive not found.' });
  }
  return res.download(zipPath, 'voice-collector-full-codebase.zip');
});

// Serve uploaded audio files
app.get('/api/uploads/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

  // Determine mime type
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.webm': 'audio/webm',
    '.mp4': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };

  res.setHeader('Content-Type', mimeMap[ext] || 'audio/webm');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Accept-Ranges', 'bytes');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// List all submissions (for admin view and review)
app.get('/api/submissions', (_req: Request, res: Response) => {
  const submissions = readSubmissions();
  res.json({ submissions });
});

// Delete a submission
app.delete('/api/submissions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const submissions = readSubmissions();
  const index = submissions.findIndex((s) => s.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  const [removed] = submissions.splice(index, 1);
  writeSubmissions(submissions);

  // Try to remove file
  if (removed && removed.fileName) {
    const filePath = path.join(UPLOADS_DIR, removed.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }

  res.json({ success: true, message: 'Submission deleted' });
});

// Google Drive / Cloud Storage sync info
app.get('/api/drive/status', (_req: Request, res: Response) => {
  const submissions = readSubmissions();
  const syncedCount = submissions.filter((s) => s.driveStatus === 'uploaded' || s.driveFileId).length;

  res.json({
    googleDriveConfigured: true,
    googleDriveFolderId: GOOGLE_DRIVE_FOLDER_ID,
    googleDriveFolderName: GOOGLE_DRIVE_FOLDER_NAME,
    googleDriveFolderUrl: `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`,
    totalSubmissions: submissions.length,
    syncedToDrive: syncedCount,
    pendingDriveSync: submissions.length - syncedCount,
  });
});

// Sync a specific submission to Google Drive
app.post('/api/drive/sync/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!accessToken) {
    return res.status(401).json({
      error: 'Google Drive access token required. Please sign in with Google.',
    });
  }

  const submissions = readSubmissions();
  const subIndex = submissions.findIndex((s) => s.id === id);
  if (subIndex === -1) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const submission = submissions[subIndex];
  const filePath = path.join(UPLOADS_DIR, submission.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Local audio file not found.' });
  }

  try {
    const driveRes = await uploadToGoogleDrive(
      filePath,
      submission.fileName,
      submission.mimeType || 'audio/webm',
      submission.name,
      accessToken
    );

    submission.driveFileId = driveRes.id;
    submission.driveWebViewLink =
      driveRes.webViewLink || `https://drive.google.com/file/d/${driveRes.id}/view`;
    submission.driveStatus = 'uploaded';
    submission.driveError = undefined;
    submission.storageDestination = `Google Drive (${GOOGLE_DRIVE_FOLDER_NAME})`;

    submissions[subIndex] = submission;
    writeSubmissions(submissions);

    return res.json({
      success: true,
      message: 'Successfully uploaded audio sample to Google Drive sheild_dataset folder!',
      submission,
    });
  } catch (error: any) {
    console.error('Google Drive sync error:', error);
    submission.driveStatus = 'failed';
    submission.driveError = error.message || 'Upload failed';
    submissions[subIndex] = submission;
    writeSubmissions(submissions);
    return res.status(500).json({ error: error.message || 'Google Drive sync failed.' });
  }
});

// Sync all pending submissions to Google Drive
app.post('/api/drive/sync-all', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!accessToken) {
    return res.status(401).json({
      error: 'Google Drive access token required. Please sign in with Google.',
    });
  }

  const submissions = readSubmissions();
  let syncedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    if (sub.driveStatus === 'uploaded' && sub.driveFileId) {
      // Propagate any updated naming to Google Drive
      await updateGoogleDriveFileName(sub.driveFileId, sub.fileName, accessToken);
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, sub.fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const driveRes = await uploadToGoogleDrive(
        filePath,
        sub.fileName,
        sub.mimeType || 'audio/webm',
        sub.name,
        accessToken
      );
      sub.driveFileId = driveRes.id;
      sub.driveWebViewLink =
        driveRes.webViewLink || `https://drive.google.com/file/d/${driveRes.id}/view`;
      sub.driveStatus = 'uploaded';
      sub.driveError = undefined;
      sub.storageDestination = `Google Drive (${GOOGLE_DRIVE_FOLDER_NAME})`;
      syncedCount++;
    } catch (err: any) {
      console.error(`Failed to sync submission ${sub.id}:`, err);
      sub.driveStatus = 'failed';
      sub.driveError = err.message || 'Sync failed';
      errorCount++;
    }
  }

  writeSubmissions(submissions);
  return res.json({
    success: true,
    message: `Sync complete: ${syncedCount} uploaded to Google Drive, ${errorCount} errors.`,
    syncedCount,
    errorCount,
    submissions,
  });
});

// List files currently present in the Google Drive folder
app.get('/api/drive/files', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!accessToken) {
    return res.status(401).json({
      error: 'Google Drive access token required. Please sign in with Google.',
    });
  }

  try {
    const query = encodeURIComponent(`'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,size,createdTime,webViewLink)');
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=createdTime desc`;

    const gResponse = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!gResponse.ok) {
      const errText = await gResponse.text();
      return res.status(gResponse.status).json({
        error: `Google Drive API error (${gResponse.status}): ${errText}`,
      });
    }

    const data = await gResponse.json();
    return res.json({
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      folderName: GOOGLE_DRIVE_FOLDER_NAME,
      folderUrl: `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`,
      files: data.files || [],
    });
  } catch (error: any) {
    console.error('Error fetching Google Drive files:', error);
    return res.status(500).json({ error: error.message || 'Failed to list Google Drive files.' });
  }
});

// Explicit 404 handler for unknown /api routes so they return JSON, NEVER Vite HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Explicit error handler for all /api routes so they ALWAYS return clean JSON errors
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred during request processing.',
  });
});

// Vite Middleware for Development / Static Serve for Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Voice Sample Collector server running on port ${PORT}`);
  });
}

startServer();
