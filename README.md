# Voice Dataset Collector ("sheild activate")

A full-stack web application designed for collecting, validating, and managing voice recording datasets. Respondents record audio samples saying **"sheild activate"** (with 1-second cadence and 0.5-second pauses), validated with real-time waveform visualization, and saved according to strict filename conventions. Collected samples can be stored locally on the server or synced directly into a Google Drive folder (`sheild_dataset`).

---

## 🚀 Quick Start on Your Server

### 1. Prerequisites
- **Node.js**: Version 18.x or 20.x+
- **npm** or **bun** / **yarn**
- Modern web browser with microphone access (HTTPS required in production for Web Audio API / `getUserMedia`)

---

### 2. Installation

Clone or extract the repository onto your server:

```bash
# Navigate to application directory
cd voice-dataset-collector

# Install dependencies
npm install
```

---

### 3. Running in Development Mode

To start the Vite development server with Express backend hot-reloading:

```bash
npm run dev
```

The application will be live at:
```
http://localhost:3000
```

---

### 4. Running in Production Mode

To build and run the production application:

```bash
# 1. Build the frontend client & compile backend bundle
npm run build

# 2. Start the production server
npm start
```

The application starts on `http://0.0.0.0:3000`.

---

### 5. Running in the Background (PM2)

For production deployment on Linux / VPS:

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Build the project
npm run build

# Start with PM2
pm2 start dist/server.cjs --name "voice-collector"

# Enable automatic start on server reboot
pm2 startup
pm2 save
```

---

### 6. Nginx Reverse Proxy Configuration (Recommended)

Because browsers require HTTPS for microphone permissions (`navigator.mediaDevices.getUserMedia`), configure Nginx with SSL (e.g., Let's Encrypt / Certbot):

```nginx
server {
    listen 80;
    server_name voice.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name voice.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/voice.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voice.yourdomain.com/privkey.pem;

    # Allow audio uploads up to 50MB
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📁 Storage & Filename Convention

### Audio Storage
- Recordings are uploaded to the `./uploads/` directory on the server.
- Metadata is tracked in `./data/submissions.json`.
- When an admin syncs recordings to Google Drive, the files are uploaded to the user's `sheild_dataset` folder using Google Drive API v3.

### Filename Format
Audio files strictly follow the naming standard:
```
[YYYY-MM-DD_HH-mm-ss]_responder_[respondent_name]_voice_sample_[unique_id].[webm/wav]
```

Example:
`2026-09-09_18-18-10_responder_dgfg_voice_sample_4t0wg.webm`

---

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Port (default: 3000)
PORT=3000

# Google OAuth Client ID (optional for standalone local mode)
# If using Google Drive sync, provide your Google OAuth 2.0 Web Client ID:
VITE_GOOGLE_CLIENT_ID=
```

---

## 🔒 Standalone Local Mode vs. Google Drive Sync

- **Standalone Mode (No setup required)**: Respondents can submit recordings directly. Recordings are securely stored in the `./uploads/` directory and can be previewed or downloaded directly from the Admin Submissions Log.
- **Google Drive Sync (Optional)**: Click "Admin Google Drive Sync" in the Submissions Log to authenticate with Google and batch upload all files into your `sheild_dataset` Google Drive folder.
