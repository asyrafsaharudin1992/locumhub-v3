import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { Readable } from "stream";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON requests — raised limit to accommodate
  // base64-encoded PDF/image uploads (APC certs, indemnity policies)
  app.use(express.json({ limit: "10mb" }));

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Upload doctor credential documents to the shared Google Drive
  // folder, using a service account so no per-doctor Google login is needed.
  // Required env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY,
  // GOOGLE_DRIVE_FOLDER_ID (see setup_google_drive_uploads.txt).
  app.post("/api/upload-to-drive", async (req, res) => {
    try {
      const { fileBase64, fileName, mimeType, phone, kind } = req.body || {};

      if (!fileBase64 || !fileName) {
        res.status(400).json({ error: "Missing fileBase64 or fileName" });
        return;
      }

      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const serviceAccountKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(
        /\\n/g,
        "\n",
      );
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!serviceAccountEmail || !serviceAccountKey || !folderId) {
        res.status(500).json({
          error:
            "Server is missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_DRIVE_FOLDER_ID environment variables.",
        });
        return;
      }

      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: serviceAccountKey,
        scopes: ["https://www.googleapis.com/auth/drive"],
      });

      const drive = google.drive({ version: "v3", auth });

      const buffer = Buffer.from(fileBase64, "base64");
      const stream = Readable.from(buffer);

      const safePhone = String(phone || "unknown").replace(/[^0-9]/g, "") || "unknown";
      const safeKind = String(kind || "file").replace(/[^a-zA-Z0-9_-]/g, "");
      const uploadName = `${safePhone}_${safeKind}_${Date.now()}_${fileName}`;

      const createRes = await drive.files.create({
        requestBody: {
          name: uploadName,
          parents: [folderId],
        },
        media: {
          mimeType: mimeType || "application/octet-stream",
          body: stream,
        },
        fields: "id",
      });

      const fileId = createRes.data.id;
      if (!fileId) {
        throw new Error("Upload succeeded but Drive returned no file ID.");
      }

      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });

      const fileMeta = await drive.files.get({
        fileId,
        fields: "webViewLink",
      });

      res.status(200).json({ url: fileMeta.data.webViewLink });
    } catch (err: any) {
      console.error("upload-to-drive error:", err);
      res.status(500).json({ error: err?.message || "Upload failed" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
