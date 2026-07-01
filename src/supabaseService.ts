import { getSupabaseClient } from "./supabaseClient";
import {
  UserProfile,
  LocumSlot,
  Announcement,
  FeedbackRecord,
  NewApplication,
  AppNotification,
} from "./types";

// Check if Supabase connection is active
export function isSupabaseActive(): boolean {
  return getSupabaseClient() !== null;
}

// Utility to try a query on multiple table names (e.g. lowercase vs capitalized)
async function queryTableWithFallback(
  tableCandidates: string[],
  selectString: string = "*",
): Promise<{ data: any[] | null; error: any }> {
  const client = getSupabaseClient();
  if (!client)
    return { data: null, error: new Error("Supabase client not initialized") };

  let lastError: any = null;
  for (const table of tableCandidates) {
    try {
      const { data, error } = await client.from(table).select(selectString);
      if (!error) {
        return { data, error: null };
      }
      lastError = error;
    } catch (err) {
      lastError = err;
    }
  }
  return { data: null, error: lastError };
}

// Utility to upsert to a table, trying fallback names
async function upsertTableWithFallback(
  tableCandidates: string[],
  record: any,
  onConflictField: string,
): Promise<{ success: boolean; error: any }> {
  const client = getSupabaseClient();
  if (!client)
    return {
      success: false,
      error: new Error("Supabase client not initialized"),
    };

  let lastError: any = null;
  for (const table of tableCandidates) {
    try {
      // Clean undefined values from record to avoid Supabase parsing issues
      const cleanedRecord = { ...record };
      Object.keys(cleanedRecord).forEach((key) => {
        if (cleanedRecord[key] === undefined) {
          delete cleanedRecord[key];
        }
      });

      const { error } = await client
        .from(table)
        .upsert(cleanedRecord, { onConflict: onConflictField });
      if (!error) {
        return { success: true, error: null };
      }
      lastError = error;
    } catch (err) {
      console.error(
        `Supabase upsertTableWithFallback caught error on table ${table}:`,
        err,
      );
      lastError = err;
    }
  }
  return { success: false, error: lastError };
}

// Utility to delete from a table, trying fallback names
async function deleteTableWithFallback(
  tableCandidates: string[],
  field: string,
  value: string,
): Promise<{ success: boolean; error: any }> {
  const client = getSupabaseClient();
  if (!client)
    return {
      success: false,
      error: new Error("Supabase client not initialized"),
    };

  let lastError: any = null;
  for (const table of tableCandidates) {
    try {
      const { error } = await client.from(table).delete().eq(field, value);
      if (!error) {
        return { success: true, error: null };
      }
      lastError = error;
    } catch (err) {
      lastError = err;
    }
  }
  return { success: false, error: lastError };
}

// FETCH OPERATIONS
export async function fetchUsersFromSupabase(): Promise<UserProfile[] | null> {
  const { data, error } = await queryTableWithFallback(["users", "Users"]);
  if (error) {
    console.warn("Supabase fetchUsers failed:", error);
    return null;
  }
  return (data || []).map((row) => ({
    phone: String(row.phone || row.Phone || "").trim(),
    password: row.password || row.Password || "",
    name: row.name || row.nama || row.Nama || "",
    role: (row.role || row.Role || "Doctor") as any,
    email: row.email || row.Email || "",
    mmc: row.mmc || row.MMC || "",
    apc: row.apc || row.APC || row.apc_2026 || row["APC 2026"] || "",
    indemnity: row.indemnity || row.Indemnity || row.indemnity_insurance || "Tiada",
    workplace: row.workplace || row.Workplace || row.tempat_berkhidmat || "",
    points: Number(row.points || row.Points || 0),
    badges: typeof row.badges === "string" ? row.badges : (Array.isArray(row.badges) ? row.badges.join(", ") : ""),
    locks: typeof row.locks === "string" ? row.locks : (Array.isArray(row.locks) ? row.locks.join(", ") : ""),
  }));
}

