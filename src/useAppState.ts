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
import { recalculateBadgesForMonth, normalizeDoctorName } from "./badgeEngine";
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
  uploadUserFileToSupabase,
  saveBadgeAwardToSupabase,
  deleteBadgeAwardFromSupabase,
  fetchBadgeAwardsFromSupabase,
  BadgeAwardRow,
  fetchShiftDeclarationsFromSupabase,
  ShiftDeclarationRow,
  verifyLogin,
  claimSlotAtomically,
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

// Badge bookkeeping — single source of truth used by every award path
// (manual injection, automated scanners, shift close-out) so historical
// month tags never get clobbered by a later scan/award.
//
// Storage format: "BadgeName (MM/YYYY):count, OtherBadge (MM/YYYY):count"
// Each badge+month combination is its own independent counter.

function addBadgeAward(
  existingBadges: string,
  badgeName: string,
  monthTag: string, // e.g. "06/2026"
): string {
  const fullKey = `${badgeName} (${monthTag})`;
  const badgeMap: { [key: string]: number } = {};

  if (existingBadges) {
    existingBadges.split(",").forEach((item) => {
      const trimmed = item.trim();
      if (!trimmed) return;
      const lastColon = trimmed.lastIndexOf(":");
      if (lastColon === -1) return;
      const key = trimmed.substring(0, lastColon).trim();
      const count = parseInt(trimmed.substring(lastColon + 1).trim()) || 0;
      if (key) badgeMap[key] = count;
    });
  }

  badgeMap[fullKey] = (badgeMap[fullKey] || 0) + 1;

  return Object.keys(badgeMap)
    .map((k) => `${k}:${badgeMap[k]}`)
    .join(", ");
}

function hasBadgeForMonth(
  existingBadges: string,
  badgeName: string,
  monthTag: string,
): boolean {
  return (existingBadges || "").includes(`${badgeName} (${monthTag})`);
}

