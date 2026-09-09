import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

// --- Config ---
const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sheild2024";
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// --- Blobs stores ---
const submissionsStore = getStore({ name: "submissions" });
const uploadsStore = getStore({ name: "uploads" });
const sessionsStore = getStore({ name: "sessions" });

// --- Helpers ---
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResp(statusCode: number, body: any, extraHeaders?: Record<string, string>) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}

async function getSubmissions(): Promise<any[]> {
  try {
    const data = await submissionsStore.get("list", { type: "json" });
    return (data as any[]) || [];
  } catch {
    return [];
  }
}

async function saveSubmissions(submissions: any[]) {
  await submissionsStore.set("list", JSON.stringify(submissions));
}

async function getSession(token: string): Promise<any> {
  try {
    const session = await sessionsStore.get(`sess:${token}`, { type: "json" }) as any;
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
      await sessionsStore.delete(`sess:${token}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function parseBody(event: HandlerEvent): any {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// --- Route handlers ---

async function handleLogin(event: HandlerEvent) {
  const { adminId, password } = parseBody(event);
  if (!adminId || !password) return jsonResp(400, { error: "Admin ID and password are required." });
  if (adminId !== ADMIN_ID || password !== ADMIN_PASSWORD)
    return jsonResp(401, { error: "Invalid Admin ID or password." });

  const token = generateToken();
  await sessionsStore.set(`sess:${token}`, JSON.stringify({ adminId, createdAt: Date.now() }));
  return jsonResp(200, { success: true, token, adminId }, corsHeaders(event.headers?.origin));
}

async function handleLogout(event: HandlerEvent) {
  const auth = event.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (token) {
    try { await sessionsStore.delete(`sess:${token}`); } catch {}
  }
  return jsonResp(200, { success: true, message: "Logged out." }, corsHeaders(event.headers?.origin));
}

async function handleMe(event: HandlerEvent) {
  const auth = event.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return jsonResp(401, { error: "Not authenticated." });
  const session = await getSession(token);
  if (!session) return jsonResp(401, { error: "Session expired." });
  return jsonResp(200, { success: true, adminId: session.adminId }, corsHeaders(event.headers?.origin));
}

async function requireAdminAuth(event: HandlerEvent): Promise<string | null> {
  const auth = event.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  const session = await getSession(token);
  return session?.adminId || null;
}

async function handleUpload(event: HandlerEvent) {
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (!contentType.includes("multipart/form-data"))
    return jsonResp(400, { error: "Expected multipart/form-data" });

  // Decode body
  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : Buffer.from(event.body || "");

  // Parse multipart manually using boundary
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) return jsonResp(400, { error: "Missing boundary in content-type" });

  const boundary = boundaryMatch[1];
  const parts = splitMultipart(bodyBuffer, boundary);

  const fields: Record<string, string> = {};
  let fileData: Buffer | null = null;
  let fileName = "";
  let fileMimeType = "audio/webm";

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerStr = part.subarray(0, headerEnd).toString("utf-8");
    const content = part.subarray(headerEnd + 4);
    // Remove trailing \r\n
    const trimmed = content[content.length - 2] === 0x0d && content[content.length - 1] === 0x0a
      ? content.subarray(0, content.length - 2)
      : content;

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (filenameMatch && nameMatch) {
      fileName = filenameMatch[1];
      fileMimeType = contentTypeMatch?.[1]?.trim() || "audio/webm";
      fileData = trimmed;
    } else if (nameMatch) {
      fields[nameMatch[1]] = trimmed.toString("utf-8");
    }
  }

  if (!fileData) return jsonResp(400, { error: "Audio file is required." });
  const name = fields.name;
  if (!name || !name.trim()) return jsonResp(400, { error: "Respondent name is required." });
  const durationNum = parseFloat(fields.duration);
  if (isNaN(durationNum) || durationNum < 5)
    return jsonResp(400, { error: "Recording must be at least 5 seconds long." });

  // Generate filename
  const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30) || "Respondent";
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  let ext = ".webm";
  if (fileMimeType.includes("mp4")) ext = ".mp4";
  else if (fileMimeType.includes("ogg")) ext = ".ogg";
  else if (fileMimeType.includes("mp3") || fileMimeType.includes("mpeg")) ext = ".mp3";
  else if (fileMimeType.includes("wav")) ext = ".wav";
  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const finalFilename = `${ts}_responder_${sanitizedName}_voice_sample_${uniqueSuffix}${ext}`;

  const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Store file in Blobs
  await uploadsStore.set(finalFilename, fileData);

  const newSubmission = {
    id,
    name: name.trim(),
    email: (fields.email || "").trim(),
    fileName: finalFilename,
    originalFilename: fileName,
    fileUrl: `/api/uploads/${finalFilename}`,
    fileSize: fileData.length,
    duration: Math.round(durationNum * 10) / 10,
    mimeType: fileMimeType,
    submittedAt: new Date().toISOString(),
    storageLocation: "Netlify Blobs",
  };

  const submissions = await getSubmissions();
  submissions.unshift(newSubmission);
  await saveSubmissions(submissions);

  return jsonResp(201, {
    success: true,
    message: "Audio sample uploaded successfully.",
    submission: newSubmission,
  }, corsHeaders(event.headers?.origin));
}

function splitMultipart(buffer: Buffer, boundary: string): Buffer[] {
  const parts: Buffer[] = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(delimiter);
  if (start === -1) return parts;
  start += delimiter.length;

  while (true) {
    let end = buffer.indexOf(delimiter, start);
    if (end === -1) break;
    // Skip \r\n before the boundary
    const partData = buffer.subarray(start, end - 2); // -2 for \r\n
    if (partData.length > 0) parts.push(partData);
    start = end + delimiter.length;
  }
  return parts;
}

async function handleServeFile(event: HandlerEvent) {
  // Extract filename from path: /api/uploads/:filename
  const pathParts = event.path.split("/");
  const filename = pathParts[pathParts.length - 1];
  if (!filename) return jsonResp(404, { error: "File not found." });

  try {
    const fileData = await uploadsStore.get(filename, { type: "arrayBuffer" });
    if (!fileData) return jsonResp(404, { error: "File not found." });

    const ext = filename.split(".").pop()?.toLowerCase() || "webm";
    const mimeMap: Record<string, string> = {
      webm: "audio/webm", mp4: "audio/mp4", ogg: "audio/ogg",
      mp3: "audio/mpeg", wav: "audio/wav",
    };
    const contentType = mimeMap[ext] || "audio/webm";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Accept-Ranges": "bytes",
      },
      body: Buffer.from(fileData).toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return jsonResp(404, { error: "File not found." });
  }
}

async function handleListSubmissions() {
  const submissions = await getSubmissions();
  return jsonResp(200, { submissions });
}

async function handleDownload(event: HandlerEvent) {
  const adminId = await requireAdminAuth(event);
  if (!adminId) return jsonResp(401, { error: "Admin authentication required." });

  const pathParts = event.path.split("/");
  // /api/submissions/:id/download
  const id = pathParts[3];
  if (!id) return jsonResp(400, { error: "Missing submission ID." });

  const submissions = await getSubmissions();
  const submission = submissions.find((s: any) => s.id === id);
  if (!submission) return jsonResp(404, { error: "Submission not found." });

  try {
    const fileData = await uploadsStore.get(submission.fileName, { type: "arrayBuffer" });
    if (!fileData) return jsonResp(404, { error: "Audio file not found." });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": submission.mimeType || "audio/webm",
        "Content-Disposition": `attachment; filename="${submission.fileName}"`,
      },
      body: Buffer.from(fileData).toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return jsonResp(404, { error: "Audio file not found." });
  }
}

async function handleDelete(event: HandlerEvent) {
  const adminId = await requireAdminAuth(event);
  if (!adminId) return jsonResp(401, { error: "Admin authentication required." });

  const pathParts = event.path.split("/");
  const id = pathParts[3];
  if (!id) return jsonResp(400, { error: "Missing submission ID." });

  const submissions = await getSubmissions();
  const index = submissions.findIndex((s: any) => s.id === id);
  if (index === -1) return jsonResp(404, { error: "Submission not found." });

  const [removed] = submissions.splice(index, 1);
  await saveSubmissions(submissions);

  if (removed?.fileName) {
    try { await uploadsStore.delete(removed.fileName); } catch {}
  }

  return jsonResp(200, { success: true, message: "Submission deleted" }, corsHeaders(event.headers?.origin));
}

// --- Main handler ---
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event.headers?.origin) };
  }

  const method = event.httpMethod;
  // event.path comes in as /.netlify/functions/api/...
  // Strip the function prefix to get the /api/... path
  const apiPath = event.path.replace(/^\/\.netlify\/functions\/api/, "") || "/";

  try {
    // Auth routes
    if (method === "POST" && apiPath === "/auth/login") return handleLogin(event);
    if (method === "POST" && apiPath === "/auth/logout") return handleLogout(event);
    if (method === "GET" && apiPath === "/auth/me") return handleMe(event);

    // Upload
    if (method === "POST" && apiPath === "/upload") return handleUpload(event);

    // Serve uploaded files
    if (method === "GET" && apiPath.startsWith("/uploads/")) return handleServeFile(event);

    // List submissions
    if (method === "GET" && apiPath === "/submissions") return handleListSubmissions();

    // Download (admin only): /submissions/:id/download
    if (method === "GET" && /^\/submissions\/[^/]+\/download$/.test(apiPath))
      return handleDownload(event);

    // Delete (admin only): /submissions/:id
    if (method === "DELETE" && /^\/submissions\/[^/]+$/.test(apiPath))
      return handleDelete(event);

    return jsonResp(404, { error: `Route not found: ${method} ${apiPath}` });
  } catch (err: any) {
    console.error("Function error:", err);
    return jsonResp(500, { error: err.message || "Internal server error" });
  }
};