export async function fetchSlotsFromSupabase(): Promise<LocumSlot[] | null> {
  const { data, error } = await queryTableWithFallback(["slots", "Slots"]);
  if (error) {
    console.warn("Supabase fetchSlots failed:", error);
    return null;
  }
  return (data || []).map((row) => {
    // Cari nama doktor yang sah dari kolum nama_locum dahulu, jika tiada baru guna fallback row.dr
    const detectedDr = row.nama_locum || row.dr || row.Dr || "";
    const cleanDr = String(detectedDr).trim().toLowerCase();
    const finalDr =
      cleanDr === "approved" || cleanDr === "available" || cleanDr === "pending"
        ? ""
        : detectedDr;

    // Cari status slot, jika kolum status mengandungi nama doktor, pulihkan statusnya
    let finalStatus = row.status || row.Status || "Available";
    if (cleanDr === "approved" || cleanDr === "pending") {
      finalStatus = detectedDr; // fallback jika data bertukar tempat dlm sheet
    }

    return {
      id: String(row.id || row.ID || "").trim(),
      tarikh: row.tarikh || row.Tarikh || "",
      masa: row.masa || row.Masa || "",
      cawangan: row.cawangan || row.Cawangan || "",
      status: finalStatus as any,
      dr: finalDr,
      phone: row.phone || row.Phone || row.no_telefon_locum || "",
      gaji: Number(row.bayaran || row.gaji || row.Gaji || 0), // Menyokong kolum bayaran & gaji sekali gus!
      sales: row.sales !== undefined ? Number(row.sales) : undefined,
      pesakit:
        row.pesakit !== undefined
          ? Number(row.pesakit)
          : row.bilangan_pesakit !== undefined
            ? Number(row.bilangan_pesakit)
            : undefined,
      bookedAt: row.bookedAt || row.BookedAt || row.booked_at || "",
      performanceRecorded:
        !!row.performance_recorded ||
        String(row.performance_recorded) === "true",
    };
  });
}

export async function fetchAnnouncementsFromSupabase(): Promise<
  Announcement[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "announcements",
    "Announcements",
  ]);
  if (error) {
    console.warn("Supabase fetchAnnouncements failed:", error);
    return null;
  }
  return (data || []).map((row) => ({
    id: String(row.id || "").trim(),
    text: row.text || "",
    date: row.date || row.Date || "",
  }));
}

export async function fetchFeedbacksPatientFromSupabase(): Promise<
  FeedbackRecord[] | null
> {
  // Feedbacks are stored either in feedbacks_patient or a single 'feedback' table with type='patient'
  const { data, error } = await queryTableWithFallback([
    "feedbacks_patient",
    "feedbacks",
    "feedback",
    "Feedback",
  ]);
  if (error) return null;
  const filtered = data
    ? data.filter(
        (row) => !row.type || String(row.type).toLowerCase() === "patient",
      )
    : [];
  return filtered.map((row) => ({
    tarikh: row.tarikh || row.Tarikh || "",
    nama: row.nama || row.Nama || "",
    reviewer: row.reviewer || row.Reviewer || "",
    target: row.target || row.Target || "",
    rating: Number(row.rating || row.Rating || 5),
    komen: row.komen || row.Komen || "",
  }));
}

export async function fetchFeedbacksStaffFromSupabase(): Promise<
  FeedbackRecord[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "feedbacks_staff",
    "feedbacks",
    "feedback",
    "Feedback",
  ]);
  if (error) return null;
  const filtered = data
    ? data.filter((row) => String(row.type || "").toLowerCase() === "staff")
    : [];
  return filtered.map((row) => ({
    tarikh: row.tarikh || row.Tarikh || "",
    nama: row.nama || row.Nama || "",
    reviewer: row.reviewer || row.Reviewer || "",
    target: row.target || row.Target || "",
    rating: Number(row.rating || row.Rating || 5),
    komen: row.komen || row.Komen || "",
  }));
}

export async function fetchFeedbacksLocumFromSupabase(): Promise<
  FeedbackRecord[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "feedbacks_locum",
    "feedbacks",
    "feedback",
    "Feedback",
  ]);
  if (error) return null;
  const filtered = data
    ? data.filter((row) => String(row.type || "").toLowerCase() === "locum")
    : [];
  return filtered.map((row) => ({
    tarikh: row.tarikh || row.Tarikh || "",
    nama: row.nama || row.Nama || "",
    reviewer: row.reviewer || row.Reviewer || "",
    target: row.target || row.Target || "",
    rating: Number(row.rating || row.Rating || 5),
    komen: row.komen || row.Komen || "",
  }));
}

