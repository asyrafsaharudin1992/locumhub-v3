// AraCoins badge calculation engine.
//
// This is intentionally kept separate from useAppState.ts (which is already
// huge) so the reward logic is easy to find, read, and adjust on its own.
//
// Badges implemented, matching the original Google Apps Script rules:
//
// 1. Heart Winner       — doctor has a perfect/near-perfect rating in the
//                          "Manual Feedback" patient feedback source that
//                          month.
// 2. The Unstoppable    — doctor completed >= 2 shifts that month AND had
//                          ZERO cancellations that month (by admin or by
//                          themselves).
// 3. The Diligent Doc   — doctor attended a CME/Briefing session that month
//                          (a slot whose branch/cawangan is "CME" or
//                          "Briefing"). Awarded per month attended, not a
//                          one-time lifetime milestone.
// 4. Iron Doctor        — doctor worked a shift >12 hours, OR 2+ shifts in
//                          the same calendar day, that month. Triggers as
//                          soon as the shift's end time has passed — does
//                          NOT require the admin to have closed out
//                          sales/patient numbers for it.
// 5. Last Minute Saviour— doctor's booking timestamp was less than 25 hours
//                          before the shift's own start time, that month.
//
// NOTE: "Team Favourite" is intentionally NOT automated — admin picks and
// awards it manually via the Loyalty Points panel, since "favourite" is a
// judgement call, not something purely countable.
//
// KNOWN DATA LIMITATION: doctor self-cancellations were only recorded in
// "admin_alerts", which gets deleted once an admin dismisses it — so for
// months before this was also logged to activity_logs (see
// cancelSlotByDoctor in useAppState.ts), self-cancellations that have
// already been dismissed can't be reconstructed. Admin-initiated
// cancellations ARE reliably tracked via activity_logs going back further,
// since that log has always captured them.

import type { LocumSlot, UserProfile, FeedbackRecord, AdminAlert } from "./types";

interface ActivityLogEntry {
  timestamp: string;
  action: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function normalizeDoctorName(s: string): string {
  return (s || "").toUpperCase().trim().replace(/^DR\.?\s+/i, "");
}

function doctorNamesMatch(a: string, b: string): boolean {
  const na = normalizeDoctorName(a);
  const nb = normalizeDoctorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);
  const [shortWords, longWords] =
    wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return shortWords.every((w) => longWords.includes(w));
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const parts = (dateStr || "").split("/");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

/** Parses slot "masa" (e.g. "8am-8pm", "6-10pm", "9am-6pm") into actual
 * start/end Date objects on the slot's date, handling overnight shifts. */
function parseShiftRange(masa: string, dateStr: string): { start: Date; end: Date } | null {
  const datePart = parseDDMMYYYY(dateStr);
  if (!datePart) return null;

  const clean = (masa || "").toLowerCase().replace(/\s+/g, "");
  const rangeParts = clean.split("-");
  if (rangeParts.length !== 2) return null;

  const parseOne = (s: string, fallbackMeridiem?: "am" | "pm") => {
    const match = s.match(/(\d{1,2})(?::(\d{2}))?(am|pm)?/);
    if (!match) return null;
    const hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = (match[3] as "am" | "pm" | undefined) || fallbackMeridiem;
    if (!meridiem) return null;
    return { hour, minute, meridiem };
  };

  const endRaw = parseOne(rangeParts[1]);
  if (!endRaw) return null;
  const startRaw = parseOne(rangeParts[0], endRaw.meridiem);
  if (!startRaw) return null;

  const to24 = (t: { hour: number; meridiem: "am" | "pm" }) => {
    let h = t.hour % 12;
    if (t.meridiem === "pm") h += 12;
    return h;
  };

  const y = datePart.getFullYear();
  const m = datePart.getMonth();
  const d = datePart.getDate();

  const start = new Date(y, m, d, to24(startRaw), startRaw.minute);
  let end = new Date(y, m, d, to24(endRaw), endRaw.minute);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // shift crosses midnight
  }
  return { start, end };
}

/** Parses the free-form "bookedAt" string the app already uses elsewhere
 * (en-GB toLocaleString format, e.g. "19/02/2026, 15:58:16"). */
function parseBookedAt(bookedAt: string | undefined): Date | null {
  if (!bookedAt) return null;
  const cleaned = bookedAt.replace(",", "");
  const parts = cleaned.split(/[\s/:.-]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  const hh = parts[3] ? parseInt(parts[3], 10) : 0;
  const mm = parts[4] ? parseInt(parts[4], 10) : 0;
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, hh, mm);
}

function slotIsInMonth(slot: LocumSlot, month: string, year: string): boolean {
  const parts = (slot.tarikh || "").split("/");
  if (parts.length !== 3) return false;
  return parts[1].padStart(2, "0") === month && parts[2] === year;
}

