import { google } from "googleapis";
import { Readable } from "stream";

// Vercel serverless function (Node.js runtime). Uploads doctor credential
// files (APC certificates, indemnity policies) to a shared Google Drive
// folder using a service account — no per-doctor Google login required.
//
// Required environment variables (set in Vercel → Project → Settings →
// Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   — the service account's client_email
//   GOOGLE_SERVICE_ACCOUNT_KEY     — the service account's private_key
//                                    (paste with literal \n line breaks kept as \n)
//   GOOGLE_DRIVE_FOLDER_ID         — the target Drive folder's ID
//                                    (the long ID in the folder's URL)

interface UploadRequestBody {
  fileBase64: string;
  fileName: string;
  mimeType?: string;
  phone?: string;
  kind?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { fileBase64, fileName, mimeType, phone, kind } =
      req.body as UploadRequestBody;

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

    const safePhone = (phone || "unknown").replace(/[^0-9]/g, "") || "unknown";
    const safeKind = (kind || "file").replace(/[^a-zA-Z0-9_-]/g, "");
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

    // Make the file viewable by anyone with the link, so doctors/admins can
    // open it later without needing access to the service account's Drive.
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
}