export async function fetchApplicationsFromSupabase(): Promise<
  NewApplication[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "applications",
    "Applications",
  ]);
  if (error) {
    console.warn("Supabase fetchApplications failed:", error);
    return null;
  }
  return (data || []).map((row) => ({
    timestamp: row.timestamp || row.Timestamp || "",
    nama: row.nama || row.Nama || "",
    phone: row.phone || row.Phone || "",
    mmc: row.mmc || row.MMC || "",
    apc: row.apc || row.APC || "",
    ins: row.ins || row.Ins || "",
    cvUrl: row.cvUrl || row.CvUrl || "",
    skills: row.skills || row.Skills || "",
  }));
}

export async function fetchActivityLogsFromSupabase(): Promise<
  { timestamp: string; action: string }[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "activity_logs",
    "ActivityLogs",
  ]);
  if (error) return null;
  return (data || []).map((row) => ({
    timestamp: row.timestamp || "",
    action: row.action || "",
  }));
}

export async function fetchNotificationsFromSupabase(): Promise<
  AppNotification[] | null
> {
  const { data, error } = await queryTableWithFallback([
    "notifications",
    "Notifications",
  ]);
  if (error) return null;
  return (data || []).map((row) => ({
    id: row.id || "",
    phone: row.phone || "",
    title: row.title || "",
    message: row.message || "",
    timestamp: row.timestamp || "",
    isRead: row.is_read ?? row.isRead ?? false,
    slotId: row.slot_id || row.slotId || undefined,
  }));
}

