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

export function normalizeDoctorName(s: string): string {
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

/** Parses a date string into {month, year} for month-matching purposes,
 * accepting either a full "DD/MM/YYYY" date or a "MM/YYYY"-only value —
 * the Manual Feedback sheet's Timestamp column only records month/year
 * (no day), unlike the Form responses 1 tab's full auto-timestamp. Returns
 * null if neither format parses. */
function parseMonthYear(dateStr: string): { month: string; year: string } | null {
  const full = parseDDMMYYYY(dateStr);
  if (full) {
    return {
      month: String(full.getMonth() + 1).padStart(2, "0"),
      year: String(full.getFullYear()),
    };
  }
  const parts = (dateStr || "").trim().split("/");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12 && y > 2000) {
      return { month: String(m).padStart(2, "0"), year: String(y) };
    }
  }
  return null;
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
  // Badges that no longer qualify and should be deleted from badge_awards
  // (currently only "The Unstoppable", the one badge whose truth can
  // change after being awarded — see the revoke logic below).
  badgeRevocations: {
    phone: string;
    name: string;
    badgeName: string;
    monthTag: string;
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

  // ---- Heart Winner: perfect rating in Manual Feedback this month ----
  // IMPORTANT: only the "MANUAL FEEDBACK" sheet counts here — NOT
  // "Form responses 1" (a 4-question Likert satisfaction survey that gets
  // averaged into a 1-5 number). A patient answering "Sangat Setuju" to
  // all 4 Likert questions produces an average of exactly 5.0, which used
  // to get treated as a genuine Heart Winner-qualifying review even though
  // it was never an actual manual review. f.source distinguishes the two
  // (set in googleSheetsService.ts); entries with no source tag at all
  // (e.g. rows coming from the Supabase feedbacks_patient table, which
  // only ever holds real Manual Feedback rows) are treated as manual.
  const heartWinnerReviewIds = new Map<string, Set<string>>();
  manualFeedback.forEach((f) => {
    if (f.source === "form") return;
    if (!f.target || f.rating < 5) return;
    const parsed = parseMonthYear(f.tarikh);
    if (!parsed) return;
    if (parsed.month === month && parsed.year === year) {
      const key = normalizeDoctorName(f.target);
      // Prefer the REAL Supabase row id (guaranteed unique) over a
      // content-based hash — two reviews can share the same
      // date/reviewer/target (e.g. the same patient reviewing twice in one
      // day), which a content hash alone can't tell apart.
      const stableId = f.id
        ? f.id
        : `${f.tarikh.replace(/\//g, "-")}_${f.reviewer.trim()}_${f.target.trim()}`
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
  // IMPORTANT: this must match the exact format used everywhere else a
  // badge+month tag gets written into the badges string — adminGivePoints,
  // giftHeartWinnerReview, and reconcilePointsFromBadgeAwards (in
  // useAppState.ts) all use "MM/YYYY", not the human-readable month name.
  // Using a different format here (it used to be "(July 2026)") caused the
  // same month to show up as two separate entries in a doctor's badges
  // string — e.g. "The Unstoppable (July 2026):1, The Unstoppable
  // (07/2026):1" — once both code paths had touched the same badge.
  const monthTagSuffix = `(${month}/${year})`;
  const monthTagSlash = `${month}/${year}`; // "MM/YYYY", for the Supabase table
  const badgeAwardDetails: RecalcResult["badgeAwardDetails"] = [];
  const badgeRevocations: RecalcResult["badgeRevocations"] = [];

  const updatedUsers = users.map((u) => {
    const key = normalizeDoctorName(u.name);
    const earnedBadges: string[] = [];
    let coinsAwarded = 0;
    let locksStr = u.locks || "";
    const newLockIds: string[] = [];

    const alreadyHasMonthBadge = (badgeName: string) =>
      (u.badges || "").includes(`${badgeName} ${monthTagSuffix}`);

    // The Unstoppable can flip from qualifying to disqualified within the
    // same month: a doctor might complete 2 shifts early on, get awarded,
    // then cancel a later shift that same month. Since this is the only
    // badge whose truth can change after being awarded (everything else —
    // a completed CME slot, a 5-star review, a finished 12h+ shift — is a
    // fact about the past that can't un-happen), it's the only one that
    // needs a revoke path. This is what makes it safe to click
    // "Recalculate Badges" every day for the current, still-open month:
    // if a cancellation shows up later, the next run strips the badge
    // again instead of leaving a now-incorrect award sitting there.
    const alreadyHasUnstoppable = alreadyHasMonthBadge("The Unstoppable");
    const qualifiesUnstoppable = unstoppableDoctors.has(key);
    let revokeUnstoppable = false;
    if (qualifiesUnstoppable && !alreadyHasUnstoppable) {
      earnedBadges.push("The Unstoppable");
      coinsAwarded += 10;
    } else if (!qualifiesUnstoppable && alreadyHasUnstoppable) {
      revokeUnstoppable = true;
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

    // Heart Winner — counted per qualifying 5-star review this month, not
    // capped at 1: a doctor can genuinely earn several excellent reviews
    // in the same month, and each one should count. Uses the same
    // lock-tag pattern as Iron Doctor/LMS to avoid re-crediting a review
    // already counted in an earlier run (id already includes the "HW-"
    // prefix, so the tag here is just "[HW-xxx]" directly).
    const heartWinnerIds = heartWinnerReviewIds.get(key);
    if (heartWinnerIds) {
      const newHeartWinnerIds = Array.from(heartWinnerIds).filter(
        (id) => !locksStr.includes(`[${id}]`),
      );
      if (newHeartWinnerIds.length > 0) {
        earnedBadges.push("Heart Winner");
        coinsAwarded += 15 * newHeartWinnerIds.length;
        newHeartWinnerIds.forEach((id) => newLockIds.push(`[${id}]`));
      }
    }

    if (earnedBadges.length === 0 && !revokeUnstoppable) return u;

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

    // Per-month badges get +1; Iron Doctor/Last Minute Saviour/Heart Winner
    // get +1 per newly-qualifying slot/review found above.
    const perMonthBadges = earnedBadges.filter(
      (b) => b !== "Iron Doctor" && b !== "Last Minute Saviour" && b !== "Heart Winner",
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
    if (heartWinnerIds) {
      const newHeartWinnerCount = Array.from(heartWinnerIds).filter((id) =>
        newLockIds.includes(`[${id}]`),
      ).length;
      if (newHeartWinnerCount > 0) {
        const tag = `Heart Winner ${monthTagSuffix}`;
        badgeMap[tag] = (badgeMap[tag] || 0) + newHeartWinnerCount;
      }
    }
    if (revokeUnstoppable) {
      delete badgeMap[`The Unstoppable ${monthTagSuffix}`];
    }

    const updatedBadgeString = Object.keys(badgeMap)
      .map((k) => `${k}:${badgeMap[k]}`)
      .join(", ");

    if (earnedBadges.length > 0) {
      summaryLines.push(`${u.name}: +${coinsAwarded} AraCoins (${earnedBadges.join(", ")})`);
    }
    if (revokeUnstoppable) {
      summaryLines.push(
        `${u.name}: The Unstoppable REVOKED for ${monthLabel} (cancellation found)`,
      );
      badgeRevocations.push({
        phone: u.phone,
        name: u.name,
        badgeName: "The Unstoppable",
        monthTag: monthTagSlash,
      });
    }

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
      }
      // totalCount is ALWAYS 1 here — this is a per-month pass/fail check
      // (did the doctor qualify this month, yes or no), computed fresh from
      // this run's real slot/feedback data. It never reads or adds onto
      // whatever was in the badges string before, so running this twice
      // (double-click, two tabs, whatever) always upserts the same correct
      // value instead of compounding it.
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: badge,
        monthTag: monthTagSlash,
        totalCount: 1,
        slotIds,
      });
    });
    if (ironSlotIds && ironSlotIds.size > 0) {
      // totalCount = the actual number of distinct qualifying slot IDs this
      // month, recomputed fresh from real slot data every run. Deliberately
      // NOT read from badgeMap/badges-string, since that was the source of
      // the double-award bug: two overlapping runs could each add their own
      // "new" count on top of an already-saved total.
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: "Iron Doctor",
        monthTag: monthTagSlash,
        totalCount: ironSlotIds.size,
        slotIds: Array.from(ironSlotIds),
      });
    }
    if (lmsSlotIds && lmsSlotIds.size > 0) {
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: "Last Minute Saviour",
        monthTag: monthTagSlash,
        totalCount: lmsSlotIds.size,
        slotIds: Array.from(lmsSlotIds),
      });
    }
    if (heartWinnerIds && heartWinnerIds.size > 0) {
      badgeAwardDetails.push({
        phone: u.phone,
        name: u.name,
        badgeName: "Heart Winner",
        monthTag: monthTagSlash,
        totalCount: heartWinnerIds.size,
        slotIds: Array.from(heartWinnerIds),
      });
    }

    // NOTE: points are intentionally NOT set here anymore. badge_awards
    // (upserted above, in useAppState.ts) is now the single source of
    // truth for points — recalculateBadges calls reconcilePointsFromBadgeAwards
    // right after saving these rows, which derives every doctor's points by
    // summing badge_awards fresh each time (a SET, not an ADD). That's what
    // makes repeated clicks / concurrent tabs harmless: no matter how many
    // times this whole flow runs, the final points always land on the same
    // correct number instead of stacking on top of the last run's result.
    return {
      ...u,
      badges: updatedBadgeString,
      locks: locksStr + newLockIds.join(""),
    };
  });

  return { updatedUsers, summaryLines, badgeAwardDetails, badgeRevocations };
}