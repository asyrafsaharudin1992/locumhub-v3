import { useState, useEffect } from "react";
import {
  LocumSlot,
  UserProfile,
  FeedbackRecord,
  NewApplication,
  Announcement,
  AppNotification,
  AdminAlert,
} from "./types";
import { getSupabaseConfig, getSupabaseClient } from "./supabaseClient";
import {
  isSupabaseActive,
  fetchUsersFromSupabase,
  fetchSlotsFromSupabase,
  fetchAnnouncementsFromSupabase,
  fetchFeedbacksPatientFromSupabase,
  fetchFeedbacksStaffFromSupabase,
  fetchFeedbacksLocumFromSupabase,
  fetchApplicationsFromSupabase,
  fetchActivityLogsFromSupabase,
  saveUserToSupabase,
  deleteUserFromSupabase,
  saveSlotToSupabase,
  deleteSlotFromSupabase,
  saveAnnouncementToSupabase,
  deleteAnnouncementFromSupabase,
  saveFeedbackPatientToSupabase,
  saveFeedbackStaffToSupabase,
  saveFeedbackLocumToSupabase,
  saveApplicationToSupabase,
  saveActivityLogToSupabase,
  pushAllLocalStateToSupabase,
  fetchNotificationsFromSupabase,
  saveNotificationToSupabase,
  markNotificationsReadInSupabase,
  deleteNotificationFromSupabase,
  fetchAdminAlertsFromSupabase,
  saveAdminAlertToSupabase,
  deleteAdminAlertFromSupabase,
} from "./supabaseService";

import {
  INITIAL_USERS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_FEEDBACKS_PATIENT,
  INITIAL_FEEDBACKS_STAFF,
  INITIAL_FEEDBACKS_LOCUM,
  INITIAL_NEW_APPLICATIONS,
  getInitialSlots,
} from "./data";
import { initAuth, googleSignIn, googleLogout } from "./googleAuth";
import {
  loadAllDataFromGoogleSheet,
  saveAllDataToGoogleSheet,
  createNewLocumSpreadsheet,
  listUserSpreadsheets,
  setupMissingSheetsInSpreadsheet,
  loadAllDataFromPublicGoogleSheet,
} from "./googleSheetsService";

export interface AppState {
  users: UserProfile[];
  slots: LocumSlot[];
  announcements: Announcement[];
  feedbacksPatient: FeedbackRecord[];
  feedbacksStaff: FeedbackRecord[];
  feedbacksLocum: FeedbackRecord[];
  newApplications: NewApplication[];
  currentUser: UserProfile | null;
  activityLogs: { timestamp: string; action: string }[];
  notifications: AppNotification[];
  adminAlerts: AdminAlert[];
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    // Attempt to load from localStorage
    const savedUsers = localStorage.getItem("ara_users");
    const savedSlots = localStorage.getItem("ara_slots");
    const savedAnnouncements = localStorage.getItem("ara_announcements");
    const savedFp = localStorage.getItem("ara_feedbacks_patient");
    const savedFs = localStorage.getItem("ara_feedbacks_staff");
    const savedFl = localStorage.getItem("ara_feedbacks_locum");
    const savedApp = localStorage.getItem("ara_applications");
    const savedLogs = localStorage.getItem("ara_logs");
    const savedCurrentUser = localStorage.getItem("ara_current_user");
    const savedNotifications = localStorage.getItem("ara_notifications");
    const savedAdminAlerts = localStorage.getItem("ara_admin_alerts");

