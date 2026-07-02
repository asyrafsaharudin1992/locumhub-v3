// Vercel serverless function. Looks up a doctor's APC/MMC/Indemnity files in
// the shared Drive folder SERVER-SIDE, and returns only that doctor's
// matched URLs — the full file listing (everyone else's filenames/links)
// never gets sent to the browser. The Drive API key also stays server-side
// only (set as GOOGLE_DRIVE_API_KEY in Vercel env vars), never shipped in
// client JS.

interface DriveFile {
  id: string;
  name: string;
}

const DOCS_FOLDER_ID = "11Uz5gfuzV-X5m83MsjKx90yfX8Cv_xR-";

function normalizeNamePart(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function findDoctorFile(
  files: DriveFile[],
  doctorName: string,
  kind: "apc" | "indemnity" | "mmc",
): string | null {
  const typeKeywords: Record<string, string[]> = {
    apc: ["apc"],
    indemnity: ["indemnity"],
    mmc: ["mmc"],
  };
  const keywords = typeKeywords[kind];

  const nameParts = (doctorName || "")
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map(normalizeNamePart)
    .filter((p) => p.length > 1);

  if (nameParts.length === 0) return null;

  const matches = files.filter((f) => {
    const fNameNorm = normalizeNamePart(f.name);
    const hasType = keywords.some((k) => fNameNorm.includes(k));
    if (!hasType) return false;
    return nameParts.some((part) => fNameNorm.includes(part));
  });

  if (matches.length === 0) return null;

  const scored = matches.map((f) => {
    const fNameNorm = normalizeNamePart(f.name);
    const score = nameParts.filter((part) => fNameNorm.includes(part)).length;
    return { file: f, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return `https://drive.google.com/file/d/${scored[0].file.id}/view`;
}

async function fetchAllFolderFiles(apiKey: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined = undefined;
  const q = encodeURIComponent(`'${DOCS_FOLDER_ID}' in parents and trashed = false`);

  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000&key=${apiKey}${pageParam}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const doctorName =
      req.method === "GET" ? req.query?.doctorName : req.body?.doctorName;

    if (!doctorName || typeof doctorName !== "string") {
      res.status(400).json({ error: "Missing doctorName" });
      return;
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: "Server is missing GOOGLE_DRIVE_API_KEY environment variable.",
      });
      return;
    }

    const allFiles = await fetchAllFolderFiles(apiKey);

    // Only the matched URLs for THIS doctor ever leave the server.
    res.status(200).json({
      apc: findDoctorFile(allFiles, doctorName, "apc"),
      mmc: findDoctorFile(allFiles, doctorName, "mmc"),
      indemnity: findDoctorFile(allFiles, doctorName, "indemnity"),
    });
  } catch (err: any) {
    console.error("get-doctor-documents error:", err);
    res.status(500).json({ error: err?.message || "Lookup failed" });
  }
}
