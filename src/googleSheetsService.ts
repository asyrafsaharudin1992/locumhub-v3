import { LocumSlot, UserProfile, Announcement, FeedbackRecord, NewApplication, LocumSurveyEntry, StaffFeedbackEntry } from './types';

// Let's define the Google Sheets Headers matching Apps Script indices exactly
export const SLOTS_HEADERS = [
  "id", "tarikh", "masa", "cawangan", "status", "dr", "unused", "phone", "gaji", "sales", "pesakit", "bookedAt"
];

export const USERS_HEADERS = [
  "Phone", "Password", "Nama", "Role", "Email", "MMC", "APC 2026", "indemnity", "workplace", "unused", "points", "badges", "locks"
];

export const ANNOUNCEMENTS_HEADERS = [
  "id", "text", "date"
];

export const FEEDBACK_HEADERS = [
  "tarikh", "nama", "reviewer", "target", "rating", "komen", "type"
];

export const APPLICATIONS_HEADERS = [
  "timestamp", "nama", "mmc", "apc", "ins", "cvUrl", "skills", "phone"
];

/**
 * List spreadsheet files from user's Google Drive.
 */
export async function listUserSpreadsheets(accessToken: string): Promise<{ id: string; name: string }[]> {
  try {
    const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=50`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Drive API returned error status: ${res.status}`);
    }
    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing spreadsheet files:", error);
    throw error;
  }
}

/**
 * Creates a brand new fully-structured Google Sheet for the Locum Hub system.
 */
export async function createNewLocumSpreadsheet(
  accessToken: string,
  initialData: {
    slots: LocumSlot[];
    users: UserProfile[];
    announcements: Announcement[];
    feedbacksPatient: FeedbackRecord[];
    feedbacksStaff: FeedbackRecord[];
    feedbacksLocum: FeedbackRecord[];
    newApplications: NewApplication[];
  }
): Promise<string> {
  try {
    // 1. Create Spreadsheet with exact individual sheets
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: "ARA CLINIC LOCUM - Roster & DB Sync"
        },
        sheets: [
          { properties: { title: "Slots" } },
          { properties: { title: "Users" } },
          { properties: { title: "Announcements" } },
          { properties: { title: "Feedback" } },
          { properties: { title: "Applications" } }
        ]
      })
    });

    if (!createRes.ok) {
      const errorMsg = await createRes.text();
      throw new Error(`Failed to create spreadsheet: ${errorMsg}`);
    }

    const sheetInfo = await createRes.json();
    const spreadsheetId = sheetInfo.spreadsheetId;

    // 2. Populate the tables with initial rows using a single batch update call
    await saveAllDataToGoogleSheet(accessToken, spreadsheetId, initialData);

    return spreadsheetId;
  } catch (error) {
    console.error("Error creating new lock spreadsheet:", error);
    throw error;
  }
}

/**
 * Save all local states into the Google Sheet in one batch operation.
 */
