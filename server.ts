import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Admin credentials from env
const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sheild2024';

// In-memory session store: token -> { adminId, createdAt }
const sessionStore = new Map<string, { adminId: string; createdAt: number }>();
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const rawName = (req.body.name || 'Anonymous').toString();
    const sanitizedName = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) || 'Respondent';
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

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
    fileSize: 35 * 1024 * 1024,
  },
});

// CORS middleware
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

// --- Auth helpers ---
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

function writeSubmissions(submissions: any[]) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing submissions:', err);
  }
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_EXPIRY_MS) {
      sessionStore.delete(token);
    }
  }
}

// Auth middleware: checks for valid admin session token
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required. Please log in.' });
  }

  const session = sessionStore.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    sessionStore.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  (req as any).adminId = session.adminId;
  next();
}

// --- Auth API Routes ---

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { adminId, password } = req.body;

  if (!adminId || !password) {
    return res.status(400).json({ error: 'Admin ID and password are required.' });
  }

  if (adminId !== ADMIN_ID || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid Admin ID or password.' });
  }

  cleanExpiredSessions();
  const token = generateToken();
  sessionStore.set(token, { adminId, createdAt: Date.now() });

  return res.json({ success: true, token, adminId });
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    sessionStore.delete(token);
  }

  return res.json({ success: true, message: 'Logged out.' });
});

// Check current session
app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const session = sessionStore.get(token);
  if (!session || Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    if (token) sessionStore.delete(token);
    return res.status(401).json({ error: 'Session expired.' });
  }

  return res.json({ success: true, adminId: session.adminId });
});

// --- API Routes ---

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload audio endpoint (public - respondents submit without login)
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
        if (file.path && fs.existsSync(file.path)) {
          fs.unlink(file.path, () => {});
        }
        return res.status(400).json({ error: 'Recording must be at least 5 seconds long.' });
      }

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
        storageLocation: 'Local Server Storage',
      };

      const submissions = readSubmissions();
      submissions.unshift(newSubmission);
      writeSubmissions(submissions);

      return res.status(201).json({
        success: true,
        message: 'Audio sample uploaded successfully.',
        submission: newSubmission,
      });
    } catch (err: any) {
      console.error('Upload processing error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process audio upload.' });
    }
  });
});

// Serve uploaded audio files (public for playback)
app.get('/api/uploads/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }

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

// List all submissions (public - view only)
app.get('/api/submissions', (_req: Request, res: Response) => {
  const submissions = readSubmissions();
  res.json({ submissions });
});

// Download audio file (admin only)
app.get('/api/submissions/:id/download', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const submissions = readSubmissions();
  const submission = submissions.find((s) => s.id === id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const filePath = path.join(UPLOADS_DIR, submission.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found on server.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${submission.fileName}"`);
  res.setHeader('Content-Type', submission.mimeType || 'audio/webm');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Delete a submission (admin only)
app.delete('/api/submissions/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const submissions = readSubmissions();
  const index = submissions.findIndex((s) => s.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  const [removed] = submissions.splice(index, 1);
  writeSubmissions(submissions);

  if (removed && removed.fileName) {
    const filePath = path.join(UPLOADS_DIR, removed.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }

  res.json({ success: true, message: 'Submission deleted' });
});

// Explicit 404 handler for unknown /api routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Explicit error handler for all /api routes
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred.',
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
