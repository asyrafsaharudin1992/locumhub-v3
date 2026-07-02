// Reads the shared "Dokumen Locum" Google Drive folder and matches files to
// doctors by name, so existing APC/MMC/Indemnity uploads can be viewed
// without needing a new upload pipeline. Requires a Drive API key (read-only,
// safe to expose client-side when restricted by HTTP referrer in Google
// Cloud Console) — NOT a service account, since this is read-only access to
// an already-public folder.

export interface DriveFile {
  id: string;
  name: string;
}

const DOCS_FOLDER_ID = "11Uz5gfuzV-X5m83MsjKx90yfX8Cv_xR-";

// Set this to your Drive API key (see setup instructions).
const DRIVE_API_KEY = "AIzaSyDq-PngkEtgEl5lY6lopExjz_Wao_DpPfM";

let cachedFiles: DriveFile[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchDriveFolderFiles(): Promise<DriveFile[]> {
  if (!DRIVE_API_KEY) {
    console.warn("Drive API key not configured — cannot list folder files.");
    return [];
  }
  const now = Date.now();
  if (cachedFiles && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFiles;
  }
  try {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined = undefined;
    const q = encodeURIComponent(`'${DOCS_FOLDER_ID}' in parents and trashed = false`);

    // Drive API caps each request at 1000 results — loop through nextPageToken
    // to make sure ALL files are captured, not just the first batch. Folders
    // that have accumulated years of documents can easily exceed 1000 files,
    // and whichever files land beyond that cutoff would otherwise never match.
    do {
      const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000&key=${DRIVE_API_KEY}${pageParam}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Drive folder listing failed:", res.status, await res.text().catch(() => ""));
        break;
      }
      const data = await res.json();
      allFiles.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    cachedFiles = allFiles;
    cacheTimestamp = now;
    console.info(`Drive folder listing: fetched ${allFiles.length} file(s) total.`);
    return allFiles;
  } catch (err) {
    console.error("fetchDriveFolderFiles error:", err);
    return [];
  }
}

function normalizeNamePart(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Finds the best-matching file in the folder for a given doctor + document
 * kind, by checking whether any part of the doctor's name appears in the
 * filename alongside the expected type keyword (e.g. "RAHMAN_ABDULLAH_APC2026").
 * Returns a viewable Drive link, or null if nothing matches.
 */
export function findDoctorFile(
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

  // Prefer the match with the most name-part overlaps (most specific match)
  const scored = matches.map((f) => {
    const fNameNorm = normalizeNamePart(f.name);
    const score = nameParts.filter((part) => fNameNorm.includes(part)).length;
    return { file: f, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return `https://drive.google.com/file/d/${scored[0].file.id}/view`;
}