function getBadgeCountForMonth(
  existingBadges: string,
  badgeName: string,
  monthTag: string,
): number {
  const fullKey = `${badgeName} (${monthTag})`;
  if (!existingBadges) return 0;
  const match = existingBadges
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${fullKey}:`));
  if (!match) return 0;
  return parseInt(match.substring(match.lastIndexOf(":") + 1).trim()) || 0;
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

  // Which Heart Winner review IDs ("HW-<supabase-row-id>") are already
  // recorded in badge_awards. Used to grey out/skip reviews in the Reviews
  // Scanner so the same review can't be gifted twice. Deliberately NOT
  // based on users.locks — that column doesn't exist in the live Supabase
  // schema, so it never actually persisted across sessions.
  const [heartWinnerAwardedIds, setHeartWinnerAwardedIds] = useState<Set<string>>(
    new Set(),
  );

  const [allBadgeAwards, setAllBadgeAwards] = useState<BadgeAwardRow[]>([]);
  const [shiftDeclarations, setShiftDeclarations] = useState<ShiftDeclarationRow[]>([]);

  const refreshShiftDeclarations = async () => {
    try {
      const rows = await fetchShiftDeclarationsFromSupabase();
      setShiftDeclarations(rows);
    } catch (err) {
      console.error("refreshShiftDeclarations failed:", err);
    }
  };

  const refreshHeartWinnerAwardedIds = async () => {
    try {
      const rows = await fetchBadgeAwardsFromSupabase();
      setAllBadgeAwards(rows);
      const ids = new Set<string>();
      rows
        .filter((r) => r.badge_name === "Heart Winner" && r.slot_ids)
        .forEach((r) => {
          r.slot_ids!.split(",").forEach((id) => {
            const trimmed = id.trim();
            if (trimmed) ids.add(trimmed);
          });
        });
      setHeartWinnerAwardedIds(ids);
    } catch (err) {
      console.error("refreshHeartWinnerAwardedIds failed:", err);
    }
  };

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

      refreshHeartWinnerAwardedIds();
      refreshShiftDeclarations();

      // nonEmpty: treat an empty array the same as null/undefined — i.e.
      // "no valid new data, keep what we had". Also guards against a fetch
      // that came back NON-empty but suspiciously SMALLER than what we
      // already have locally — e.g. a flaky/partial read during Supabase's
      // own ongoing incident (per the dashboard status banner) that
      // returns real data but misses some rows. Without this, an admin
      // could see a doctor correctly in a dropdown (from a good earlier
      // fetch), then have a background poll silently swap in an
      // incomplete list moments later, causing a genuine "User not found"
      // on submit even though the doctor was right there on screen.
      const nonEmpty = <T,>(arr: T[] | null | undefined, fallback: T[]): T[] => {
        if (!arr || arr.length === 0) return fallback;
        if (arr.length < fallback.length) return fallback;
        return arr;
      };

      setState((prev) => {
        return {
          users: nonEmpty(sbUsers, prev.users),
          slots: nonEmpty(sbSlots, prev.slots),
          announcements: nonEmpty(sbAnnouncements, prev.announcements),
          feedbacksPatient: nonEmpty(sbFbP, prev.feedbacksPatient),
          feedbacksStaff: nonEmpty(sbFbS, prev.feedbacksStaff),
          feedbacksLocum: nonEmpty(sbFbL, prev.feedbacksLocum),
          newApplications: nonEmpty(sbApps, prev.newApplications),
          activityLogs: nonEmpty(sbLogs, prev.activityLogs),
          notifications: nonEmpty(sbNotifs, prev.notifications),
          adminAlerts: nonEmpty(sbAlerts, prev.adminAlerts),
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
      // Must actually await this — previously it fired the save without
      // waiting, so callers (like giftHeartWinnerReview) would think the
      // write was done while it was still in flight. That created a race:
      // clicking "Recalculate Badges" soon after a manual award could
      // fetch fresh users BEFORE the award's write had landed, silently
      // reverting it when recalculateBadges saved its own (stale) copy
      // back over it.
      await saveUserToSupabase(user).catch((err) =>
        console.error("Supabase saveUser failed:", err),
      );
    }
  };

  const cloudSaveUsersBulk = async (usersToSave: UserProfile[]) => {
    if (isSupabaseEnabled && isSupabaseActive()) {
      // Must actually await each save — previously this fired all saves
      // without waiting, so callers like recalculateBadges() would think
      // they were done while writes were still in flight. That created a
      // race with the 10-second background poll: if the poll fired before
      // these saves landed, it would pull back stale data (missing the
      // newly-added badge locks), making the same badges look "not yet
      // awarded" and get double-counted on the next recalculation run.
      await Promise.all(
        usersToSave.map((u) =>
          saveUserToSupabase(u).catch((err) =>
            console.error("Supabase saveUser bulk failed:", err),
          ),
        ),
      );
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
    }, 45000); // 45 seconds — was 10s; the tighter interval was pushing the
    // Supabase project over its free-tier 5GB/month egress quota (109%
    // used), which is a plausible contributor to the intermittent fetch
    // failures/phantom-data issues debugged earlier. 45s is still frequent
    // enough for near-real-time booking approvals while cutting egress
    // volume by roughly 4-5x.

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

  const loginUser = async (
    phone: string,
    passwordInput?: string,
    role?: string,
  ): Promise<{ success: boolean; message: string; user: UserProfile | null }> => {
    // The password check now happens entirely server-side (verify_login
    // RPC) — the actual stored password is never fetched to the browser,
    // whether login succeeds or fails. This replaces the old
    // state.users.find(...) + client-side password comparison.
    if (passwordInput !== undefined) {
      const res = await verifyLogin(phone, passwordInput);
      if (!res.success || !res.user) {
        return {
          success: false,
          message: res.message || "Invalid Password!",
          user: null,
        };
      }
      const rawUser = res.user;
      const user: UserProfile = {
        phone: String(rawUser.phone || "").trim(),
        password: "",
        name: rawUser.name || rawUser.nama || "",
        role: (rawUser.role || "Doctor") as any,
        email: rawUser.email || "",
        mmc: rawUser.mmc || "",
        apc: rawUser.apc || "",
        indemnity: rawUser.indemnity || "Tiada",
        workplace: rawUser.workplace || "",
        points: Number(rawUser.points || 0),
        badges: typeof rawUser.badges === "string" ? rawUser.badges : "",
        locks: typeof rawUser.locks === "string" ? rawUser.locks : "",
      };
      if (role && user.role !== role) {
        return {
          success: false,
          message: `Access denied. Selected account is a ${user.role}.`,
          user: null,
        };
      }
      setState((prev) => ({ ...prev, currentUser: user }));
      logActivity(`Logged in: ${user.name} (${user.role})`);
      return { success: true, message: "Login successful", user };
    }

    // No password provided — this path is used for role-restore /
    // session-continuation checks against already-loaded state.users
    // (which never carries a password value now anyway), not a fresh
    // credential check.
    const user = state.users.find((u) => u.phone.trim() === phone.trim());
    if (user) {
      if (role && user.role !== role) {
        return {
          success: false,
          message: `Access denied. Selected account is a ${user.role}.`,
          user: null,
        };
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

  const adminCreateUser = async (
    name: string,
    phone: string,
    initialPassword: string,
    role: "Doctor" | "Admin" | "Staff",
    email: string = "",
  ): Promise<{ success: boolean; message: string }> => {
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

    try {
      await cloudSaveUser(newUser);
    } catch (err: any) {
      console.error("Cloud adminCreateUser failed:", err);
      return {
        success: false,
        message: `Failed to save to database: ${err?.message || "Unknown error"}`,
      };
    }

    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
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

  const deleteUser = async (phone: string): Promise<string> => {
    let result: { success: boolean; error?: string };
    try {
      result = await deleteUserFromSupabase(phone);
    } catch (err: any) {
      console.error("Cloud deleteUser failed:", err);
      return "⚠️ Failed to delete from database — please check your connection and try again.";
    }

    if (!result.success) {
      console.error("deleteUser failed:", result.error);
      return `⚠️ Delete failed: ${result.error || "Unknown error"}`;
    }

    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.phone !== phone),
      currentUser: prev.currentUser?.phone === phone ? null : prev.currentUser,
    }));
    logActivity(`Deleted user profile: ${phone}`);
    return "success";
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
    // Google Drive's service-account upload path hit a hard wall (service
    // accounts have zero storage quota, and this Drive isn't a Shared
    // Drive), so new uploads go to Supabase Storage instead. Viewing files
    // that already exist in the shared Drive folder is unaffected.
    return uploadUserFileToSupabase(file, phone, kind);
  };

  const bookSlot = async (
    slotId: string,
    doctorName: string,
    doctorPhone: string,
  ): Promise<string> => {
    // Check local state first purely for a fast, friendly early exit (no
    // point trying to claim a slot that's obviously already gone from
    // this doctor's own point of view) — but this check is NOT what
    // actually prevents double-booking; the atomic claim below is.
    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return "Error: Slot not found.";
    if (slot.status !== "Available") return "Slot is no longer available.";

    const bookedAt = new Date().toLocaleString("en-GB");

    // The real fix: atomically claim the slot in Supabase first — this
    // only succeeds if the slot is STILL "Available" at the exact moment
    // this write reaches the database, closing the race where two
    // doctors both saw it as Available from their own (possibly
    // slightly-stale) local state and both clicked Book within moments
    // of each other. Whoever's claim reaches the database first wins;
    // the second cleanly fails instead of silently overwriting the first.
    if (isSupabaseEnabled && isSupabaseActive()) {
      const claimResult = await claimSlotAtomically(
        slotId,
        doctorName,
        doctorPhone,
        bookedAt,
      );
      if (!claimResult.claimed) {
        // Someone else claimed it first — refresh local state so this
        // doctor immediately sees the slot is really gone, rather than
        // it lingering as "Available" in their view until the next poll.
        pullFromSupabase();
        return "Sorry, this slot was just booked by another doctor. Please choose a different slot.";
      }
    }

    const updatedSlots = state.slots.map((s) => {
      if (s.id === slotId) {
        return {
          ...s,
          status: "Pending",
          dr: doctorName,
          phone: doctorPhone,
          bookedAt,
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
      bookedAt,
    };

    if (googleToken && connectedSpreadsheetId && isAutoSyncEnabled) {
      await saveAllDataToGoogleSheet(googleToken, connectedSpreadsheetId, {
        ...state,
        slots: updatedSlots,
      }).catch((err) => console.error("Google Sheets book sync failed:", err));
    }

    logActivity(
      `Doctor ${doctorName} applied for slot: ${slotId} (${slot.tarikh} ${slot.masa})`,
    );
    return "Application successfully submitted!";
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

    // admin_alerts gets deleted once an admin dismisses it, so it's not a
    // durable record — log here too so badge recalculation (The Unstoppable)
    // can still detect this cancellation in future months.
    logActivity(
      `DOCTOR: SELF-CANCEL - Slot ID ${slotId} (Dr: ${slot.dr}) on ${slot.tarikh}`,
    );

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
    // Deliberately NOT logged via logActivity — this fires every single
    // time a doctor opens their notifications, which flooded activity_logs
    // with thousands of noise entries for no benefit (nothing reads this
    // for badges or auditing, unlike ADMIN: CANCEL & RESET / DOCTOR:
    // SELF-CANCEL, which badgeEngine.ts actually depends on).
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
    // Refresh from Supabase first — acting on a possibly-stale in-memory
    // state.slots snapshot was causing genuine pending bookings to
    // incorrectly report as gone/not-found, only for them to reappear
    // after a page reload (which does a truly fresh fetch) once the
    // in-memory state eventually caught back up.
    let baseSlots = state.slots;
    try {
      const freshSlots = await fetchSlotsFromSupabase();
      if (freshSlots && freshSlots.length > 0) baseSlots = freshSlots;
    } catch (err) {
      console.error("adminApproveSlot: fresh fetch failed, using in-memory state", err);
    }

    let docName = "";
    let branchName = "";
    let dateStr = "";
    let scheduleStr = "";

    const updatedSlots = baseSlots.map((s) => {
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
    if (!slot) return "Error: Slot not found.";
    await cloudSaveSlot(slot).catch((err) =>
      console.error("Cloud adminApproveSlot failed:", err),
    );
    // Trigger local application notification
    triggerApprovalNotification(slot);

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
    // Same fresh-fetch guard as adminApproveSlot — see comment there.
    let baseSlots = state.slots;
    try {
      const freshSlots = await fetchSlotsFromSupabase();
      if (freshSlots && freshSlots.length > 0) baseSlots = freshSlots;
    } catch (err) {
      console.error("adminManageSlot: fresh fetch failed, using in-memory state", err);
    }
    const slot = baseSlots.find((s) => s.id === id);
    if (!slot) return "Error: Slot not found.";
    const drAsal = slot.dr || "Unknown";
    const branch = slot.cawangan;

    if (action === "DELETE") {
      const updatedSlots = baseSlots.filter((s) => s.id !== id);
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
      const updatedSlots = baseSlots.map((s) => {
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
        const updatedSlots = baseSlots.map((s) => {
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

  // Logs a CME/Briefing session for MULTIPLE doctors at once. The existing
  // slot system is fundamentally "one slot = one doctor" (LocumSlot.dr is a
  // single string), so there's no way to have one slot represent a whole
  // room of attendees. This works around that by creating one Approved
  // slot per selected doctor — same date/time/branch, different dr — which
  // is exactly what The Diligent Doc's detection in badgeEngine.ts looks
  // for (any Approved slot that month whose branch contains "CME" or
  // "BRIEFING"). No new detection logic needed on the badge side; this
  // just makes it possible to log attendance for many doctors in one go
  // instead of creating slots one at a time.
  const adminLogCMEAttendance = (
    doctorPhones: string[],
    date: string, // "YYYY-MM-DD" from a date input
    time: string,
    sessionType: "CME" | "Briefing",
  ): string => {
    if (doctorPhones.length === 0) {
      return "❌ Select at least one doctor.";
    }
    const parts = date.split("-");
    const formattedDate =
      parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
    const now = Date.now();

    const attendees = doctorPhones
      .map((phone) => state.users.find((u) => normalizePhone(u.phone) === normalizePhone(phone)))
      .filter((u): u is UserProfile => !!u);

    if (attendees.length === 0) {
      return "❌ Could not match any selected doctor to a user record.";
    }

    const newSlots: LocumSlot[] = attendees.map((doc, index) => ({
      id: `SLOT${now + index}CME`,
      tarikh: formattedDate,
      masa: time,
      cawangan: sessionType, // "CME" or "Briefing" — matches badgeEngine.ts's .includes() check
      status: "Approved",
      dr: doc.name,
      phone: doc.phone,
      gaji: 0, // CME/Briefing attendance, not a paid clinical shift
    }));

    setState((prev) => ({
      ...prev,
      slots: [...prev.slots, ...newSlots],
    }));

    cloudSaveSlotsBulk(newSlots).catch((err) =>
      console.error("Cloud adminLogCMEAttendance failed:", err),
    );

    logActivity(
      `ADMIN: Logged ${sessionType} attendance on ${formattedDate} for: ${attendees.map((a) => a.name).join(", ")}`,
    );

    return `✅ Logged ${sessionType} attendance for ${attendees.length} doctor(s): ${attendees.map((a) => a.name).join(", ")}. Run "Recalculate Badges" for this month to award The Diligent Doc.`;
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

  // One-time migration: reads every doctor's existing "badges" text column
  // and populates the new badge_awards table from it. Safe to run more than
  // once — upserts by (doctor, badge, month), so re-running just re-confirms
  // the same counts rather than duplicating rows.
  // Reverse direction of migrateHistoricalBadgesToSupabase — reads the
  // badge_awards table (the source of truth after a reset/cleanup) and
  // REBUILDS each doctor's users.badges string + users.points to match it
  // exactly, rather than just adding on top. Useful after a manual reset or
  // any time the two tables have drifted out of sync with each other.
  const POINTS_PER_BADGE: { [badge: string]: number } = {
    "Iron Doctor": 10,
    "Heart Winner": 15,
    "The Unstoppable": 10,
    "The Diligent Doc": 10,
    "Last Minute Saviour": 20,
    "Team Favorite": 20, // admin-set historically — 20 is a best-effort default
  };

  const reconcilePointsFromBadgeAwards = async (): Promise<string> => {
    let awardRows: BadgeAwardRow[] = [];
    try {
      awardRows = await fetchBadgeAwardsFromSupabase();
    } catch (err: any) {
      return `⚠️ Failed to read badge_awards: ${err?.message || "Unknown error"}`;
    }

    if (awardRows.length === 0) {
      return "ℹ️ badge_awards table is empty — nothing to reconcile.";
    }

    // Group rows by doctor phone
    const byPhone = new Map<string, BadgeAwardRow[]>();
    awardRows.forEach((row) => {
      const phone = row.doctor_phone;
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone)!.push(row);
    });

    const updatedDocList: UserProfile[] = [];
    const summaryLines: string[] = [];

    byPhone.forEach((rows, phone) => {
      const existingUser = state.users.find(
        (u) => normalizePhone(u.phone) === normalizePhone(phone),
      );
      if (!existingUser) return; // badge_awards row references a doctor no longer in users

      const badgesParts: string[] = [];
      let totalPoints = 0;
      rows.forEach((row) => {
        badgesParts.push(`${row.badge_name} (${row.month_tag}):${row.award_count}`);
        const perBadgePoints = POINTS_PER_BADGE[row.badge_name] ?? 10;
        totalPoints += perBadgePoints * row.award_count;
      });

      const newBadgesString = badgesParts.join(", ");
      if (existingUser.badges === newBadgesString && existingUser.points === totalPoints) {
        return; // already in sync, skip
      }

      updatedDocList.push({
        ...existingUser,
        badges: newBadgesString,
        points: totalPoints,
      });
      summaryLines.push(
        `${existingUser.name}: badges & points rebuilt from badge_awards (points = ${totalPoints})`,
      );
    });

    if (updatedDocList.length === 0) {
      return "✅ Everything already matches badge_awards — nothing to update.";
    }

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        const match = updatedDocList.find((d) => d.phone === u.phone);
        return match || u;
      });
      const currentUpdated =
        updatedUsers.find((u) => u.phone === prev.currentUser?.phone) ||
        prev.currentUser;
      return { ...prev, users: updatedUsers, currentUser: currentUpdated };
    });

    await cloudSaveUsersBulk(updatedDocList).catch((err) =>
      console.error("Cloud reconcilePointsFromBadgeAwards failed:", err),
    );

    logActivity(
      `Reconciled users.points/badges from badge_awards for ${updatedDocList.length} doctor(s).`,
    );
    return `✅ Reconciled ${updatedDocList.length} doctor(s):\n\n${summaryLines.join("\n")}`;
  };

  const migrateHistoricalBadgesToSupabase = async (): Promise<string> => {
    let migratedCount = 0;
    let doctorCount = 0;

    for (const u of state.users) {
      if (!u.badges) continue;
      const entries = u.badges
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (entries.length === 0) continue;
      doctorCount++;

      for (const entry of entries) {
        const lastColon = entry.lastIndexOf(":");
        if (lastColon === -1) continue;
        const keyPart = entry.substring(0, lastColon).trim();
        const count = parseInt(entry.substring(lastColon + 1).trim()) || 0;
        if (count <= 0) continue;

        const monthMatch = keyPart.match(/\((\d{2}\/\d{4})\)\s*$/);
        if (!monthMatch) continue; // skip badges with no month tag (can't file them anywhere meaningful)
        const monthTag = monthMatch[1];
        const badgeName = keyPart.replace(/\s*\(\d{2}\/\d{4}\)\s*$/, "").trim();

        const result = await saveBadgeAwardToSupabase(
          u.phone,
          u.name,
          badgeName,
          monthTag,
          count,
        );
        if (result.success) migratedCount++;
      }
    }

    logActivity(
      `Migrated historical badges to badge_awards table: ${migratedCount} rows across ${doctorCount} doctors.`,
    );
    return `✅ Migration complete! ${migratedCount} badge/month entries synced across ${doctorCount} doctors.`;
  };

  // Compares the LAST 9 digits only (not the raw string) — this survives
  // the most common real-world phone formatting mismatches seen in this
  // data: a leading "0" silently dropped (e.g. by a spreadsheet treating
  // the column as a number), or a "60"/"+60" country-code prefix present
  // on one side but not the other. "0103728506", "103728506", and
  // "60103728506" all normalize to the same "103728506" and correctly
  // match each other.
  const normalizePhone = (p: string) => (p || "").replace(/[^0-9]/g, "").slice(-9);

  const adminGivePoints = (
    phone: string,
    pointsToAdd: number,
    awardName: string,
    monthTag?: string, // "MM/YYYY" — defaults to current month if not given
  ): string => {
    const targetPhone = normalizePhone(phone);
    // awardName may already carry "(MM/YYYY)" (e.g. from the Heart Winner
    // review scanner) — extract it if present, otherwise fall back to the
    // explicit monthTag param, then to the current month.
    const embeddedMonth = awardName.match(/\((\d{2}\/\d{4})\)/);
    const now = new Date();
    const resolvedMonthTag =
      (embeddedMonth ? embeddedMonth[1] : undefined) ||
      monthTag ||
      `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    const cleanBadgeName = awardName
      .split(" [")[0]
      .replace(/\s*\(\d{2}\/\d{4}\)\s*$/, "")
      .trim();
    const rowTag = awardName.match(/\[[^\]]+\]/)
      ? awardName.match(/\[[^\]]+\]/)![0]
      : "";

    // ONE lookup, used consistently for the result message, the local
    // state update, AND the cloud save below. Previously this function
    // searched twice — once inside setState's updater (against `prev`)
    // to decide the returned message, and again separately (against the
    // outer `state` closure) to decide whether to actually save to
    // Supabase. Those two lookups could disagree if a background poll
    // swapped `prev.users` for something slightly different between
    // renders, producing exactly the confusing "shows an error, but the
    // row appears in Supabase anyway" behavior seen in testing — the save
    // used the (correct) outer `state`, while the message used the
    // (sometimes stale) `prev`. A single lookup makes that impossible.
    const user = state.users.find((u) => normalizePhone(u.phone) === targetPhone);
    if (!user) {
      return `Error: User not found (searched for phone "${phone}").`;
    }

    const currentLocks = user.locks || "";
    if (rowTag && currentLocks.indexOf(rowTag) !== -1) {
      return "🔒 This review has already been rewarded to Dr. " + user.name;
    }

    const updatedBadges = addBadgeAward(user.badges, cleanBadgeName, resolvedMonthTag);
    const updatedLocks = rowTag ? currentLocks + `[${rowTag}]` : currentLocks;
    const updatedUser = {
      ...user,
      points: (user.points || 0) + pointsToAdd,
      badges: updatedBadges,
      locks: updatedLocks,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        normalizePhone(u.phone) === targetPhone ? updatedUser : u,
      ),
      currentUser:
        normalizePhone(prev.currentUser?.phone || "") === targetPhone
          ? updatedUser
          : prev.currentUser,
    }));

    cloudSaveUser(updatedUser).catch((err) =>
      console.error("Cloud adminGivePoints failed:", err),
    );
    saveBadgeAwardToSupabase(
      user.phone,
      user.name,
      cleanBadgeName,
      resolvedMonthTag,
      getBadgeCountForMonth(updatedBadges, cleanBadgeName, resolvedMonthTag),
    ).catch((err) => console.error("saveBadgeAwardToSupabase failed:", err));

    logActivity(
      `ADMIN AWARD: Given ${cleanBadgeName} (${resolvedMonthTag}) (${pointsToAdd} pts) to user ${phone}`,
    );
    return `✅ Success! Awarded ${pointsToAdd} Aracoins. ${cleanBadgeName} (${resolvedMonthTag}) recorded for Dr. ${user.name}.`;
  };

  // Dedicated Heart Winner gifting flow — separate from adminGivePoints
  // because Heart Winner needs its slot_ids (the "HW-<id>" review tag)
  // properly MERGED into any existing badge_awards row for that doctor +
  // month, not overwritten. adminGivePoints never passed slotIds at all,
  // so the review's HW-id never actually reached badge_awards — meaning
  // the "already gifted" check could never see it, and the same review
  // kept reappearing in the Reviews Scanner list no matter how many times
  // it was gifted.
  const giftHeartWinnerReview = async (
    phone: string,
    badgeId: string, // "Heart Winner (MM/YYYY) [HW-<id>]"
  ): Promise<string> => {
    const targetPhone = normalizePhone(phone);
    const user = state.users.find((u) => normalizePhone(u.phone) === targetPhone);
    if (!user) return `Error: User not found (searched for phone "${phone}").`;

    const embeddedMonth = badgeId.match(/\((\d{2}\/\d{4})\)/);
    const monthTag =
      embeddedMonth?.[1] ||
      `${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()}`;
    const rowMatch = badgeId.match(/\[([^\]]+)\]/);
    const rowId = rowMatch ? rowMatch[1] : ""; // "HW-<id>", no brackets

    if (!rowId) return "Error: Could not identify this review's row ID.";

    // Pull the current badge_awards row (if any) for this doctor+month so
    // we can merge rather than overwrite — a doctor can get more than one
    // Heart Winner-qualifying review in the same month.
    let existingSlotIds: string[] = [];
    let existingCount = 0;
    try {
      const rows = await fetchBadgeAwardsFromSupabase();
      const existing = rows.find(
        (r) =>
          normalizePhone(r.doctor_phone) === targetPhone &&
          r.badge_name === "Heart Winner" &&
          r.month_tag === monthTag,
      );
      if (existing) {
        existingSlotIds = (existing.slot_ids || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        existingCount = existing.award_count || 0;
      }
    } catch (err) {
      console.error("giftHeartWinnerReview: failed to read existing badge_awards row", err);
    }

    if (existingSlotIds.includes(rowId)) {
      return `🔒 This review has already been rewarded to Dr. ${user.name}.`;
    }

    const mergedSlotIds = [...existingSlotIds, rowId];
    const newCount = Math.max(existingCount, 0) + 1;

    const updatedBadges = addBadgeAward(user.badges, "Heart Winner", monthTag);
    const updatedUser = { ...user, points: (user.points || 0) + 15, badges: updatedBadges };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.phone === user.phone ? updatedUser : u)),
      currentUser:
        prev.currentUser?.phone === user.phone ? updatedUser : prev.currentUser,
    }));
    localStorage.setItem(
      "ara_users",
      JSON.stringify(state.users.map((u) => (u.phone === user.phone ? updatedUser : u))),
    );

    await cloudSaveUser(updatedUser).catch((err) =>
      console.error("giftHeartWinnerReview: cloudSaveUser failed", err),
    );
    await saveBadgeAwardToSupabase(
      user.phone,
      user.name,
      "Heart Winner",
      monthTag,
      newCount,
      mergedSlotIds,
    ).catch((err) => console.error("giftHeartWinnerReview: saveBadgeAwardToSupabase failed", err));

    await refreshHeartWinnerAwardedIds();

    logActivity(`ADMIN AWARD: Given Heart Winner (${monthTag}) (15 pts) to Dr. ${user.name}`);
    return `✅ Success! Awarded 15 AraCoins. Heart Winner (${monthTag}) recorded for Dr. ${user.name}.`;
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
    let badgesAwardedRef: string[] = [];

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
      badgesAwardedRef = badgesToUpdate;
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

      // Logic for Last Minute Saviour — booked within 25 hours of shift start
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
          if (diffInHours > 0 && diffInHours < 25) {
            badgesToUpdate.push("Last Minute Saviour");
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

          let updatedBadges = u.badges || "";
          badgesToUpdate.forEach((badge) => {
            updatedBadges = addBadgeAward(updatedBadges, badge, period);
          });

          const totalPointsAwarded = badgesToUpdate.length * 10;
          const updatedLocks = locksStr + slotLockId;

          resultText = `✅ Shift Completed! Doctor ${u.name} awarded ${totalPointsAwarded} Aracoins for: ${badgesToUpdate.join(", ")}`;

          return {
            ...u,
            points: (u.points || 0) + totalPointsAwarded,
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
      badgesAwardedRef.forEach((badge) => {
        saveBadgeAwardToSupabase(
          userToSave.phone,
          userToSave.name,
          badge,
          period,
          getBadgeCountForMonth(userToSave.badges, badge, period),
        ).catch((err) => console.error("saveBadgeAwardToSupabase failed:", err));
      });
    }

    return resultText;
  };

  // Recalculates all 6 AraCoins badges for a given month (Team Favorite,
  // Heart Winner, The Unstoppable, Iron Doctor, The Diligent Doc, Last
  // Minute Savior) and applies them to every qualifying doctor. Can be run
  // for any past month too, not just the current one — see badgeEngine.ts
  // for the full rules and a note on data limitations for older months.
  const recalculateBadges = async (
    month: string,
    year: string,
    manualFeedback: FeedbackRecord[],
  ): Promise<string> => {
    let freshUsers = state.users;
    let freshSlots = state.slots;
    let freshActivityLogs = state.activityLogs;
    let freshAdminAlerts: AdminAlert[] = [];
    try {
      // Pull directly from Supabase rather than trusting React state here —
      // this is what actually fixes "clicking the same month twice still
      // adds points": if state.users was even slightly stale (a missed
      // re-render, a lagging background poll, anything), the "already
      // awarded this month" checks below would silently miss the doctor's
      // real current locks/badges and re-credit them.
      const [usersResult, slotsResult, logsResult, alertsResult] = await Promise.all([
        fetchUsersFromSupabase(),
        fetchSlotsFromSupabase(),
        fetchActivityLogsFromSupabase(),
        fetchAdminAlertsFromSupabase(),
      ]);
      if (usersResult && usersResult.length >= freshUsers.length) freshUsers = usersResult;
      if (slotsResult && slotsResult.length >= freshSlots.length) freshSlots = slotsResult;
      if (logsResult && logsResult.length >= freshActivityLogs.length) freshActivityLogs = logsResult;
      if (alertsResult && alertsResult.length > 0) freshAdminAlerts = alertsResult;
    } catch (err) {
      console.error("recalculateBadges: failed to fetch fresh data", err);
    }

    const { updatedUsers, summaryLines, badgeAwardDetails, badgeRevocations } = recalculateBadgesForMonth(
      freshUsers,
      freshSlots,
      freshActivityLogs,
      freshAdminAlerts,
      manualFeedback,
      month,
      year,
    );

    if (summaryLines.length === 0) {
      return "No doctors qualified for any badge this month.";
    }

    setState((prev) => ({
      ...prev,
      users: updatedUsers,
      currentUser:
        updatedUsers.find((u) => u.phone === prev.currentUser?.phone) ||
        prev.currentUser,
    }));
    localStorage.setItem("ara_users", JSON.stringify(updatedUsers));

    await cloudSaveUsersBulk(updatedUsers).catch((err) =>
      console.error("Cloud recalculateBadges saveUsers failed:", err),
    );

    await Promise.all(
      badgeAwardDetails.map((detail) =>
        saveBadgeAwardToSupabase(
          detail.phone,
          detail.name,
          detail.badgeName,
          detail.monthTag,
          detail.totalCount,
          detail.slotIds,
        ).catch((err) => console.error("saveBadgeAwardToSupabase failed:", err)),
      ),
    );

    // Delete any revoked awards (currently just "The Unstoppable" when a
    // cancellation is found after it was already given) before reconciling
    // points, so the SUM in reconcilePointsFromBadgeAwards doesn't still
    // include a badge that no longer qualifies.
    await Promise.all(
      badgeRevocations.map((rev) =>
        deleteBadgeAwardFromSupabase(rev.phone, rev.badgeName, rev.monthTag).catch((err) =>
          console.error("deleteBadgeAwardFromSupabase failed:", err),
        ),
      ),
    );

    // Points are derived fresh from badge_awards here — NOT accumulated
    // from the old u.points value — so clicking Recalculate Badges more
    // than once for the same month (or two tabs racing each other) always
    // converges on the same correct total instead of stacking on top of
    // the previous run's result. This is the fix for the
    // "690 -> 850 after two clicks" bug.
    try {
      await reconcilePointsFromBadgeAwards();
    } catch (err) {
      console.error("recalculateBadges: reconcilePointsFromBadgeAwards failed", err);
    }

    logActivity(`Recalculated AraCoins badges for ${month}/${year}`);
    return `✅ Badges recalculated!\n\n${summaryLines.join("\n")}`;
  };

  // Iron Doctor — auto-detects shifts of 12+ hours (or specific back-to-back
  // time patterns) once the shift's end time has passed, without needing the
  // Clinical Performance Close-Out form to be filled in first.
  const processIronDoctorScan = async (): Promise<string> => {
    const now = new Date();
    const parseSlotEnd = (tarikh: string, masa: string): Date | null => {
      const dParts = tarikh.split("/");
      if (dParts.length !== 3) return null;
      const [d, m, y] = dParts.map((p) => parseInt(p, 10));
      // masa is typically like "8am-8pm" or "8pm-8am" (overnight) — take the
      // end time; if end time is numerically <= start (overnight), roll to
      // next day for an accurate "has this shift ended yet" check.
      const timeMatch = masa.match(/(\d{1,2})\s*(am|pm)?\s*-\s*(\d{1,2})\s*(am|pm)?/i);
      if (!timeMatch) return new Date(y, m - 1, d, 23, 59);
      let endHour = parseInt(timeMatch[3], 10);
      const endMeridiem = (timeMatch[4] || timeMatch[2] || "").toLowerCase();
      if (endMeridiem === "pm" && endHour !== 12) endHour += 12;
      if (endMeridiem === "am" && endHour === 12) endHour = 0;
      let startHour = parseInt(timeMatch[1], 10);
      const startMeridiem = (timeMatch[2] || "").toLowerCase();
      if (startMeridiem === "pm" && startHour !== 12) startHour += 12;
      if (startMeridiem === "am" && startHour === 12) startHour = 0;
      const overnight = endHour <= startHour;
      const endDate = new Date(y, m - 1, d, endHour);
      if (overnight) endDate.setDate(endDate.getDate() + 1);
      return endDate;
    };

    const qualifyingSlots = state.slots.filter((s) => {
      if (s.status !== "Approved" || !s.dr) return false;
      const endTime = parseSlotEnd(s.tarikh, s.masa);
      if (!endTime || endTime > now) return false; // shift hasn't ended yet

      const numbersOnly = s.masa.toLowerCase().replace(/[^0-9]/g, "");
      const isLongShift =
        /8.*8|9.*9|10.*10|11.*11|12.*12/.test(numbersOnly) ||
        s.masa.toLowerCase().includes("12h") ||
        s.masa.toLowerCase().includes("12jam") ||
        s.masa.toLowerCase().includes("12-hour") ||
        s.masa.toLowerCase().includes("12 hour");
      return isLongShift;
    });

    if (qualifyingSlots.length === 0) {
      return "❌ No completed 12-hour+ shifts found to award.";
    }

    const awardedList: string[] = [];
    const updatedDocList: UserProfile[] = [];
    const badgeSyncQueue: { phone: string; name: string; monthTag: string }[] = [];

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        const uNameNorm = u.name.toUpperCase().trim().replace(/^(DR|dr)\.?\s+/i, "");
        const mySlots = qualifyingSlots.filter((s) => {
          const drNorm = (s.dr || "").toUpperCase().trim().replace(/^(DR|dr)\.?\s+/i, "");
          return drNorm === uNameNorm;
        });
        if (mySlots.length === 0) return u;

        let points = u.points || 0;
        let badges = u.badges || "";
        let locks = u.locks || "";
        let didAward = false;
        const monthsTouched = new Set<string>();

        mySlots.forEach((s) => {
          const lockId = `[IRON-${s.id}]`;
          if (locks.includes(lockId)) return; // already awarded for this slot
          const parts = s.tarikh.split("/");
          const monthTag = parts.length === 3 ? `${parts[1].padStart(2, "0")}/${parts[2]}` : "";
          badges = addBadgeAward(badges, "Iron Doctor", monthTag);
          points += 10;
          locks += lockId;
          didAward = true;
          monthsTouched.add(monthTag);
        });

        monthsTouched.forEach((monthTag) => {
          badgeSyncQueue.push({ phone: u.phone, name: u.name, monthTag });
        });

        if (didAward) {
          awardedList.push(u.name);
          const updated = { ...u, points, badges, locks };
          updatedDocList.push(updated);
          return updated;
        }
        return u;
      });

      const currentUpdated =
        updatedUsers.find((u) => u.phone === prev.currentUser?.phone) ||
        prev.currentUser;

      return { ...prev, users: updatedUsers, currentUser: currentUpdated };
    });

    if (updatedDocList.length > 0) {
      await cloudSaveUsersBulk(updatedDocList).catch((err) =>
        console.error("Cloud processIronDoctorScan failed:", err),
      );
      await Promise.all(
        badgeSyncQueue.map(({ phone, name, monthTag }) => {
          const finalUser = updatedDocList.find((u) => u.phone === phone);
          if (!finalUser) return Promise.resolve();
          return saveBadgeAwardToSupabase(
            phone,
            name,
            "Iron Doctor",
            monthTag,
            getBadgeCountForMonth(finalUser.badges, "Iron Doctor", monthTag),
          ).catch((err) => console.error("saveBadgeAwardToSupabase failed:", err));
        }),
      );
      logActivity(`Iron Doctor scan ran. Awarded: ${awardedList.join(", ")}`);
      return `✅ SUCCESS! Awarded "Iron Doctor" to: ${awardedList.join(", ")}`;
    }
    return "ℹ️ All qualifying shifts have already been awarded — nothing new to give.";
  };

  const processMonthlyUnstoppable = async (
    selectedMonth: string,
    selectedYear: string,
  ): Promise<string> => {
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
          if (hasBadgeForMonth(u.badges, "The Unstoppable", `${selectedMonth}/${selectedYear}`)) {
            skippedList.push(u.name);
            return u;
          }

          awardedList.push(u.name);

          return {
            ...u,
            points: (u.points || 0) + 10,
            badges: addBadgeAward(u.badges, "The Unstoppable", `${selectedMonth}/${selectedYear}`),
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
        if (!hasBadgeForMonth(u.badges, "The Unstoppable", `${selectedMonth}/${selectedYear}`)) {
          updatedDocList.push({
            ...u,
            points: (u.points || 0) + 10,
            badges: addBadgeAward(u.badges, "The Unstoppable", `${selectedMonth}/${selectedYear}`),
          });
        }
      }
    });
    if (updatedDocList.length > 0) {
      await cloudSaveUsersBulk(updatedDocList).catch((err) =>
        console.error("Cloud processMonthlyUnstoppable failed:", err),
      );
      await Promise.all(
        updatedDocList.map((u) =>
          saveBadgeAwardToSupabase(
            u.phone,
            u.name,
            "The Unstoppable",
            `${selectedMonth}/${selectedYear}`,
            getBadgeCountForMonth(u.badges, "The Unstoppable", `${selectedMonth}/${selectedYear}`),
          ).catch((err) => console.error("saveBadgeAwardToSupabase failed:", err)),
        ),
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

  const getManualHeartCandidates = (feedbackData?: FeedbackRecord[]) => {
    return (feedbackData ?? state.feedbacksPatient)
      .filter((f) => f.source !== "form")
      .filter((f) => f.rating === 5)
      .filter((f) => {
        const stableId = f.id
          ? f.id
          : `${f.tarikh.replace(/\//g, "-")}_${f.reviewer.trim()}_${f.target.trim()}`
              .replace(/[^a-zA-Z0-9-_]/g, "")
              .slice(0, 40);
        // Skip reviews already recorded in badge_awards — checked against
        // the real persisted table, not users.locks (that column doesn't
        // exist in the live schema, so it never actually prevented
        // double-gifting across sessions).
        return !heartWinnerAwardedIds.has(`HW-${stableId}`);
      })
      .map((f) => {
        // Prefer the REAL Supabase row id (guaranteed unique) over a
        // content-based hash — two reviews can share the same
        // date/reviewer/target (e.g. the same patient reviewing twice in
        // one day), which a content hash alone can't tell apart.
        const stableId = f.id
          ? f.id
          : `${f.tarikh.replace(/\//g, "-")}_${f.reviewer.trim()}_${f.target.trim()}`
              .replace(/[^a-zA-Z0-9-_]/g, "")
              .slice(0, 40);
        const rowId = `HW-${stableId}`;
        const parts = f.tarikh.split("/");
        // Handles both "DD/MM/YYYY" (3 parts) and the Manual Feedback
        // sheet's "MM/YYYY"-only format (2 parts) — falls back to the
        // current month only if the value is genuinely unparseable.
        const monthSegment =
          parts.length === 3
            ? `(${parts[1]}/${parts[2]})`
            : parts.length === 2
              ? `(${parts[0].padStart(2, "0")}/${parts[1]})`
              : `(${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()})`;
        const badgeId = `Heart Winner ${monthSegment} [${rowId}]`;

        // Exact match on normalized name ("Ain" and "Dr Ain" both become
        // "AIN") — NOT a substring/.includes() check, which could
        // wrongly match "Ain" against a name like "Wan Zainol" (contains
        // the letters "ain" inside "Zainol").
        const targetKey = normalizeDoctorName(f.target);
        const matchedDoctor = state.users.find(
          (u) => normalizeDoctorName(u.name) === targetKey,
        );

        return {
          name: f.target,
          phone: matchedDoctor?.phone || "",
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
                  const { password: _sheetPassword, ...sheetUserNoPassword } = sheetUser;
                  return {
                    ...sheetUserNoPassword,
                    // Password is deliberately NOT merged here — the
                    // fetch that populates `existing` no longer carries a
                    // real password value (it's protected server-side via
                    // verify_login now), so blindly falling back to
                    // sheetUser.password would silently overwrite each
                    // user's real password with whatever's in the Google
                    // Sheet (often blank/stale) on every sync. Omitting
                    // the key means the save step leaves password
                    // untouched in Supabase.
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
                      const { password: _sheetPassword2, ...sheetUserNoPassword2 } = sheetUser;
                      return {
                        ...sheetUserNoPassword2,
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
    adminLogCMEAttendance,
    publishAnnouncement,
    deleteAnnouncement,
    adminGivePoints,
    completeSlotAndAwardPoints,
    recalculateBadges,
    processMonthlyUnstoppable,
    processIronDoctorScan,
    migrateHistoricalBadgesToSupabase,
    reconcilePointsFromBadgeAwards,
    getManualHeartCandidates,
    refreshHeartWinnerAwardedIds,
    allBadgeAwards,
    shiftDeclarations,
    refreshShiftDeclarations,
    giftHeartWinnerReview,
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