// SAVE & WRITE OPERATIONS
export async function saveUserToSupabase(user: UserProfile) {
  const client = getSupabaseClient();
  if (!client) return;

  const trimmedPhone = user.phone.trim();

  // Find existing user row to figure out exact column casing
  for (const tableName of ["users", "Users"]) {
    const { data: existingData, error: queryError } = await client
      .from(tableName)
      .select("*");

    if (!queryError && existingData) {
      // Find row matching phone
      const matchedRow = existingData.find(
        (row) => String(row.phone || row.Phone || "").trim() === trimmedPhone,
      );

      if (matchedRow) {
        // Build update object based on existing keys
        const keys = Object.keys(matchedRow);
        const aliasMap: Record<string, string> = {
          name: "nama",
          apc: "apc_2026",
          indemnity: "indemnity_insurance",
          workplace: "tempat_berkhidmat",
        };
        const getCol = (lowerName: string) => {
          // Check for exact match
          const exact = keys.find((k) => k.toLowerCase() === lowerName);
          if (exact) return exact;
          // Check for alias
          const alias = aliasMap[lowerName];
          if (alias) {
            const aliasMatch = keys.find((k) => k.toLowerCase() === alias);
            if (aliasMatch) return aliasMatch;
          }
          return lowerName;
        };

        // Define all potential fields and their mapping to Supabase column names
        const fieldMapping: Record<string, keyof UserProfile> = {
          [getCol("phone")]: "phone",
          [getCol("password")]: "password",
          [getCol("name")]: "name",
          [getCol("role")]: "role",
          [getCol("email")]: "email",
          [getCol("mmc")]: "mmc",
          [getCol("apc")]: "apc",
          [getCol("indemnity")]: "indemnity",
          [getCol("workplace")]: "workplace",
          [getCol("points")]: "points",
          [getCol("badges")]: "badges",
          [getCol("locks")]: "locks",
        };

        const updateRecord: Record<string, any> = {};
        for (const [colName, profileKey] of Object.entries(fieldMapping)) {
          // Only add to updateRecord if the column actually exists in the DB row and value is defined
          if (keys.includes(colName) && user[profileKey] !== undefined) {
            updateRecord[colName] = user[profileKey];
          }
        }

        const exactPhoneCol = getCol("phone");

        const { error: updateError } = await client
          .from(tableName)
          .update(updateRecord)
          .eq(exactPhoneCol, matchedRow[exactPhoneCol]);

        if (updateError) {
          console.error(
            `Supabase saveUser (update) failed on ${tableName}:`,
            updateError,
          );
          throw updateError;
        }
        return; // Success
      } else if (existingData.length > 0) {
        // Table exists, but no user, let's insert it using the schema of the first row
        const sampleRow = existingData[0];
        const keys = Object.keys(sampleRow);
        const aliasMap: Record<string, string> = {
          name: "nama",
          apc: "apc_2026",
          indemnity: "indemnity_insurance",
          workplace: "tempat_berkhidmat",
        };
        const getCol = (lowerName: string) => {
          // Check for exact match
          const exact = keys.find((k) => k.toLowerCase() === lowerName);
          if (exact) return exact;
          // Check for alias
          const alias = aliasMap[lowerName];
          if (alias) {
            const aliasMatch = keys.find((k) => k.toLowerCase() === alias);
            if (aliasMatch) return aliasMatch;
          }
          return lowerName;
        };

        // Define all potential fields and their mapping to Supabase column names
        const fieldMapping: Record<string, keyof UserProfile> = {
          [getCol("phone")]: "phone",
          [getCol("password")]: "password",
          [getCol("name")]: "name",
          [getCol("role")]: "role",
          [getCol("email")]: "email",
          [getCol("mmc")]: "mmc",
          [getCol("apc")]: "apc",
          [getCol("indemnity")]: "indemnity",
          [getCol("workplace")]: "workplace",
          [getCol("points")]: "points",
          [getCol("badges")]: "badges",
          [getCol("locks")]: "locks",
        };

        const insertRecord: Record<string, any> = {};
        for (const [colName, profileKey] of Object.entries(fieldMapping)) {
          // Only add to insertRecord if the column actually exists in the DB row and value is defined
          if (keys.includes(colName) && user[profileKey] !== undefined) {
            insertRecord[colName] = user[profileKey];
          }
        }

        const { error: insertError } = await client
          .from(tableName)
          .insert(insertRecord);
        if (insertError) {
          console.error(
            `Supabase saveUser (insert) failed on ${tableName}:`,
            insertError,
          );
          throw insertError;
        }
        return; // Success
      }
    }
  }

  // Fallback to old upsert behavior if table is completely empty or queries failed
  const record = {
    phone: user.phone,
    password: user.password || "",
    name: user.name,
    role: user.role,
    email: user.email,
    mmc: user.mmc,
    apc: user.apc,
    indemnity: user.indemnity,
    workplace: user.workplace || "",
    points: user.points,
    badges: user.badges,
    locks: user.locks || "",
  };

  const { success, error } = await upsertTableWithFallback(
    ["users", "Users"],
    record,
    "phone",
  );
  if (!success) {
    console.error("Supabase saveUser fallback failed:", error);
    throw error || new Error("Failed to save user to Supabase");
  }
}

export async function deleteUserFromSupabase(phone: string) {
  const client = getSupabaseClient();
  if (!client) return;

  const trimmedPhone = phone.trim();

  for (const tableName of ["users", "Users"]) {
    const { data, error } = await client.from(tableName).select("*");
    if (!error && data && data.length > 0) {
      const matchedRows = data.filter(
        (row) => String(row.phone || row.Phone || "").trim() === trimmedPhone,
      );

      for (const matchedRow of matchedRows) {
        const phoneCol =
          Object.keys(matchedRow).find((k) => k.toLowerCase() === "phone") ||
          "phone";
        const exactPhone = matchedRow[phoneCol];

        const { error: deleteError } = await client
          .from(tableName)
          .delete()
          .eq(phoneCol, exactPhone);
        if (deleteError) {
          console.error(`Supabase delete error in ${tableName}:`, deleteError);
        }
      }

      if (matchedRows.length > 0) {
        return;
      }
    }
  }
}