interface RecalcResult {
  updatedUsers: UserProfile[];
  summaryLines: string[];
  badgeAwardDetails: {
    phone: string;
    name: string;
    badgeName: string;
    monthTag: string; // "MM/YYYY" — for the Supabase table (distinct from the display monthLabel)
    totalCount: number;
    slotIds?: string[];
  }[];
}

export function recalculateBadgesForMonth(
  users: UserProfile[],
  allSlots: LocumSlot[],
  activityLogs: ActivityLogEntry[],
  adminAlerts: AdminAlert[],
  manualFeedback: FeedbackRecord[],
  month: string,
  year: string,
): RecalcResult {
  const monthLabel = `${MONTH_NAMES[parseInt(month, 10) - 1] || month} ${year}`;
  const summaryLines: string[] = [];

  const monthSlots = allSlots.filter(
    (s) => s.status === "Approved" && s.dr && slotIsInMonth(s, month, year),
  );

  // ---- Cancellations this month (admin-side + doctor self-cancel) ----
  // Text patterns logged by adminManageSlot('CANCEL') and cancelSlotByDoctor.
  const cancelledDoctorsThisMonth = new Set<string>();

  activityLogs.forEach((log) => {
    const adminMatch = log.action.match(/ADMIN: CANCEL & RESET.*\(Dr:\s*(.+?)\)/i);
    const selfMatch = log.action.match(/DOCTOR: SELF-CANCEL.*\(Dr:\s*(.+?)\).*on\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (selfMatch) {
      const [, drName, dateStr] = selfMatch;
      if (slotIsInMonth({ tarikh: dateStr } as LocumSlot, month, year)) {
        cancelledDoctorsThisMonth.add(normalizeDoctorName(drName));
      }
    } else if (adminMatch) {
      // Admin cancel logs don't carry the shift's date, only the log
      // timestamp — use the log's own date as the best available proxy.
      const logDate = parseBookedAt(log.timestamp);
      if (logDate) {
        const logMonth = String(logDate.getMonth() + 1).padStart(2, "0");
        const logYear = String(logDate.getFullYear());
        if (logMonth === month && logYear === year) {
          cancelledDoctorsThisMonth.add(normalizeDoctorName(adminMatch[1]));
        }
      }
    }
  });

  // Any still-undismissed admin_alerts (doctor self-cancel) for this month
  adminAlerts.forEach((alert) => {
    const drName = alert.drName || "";
    const tarikh = alert.tarikh || "";
    if (drName && tarikh && slotIsInMonth({ tarikh } as LocumSlot, month, year)) {
      cancelledDoctorsThisMonth.add(normalizeDoctorName(drName));
    }
  });

  // ---- Group this month's completed shifts by doctor ----
  const shiftsByDoctor = new Map<string, LocumSlot[]>();
  monthSlots.forEach((s) => {
    const key = normalizeDoctorName(s.dr);
    if (!shiftsByDoctor.has(key)) shiftsByDoctor.set(key, []);
    shiftsByDoctor.get(key)!.push(s);
  });

  // ---- The Diligent Doc: attended a CME/Briefing slot this month ----
  const diligentDocDoctors = new Set<string>();
  const diligentDocSlotIds = new Map<string, Set<string>>();
  monthSlots.forEach((s) => {
    const branchUpper = (s.cawangan || "").toUpperCase();
    if (branchUpper.includes("CME") || branchUpper.includes("BRIEFING")) {
      const key = normalizeDoctorName(s.dr);
      diligentDocDoctors.add(key);
      if (!diligentDocSlotIds.has(key)) diligentDocSlotIds.set(key, new Set());
      diligentDocSlotIds.get(key)!.add(s.id);
    }
  });

  // ---- Iron Doctor: >12h shift, or 2+ shifts same calendar day, shift must
  // have already ended (not gated behind performance close-out). Tracks
  // WHICH slot IDs qualified per doctor, so re-running this scan later
  // (e.g. next month, or a re-run for the same month) never double-counts
  // a slot that was already credited.
  const now = new Date();
  const ironDoctorSlotIds = new Map<string, Set<string>>();
  shiftsByDoctor.forEach((shifts, key) => {
    const byDate = new Map<string, LocumSlot[]>();
    shifts.forEach((s) => {
      if (!byDate.has(s.tarikh)) byDate.set(s.tarikh, []);
      byDate.get(s.tarikh)!.push(s);
    });
    byDate.forEach((sameDaySlots) => {
      let qualifies = sameDaySlots.length >= 2;
      sameDaySlots.forEach((s) => {
        const range = parseShiftRange(s.masa, s.tarikh);
        if (range && range.end.getTime() <= now.getTime()) {
          const hours = (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60);
          if (hours >= 12) qualifies = true;
        } else if (!range) {
          qualifies = false; // can't confirm timing, don't guess
        }
      });
      // For the "2+ shifts same day" path, still require at least one of
      // them to have already ended before crediting it.
      const anyEnded = sameDaySlots.some((s) => {
        const range = parseShiftRange(s.masa, s.tarikh);
        return range && range.end.getTime() <= now.getTime();
      });
      if (qualifies && anyEnded) {
        if (!ironDoctorSlotIds.has(key)) ironDoctorSlotIds.set(key, new Set());
        sameDaySlots.forEach((s) => ironDoctorSlotIds.get(key)!.add(s.id));
      }
    });
  });

  // ---- The Unstoppable: >=2 shifts this month, zero cancellations ----
  const unstoppableDoctors = new Set<string>();
  shiftsByDoctor.forEach((shifts, key) => {
    if (shifts.length >= 2 && !cancelledDoctorsThisMonth.has(key)) {
      unstoppableDoctors.add(key);
    }
  });

  // ---- Last Minute Saviour: booked <24h before shift start ----
  // Also tracked per slot ID for the same re-run-safety reason as Iron Doctor.
  const lastMinuteSlotIds = new Map<string, Set<string>>();
  monthSlots.forEach((s) => {
    if (!s.bookedAt) return;
    const range = parseShiftRange(s.masa, s.tarikh);
    const bookedAt = parseBookedAt(s.bookedAt);
    if (range && bookedAt) {
      const diffHours = (range.start.getTime() - bookedAt.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 25) {
        const key = normalizeDoctorName(s.dr);
        if (!lastMinuteSlotIds.has(key)) lastMinuteSlotIds.set(key, new Set());
        lastMinuteSlotIds.get(key)!.add(s.id);
      }
    }
  });

  // ---- Heart Winner: perfect/near-perfect rating in Manual Feedback this month ----
  const heartWinnerDoctors = new Set<string>();
  const heartWinnerReviewIds = new Map<string, Set<string>>();
  manualFeedback.forEach((f) => {
    if (!f.target || f.rating < 5) return;
    const fDate = parseDDMMYYYY(f.tarikh);
    if (!fDate) return;
    const fMonth = String(fDate.getMonth() + 1).padStart(2, "0");
    const fYear = String(fDate.getFullYear());
    if (fMonth === month && fYear === year) {
      const key = normalizeDoctorName(f.target);
      heartWinnerDoctors.add(key);
      // Same stable-ID formula as saveFeedbackPatientToSupabase / the
      // Reviews Scanner's lock tags — ties this award back to the exact
      // review that earned it.
      const stableId = `${f.tarikh.replace(/\//g, "-")}_${f.reviewer.trim()}_${f.target.trim()}`
        .replace(/[^a-zA-Z0-9\-_]/g, "");
      if (!heartWinnerReviewIds.has(key)) heartWinnerReviewIds.set(key, new Set());
      heartWinnerReviewIds.get(key)!.add(`HW-${stableId}`);
    }
  });

  // ---- Apply badges + AraCoins to each user ----
  // Every check here is written so running this scan again for the same
  // month (or accidentally twice) never inflates counts:
  //  - Per-slot badges (Iron Doctor, Last Minute Saviour) check the doctor's
  //    `locks` field for that exact slot ID before crediting it.
  //  - Per-month badges (Heart Winner, Unstoppable, Diligent Doc) check
  //    whether that "(Month Year)" tag is already present before adding it.
  const monthTagSuffix = `(${monthLabel})`;
  const monthTagSlash = `${month}/${year}`; // "MM/YYYY", for the Supabase table
  const badgeAwardDetails: RecalcResult["badgeAwardDetails"] = [];

  const updatedUsers = users.map((u) => {
    const key = normalizeDoctorName(u.name);
    const earnedBadges: string[] = [];
    let coinsAwarded = 0;
    let locksStr = u.locks || "";
    const newLockIds: string[] = [];

    const alreadyHasMonthBadge = (badgeName: string) =>
      (u.badges || "").includes(`${badgeName} ${monthTagSuffix}`);

    if (heartWinnerDoctors.has(key) && !alreadyHasMonthBadge("Heart Winner")) {
      earnedBadges.push("Heart Winner");
      coinsAwarded += 10;
    }
    if (unstoppableDoctors.has(key) && !alreadyHasMonthBadge("The Unstoppable")) {
      earnedBadges.push("The Unstoppable");
      coinsAwarded += 10;
    }
    if (diligentDocDoctors.has(key) && !alreadyHasMonthBadge("The Diligent Doc")) {
      earnedBadges.push("The Diligent Doc");
      coinsAwarded += 10;
    }

    // Iron Doctor — count only slot-days not already locked
    const ironSlotIds = ironDoctorSlotIds.get(key);
    if (ironSlotIds) {
      const newIronSlots = Array.from(ironSlotIds).filter(
        (id) => !locksStr.includes(`[IRON-${id}]`),
      );
      if (newIronSlots.length > 0) {
        earnedBadges.push("Iron Doctor");
        coinsAwarded += 10 * newIronSlots.length;
        newIronSlots.forEach((id) => newLockIds.push(`[IRON-${id}]`));
      }
    }

    // Last Minute Saviour — count only slots not already locked
    const lmsSlotIds = lastMinuteSlotIds.get(key);
    if (lmsSlotIds) {
      const newLmsSlots = Array.from(lmsSlotIds).filter(
        (id) => !locksStr.includes(`[LMS-${id}]`),
      );
      if (newLmsSlots.length > 0) {
        earnedBadges.push("Last Minute Saviour");
        coinsAwarded += 20 * newLmsSlots.length;
        newLmsSlots.forEach((id) => newLockIds.push(`[LMS-${id}]`));
      }
    }

    if (earnedBadges.length === 0) return u;

    const badgeMap: { [key: string]: number } = {};
    (u.badges || "").split(",").forEach((item) => {
      const trimmed = item.trim();
      if (!trimmed) return;
      const lastColon = trimmed.lastIndexOf(":");
      if (lastColon === -1) return;
      const name = trimmed.substring(0, lastColon).trim();
      const count = parseInt(trimmed.substring(lastColon + 1).trim()) || 1;
      badgeMap[name] = count;
    });

    // Per-month badges get +1; Iron Doctor/Last Minute Saviour get +1 per
    // newly-qualifying slot found above.
    const perMonthBadges = earnedBadges.filter(
      (b) => b !== "Iron Doctor" && b !== "Last Minute Saviour",
    );
    perMonthBadges.forEach((badge) => {
      const tag = `${badge} ${monthTagSuffix}`;
      badgeMap[tag] = (badgeMap[tag] || 0) + 1;
    });
    if (ironSlotIds) {
      const newIronCount = Array.from(ironSlotIds).filter((id) =>
        newLockIds.includes(`[IRON-${id}]`),
      ).length;
      if (newIronCount > 0) {
        const tag = `Iron Doctor ${monthTagSuffix}`;
        badgeMap[tag] = (badgeMap[tag] || 0) + newIronCount;
      }
    }
    if (lmsSlotIds) {
      const newLmsCount = Array.from(lmsSlotIds).filter((id) =>
        newLockIds.includes(`[LMS-${id}]`),
      ).length;
      if (newLmsCount > 0) {
        const tag = `Last Minute Saviour ${monthTagSuffix}`;
        badgeMap[tag] = (badgeMap[tag] || 0) + newLmsCount;
      }
    }

    const updatedBadgeString = Object.keys(badgeMap)
      .map((k) => `${k}:${badgeMap[k]}`)
      .join(", ");

    summaryLines.push(`${u.name}: +${coinsAwarded} AraCoins (${earnedBadges.join(", ")})`);

    // Record per-badge details for the badge_awards Supabase table — total
    // count for this month (not just what's new in this run), plus the full
    // set of contributing slot IDs for Iron Doctor / Last Minute Saviour.
    perMonthBadges.forEach((badge) => {
      let slotIds: string[] | undefined;
      if (badge === "The Diligent Doc") {
        const s = diligentDocSlotIds.get(key);
        if (s && s.size > 0) slotIds = Array.from(s);
      } else if (badge === "The Unstoppable") {
        const s = shiftsByDoctor.get(key);
        if (s && s.length > 0) slotIds = s.map((slot) => slot.id);
      } else if (badge === "Heart Winner") {
        const s = heartWinnerReviewIds.get(key);
        if (s && s.size > 0) slotIds = Array.from(s);
      }
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: badge,
        monthTag: monthTagSlash,
        totalCount: badgeMap[`${badge} ${monthTagSuffix}`] || 1,
        slotIds,
      });
    });
    if (ironSlotIds && ironSlotIds.size > 0) {
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: "Iron Doctor",
        monthTag: monthTagSlash,
        totalCount: badgeMap[`Iron Doctor ${monthTagSuffix}`] || ironSlotIds.size,
        slotIds: Array.from(ironSlotIds),
      });
    }
    if (lmsSlotIds && lmsSlotIds.size > 0) {
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: "Last Minute Saviour",
        monthTag: monthTagSlash,
        totalCount: badgeMap[`Last Minute Saviour ${monthTagSuffix}`] || lmsSlotIds.size,
        slotIds: Array.from(lmsSlotIds),
      });
    }

    return {
      ...u,
      points: (u.points || 0) + coinsAwarded,
      badges: updatedBadgeString,
      locks: locksStr + newLockIds.join(""),
    };
  });

  return { updatedUsers, summaryLines, badgeAwardDetails };
}