    return {
      users: savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS,
      slots: savedSlots ? JSON.parse(savedSlots) : getInitialSlots(),
      announcements: savedAnnouncements
        ? JSON.parse(savedAnnouncements)
        : INITIAL_ANNOUNCEMENTS,
      feedbacksPatient: savedFp
        ? JSON.parse(savedFp)
        : INITIAL_FEEDBACKS_PATIENT,
      feedbacksStaff: savedFs ? JSON.parse(savedFs) : INITIAL_FEEDBACKS_STAFF,
      feedbacksLocum: savedFl ? JSON.parse(savedFl) : INITIAL_FEEDBACKS_LOCUM,
      newApplications: savedApp
        ? JSON.parse(savedApp)
        : INITIAL_NEW_APPLICATIONS,
      currentUser: savedCurrentUser ? JSON.parse(savedCurrentUser) : null,
      activityLogs: savedLogs ? JSON.parse(savedLogs) : [],
      notifications: savedNotifications ? JSON.parse(savedNotifications) : [],
      adminAlerts: savedAdminAlerts ? JSON.parse(savedAdminAlerts) : [],
    };
  });

  // Google Sheets integration state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string>("");
  const [connectedSpreadsheetId, setConnectedSpreadsheetId] = useState<string>(
    () => {
      return (
        localStorage.getItem("ara_spreadsheet_id") ||
        "1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y"
      );
    },
  );
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    if (isSupabaseActive()) {
      return false; // Matikan auto-sync Google Sheets dlm mod Supabase sahaja
    }
    return localStorage.getItem("ara_auto_sync") !== "false";
  });
  const [sheetsSyncLoading, setSheetsSyncLoading] = useState(false);
  const [sheetsSyncError, setSheetsSyncError] = useState("");
  const [userSpreadsheets, setUserSpreadsheets] = useState<
    { id: string; name: string }[]
  >([]);

  // ✅ KOD BAHARU: PAKSA AKTIF 24 JAM
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState<boolean>(true);

  const pullFromSupabase = async (): Promise<boolean> => {
    if (!isSupabaseActive()) {
      console.log("Supabase not active, skipping pull.");
      return false;
    }
    try {
      console.log("Pulling active rosters and metadata from Supabase...");
      const [
        sbUsers,
        sbSlots,
        sbAnnouncements,
        sbFbP,
        sbFbS,
        sbFbL,
        sbApps,
        sbLogs,
        sbNotifs,
        sbAlerts,
      ] = await Promise.all([
        fetchUsersFromSupabase(),
        fetchSlotsFromSupabase(),
        fetchAnnouncementsFromSupabase(),
        fetchFeedbacksPatientFromSupabase(),
        fetchFeedbacksStaffFromSupabase(),
        fetchFeedbacksLocumFromSupabase(),
        fetchApplicationsFromSupabase(),
        fetchActivityLogsFromSupabase(),
        fetchNotificationsFromSupabase(),
        fetchAdminAlertsFromSupabase(),
      ]);

      console.log("Supabase pull results:", {
        sbUsers: sbUsers?.length,
        sbSlots: sbSlots?.length,
      });

      setState((prev) => {
        return {
          users: sbUsers || prev.users,
          slots: sbSlots || prev.slots,
          announcements: sbAnnouncements || prev.announcements,
          feedbacksPatient: sbFbP || prev.feedbacksPatient,
          feedbacksStaff: sbFbS || prev.feedbacksStaff,
          feedbacksLocum: sbFbL || prev.feedbacksLocum,
          newApplications: sbApps || prev.newApplications,
          activityLogs: sbLogs || prev.activityLogs,
          notifications: sbNotifs || prev.notifications,
          adminAlerts: sbAlerts || prev.adminAlerts,
          currentUser: prev.currentUser
            ? sbUsers?.find((u) => u.phone === prev.currentUser?.phone) ||
              prev.currentUser
            : null,
        };
      });
      return true;
    } catch (err) {
      console.error("Failed to pull from Supabase:", err);
      return false;
    }
  };

  const pushToSupabase = async (): Promise<boolean> => {
    if (!isSupabaseActive()) return false;
    try {
      console.log("Pushing local state cache to Supabase database...");
      const ok = await pushAllLocalStateToSupabase(state);
      return ok;
    } catch (err) {
      console.error("Failed to push to Supabase:", err);
      return false;
    }
  };

  // Dual cloud wrappers
  const cloudSaveUser = async (user: UserProfile) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveUserToSupabase(user).catch((err) =>
        console.error("Supabase saveUser failed:", err),
      );
    }
  };

  const cloudSaveUsersBulk = async (usersToSave: UserProfile[]) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      for (const u of usersToSave) {
        saveUserToSupabase(u).catch((err) =>
          console.error("Supabase saveUser bulk failed:", err),
        );
      }
    }
  };

  const cloudDeleteUser = async (phone: string) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      await deleteUserFromSupabase(phone).catch((err) =>
        console.error("Supabase deleteUser failed:", err),
      );
    }
  };

  const cloudSaveSlot = async (slot: LocumSlot) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      await saveSlotToSupabase(slot).catch((err) =>
        console.error("Supabase saveSlot failed:", err),
      );
    }
  };

  const cloudSaveSlotsBulk = async (slotsToSave: LocumSlot[]) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      for (const s of slotsToSave) {
        await saveSlotToSupabase(s).catch((err) =>
          console.error("Supabase saveSlot bulk failed:", err),
        );
      }
    }
  };

  const cloudDeleteSlot = async (slotId: string) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      await deleteSlotFromSupabase(slotId).catch((err) =>
        console.error("Supabase deleteSlot failed:", err),
      );
    }
  };

  const cloudSaveAnnouncement = async (ann: Announcement) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveAnnouncementToSupabase(ann).catch((err) =>
        console.error("Supabase saveAnnouncement failed:", err),
      );
    }
  };

  const cloudDeleteAnnouncement = async (annId: string) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      deleteAnnouncementFromSupabase(annId).catch((err) =>
        console.error("Supabase deleteAnnouncement failed:", err),
      );
    }
  };

  const cloudSaveFeedbackPatient = async (fb: FeedbackRecord) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveFeedbackPatientToSupabase(fb).catch((err) =>
        console.error("Supabase saveFeedbackPatient failed:", err),
      );
    }
  };

  const cloudSaveFeedbackStaff = async (fb: FeedbackRecord) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveFeedbackStaffToSupabase(fb).catch((err) =>
        console.error("Supabase saveFeedbackStaff failed:", err),
      );
    }
  };

  const cloudSaveFeedbackLocum = async (fb: FeedbackRecord) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveFeedbackLocumToSupabase(fb).catch((err) =>
        console.error("Supabase saveFeedbackLocum failed:", err),
      );
    }
  };

  const cloudSaveApplication = async (app: NewApplication) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveApplicationToSupabase(app).catch((err) =>
        console.error("Supabase saveApplication failed:", err),
      );
    }
  };

  const cloudSaveActivityLog = async (log: {
    timestamp: string;
    action: string;
  }) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      saveActivityLogToSupabase(log).catch((err) =>
        console.error("Supabase saveActivityLog failed:", err),
      );
    }
  };

  // Run startup pull from Supabase if active
  useEffect(() => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      pullFromSupabase();
    }
  }, []);

  // Poll Supabase database every 10 seconds for real-time changes
  useEffect(() => {
    if (!isSupabaseEnabled || !isSupabaseActive()) return;

    const interval = setInterval(() => {
      pullFromSupabase();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isSupabaseEnabled]);

  // Check Google Auth on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) {
          setGoogleToken(token);
        }
      },
      () => {
        setGoogleUser(null);
        setGoogleToken("");
      },
    );
    return () => {
      if (unsubscribe && typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Sync spreadsheet list when token transitions
  useEffect(() => {
    if (googleToken) {
      listUserSpreadsheets(googleToken)
        .then((files) => setUserSpreadsheets(files))
        .catch((err) =>
          console.error(
            "Could not fetch user spreadsheets from Google Drive:",
            err,
          ),
        );
    } else {
      setUserSpreadsheets([]);
    }
  }, [googleToken]);

  // Background Auto-sync effect
  useEffect(() => {
    if (isSupabaseActive()) return;
    if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
      const delayDebounce = setTimeout(() => {
        pushToGoogleSheet(connectedSpreadsheetId);
      }, 1500); // 1.5-second debounce
      return () => clearTimeout(delayDebounce);
    }
  }, [state, googleToken, connectedSpreadsheetId, isAutoSyncEnabled]);

  // Write changes to localStorage on state changes
  useEffect(() => {
    localStorage.setItem("ara_users", JSON.stringify(state.users));
    localStorage.setItem("ara_slots", JSON.stringify(state.slots));
    localStorage.setItem(
      "ara_announcements",
      JSON.stringify(state.announcements),
    );
    localStorage.setItem(
      "ara_feedbacks_patient",
      JSON.stringify(state.feedbacksPatient),
    );
    localStorage.setItem(
      "ara_feedbacks_staff",
      JSON.stringify(state.feedbacksStaff),
    );
    localStorage.setItem(
      "ara_feedbacks_locum",
      JSON.stringify(state.feedbacksLocum),
    );
    localStorage.setItem(
      "ara_applications",
      JSON.stringify(state.newApplications),
    );
    localStorage.setItem("ara_logs", JSON.stringify(state.activityLogs));
    localStorage.setItem("ara_notifications", JSON.stringify(state.notifications || []));
    localStorage.setItem("ara_admin_alerts", JSON.stringify(state.adminAlerts || []));
    if (state.currentUser) {
      localStorage.setItem(
        "ara_current_user",
        JSON.stringify(state.currentUser),
      );
    } else {
      localStorage.removeItem("ara_current_user");
    }
  }, [state]);

  // Log activity
  const logActivity = (action: string) => {
    const timestamp = new Date().toLocaleString("en-GB");
    setState((prev) => ({
      ...prev,
      activityLogs: [{ timestamp, action }, ...prev.activityLogs].slice(0, 100),
    }));
    cloudSaveActivityLog({ timestamp, action }).catch((err) => {
      console.warn("Logging activity to cloud failed:", err);
    });
  };

  // --- CORE SYSTEM FUNCTIONS ---

  const loginUser = (
    phone: string,
    passwordInput?: string,
    role?: string,
  ): { success: boolean; message: string; user: UserProfile | null } => {
    const user = state.users.find((u) => u.phone.trim() === phone.trim());
    if (user) {
      if (role && user.role !== role) {
        return {
          success: false,
          message: `Access denied. Selected account is a ${user.role}.`,
          user: null,
        };
      }
      if (passwordInput !== undefined) {
        const storedPass = (user.password || "").trim();
        const inputTrimmed = (passwordInput || "").trim();
        let encodedInput = "";
        try {
          encodedInput = btoa(inputTrimmed);
        } catch (e) {}
        if (
          storedPass !== "" &&
          storedPass !== inputTrimmed &&
          storedPass !== encodedInput
        ) {
          return { success: false, message: "Invalid Password!", user: null };
        }
      }
      setState((prev) => ({ ...prev, currentUser: user }));
      logActivity(`Logged in: ${user.name} (${user.role})`);
      return { success: true, message: "Login successful", user };
    }
    return {
      success: false,
      message:
        "Invalid Phone Number! (If new, please request join via HQ link below)",
      user: null,
    };
  };

  const registerUser = (
    phone: string,
    name: string,
    email: string,
    mmc: string,
  ): { success: boolean; message: string } => {
    if (state.users.some((u) => u.phone === phone)) {
      return { success: false, message: "Phone number already registered." };
    }
    const newUser: UserProfile = {
      phone,
      name,
      role: "Doctor",
      email,
      mmc,
      apc: "",
      indemnity: "Tiada",
      points: 0,
      badges: "",
      locks: "",
    };
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    cloudSaveUser(newUser).catch((err) =>
      console.error("Cloud registerUser failed:", err),
    );
    logActivity(`Registered new doctor: ${name}`);
    return { success: true, message: "Successfully registered Dr. " + name };
  };

  const adminCreateUser = (
    name: string,
    phone: string,
    initialPassword: string,
    role: "Doctor" | "Admin" | "Staff",
    email: string = "",
  ): { success: boolean; message: string } => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone || !name.trim()) {
      return { success: false, message: "Name and phone number are required." };
    }
    if (state.users.some((u) => u.phone.trim() === trimmedPhone)) {
      return { success: false, message: "That phone number is already registered." };
    }
    if (initialPassword.trim().length < 6) {
      return { success: false, message: "Initial password must be at least 6 characters." };
    }

    const newUser: UserProfile = {
      phone: trimmedPhone,
      password: btoa(initialPassword.trim()),
      name: name.trim(),
      role,
      email,
      mmc: "",
      apc: "",
      indemnity: "Tiada",
      points: 0,
      badges: "",
      locks: "",
    };

    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    cloudSaveUser(newUser).catch((err) =>
      console.error("Cloud adminCreateUser failed:", err),
    );
    logActivity(`Admin created new ${role} account: ${name} (${trimmedPhone})`);
    return { success: true, message: `Account created for ${name}.` };
  };

  const logout = () => {
    if (state.currentUser) {
      logActivity(`Logged out: ${state.currentUser.name}`);
    }
    setState((prev) => ({ ...prev, currentUser: null }));
  };

  const changePassword = async (
    phone: string,
    newPass: string,
  ): Promise<string> => {
    const encodedPass = btoa(newPass.trim());
    const targetPhone = phone.trim();

    const existingUser = state.users.find((u) => u.phone.trim() === targetPhone);
    if (!existingUser) {
      return "⚠️ Could not find that account — password was not changed.";
    }

    const updatedUser = { ...existingUser, password: encodedPass };

    try {
      await saveUserToSupabase(updatedUser);
    } catch (err) {
      console.error("Cloud changePassword failed:", err);
      return "⚠️ Password change failed to save — please check your connection and try again.";
    }

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        if (u.phone.trim() === targetPhone) {
          return { ...u, password: encodedPass };
        }
        return u;
      });
      const currentUpdated =
        updatedUsers.find((u) => u.phone.trim() === targetPhone) || null;
      return {
        ...prev,
        users: updatedUsers,
        currentUser:
          prev.currentUser?.phone.trim() === targetPhone ? currentUpdated : prev.currentUser,
      };
    });

    logActivity(`Password changed for account: ${targetPhone}`);
    return "Password successfully updated & secured!";
  };

  const deleteUser = (phone: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.phone !== phone),
      currentUser: prev.currentUser?.phone === phone ? null : prev.currentUser,
    }));
    cloudDeleteUser(phone);
    logActivity(`Deleted user profile: ${phone}`);
  };

  const updateProfile = (
    phone: string,
    email: string,
    mmc: string,
    apc: string,
    indStatus: string,
    indemnityFile: string,
    workplace: string,
  ): string => {
    const buildIndemnityString = (previousIndemnity: string): string => {
      if (indStatus !== "Ada") return "Tiada";
      if (indemnityFile) return `Ada | ${indemnityFile}`;
      // No new file uploaded this time — keep whatever URL was already on file
      const existingUrl = previousIndemnity?.includes("http")
        ? previousIndemnity.split("|")[1]?.trim()
        : "";
      return existingUrl ? `Ada | ${existingUrl}` : "Ada";
    };

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        if (u.phone === phone) {
          return {
            ...u,
            email,
            mmc,
            apc: apc || u.apc || "",
            indemnity: buildIndemnityString(u.indemnity),
            workplace,
          };
        }
        return u;
      });

      const currentUpdated =
        updatedUsers.find((u) => u.phone === phone) || null;
      return {
        ...prev,
        users: updatedUsers,
        currentUser:
          prev.currentUser?.phone === phone ? currentUpdated : prev.currentUser,
      };
    });

    const user = state.users.find((u) => u.phone === phone);
    if (user) {
      const updatedUser = {
        ...user,
        email,
        mmc,
        apc: apc || user.apc || "",
        indemnity: buildIndemnityString(user.indemnity),
        workplace,
      };
      cloudSaveUser(updatedUser).catch((err) =>
        console.error("Cloud updateProfile failed:", err),
      );
    }

    logActivity(`Profile updated for user: ${phone}`);
    return "Profile Successfully Updated!";
  };

  const uploadCredentialFile = async (
    file: File,
    phone: string,
    kind: "apc" | "indemnity" | "mmc",
  ): Promise<{ url: string | null; error?: string }> => {
    try {
      // Convert to base64 client-side and POST as JSON — the serverless
      // function at /api/upload-to-drive handles the actual upload to the
      // shared Google Drive folder using a service account.
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/upload-to-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          phone,
          kind,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("Drive upload failed:", errBody);
        return {
          url: null,
          error: errBody?.error || `Upload failed (server responded ${res.status}).`,
        };
      }

      const data = await res.json();
      return { url: data.url || null };
    } catch (err: any) {
      console.error("uploadCredentialFile error:", err);
      return {
        url: null,
        error: err?.message || "Could not reach the upload service — check your connection.",
      };
    }
  };

  const bookSlot = async (
    slotId: string,
    doctorName: string,
    doctorPhone: string,
  ): Promise<string> => {
    let resultMessage = "Error: Slot booking failed.";

    // Check if the slot is currently available
    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return "Error: Slot not found.";
    if (slot.status !== "Available") return "Slot is no longer available.";

    const updatedSlots = state.slots.map((s) => {
      if (s.id === slotId) {
        resultMessage = "Application successfully submitted!";
        return {
          ...s,
          status: "Pending",
          dr: doctorName,
          phone: doctorPhone,
          bookedAt: new Date().toLocaleString("en-GB"),
        } as LocumSlot;
      }
      return s;
    });

    setState((prev) => ({ ...prev, slots: updatedSlots }));

    const updatedSlot: LocumSlot = {
      ...slot,
      status: "Pending",
      dr: doctorName,
      phone: doctorPhone,
      bookedAt: new Date().toLocaleString("en-GB"),
    };
    await cloudSaveSlot(updatedSlot).catch((err) =>
      console.error("Cloud bookSlot failed:", err),
    );

    if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
      await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
        ...state,
        slots: updatedSlots,
      }).catch((err) => console.error("Google Sheets book sync failed:", err));
    }

    logActivity(
      `Doctor ${doctorName} applied for slot: ${slotId} (${slot.tarikh} ${slot.masa})`,
    );
    return resultMessage;
  };

  const triggerCancellationAlert = (
    slot: LocumSlot,
    priorStatus: string,
  ) => {
    const drLabel = slot.dr
      ? slot.dr.toUpperCase().trim().replace(/^DR\s+/i, "")
      : "Unknown";
    const urgencyNote =
      priorStatus === "Approved"
        ? "Please find a replacement."
        : "The shift is now back to Open.";

    const newAlert: AdminAlert = {
      id: "alert_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      slotId: slot.id,
      drName: drLabel,
      cawangan: slot.cawangan,
      tarikh: slot.tarikh,
      masa: slot.masa,
      message: `Dr ${drLabel} cancelled their slot on ${slot.tarikh} (${slot.masa}) at Klinik ARA ${slot.cawangan}. ${urgencyNote}`,
      timestamp: new Date().toLocaleString("en-GB"),
    };

    setState((prev) => ({
      ...prev,
      adminAlerts: [newAlert, ...(prev.adminAlerts || [])],
    }));

    saveAdminAlertToSupabase(newAlert).catch((err) =>
      console.error("Cloud saveAdminAlert failed:", err),
    );

    logActivity(`ALERT: Dr ${drLabel} cancelled slot ${slot.id}`);
  };

  const dismissAdminAlert = (id: string) => {
    setState((prev) => ({
      ...prev,
      adminAlerts: (prev.adminAlerts || []).filter((a) => a.id !== id),
    }));
    deleteAdminAlertFromSupabase(id).catch((err) =>
      console.error("Cloud deleteAdminAlert failed:", err),
    );
  };

  const cancelSlotByDoctor = async (
    slotId: string,
    statusAsal: string,
    doctorPhone: string,
  ): Promise<string> => {
    let resultMessage = "Error: Slot cancellation failed.";

    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return "Error: Slot not found.";

    const updatedSlots = state.slots.map((s) => {
      if (s.id === slotId) {
        resultMessage = "✅ Success! Slot is now Available again.";
        return {
          ...s,
          status: "Available",
          dr: "",
          phone: "",
          bookedAt: undefined,
        } as LocumSlot;
      }
      return s;
    });

    setState((prev) => ({ ...prev, slots: updatedSlots }));

    const updatedSlot: LocumSlot = {
      ...slot,
      status: "Available",
      dr: "",
      phone: "",
      bookedAt: undefined,
    };
    await cloudSaveSlot(updatedSlot).catch((err) =>
      console.error("Cloud cancelSlotByDoctor failed:", err),
    );

    // Heads-up alert for admins so they know to find a replacement
    triggerCancellationAlert(slot, statusAsal);

    if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
      await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
        ...state,
        slots: updatedSlots,
      }).catch((err) =>
        console.error("Google Sheets cancel sync failed:", err),
      );
    }

    logActivity(
      `Doctor cancelled slot application: ${slotId} (previous status: ${statusAsal})`,
    );
    return resultMessage;
  };

  // --- ADMIN SYSTEM FUNCTIONS ---

  const triggerApprovalNotification = (slot: LocumSlot) => {
    const newNotif: AppNotification = {
      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      phone: slot.phone,
      title: "Slot Approved 🎉",
      message: `Your booking for a slot at ARA ${slot.cawangan} on ${slot.tarikh} (${slot.masa}) has been approved!`,
      timestamp: new Date().toLocaleString("en-GB"),
      isRead: false,
      slotId: slot.id,
    };

    setState((prev) => {
      const currentNotifs = prev.notifications || [];
      return {
        ...prev,
        notifications: [newNotif, ...currentNotifs],
      };
    });

    // Persist to Supabase so the doctor's device (a different browser/session) actually receives it
    saveNotificationToSupabase(newNotif).catch((err) =>
      console.error("Cloud saveNotification failed:", err),
    );

    logActivity(`LocumHub Notification created for Dr ${slot.dr} (Phone: ${slot.phone})`);
  };

  const markNotificationsAsRead = (phone: string) => {
    setState((prev) => {
      const updated = (prev.notifications || []).map((n) => {
        if (n.phone.trim() === phone.trim()) {
          return { ...n, isRead: true };
        }
        return n;
      });
      return { ...prev, notifications: updated };
    });
    markNotificationsReadInSupabase(phone).catch((err) =>
      console.error("Cloud markNotificationsRead failed:", err),
    );
    logActivity(`Cleared unread notifications count for phone: ${phone}`);
  };

  const deleteNotification = (id: string) => {
    setState((prev) => {
      const updated = (prev.notifications || []).filter((n) => n.id !== id);
      return { ...prev, notifications: updated };
    });
    deleteNotificationFromSupabase(id).catch((err) =>
      console.error("Cloud deleteNotification failed:", err),
    );
    logActivity(`Deleted notification record ${id}`);
  };

  const adminApproveSlot = async (id: string): Promise<string> => {
    let docName = "";
    let branchName = "";
    let dateStr = "";
    let scheduleStr = "";

    const updatedSlots = state.slots.map((s) => {
      if (s.id === id) {
        docName = s.dr;
        branchName = s.cawangan;
        dateStr = s.tarikh;
        scheduleStr = s.masa;
        return { ...s, status: "Approved" } as LocumSlot;
      }
      return s;
    });

    setState((prev) => ({ ...prev, slots: updatedSlots }));

    const slot = updatedSlots.find((s) => s.id === id);
    if (slot) {
      await cloudSaveSlot(slot).catch((err) =>
        console.error("Cloud adminApproveSlot failed:", err),
      );
      // Trigger local application notification
      triggerApprovalNotification(slot);
    }

    if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
      await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
        ...state,
        slots: updatedSlots,
      }).catch((err) =>
        console.error("Google Sheets approve sync failed:", err),
      );
    }

    logActivity(`ADMIN APPROVED: Slot ${id} for Dr ${docName}`);
    return `Slot Approved! LocumHub Notification dispatched directly to Dr. ${docName} for shift on ${dateStr} at ARA ${branchName}`;
  };

  const adminManageSlot = async (
    action: "DELETE" | "CANCEL" | "REPLACE",
    id: string,
    newDrPhone?: string,
    manualName?: string,
  ): Promise<string> => {
    let result = "Error executing action.";
    const slot = state.slots.find((s) => s.id === id);
    if (!slot) return "Error: Slot not found.";
    const drAsal = slot.dr || "Unknown";
    const branch = slot.cawangan;

    if (action === "DELETE") {
      const updatedSlots = state.slots.filter((s) => s.id !== id);
      setState((prev) => ({
        ...prev,
        slots: updatedSlots,
      }));
      await cloudDeleteSlot(id).catch((err) =>
        console.error("Cloud adminManageSlot DELETE failed:", err),
      );

      if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
        await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
          ...state,
          slots: updatedSlots,
        }).catch((err) =>
          console.error("Google Sheets delete sync failed:", err),
        );
      }

      logActivity(`ADMIN: PERMANENT DELETE - Slot ID ${id}`);
      return "✅ Slot successfully deleted permanently.";
    }

    if (action === "CANCEL") {
      const updatedSlots = state.slots.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            status: "Available",
            dr: "",
            phone: "",
            bookedAt: undefined,
          } as LocumSlot;
        }
        return s;
      });

      setState((prev) => ({ ...prev, slots: updatedSlots }));

      const updatedSlot = {
        ...slot,
        status: "Available",
        dr: "",
        phone: "",
        bookedAt: undefined,
      } as LocumSlot;

      await cloudSaveSlot(updatedSlot).catch((err) =>
        console.error("Cloud adminManageSlot CANCEL failed:", err),
      );

      if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
        await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
          ...state,
          slots: updatedSlots,
        }).catch((err) =>
          console.error("Google Sheets cancel sync failed:", err),
        );
      }

      logActivity(`ADMIN: CANCEL & RESET - Slot ID ${id} (Dr: ${drAsal})`);
      return `✅ Slot reset to Available. Cancellation logged for Dr. ${drAsal}`;
    }

    if (action === "REPLACE") {
      let finalName = "";
      let finalPhone = "";

      if (manualName && manualName.trim() !== "") {
        finalName = manualName.trim() + " (External)";
        finalPhone = "MANUAL";
      } else if (newDrPhone) {
        const docUser = state.users.find((u) => u.phone === newDrPhone);
        if (docUser) {
          finalName = docUser.name;
          finalPhone = docUser.phone;
        }
      }

      if (finalName) {
        const assignedAt = new Date().toLocaleString("en-GB");
        const updatedSlots = state.slots.map((s) => {
          if (s.id === id) {
            return {
              ...s,
              status: "Approved",
              dr: finalName,
              phone: finalPhone,
              bookedAt: assignedAt,
            } as LocumSlot;
          }
          return s;
        });

        setState((prev) => ({ ...prev, slots: updatedSlots }));

        const updatedSlot = {
          ...slot,
          status: "Approved",
          dr: finalName,
          phone: finalPhone,
          bookedAt: assignedAt,
        } as LocumSlot;

        await cloudSaveSlot(updatedSlot).catch((err) =>
          console.error("Cloud adminManageSlot REPLACE failed:", err),
        );

        // Trigger local application notification
        triggerApprovalNotification(updatedSlot);

        if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
          await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
            ...state,
            slots: updatedSlots,
          }).catch((err) =>
            console.error("Google Sheets replace sync failed:", err),
          );
        }

        logActivity(
          `ADMIN: REPLACE - Slot ${id} (Old: ${drAsal} -> New: ${finalName})`,
        );
        return `✅ Successfully replaced with Dr. ${finalName}`;
      }
      return "❌ Error: Doctor not found.";
    }

    return result;
  };

  const adminCreateBulkSlots = (
    dates: string[],
    branch: string,
    time: string,
    basePayRate: number,
  ): string => {
    const now = Date.now();
    const newSlots: LocumSlot[] = dates.map((d, index) => {
      // Convert YYYY-MM-DD input to DD/MM/YYYY
      const parts = d.split("-");
      const formattedDate =
        parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
      const id = "SLOT" + (now + index);

      return {
        id,
        tarikh: formattedDate,
        masa: time,
        cawangan: branch,
        status: "Available",
        dr: "",
        phone: "",
        gaji: basePayRate,
      };
    });

    setState((prev) => ({
      ...prev,
      slots: [...prev.slots, ...newSlots],
    }));

    cloudSaveSlotsBulk(newSlots).catch((err) =>
      console.error("Cloud adminCreateBulkSlots failed:", err),
    );

    logActivity(
      `ADMIN: Bulk created ${dates.length} slots for branch ${branch}`,
    );
    return `✅ Berjaya tambah ${dates.length} slot!`;
  };

  const publishAnnouncement = (text: string): string => {
    const id = "ann-" + Date.now();
    const date = new Date().toLocaleDateString("en-GB");
    setState((prev) => ({
      ...prev,
      announcements: [{ id, text, date }, ...prev.announcements],
    }));
    cloudSaveAnnouncement({ id, text, date }).catch((err) =>
      console.error("Cloud publishAnnouncement failed:", err),
    );
    logActivity(`ADMIN: Published announcement: "${text.substring(0, 30)}..."`);
    return "Announcement updated!";
  };

  const deleteAnnouncement = (id: string) => {
    setState((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
    cloudDeleteAnnouncement(id).catch((err) =>
      console.error("Cloud deleteAnnouncement failed:", err),
    );
    logActivity(`ADMIN: Deleted announcement ID ${id}`);
  };

  const adminGivePoints = (
    phone: string,
    pointsToAdd: number,
    awardName: string,
  ): string => {
    let result = "Error: User not found.";
    const cleanBadgeName = awardName.split(" [")[0].trim();
    const rowTag = awardName.match(/\[R\d+\]/)
      ? awardName.match(/\[R\d+\]/)![0]
      : "";

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        if (u.phone === phone) {
          // Check anti-double award logic using locks
          const currentLocks = u.locks || "";
          if (rowTag && currentLocks.indexOf(rowTag) !== -1) {
            result =
              "🔒 This review has already been rewarded to Dr. " + u.name;
            return u;
          }

          const currentPoints = u.points || 0;
          const badgeString = u.badges || "";
          const badgeMap: { [key: string]: number } = {};

          if (badgeString) {
            badgeString.split(",").forEach((item) => {
              const parts = item.split(":");
              if (parts.length === 2) {
                const key = parts[0].trim().split(" (")[0].trim();
                badgeMap[key] = (badgeMap[key] || 0) + parseInt(parts[1]);
              }
            });
          }

          badgeMap[cleanBadgeName] = (badgeMap[cleanBadgeName] || 0) + 1;
          const updatedBadges = Object.keys(badgeMap)
            .map((k) => `${k}:${badgeMap[k]}`)
            .join(", ");
          const updatedLocks = rowTag
            ? currentLocks + `[${rowTag}]`
            : currentLocks;

          result = `✅ Success! Awarded ${pointsToAdd} Aracoins. ${cleanBadgeName} count for Dr. ${u.name} is now ${badgeMap[cleanBadgeName]}`;

          return {
            ...u,
            points: currentPoints + pointsToAdd,
            badges: updatedBadges,
            locks: updatedLocks,
          };
        }
        return u;
      });

      const currentUpdated =
        updatedUsers.find((u) => u.phone === phone) || null;
      return {
        ...prev,
        users: updatedUsers,
        currentUser:
          prev.currentUser?.phone === phone ? currentUpdated : prev.currentUser,
      };
    });

    const user = state.users.find((u) => u.phone === phone);
    if (user) {
      const currentLocks = user.locks || "";
      if (!(rowTag && currentLocks.indexOf(rowTag) !== -1)) {
        const currentPoints = user.points || 0;
        const badgeString = user.badges || "";
        const badgeMap: { [key: string]: number } = {};

        if (badgeString) {
          badgeString.split(",").forEach((item) => {
            const parts = item.split(":");
            if (parts.length === 2) {
              const key = parts[0].trim().split(" (")[0].trim();
              badgeMap[key] = (badgeMap[key] || 0) + parseInt(parts[1]);
            }
          });
        }

        badgeMap[cleanBadgeName] = (badgeMap[cleanBadgeName] || 0) + 1;
        const updatedBadges = Object.keys(badgeMap)
          .map((k) => `${k}:${badgeMap[k]}`)
          .join(", ");
        const updatedLocks = rowTag
          ? currentLocks + `[${rowTag}]`
          : currentLocks;

        const updatedUser = {
          ...user,
          points: currentPoints + pointsToAdd,
          badges: updatedBadges,
          locks: updatedLocks,
        };
        cloudSaveUser(updatedUser).catch((err) =>
          console.error("Cloud adminGivePoints failed:", err),
        );
      }
    }

    logActivity(
      `ADMIN AWARD: Given ${cleanBadgeName} (${pointsToAdd} pts) to user ${phone}`,
    );
    return result;
  };

  const completeSlotAndAwardPoints = async (
    slotId: string,
    sales: number,
    patients: number,
    payment: number,
    period: string,
  ): Promise<string> => {
    let resultText = "✅ Performance saved.";

    let updatedSlotsRef: LocumSlot[] = [];
    let updatedUsersRef: UserProfile[] = [];

    setState((prev) => {
      const slot = prev.slots.find((s) => s.id === slotId);
      if (!slot) return prev;

      // 1. Update performance parameters in the slot
      const updatedSlots = prev.slots.map((s) => {
        if (s.id === slotId) {
          return {
            ...s,
            sales,
            pesakit: patients,
            gaji: payment,
            performanceRecorded: true,
          } as LocumSlot;
        }
        return s;
      });
      updatedSlotsRef = updatedSlots;

      // 2. Identify the doctor to reward
      const drNameInSlot = slot.dr ? slot.dr.toUpperCase().trim() : "";
      if (!drNameInSlot) {
        updatedUsersRef = prev.users;
        return { ...prev, slots: updatedSlots };
      }

      const badgesToUpdate: string[] = [];
      const slotTimeRaw = slot.masa.toLowerCase();
      const branchRaw = slot.cawangan.toUpperCase();
      const slotDateRaw = slot.tarikh;
      const bookedAtRaw = slot.bookedAt;

      // Logic for Iron Doctor
      const numbersOnly = slotTimeRaw.replace(/[^0-9]/g, "");
      if (
        /8.*8|9.*9|10.*10/.test(numbersOnly) ||
        slotTimeRaw.includes("12h") ||
        slotTimeRaw.includes("12jam") ||
        slotTimeRaw.includes("12-hour") ||
        slotTimeRaw.includes("12 hour")
      ) {
        badgesToUpdate.push("Iron Doctor");
      }

      // Logic for CME
      if (branchRaw.includes("CME") || branchRaw.includes("BRIEFING")) {
        badgesToUpdate.push("The Diligent Doc");
      }

      // Logic for Last Minute Savior
      if (bookedAtRaw && slotDateRaw) {
        try {
          const parseDate = (dStr: string) => {
            const p = dStr.split(/[\s/:-]+/);
            return p.length >= 3
              ? new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
              : new Date(dStr);
          };
          const sDate = parseDate(slotDateRaw);
          const bDate = parseDate(bookedAtRaw);
          const diffInHours =
            (sDate.getTime() - bDate.getTime()) / (1000 * 60 * 60);
          if (diffInHours > 0 && diffInHours < 48) {
            badgesToUpdate.push("Last Minute Savior");
          }
        } catch (e: any) {
          console.warn("Date parse error", e.message);
        }
      }

      if (badgesToUpdate.length === 0) {
        updatedUsersRef = prev.users;
        return { ...prev, slots: updatedSlots };
      }

      // 3. Update the matching doctor profile
      const updatedUsers = prev.users.map((u) => {
        if (
          u.name.toUpperCase().trim() === drNameInSlot ||
          u.name
            .toUpperCase()
            .trim()
            .replace(/^(DR|dr)\.?\s+/i, "") === drNameInSlot
        ) {
          const locksStr = u.locks || "";
          const slotLockId = `[${slotId}]`;

          if (locksStr.indexOf(slotLockId) !== -1) return u;

          const currentPoints = u.points || 0;
          const badgeString = u.badges || "";
          const badgeMap: { [key: string]: number } = {};

          if (badgeString) {
            badgeString.split(",").forEach((item) => {
              const parts = item.split(":");
              if (parts.length === 2)
                badgeMap[parts[0].trim()] = parseInt(parts[1]);
            });
          }

          const monthlyId = `(${period})`;
          badgesToUpdate.forEach((badge) => {
            const cleanKey = `${badge} ${monthlyId}`;
            badgeMap[cleanKey] = (badgeMap[cleanKey] || 0) + 1;
          });

          const totalPointsAwarded = badgesToUpdate.length * 10;
          const updatedBadges = Object.keys(badgeMap)
            .map((k) => `${k}:${badgeMap[k]}`)
            .join(", ");
          const updatedLocks = locksStr + slotLockId;

          resultText = `✅ Shift Completed! Doctor ${u.name} awarded ${totalPointsAwarded} Aracoins for: ${badgesToUpdate.join(", ")}`;

          return {
            ...u,
            points: currentPoints + totalPointsAwarded,
            badges: updatedBadges,
            locks: updatedLocks,
          };
        }
        return u;
      });
      updatedUsersRef = updatedUsers;

      return {
        ...prev,
        slots: updatedSlots,
        users: updatedUsers,
        currentUser:
          updatedUsers.find((u) => u.phone === prev.currentUser?.phone) ||
          prev.currentUser,
      };
    });

    // Synchronous localStorage persistence
    localStorage.setItem("ara_slots", JSON.stringify(updatedSlotsRef));
    localStorage.setItem("ara_users", JSON.stringify(updatedUsersRef));

    // Async Cloud sync
    const slotToSave = updatedSlotsRef.find((s) => s.id === slotId);
    if (slotToSave) {
      await cloudSaveSlot(slotToSave).catch((err) =>
        console.error("Cloud completeSlot saveSlot failed:", err),
      );
    }

    // Also update the doctor in Supabase if points were awarded
    const userToSave = updatedUsersRef.find((u) => {
      const drNameInSlot = (state.slots.find((s) => s.id === slotId)?.dr || "")
        .toUpperCase()
        .trim();
      return (
        u.name.toUpperCase().trim() === drNameInSlot ||
        u.name
          .toUpperCase()
          .trim()
          .replace(/^(DR|dr)\.?\s+/i, "") === drNameInSlot
      );
    });
    if (userToSave) {
      await saveUserToSupabase(userToSave).catch((err) =>
        console.error("Cloud completeSlot saveUser failed:", err),
      );
    }

    return resultText;
  };

  const processMonthlyUnstoppable = (
    selectedMonth: string,
    selectedYear: string,
  ): string => {
    const dateBadgeId = `(${selectedMonth}/${selectedYear})`;
    const monthlySlots = state.slots.filter((s) => {
      const parts = s.tarikh.split("/");
      if (parts.length === 3) {
        return (
          parts[1].padStart(2, "0") === selectedMonth &&
          parts[2] === selectedYear
        );
      }
      return false;
    });

    const docSummary: {
      [drName: string]: { approved: number; cancelled: number };
    } = {};
    monthlySlots.forEach((s) => {
      if (!s.dr) return;
      const name = s.dr.toUpperCase().trim();
      if (!docSummary[name]) {
        docSummary[name] = { approved: 0, cancelled: 0 };
      }
      if (s.status === "Approved") {
        docSummary[name].approved++;
      }
    });

    state.activityLogs.forEach((log) => {
      if (log.action.includes("CANCEL") || log.action.includes("cancelled")) {
        state.users.forEach((u) => {
          if (log.action.includes(u.name)) {
            const name = u.name.toUpperCase().trim();
            if (docSummary[name]) {
              docSummary[name].cancelled++;
            }
          }
        });
      }
    });

    const awardedList: string[] = [];
    const skippedList: string[] = [];

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        const uName = u.name.toUpperCase().trim();
        const summary = docSummary[uName];
        if (summary && summary.approved >= 2 && summary.cancelled === 0) {
          if (u.badges.indexOf(`The Unstoppable ${dateBadgeId}`) !== -1) {
            skippedList.push(u.name);
            return u;
          }

          const currentPoints = u.points || 0;
          const badgeString = u.badges || "";
          const badgeMap: { [key: string]: number } = {};

          if (badgeString) {
            badgeString.split(",").forEach((item) => {
              const parts = item.split(":");
              if (parts.length === 2) {
                const clean = parts[0].split(" (")[0].trim();
                badgeMap[clean] = (badgeMap[clean] || 0) + parseInt(parts[1]);
              }
            });
          }

          badgeMap["The Unstoppable"] = (badgeMap["The Unstoppable"] || 0) + 1;
          const updatedBadges = Object.keys(badgeMap)
            .map((k) => `${k} ${dateBadgeId}:${badgeMap[k]}`)
            .join(", ");

          awardedList.push(u.name);

          return {
            ...u,
            points: currentPoints + 10,
            badges: updatedBadges,
          };
        }
        return u;
      });

      const currentUpdated =
        updatedUsers.find((u) => u.phone === prev.currentUser?.phone) ||
        prev.currentUser;

      return {
        ...prev,
        users: updatedUsers,
        currentUser: currentUpdated,
      };
    });

    const updatedDocList: UserProfile[] = [];
    state.users.forEach((u) => {
      const uName = u.name.toUpperCase().trim();
      const summary = docSummary[uName];
      if (summary && summary.approved >= 2 && summary.cancelled === 0) {
        if (u.badges.indexOf(`The Unstoppable ${dateBadgeId}`) === -1) {
          const currentPoints = u.points || 0;
          const badgeString = u.badges || "";
          const badgeMap: { [key: string]: number } = {};

          if (badgeString) {
            badgeString.split(",").forEach((item) => {
              const parts = item.split(":");
              if (parts.length === 2) {
                const clean = parts[0].split(" (")[0].trim();
                badgeMap[clean] = (badgeMap[clean] || 0) + parseInt(parts[1]);
              }
            });
          }

          badgeMap["The Unstoppable"] = (badgeMap["The Unstoppable"] || 0) + 1;
          const updatedBadges = Object.keys(badgeMap)
            .map((k) => `${k} ${dateBadgeId}:${badgeMap[k]}`)
            .join(", ");

          updatedDocList.push({
            ...u,
            points: currentPoints + 10,
            badges: updatedBadges,
          });
        }
      }
    });
    if (updatedDocList.length > 0) {
      cloudSaveUsersBulk(updatedDocList).catch((err) =>
        console.error("Cloud processMonthlyUnstoppable failed:", err),
      );
    }

    if (awardedList.length > 0) {
      logActivity(
        `Unstoppable scanner ran for ${selectedMonth}/${selectedYear}. Awarded: ${awardedList.join(", ")}`,
      );
      return `✅ SUCCESS! Awarded "The Unstoppable" to: ${awardedList.join(", ")}`;
    }
    if (skippedList.length > 0) {
      return `ℹ️ ALREADY AWARDED: ${skippedList.join(", ")}`;
    }
    return `❌ No eligible doctors found for ${selectedMonth}/${selectedYear} (Requires min 2 approved shifts & zero cancellations).`;
  };

  const getManualHeartCandidates = () => {
    return state.feedbacksPatient
      .filter((f) => f.rating === 5)
      .map((f, i) => {
        const rowId = `R${100 + i}`;
        const parts = f.tarikh.split("/");
        const monthSegment =
          parts.length === 3 ? `(${parts[1]}/${parts[2]})` : "(06/2026)";
        const badgeId = `Heart Winner ${monthSegment} [${rowId}]`;

        return {
          name: f.target,
          date: f.tarikh,
          row: rowId,
          badgeId,
          comment: f.komen,
        };
      });
  };

  const submitRecruitment = (app: NewApplication) => {
    setState((prev) => ({
      ...prev,
      newApplications: [app, ...prev.newApplications],
    }));
    cloudSaveApplication(app).catch((err) =>
      console.error("Cloud submitRecruitment failed:", err),
    );
    logActivity(`Recruitment Form: Submitted by ${app.nama}`);
  };

  // Google Sheets & Authentication operations
  const authenticateGoogle = async () => {
    setSheetsSyncError("");
    setSheetsSyncLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        logActivity(`Authenticated Google: ${res.user.email}`);
        return res;
      }
    } catch (err: any) {
      setSheetsSyncError(err.message || "Google authentication failed");
    } finally {
      setSheetsSyncLoading(false);
    }
    return null;
  };

  const disconnectGoogle = async () => {
    await googleLogout();
    setGoogleUser(null);
    setGoogleToken("");
    logActivity("Disconnected Google Sheets integration");
  };

  const connectSpreadsheet = (id: string) => {
    setConnectedSpreadsheetId(id);
    localStorage.setItem("ara_spreadsheet_id", id);
    logActivity(`Connected Spreadsheet: ID ${id.substring(0, 8)}...`);
    pullFromGoogleSheet(id);
  };

  const disconnectSpreadsheet = () => {
    setConnectedSpreadsheetId("");
    localStorage.removeItem("ara_spreadsheet_id");
    logActivity("Disassociated Spreadsheet link");
  };

  const pullFromGoogleSheet = async (idToUse?: string, silent = false) => {
    const activeId = idToUse || connectedSpreadsheetId;
    if (!activeId) return false;

    if (!silent) {
      setSheetsSyncLoading(true);
      setSheetsSyncError("");
    }
    try {
      let loaded = null;
      if (googleToken) {
        if (!silent) {
          await setupMissingSheetsInSpreadsheet(googleToken, activeId);
        }
        loaded = await loadAllDataFromGoogleSheet(googleToken, activeId);
      } else {
        loaded = await loadAllDataFromPublicGoogleSheet(activeId);
      }

      if (loaded) {
        const isEmptySheet =
          loaded.slots.length === 0 && loaded.users.length === 0;
        if (isEmptySheet && googleToken) {
          const success = await saveAllDataToGoogleSheet(
            googleToken,
            activeId,
            state,
          );
          if (success) {
            logActivity(
              `Seeded initial data rosters to newly synchronized spreadsheet`,
            );
          }
          return success;
        }

        let finalSlots: LocumSlot[] = [];

        setState((prev) => {
          const finalUsers = loaded.users.length > 0
            ? loaded.users.map((sheetUser) => {
                const existing = prev.users.find(
                  (u) => u.phone.trim() === sheetUser.phone.trim()
                );
                if (existing && isSupabaseActive()) {
                  return {
                    ...sheetUser,
                    password: existing.password || sheetUser.password,
                    points: existing.points !== undefined ? existing.points : sheetUser.points,
                    badges: existing.badges || sheetUser.badges,
                  };
                }
                return sheetUser;
              })
            : prev.users;

          finalSlots = loaded.slots.length > 0
            ? loaded.slots.map((sheetSlot) => {
                const existing = prev.slots.find(
                  (s) => s.id.trim() === sheetSlot.id.trim()
                );
                if (existing && isSupabaseActive()) {
                  const getStatusWeight = (status: string) => {
                    if (status === "Approved") return 2;
                    if (status === "Pending") return 1;
                    return 0;
                  };
                  const existingWeight = getStatusWeight(existing.status);
                  const sheetWeight = getStatusWeight(sheetSlot.status || "");

                  if (existingWeight > sheetWeight) {
                    return {
                      ...sheetSlot,
                      status: existing.status,
                      dr: existing.dr || sheetSlot.dr,
                      phone: existing.phone || sheetSlot.phone,
                      bookedAt: existing.bookedAt || sheetSlot.bookedAt,
                      sales: existing.sales !== undefined ? existing.sales : sheetSlot.sales,
                      pesakit: existing.pesakit !== undefined ? existing.pesakit : sheetSlot.pesakit,
                      performanceRecorded: existing.performanceRecorded !== undefined ? existing.performanceRecorded : sheetSlot.performanceRecorded,
                    };
                  } else if (existingWeight === sheetWeight && existingWeight > 0) {
                    return {
                      ...sheetSlot,
                      dr: sheetSlot.dr || existing.dr,
                      phone: sheetSlot.phone || existing.phone,
                      bookedAt: sheetSlot.bookedAt || existing.bookedAt,
                      sales: sheetSlot.sales !== undefined ? sheetSlot.sales : existing.sales,
                      pesakit: sheetSlot.pesakit !== undefined ? sheetSlot.pesakit : existing.pesakit,
                      performanceRecorded: sheetSlot.performanceRecorded !== undefined ? sheetSlot.performanceRecorded : existing.performanceRecorded,
                    };
                  }
                }
                return sheetSlot;
              })
            : prev.slots;

          return {
            ...prev,
            slots: finalSlots,
            users: finalUsers,
            announcements:
              loaded.announcements.length > 0
                ? loaded.announcements
                : prev.announcements,
            feedbacksPatient:
              loaded.feedbacksPatient.length > 0
                ? loaded.feedbacksPatient
                : prev.feedbacksPatient,
            feedbacksStaff:
              loaded.feedbacksStaff.length > 0
                ? loaded.feedbacksStaff
                : prev.feedbacksStaff,
            feedbacksLocum:
              loaded.feedbacksLocum.length > 0
                ? loaded.feedbacksLocum
                : prev.feedbacksLocum,
            newApplications:
              loaded.newApplications.length > 0
                ? loaded.newApplications
                : prev.newApplications,
          };
        });

        if (!silent) {
          if (isSupabaseEnabled && isSupabaseActive()) {
            try {
              const mergedUsersForPush = loaded.users.length > 0
                ? loaded.users.map((sheetUser) => {
                    const existing = state.users.find(
                      (u) => u.phone.trim() === sheetUser.phone.trim()
                    );
                    if (existing) {
                      return {
                        ...sheetUser,
                        password: existing.password || sheetUser.password,
                        points: existing.points !== undefined ? existing.points : sheetUser.points,
                        badges: existing.badges || sheetUser.badges,
                      };
                    }
                    return sheetUser;
                  })
                : state.users;

              await pushAllLocalStateToSupabase({
                users: mergedUsersForPush,
                slots: finalSlots.length > 0 ? finalSlots : state.slots,
                announcements:
                  loaded.announcements.length > 0
                    ? loaded.announcements
                    : state.announcements,
                feedbacksPatient:
                  loaded.feedbacksPatient.length > 0
                    ? loaded.feedbacksPatient
                    : state.feedbacksPatient,
                feedbacksStaff:
                  loaded.feedbacksStaff.length > 0
                    ? loaded.feedbacksStaff
                    : state.feedbacksStaff,
                feedbacksLocum:
                  loaded.feedbacksLocum.length > 0
                    ? loaded.feedbacksLocum
                    : state.feedbacksLocum,
                newApplications:
                  loaded.newApplications.length > 0
                    ? loaded.newApplications
                    : state.newApplications,
              });
              console.log("Supabase bulk sync mirror completed successfully.");
            } catch (sbErr) {
              console.error(
                "Supabase mirroring during sheet pull failed:",
                sbErr,
              );
            }
          }
        }

        if (!silent) {
          logActivity(`Synced latest data from Google Sheet`);
        }
        return true;
      } else {
        if (!silent) {
          setSheetsSyncError(
            "Could not parse Google Sheet. Verify it is a valid format and shared publicly.",
          );
        }
      }
    } catch (err: any) {
      if (!silent) {
        setSheetsSyncError(err.message || "Pull sync failed");
      }
    } finally {
      if (!silent) {
        setSheetsSyncLoading(false);
      }
    }
    return false;
  };

  // Initial auto-pull once user successfully logs in with google permissions
  useEffect(() => {
    if (isSupabaseActive()) return;
    if (googleToken && connectedSpreadsheetId) {
      pullFromGoogleSheet(connectedSpreadsheetId);
    }
  }, [googleToken]);

  // Load live Google Sheet on app startup automatically and mirror to Database
  useEffect(() => {
    const fetchStartupData = async () => {
      if (isSupabaseActive()) {
        console.log("Supabase active. Skipping startup silent pull from Google Sheet.");
        return;
      }
      const activeId =
        connectedSpreadsheetId ||
        "1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y";
      if (!activeId) return;

      console.log(
        "Auto-sync: Performing startup silent pull from Google Sheet...",
      );
      await pullFromGoogleSheet(activeId, true);
    };

    fetchStartupData();
  }, [connectedSpreadsheetId]);

  const pushToGoogleSheet = async (idToUse?: string) => {
    const activeId = idToUse || connectedSpreadsheetId;
    if (!activeId || !googleToken) return false;

    setSheetsSyncError("");
    try {
      const success = await saveAllDataToGoogleSheet(
        googleToken,
        activeId,
        state,
      );
      if (success) {
        logActivity(`Flushed clinical changes directly to Google Sheet`);
        return true;
      } else {
        setSheetsSyncError("Failed to overwrite Google Sheet values");
      }
    } catch (err: any) {
      setSheetsSyncError(err.message || "Push sync failed");
    }
    return false;
  };

  const createAndConnectNewSpreadsheet = async () => {
    if (!googleToken) return;
    setSheetsSyncLoading(true);
    setSheetsSyncError("");
    try {
      const newId = await createNewLocumSpreadsheet(googleToken, {
        slots: state.slots,
        users: state.users,
        announcements: state.announcements,
        feedbacksPatient: state.feedbacksPatient,
        feedbacksStaff: state.feedbacksStaff,
        feedbacksLocum: state.feedbacksLocum,
        newApplications: state.newApplications,
      });
      if (newId) {
        setConnectedSpreadsheetId(newId);
        localStorage.setItem("ara_spreadsheet_id", newId);
        const files = await listUserSpreadsheets(googleToken);
        setUserSpreadsheets(files);
        logActivity(
          `Created & Linked brand new Google Sheet: ${newId.substring(0, 8)}...`,
        );
        return newId;
      }
    } catch (err: any) {
      setSheetsSyncError(err.message || "Failed to create new spreadsheet");
    } finally {
      setSheetsSyncLoading(false);
    }
    return null;
  };

  const toggleAutoSync = () => {
    setIsAutoSyncEnabled((prev) => {
      const n = !prev;
      localStorage.setItem("ara_auto_sync", String(n));
      return n;
    });
  };

  return {
    state,
    loginUser,
    registerUser,
    adminCreateUser,
    deleteUser,
    logout,
    changePassword,
    updateProfile,
    uploadCredentialFile,
    bookSlot,
    cancelSlotByDoctor,
    adminApproveSlot,
    adminManageSlot,
    adminCreateBulkSlots,
    publishAnnouncement,
    deleteAnnouncement,
    adminGivePoints,
    completeSlotAndAwardPoints,
    processMonthlyUnstoppable,
    getManualHeartCandidates,
    submitRecruitment,
    logActivity,
    markNotificationsAsRead,
    deleteNotification,
    dismissAdminAlert,

    // Google synchronization exposed properties
    googleUser,
    googleToken,
    connectedSpreadsheetId,
    isAutoSyncEnabled,
    sheetsSyncLoading,
    sheetsSyncError,
    userSpreadsheets,
    authenticateGoogle,
    disconnectGoogle,
    connectSpreadsheet,
    disconnectSpreadsheet,
    pullFromGoogleSheet,
    pushToGoogleSheet,
    createAndConnectNewSpreadsheet,
    toggleAutoSync,

    // Supabase integration properties
    isSupabaseEnabled,
    setIsSupabaseEnabled,
    pullFromSupabase,
    pushToSupabase,
  };
}