export async function saveSlotToSupabase(slot: LocumSlot) {
  const client = getSupabaseClient();
  if (!client) return;

  // Membina rekod yang mengandungi kedua-dua variasi kolum (Supabase vs Sheet) supaya selamat dua-dua arah!
  const record = {
    id: slot.id,
    tarikh: slot.tarikh,
    masa: slot.masa,
    cawangan: slot.cawangan,
    status: slot.status,
    nama_locum: slot.dr,
    no_telefon_locum: slot.phone,
    bayaran: Number(slot.gaji || 0),
    sales: slot.sales !== undefined ? Number(slot.sales) : null,
    bilangan_pesakit: slot.pesakit !== undefined ? Number(slot.pesakit) : null,
    booked_at: slot.bookedAt || null,
    performance_recorded: slot.performanceRecorded || false,
  };

  console.log("Supabase saveSlot record:", record);
  const { success, error } = await upsertTableWithFallback(
    ["slots", "Slots"],
    record,
    "id",
  );
  if (!success) {
    console.error(
      "Supabase saveSlot failed for record:",
      JSON.stringify(record),
      "Error:",
      JSON.stringify(error, null, 2),
    );
    throw error || new Error("Failed to save slot to Supabase");
  }
}

export async function deleteSlotFromSupabase(slotId: string) {
  const { success, error } = await deleteTableWithFallback(
    ["slots", "Slots"],
    "id",
    slotId,
  );
  if (!success) {
    console.error(
      "Supabase deleteSlot failed for ID:",
      slotId,
      "Error:",
      JSON.stringify(error, null, 2),
    );
    throw error || new Error("Failed to delete slot from Supabase");
  }
}