export async function saveAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  data: {
    slots: LocumSlot[];
    users: UserProfile[];
    announcements: Announcement[];
    feedbacksPatient: FeedbackRecord[];
    feedbacksStaff: FeedbackRecord[];
    feedbacksLocum: FeedbackRecord[];
    newApplications: NewApplication[];
  }
): Promise<boolean> {
  try {
    // Build rows for each table
    const slotsRows = [
      SLOTS_HEADERS,
      ...data.slots.map(s => [
        s.id || "",
        s.tarikh || "",
        s.masa || "",
        s.cawangan || "",
        s.status || "Available",
        s.dr || "",
        "", // unused (Column G)
        s.phone || "",
        String(s.gaji || 0),
        s.sales !== undefined ? String(s.sales) : "",
        s.pesakit !== undefined ? String(s.pesakit) : "",
        s.bookedAt || ""
      ])
    ];

    const usersRows = [
      USERS_HEADERS,
      ...data.users.map(u => [
        u.phone || "",
        u.password || "",
        u.name || "",
        u.role || "Doctor",
        u.email || "",
        u.mmc || "",
        u.apc || "",
        u.indemnity || "",
        u.workplace || "",
        "", // unused (Column J)
        String(u.points || 0),
        u.badges || "",
        u.locks || ""
      ])
    ];

    const annRows = [
      ANNOUNCEMENTS_HEADERS,
      ...data.announcements.map(a => [
        a.id || "",
        a.text || "",
        a.date || ""
      ])
    ];

    // Combine all feedback into a single list
    const combinedFeedback: FeedbackRecord[] = [];
    data.feedbacksPatient.forEach(f => combinedFeedback.push({ ...f, type: "Patient" } as any));
    data.feedbacksStaff.forEach(f => combinedFeedback.push({ ...f, type: "Staff" } as any));
    data.feedbacksLocum.forEach(f => combinedFeedback.push({ ...f, type: "Locum" } as any));

    const feedbackRows = [
      FEEDBACK_HEADERS,
      ...combinedFeedback.map((f: any) => [
        f.tarikh || "",
        f.nama || "",
        f.reviewer || "",
        f.target || "",
        String(f.rating || 0),
        f.komen || "",
        f.type || "Patient"
      ])
    ];

    const appRows = [
      APPLICATIONS_HEADERS,
      ...data.newApplications.map(a => [
        a.timestamp || "",
        a.nama || "",
        a.mmc || "",
        a.apc || "",
        a.ins || "",
        a.cvUrl || "",
        a.skills || "",
        a.phone || ""
      ])
    ];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "Slots!A1:L1000", values: slotsRows },
          { range: "Users!A1:M1000", values: usersRows },
          { range: "Announcements!A1:C500", values: annRows },
          { range: "Feedback!A1:G1000", values: feedbackRows },
          { range: "Applications!A1:H500", values: appRows }
        ]
      })
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      console.error(`batchUpdate failure: ${errorMsg}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error saving to sheet:", err);
    return false;
  }
}

/**
 * Verifies if required tabs exist in the sheet, and creates any missing ones.
 */
export async function setupMissingSheetsInSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<boolean> {
  try {
    // 1. Get current sheets in the spreadsheet
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!metaRes.ok) {
      const text = await metaRes.text();
      console.error("Failed to read spreadsheet metadata:", text);
      return false;
    }
    const metaData = await metaRes.json();
    const existingTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title || "");

    const requiredTabs = ["Slots", "Users", "Announcements", "Feedback", "Applications"];
    const missingTabs = requiredTabs.filter(tab => !existingTitles.includes(tab));

    if (missingTabs.length === 0) {
      return true; // Everything is present
    }

    // 2. Add missing sheets
    const requests = missingTabs.map(tab => ({
      addSheet: { properties: { title: tab } }
    }));

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests })
    });

    if (!updateRes.ok) {
      const errorMsg = await updateRes.text();
      console.error("Failed to create missing sheet tabs:", errorMsg);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error setting up missing tabs in spreadsheet:", error);
    return false;
  }
}

/**
 * Fetch all sheets values from the spreadsheet and parse them back to type records.
 */
export async function loadAllDataFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  slots: LocumSlot[];
  users: UserProfile[];
  announcements: Announcement[];
  feedbacksPatient: FeedbackRecord[];
  feedbacksStaff: FeedbackRecord[];
  feedbacksLocum: FeedbackRecord[];
  newApplications: NewApplication[];
} | null> {
  try {
    const ranges = [
      "Slots!A1:L1000",
      "Users!A1:M1000",
      "Announcements!A1:C500",
      "Feedback!A1:G1000",
      "Applications!A1:H500"
    ];
    
    const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeParams}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      throw new Error(`Failed to load values from Google Sheet: ${res.status}`);
    }

    const batchData = await res.json();
    const valueRanges = batchData.valueRanges || [];

    const slotsData = valueRanges.find((vr: any) => vr.range && vr.range.toLowerCase().includes("slots"));
    const usersData = valueRanges.find((vr: any) => vr.range && vr.range.toLowerCase().includes("users"));
    const annData = valueRanges.find((vr: any) => vr.range && vr.range.toLowerCase().includes("announcements"));
    const fbData = valueRanges.find((vr: any) => vr.range && vr.range.toLowerCase().includes("feedback"));
    const appData = valueRanges.find((vr: any) => vr.range && vr.range.toLowerCase().includes("applications"));

    const slots = parseSlots(slotsData?.values || []);
    const users = parseUsers(usersData?.values || []);
    const announcements = parseAnnouncements(annData?.values || []);
    const { feedbacksPatient, feedbacksStaff, feedbacksLocum } = parseFeedback(fbData?.values || []);
    const newApplications = parseApplications(appData?.values || []);

    return {
      slots,
      users,
      announcements,
      feedbacksPatient,
      feedbacksStaff,
      feedbacksLocum,
      newApplications
    };

  } catch (error) {
    console.error("Error loading data from Google Sheets:", error);
    return null;
  }
}

// Helpers to parse arrays into strict Types

export function normalizeSheetDate(val: any): string {
  if (val === undefined || val === null) return "";
  const valStr = String(val).trim();
  if (valStr.startsWith("Date(")) {
    const match = valStr.match(/Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)[^)]*\)/);
    if (match) {
      const y = match[1];
      const m = String(parseInt(match[2]) + 1).padStart(2, '0');
      const d = String(parseInt(match[3])).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }
  
  // Let's normalize any slashes/dashes
  // A date could be e.g. YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY etc.
  // Let's split by either - or / or .
  const parts = valStr.split(/[-/.]/);
  if (parts.length === 3) {
    const p1 = parts[0].trim();
    const p2 = parts[1].trim();
    const p3 = parts[2].trim();
    
    // Check if it's YYYY-MM-DD (4-digit year at start)
    if (p1.length === 4) {
      const y = p1;
      const m = p2.padStart(2, '0');
      const d = p3.padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    // Check if it's DD-MM-YYYY (4-digit year at end)
    if (p3.length === 4) {
      const d = p1.padStart(2, '0');
      const m = p2.padStart(2, '0');
      const y = p3;
      return `${d}/${m}/${y}`;
    }
    // If we have a 2-digit year at end, e.g., DD/MM/YY
    if (p3.length === 2) {
      const d = p1.padStart(2, '0');
      const m = p2.padStart(2, '0');
      const y = "20" + p3; // Assume 21st century
      return `${d}/${m}/${y}`;
    }
    // If we have a 2-digit year at start, e.g., YY/MM/DD
    if (p1.length === 2 && p3.length <= 2) {
      const y = "20" + p1;
      const m = p2.padStart(2, '0');
      const d = p3.padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }
  
  return valStr;
}

function parseSlots(values: any[][]): LocumSlot[] {
  if (!values || values.length === 0) return [];
  
  const firstRow = values[0];
  const hasHeader = firstRow && firstRow[0] && String(firstRow[0]).trim().toLowerCase() === "id";
  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map((row, index) => {
      const parseCellDate = (val: any): string => {
        return normalizeSheetDate(val);
      };

      const rawCawangan = row[3] !== undefined ? String(row[3]).trim() : "";
      let cawangan = rawCawangan;
      if (rawCawangan.toLowerCase().includes("seri kembangan")) {
        cawangan = "Seri Kembangan";
      } else if (rawCawangan.toLowerCase().includes("kajang")) {
        cawangan = "Kajang";
      } else if (rawCawangan.toLowerCase().includes("cme") || rawCawangan.toLowerCase().includes("briefing")) {
        cawangan = "CME / BRIEFING";
      }

      const dr = row[5] !== undefined ? String(row[5]).trim() : "";
      const rawStatus = row[4] !== undefined ? String(row[4]).trim() : "";
      let status = rawStatus;
      if (!status) {
        status = dr ? "Approved" : "Available";
      } else if (status.toLowerCase().includes("approved")) {
        status = "Approved";
      } else if (status.toLowerCase().includes("pending")) {
        status = "Pending";
      } else if (status.toLowerCase().includes("available")) {
        status = "Available";
      }

      return {
        id: row[0] !== undefined ? String(row[0]).trim() : `SLOT-${index}-${Date.now()}`,
        tarikh: parseCellDate(row[1]),
        masa: row[2] !== undefined ? String(row[2]).trim() : "",
        cawangan: cawangan,
        status: status as any,
        dr: dr,
        phone: row[7] !== undefined ? String(row[7]).trim() : "",
        gaji: row[8] !== undefined ? parseFloat(String(row[8]).trim()) || 0 : 0,
        sales: row[9] !== undefined && String(row[9]).trim() !== "" ? parseFloat(String(row[9]).trim()) : undefined,
        pesakit: row[10] !== undefined && String(row[10]).trim() !== "" ? parseInt(String(row[10]).trim()) : undefined,
        bookedAt: row[11] !== undefined ? String(row[11]).trim() : undefined
      };
    });
}

function parseUsers(values: any[][]): UserProfile[] {
  if (!values || values.length === 0) return [];
  
  const firstRow = values[0];
  const hasHeader = firstRow && firstRow[0] && String(firstRow[0]).trim().toLowerCase() === "phone";
  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map(row => {
      return {
        phone: row[0] !== undefined ? String(row[0]).trim() : "",
        password: row[1] !== undefined ? String(row[1]).trim() : "",
        name: row[2] !== undefined ? String(row[2]).trim() : "",
        role: (row[3] !== undefined ? String(row[3]).trim() : "Doctor") as any,
        email: row[4] !== undefined ? String(row[4]).trim() : "",
        mmc: row[5] !== undefined ? String(row[5]).trim() : "",
        apc: row[6] !== undefined ? String(row[6]).trim() : "",
        indemnity: row[7] !== undefined ? String(row[7]).trim() : "Tiada",
        workplace: row[8] !== undefined ? String(row[8]).trim() : "",
        points: row[10] !== undefined ? parseInt(String(row[10]).trim()) || 0 : 0,
        badges: row[11] !== undefined ? String(row[11]).trim() : "",
        locks: row[12] !== undefined ? String(row[12]).trim() : ""
      };
    });
}

function parseAnnouncements(values: any[][]): Announcement[] {
  if (!values || values.length === 0) return [];
  
  const firstRow = values[0];
  const hasHeader = firstRow && firstRow[0] && String(firstRow[0]).trim().toLowerCase() === "id";
  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map(row => {
      return {
        id: row[0] !== undefined ? String(row[0]).trim() : `ann-${Date.now()}`,
        text: row[1] !== undefined ? String(row[1]).trim() : "",
        date: row[2] !== undefined ? normalizeSheetDate(row[2]) : ""
      };
    });
}

function parseFeedback(values: any[][]): {
  feedbacksPatient: FeedbackRecord[];
  feedbacksStaff: FeedbackRecord[];
  feedbacksLocum: FeedbackRecord[];
} {
  const result = {
    feedbacksPatient: [] as FeedbackRecord[],
    feedbacksStaff: [] as FeedbackRecord[],
    feedbacksLocum: [] as FeedbackRecord[]
  };

  if (!values || values.length === 0) return result;
  
  const firstRow = values[0];
  const hasHeader = firstRow && firstRow[0] && String(firstRow[0]).trim().toLowerCase() === "tarikh";
  const dataRows = hasHeader ? values.slice(1) : values;

  dataRows
    .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .forEach(row => {
      const record: FeedbackRecord = {
        tarikh: row[0] !== undefined ? normalizeSheetDate(row[0]) : "",
        nama: row[1] !== undefined ? String(row[1]).trim() : "",
        reviewer: row[2] !== undefined ? String(row[2]).trim() : "",
        target: row[3] !== undefined ? String(row[3]).trim() : "",
        rating: row[4] !== undefined ? parseFloat(String(row[4]).trim()) || 0 : 0,
        komen: row[5] !== undefined ? String(row[5]).trim() : ""
      };

      const type = row[6] !== undefined ? String(row[6]).toLowerCase().trim() : "patient";
      if (type === "patient") {
        result.feedbacksPatient.push(record);
      } else if (type === "staff") {
        result.feedbacksStaff.push(record);
      } else if (type === "locum") {
        result.feedbacksLocum.push(record);
      }
    });

  return result;
}

function parseApplications(values: any[][]): NewApplication[] {
  if (!values || values.length === 0) return [];
  
  const firstRow = values[0];
  const hasHeader = firstRow && firstRow[0] && String(firstRow[0]).trim().toLowerCase() === "timestamp";
  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map(row => {
      return {
        timestamp: row[0] !== undefined ? String(row[0]).trim() : "",
        nama: row[1] !== undefined ? String(row[1]).trim() : "",
        mmc: row[2] !== undefined ? String(row[2]).trim() : "",
        apc: row[3] !== undefined ? String(row[3]).trim() : "",
        ins: row[4] !== undefined ? String(row[4]).trim() : "",
        cvUrl: row[5] !== undefined ? String(row[5]).trim() : "",
        skills: row[6] !== undefined ? String(row[6]).trim() : "",
        phone: row[7] !== undefined ? String(row[7]).trim() : ""
      };
    });
}

/**
 * Loads public Google Sheet data via the gviz endpoint.
 */
export async function loadAllDataFromPublicGoogleSheet(
  spreadsheetId: string
): Promise<{
  slots: LocumSlot[];
  users: UserProfile[];
  announcements: Announcement[];
  feedbacksPatient: FeedbackRecord[];
  feedbacksStaff: FeedbackRecord[];
  feedbacksLocum: FeedbackRecord[];
  newApplications: NewApplication[];
} | null> {
  try {
    const fetchPublicTab = async (sheetName: string): Promise<any[][] | null> => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) return null;
        const json = JSON.parse(match[1]);
        const table = json.table;
        if (!table || !table.rows) return null;
        
        return table.rows.map((r: any) => {
          if (!r || !r.c) return [];
          return r.c.map((cell: any) => {
            if (!cell) return "";
            if (cell.v !== undefined && cell.v !== null) {
              const valStr = String(cell.v);
              if (valStr.startsWith("Date(") && cell.f) {
                return cell.f;
              }
              return cell.v;
            }
            return cell.f !== undefined && cell.f !== null ? cell.f : "";
          });
        });
      } catch (err) {
        console.warn(`Failed to fetch public sheet tab ${sheetName}:`, err);
        return null;
      }
    };

    const slotsRaw = await fetchPublicTab("Slots");
    const usersRaw = await fetchPublicTab("Users");
    const fbRaw = await fetchPublicTab("Feedback");
    const annRaw = await fetchPublicTab("Announcements");
    // Google Forms creates a tab literally named "Form responses 1" by default —
    // fall back to "Applications" for spreadsheets that were manually renamed.
    const appRaw =
      (await fetchPublicTab("Form responses 1")) ||
      (await fetchPublicTab("Applications"));

    const slots = slotsRaw ? parseSlots(slotsRaw) : [];
    const users = usersRaw ? parseUsers(usersRaw) : [];
    const announcements = annRaw ? parseAnnouncements(annRaw) : [];
    const { feedbacksPatient, feedbacksStaff, feedbacksLocum } = fbRaw ? parseFeedback(fbRaw) : { feedbacksPatient: [], feedbacksStaff: [], feedbacksLocum: [] };
    const newApplications = appRaw ? parseApplications(appRaw) : [];

    return {
      slots,
      users,
      announcements,
      feedbacksPatient,
      feedbacksStaff,
      feedbacksLocum,
      newApplications
    };
  } catch (error) {
    console.error("Error loading public sheet:", error);
    return null;
  }
}

/**
 * Generic reusable fetcher for a single tab of ANY public Google Sheet by ID + tab name.
 */
async function fetchPublicSheetTab(spreadsheetId: string, sheetName: string): Promise<any[][] | null> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!match) return null;
    const json = JSON.parse(match[1]);
    const table = json.table;
    if (!table || !table.rows) return null;

    return table.rows.map((r: any) => {
      if (!r || !r.c) return [];
      return r.c.map((cell: any) => {
        if (!cell) return "";
        if (cell.v !== undefined && cell.v !== null) {
          const valStr = String(cell.v);
          if (valStr.startsWith("Date(") && cell.f) return cell.f;
          return cell.v;
        }
        return cell.f !== undefined && cell.f !== null ? cell.f : "";
      });
    });
  } catch (err) {
    console.warn(`Failed to fetch public sheet tab ${sheetName} (${spreadsheetId}):`, err);
    return null;
  }
}

function stripHeaderRow(rows: any[][]): any[][] {
  if (!rows || rows.length === 0) return [];
  const first = rows[0];
  const looksLikeHeader = first && first[0] && String(first[0]).trim().toLowerCase() === "timestamp";
  return looksLikeHeader ? rows.slice(1) : rows;
}

function isBlankRow(row: any[]): boolean {
  return !row || row.length === 0 || !row.some(c => c !== undefined && c !== null && String(c).trim() !== "");
}

// --- 1. DOCTOR -> CLINIC (Locum operational survey; open-ended, no rating) ---
const LOCUM_SURVEY_SHEET_ID = "14tqRzsZWtXL1ciBW_Zas4VKsijrWEaqAZAe-AfFiI3o";

export async function fetchLocumSurveyResponses(): Promise<LocumSurveyEntry[]> {
  const rows = stripHeaderRow((await fetchPublicSheetTab(LOCUM_SURVEY_SHEET_ID, "Form responses 1")) || []);
  return rows
    .filter(r => !isBlankRow(r))
    .map(r => ({
      timestamp: String(r[0] ?? "").trim(),
      duration: String(r[1] ?? "").trim(),
      clinics: String(r[2] ?? "").trim(),
      workflowSmooth: String(r[3] ?? "").trim(),
      workflowElaborate: String(r[4] ?? "").trim(),
      feltSupported: String(r[5] ?? "").trim(),
      staffFeedback: String(r[6] ?? "").trim(),
      safetyConcerns: String(r[7] ?? "").trim(),
      medsSufficient: String(r[8] ?? "").trim(),
      medsFeedback: String(r[9] ?? "").trim(),
      awareOutsourced: String(r[10] ?? "").trim(),
      outsourcedSuggestion: String(r[11] ?? "").trim(),
      appreciate: String(r[12] ?? "").trim(),
      improve: String(r[13] ?? "").trim(),
    }))
    .reverse(); // later rows = newer submissions
}

// --- 2. STAFF -> DOCTOR (categorical, no star rating) ---
const STAFF_FEEDBACK_SHEET_ID = "1xdWVGZE8GGxtG9tHHQdfXp4IXhaaKK-p0cnGL4wKtOs";

export async function fetchStaffFeedbackResponses(): Promise<StaffFeedbackEntry[]> {
  const rows = stripHeaderRow((await fetchPublicSheetTab(STAFF_FEEDBACK_SHEET_ID, "Form responses 1")) || []);
  return rows
    .filter(r => !isBlankRow(r))
    .map(r => ({
      timestamp: String(r[0] ?? "").trim(),
      staffName: String(r[1] ?? "").trim(),
      cawangan: String(r[2] ?? "").trim(),
      doctorName: String(r[3] ?? "").trim(),
      dutyDate: String(r[4] ?? "").trim(),
      category: String(r[5] ?? "").trim(),
      details: String(r[6] ?? "").trim(),
    }))
    .reverse();
}

// --- 3. PATIENTS -> DOCTOR (Form responses 1 = 4-question Likert; MANUAL FEEDBACK = direct /5 rating) ---
const PATIENT_FEEDBACK_SHEET_ID = "1rUKIsFHHWJIq885eRyHtJWSvzahW7lszQLr4e68Fbjw";

// Sangat Setuju / Setuju / Tidak Setuju / Sangat Tidak Setuju -> 5 / 4 / 2 / 1
function likertToScore(raw: string): number | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("sangat tidak setuju")) return 1;
  if (v.includes("tidak setuju")) return 2;
  if (v.includes("sangat setuju")) return 5;
  if (v.includes("setuju")) return 4;
  return null;
}

export async function fetchPatientFeedbackFromSheets(): Promise<FeedbackRecord[]> {
  const [formRows, manualRows] = await Promise.all([
    fetchPublicSheetTab(PATIENT_FEEDBACK_SHEET_ID, "Form responses 1"),
    fetchPublicSheetTab(PATIENT_FEEDBACK_SHEET_ID, "MANUAL FEEDBACK"),
  ]);

  // -- Form responses 1: Timestamp, Nama pesakit, No telefon, Cawangan, Q1-Q4 (Likert), Ulasan lain, ..., Nama doktor (col J / index 9)
  const formEntries: FeedbackRecord[] = stripHeaderRow(formRows || [])
    .filter(r => !isBlankRow(r))
    .map(r => {
      const scores = [likertToScore(r[4]), likertToScore(r[5]), likertToScore(r[6]), likertToScore(r[7])]
        .filter((s): s is number => s !== null);
      const rating = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const doctorName = String(r[9] ?? "").trim(); // Column J
      return {
        tarikh: String(r[0] ?? "").trim(),
        nama: String(r[1] ?? "").trim(),
        reviewer: String(r[1] ?? "").trim(),
        target: doctorName,
        rating,
        komen: String(r[8] ?? "").trim(),
      };
    })
    .reverse();

  // -- MANUAL FEEDBACK: Timestamp, Nama Pesakit, E-mel, Cawangan ARA, Rating 1, Ulasan/Komen, Nama Doktor (col G / index 6)
  const manualEntries: FeedbackRecord[] = stripHeaderRow(manualRows || [])
    .filter(r => !isBlankRow(r))
    .map(r => ({
      tarikh: String(r[0] ?? "").trim(),
      nama: String(r[1] ?? "").trim(),
      reviewer: String(r[1] ?? "").trim(),
      target: String(r[6] ?? "").trim(), // Column G
      rating: Number(r[4]) || 0,
      komen: String(r[5] ?? "").trim(),
    }))
    .reverse();

  return [...manualEntries, ...formEntries];
}
