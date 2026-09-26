// Client-side helper for fetching a doctor's own APC/MMC/Indemnity document
// links. The actual Drive API key and full folder listing stay server-side
// (see api/get-doctor-documents.ts) — this only ever receives the specific
// doctor's own matched URLs, never anyone else's filenames or links.

export interface DoctorDocumentLinks {
  apc: string | null;
  mmc: string | null;
  indemnity: string | null;
}

const cache = new Map<string, { data: DoctorDocumentLinks; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchDoctorDocumentLinks(
  doctorName: string,
  forceRefresh = false,
): Promise<DoctorDocumentLinks> {
  const empty: DoctorDocumentLinks = { apc: null, mmc: null, indemnity: null };
  if (!doctorName) return empty;

  const cached = cache.get(doctorName);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `/api/get-doctor-documents?doctorName=${encodeURIComponent(doctorName)}`,
    );
    if (!res.ok) {
      console.warn("fetchDoctorDocumentLinks failed:", res.status);
      return empty;
    }
    const data = await res.json();
    const result: DoctorDocumentLinks = {
      apc: data.apc || null,
      mmc: data.mmc || null,
      indemnity: data.indemnity || null,
    };
    // Do not retain a transient API/network failure as a five-minute
    // "no document" result. Successful responses may still be cached.
    if (result.apc || result.mmc || result.indemnity) {
      cache.set(doctorName, { data: result, timestamp: Date.now() });
    } else {
      cache.delete(doctorName);
    }
    return result;
  } catch (err) {
    console.error("fetchDoctorDocumentLinks error:", err);
    return empty;
  }
}