export async function saveAnnouncementToSupabase(ann: Announcement) {
  const record = {
    id: ann.id,
    text: ann.text,
    date: ann.date,
  };
  const { success, error } = await upsertTableWithFallback(
    ["announcements", "Announcements"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveAnnouncement failed:", error);
    throw error || new Error("Failed to save announcement to Supabase");
  }
}

export async function deleteAnnouncementFromSupabase(annId: string) {
  const { success, error } = await deleteTableWithFallback(
    ["announcements", "Announcements"],
    "id",
    annId,
  );
  if (!success) {
    console.error("Supabase deleteAnnouncement failed:", error);
    throw error || new Error("Failed to delete announcement from Supabase");
  }
}

export async function saveFeedbackPatientToSupabase(fb: FeedbackRecord) {
  const id =
    `${fb.tarikh.replace(/\//g, "-")}_${fb.reviewer.trim()}_${fb.target.trim()}`.replace(
      /[^a-zA-Z0-9-_]/g,
      "",
    );
  const record = {
    id,
    tarikh: fb.tarikh,
    nama: fb.nama,
    reviewer: fb.reviewer,
    target: fb.target,
    rating: fb.rating,
    komen: fb.komen,
    type: "patient",
  };
  const { success, error } = await upsertTableWithFallback(
    ["feedbacks_patient", "feedbacks", "feedback", "Feedback"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveFeedbackPatient failed:", error);
    throw error || new Error("Failed to save patient feedback to Supabase");
  }
}

export async function saveFeedbackStaffToSupabase(fb: FeedbackRecord) {
  const id =
    `${fb.tarikh.replace(/\//g, "-")}_${fb.reviewer.trim()}_${fb.target.trim()}`.replace(
      /[^a-zA-Z0-9-_]/g,
      "",
    );
  const record = {
    id,
    tarikh: fb.tarikh,
    nama: fb.nama,
    reviewer: fb.reviewer,
    target: fb.target,
    rating: fb.rating,
    komen: fb.komen,
    type: "staff",
  };
  const { success, error } = await upsertTableWithFallback(
    ["feedbacks_staff", "feedbacks", "feedback", "Feedback"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveFeedbackStaff failed:", error);
    throw error || new Error("Failed to save staff feedback to Supabase");
  }
}

export async function saveFeedbackLocumToSupabase(fb: FeedbackRecord) {
  const id =
    `${fb.tarikh.replace(/\//g, "-")}_${fb.reviewer.trim()}_${fb.target.trim()}`.replace(
      /[^a-zA-Z0-9-_]/g,
      "",
    );
  const record = {
    id,
    tarikh: fb.tarikh,
    nama: fb.nama,
    reviewer: fb.reviewer,
    target: fb.target,
    rating: fb.rating,
    komen: fb.komen,
    type: "locum",
  };
  const { success, error } = await upsertTableWithFallback(
    ["feedbacks_locum", "feedbacks", "feedback", "Feedback"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveFeedbackLocum failed:", error);
    throw error || new Error("Failed to save locum feedback to Supabase");
  }
}

export async function saveApplicationToSupabase(app: NewApplication) {
  const id =
    `${app.timestamp.replace(/[^a-zA-Z0-9]/g, "")}_${app.nama.trim()}`.replace(
      /[^a-zA-Z0-9-_]/g,
      "",
    );
  const record = {
    id,
    timestamp: app.timestamp,
    nama: app.nama,
    phone: app.phone,
    mmc: app.mmc,
    apc: app.apc,
    ins: app.ins,
    cvUrl: app.cvUrl,
    skills: app.skills,
  };
  const { success, error } = await upsertTableWithFallback(
    ["applications", "Applications"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveApplication failed:", error);
    throw error || new Error("Failed to save application to Supabase");
  }
}

export async function saveActivityLogToSupabase(log: {
  timestamp: string;
  action: string;
}) {
  const client = getSupabaseClient();
  if (!client) return;
  const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Just try inserting to whichever activity_logs table matches
  for (const table of ["activity_logs", "ActivityLogs"]) {
    try {
      await client
        .from(table)
        .insert({ id, timestamp: log.timestamp, action: log.action });
      break;
    } catch {}
  }
}

export async function saveNotificationToSupabase(notif: AppNotification) {
  const record = {
    id: notif.id,
    phone: notif.phone,
    title: notif.title,
    message: notif.message,
    timestamp: notif.timestamp,
    is_read: notif.isRead,
    slot_id: notif.slotId || null,
  };
  const { success, error } = await upsertTableWithFallback(
    ["notifications", "Notifications"],
    record,
    "id",
  );
  if (!success) {
    console.error("Supabase saveNotification failed:", error);
    throw error || new Error("Failed to save notification to Supabase");
  }
}

export async function markNotificationsReadInSupabase(phone: string) {
  const client = getSupabaseClient();
  if (!client) return;
  for (const table of ["notifications", "Notifications"]) {
    try {
      const { error } = await client
        .from(table)
        .update({ is_read: true })
        .eq("phone", phone);
      if (!error) return;
    } catch {}
  }
}

export async function deleteNotificationFromSupabase(notifId: string) {
  const { success, error } = await deleteTableWithFallback(
    ["notifications", "Notifications"],
    "id",
    notifId,
  );
  if (!success) {
    console.error("Supabase deleteNotification failed:", error);
    throw error || new Error("Failed to delete notification from Supabase");
  }
}

// BULK EXPORTS (Used during initial connection/sync migration)
export async function pushAllLocalStateToSupabase(state: {
  users: UserProfile[];
  slots: LocumSlot[];
  announcements: Announcement[];
  feedbacksPatient: FeedbackRecord[];
  feedbacksStaff: FeedbackRecord[];
  feedbacksLocum: FeedbackRecord[];
  newApplications: NewApplication[];
}) {
  const client = getSupabaseClient();
  if (!client) return false;

  console.log("Starting bulk export to Supabase...");
  try {
    for (const u of state.users) {
      await saveUserToSupabase(u);
    }
    for (const s of state.slots) {
      await saveSlotToSupabase(s);
    }
    for (const a of state.announcements) {
      await saveAnnouncementToSupabase(a);
    }
    for (const fp of state.feedbacksPatient) {
      await saveFeedbackPatientToSupabase(fp);
    }
    for (const fs of state.feedbacksStaff) {
      await saveFeedbackStaffToSupabase(fs);
    }
    for (const fl of state.feedbacksLocum) {
      await saveFeedbackLocumToSupabase(fl);
    }
    for (const app of state.newApplications) {
      await saveApplicationToSupabase(app);
    }
    console.log("Bulk export to Supabase complete!");
    return true;
  } catch (error) {
    console.error("Error during bulk state export to Supabase:", error);
    return false;
  }
}
