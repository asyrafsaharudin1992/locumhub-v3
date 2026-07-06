/**
 * Ara Locum Hub Types
 */

export type UserRole = 'Doctor' | 'Admin' | 'Staff';

export interface UserProfile {
  phone: string;
  password?: string;
  name: string;
  role: UserRole;
  email: string;
  mmc: string; // MMC Number, can include file name/url
  apc: string; // APC URL or file name/url
  indemnity: string; // Indemnity status ("Ada" | "Tiada") + possible file name/url
  workplace?: string;
  points: number; // Aracoins
  badges: string; // e.g. "Team Favorite:2, Iron Doctor:1"
  locks?: string; // Locker list
}

export interface LocumSlot {
  id: string;
  tarikh: string; // Format: DD/MM/YYYY
  masa: string; // e.g. "9am-5pm" or "6pm-10pm"
  cawangan: string; // "Seri Kembangan" | "Kajang" | "CME / BRIEFING"
  status: 'Available' | 'Pending' | 'Approved';
  dr: string; // Doctor name of booking doctor
  phone: string; // Phone number
  gaji: number; // Flat salary rate or base pay
  sales?: number; // Clinical sales logged after completion
  pesakit?: number; // Doctor's patient count logged after completion
  bookedAt?: string; // Time doctor clicked Book
  performanceRecorded?: boolean; // Track if performance output has been recorded
}

export interface FeedbackRecord {
  id?: string; // real Supabase row id, when available — used to uniquely
  // identify a review for Heart Winner tracking, since two reviews CAN
  // share the same date/reviewer/target (e.g. same patient reviewing twice
  // in one day), which content-based hashing alone can't distinguish.
  source?: "form" | "manual"; // "form" = Form responses 1 (4-question Likert
  // satisfaction survey, averaged into a 1-5 number) — NOT a genuine review,
  // and must never count toward Heart Winner. "manual" = MANUAL FEEDBACK
  // sheet (direct /5 rating), the only legitimate Heart Winner source.
  // Undefined is treated as manual (e.g. rows already in Supabase, which
  // only ever hold genuine manual reviews).
  tarikh: string;
  nama: string; // Sender or Subject
  reviewer: string; // Reviewer name
  target: string; // Doctor name or Clinic
  cawangan?: string; // Branch, when available
  rating: number; // 1-5 scale
  komen: string;
}

export interface NewApplication {
  timestamp: string;
  nama: string;
  phone: string;
  mmc: string;
  apc: string;
  ins: string;
  cvUrl: string;
  skills: string;
}

export interface Announcement {
  id: string;
  text: string;
  date: string;
}

export interface AppNotification {
  id: string;
  phone: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  slotId?: string;
}

export interface AdminAlert {
  id: string;
  slotId: string;
  drName: string;
  cawangan: string;
  tarikh: string;
  masa: string;
  message: string;
  timestamp: string;
}

export interface LocumSurveyEntry {
  timestamp: string;
  duration: string;
  clinics: string;
  workflowSmooth: string;
  workflowElaborate: string;
  feltSupported: string;
  staffFeedback: string;
  safetyConcerns: string;
  medsSufficient: string;
  medsFeedback: string;
  awareOutsourced: string;
  outsourcedSuggestion: string;
  appreciate: string;
  improve: string;
}

export interface StaffFeedbackEntry {
  timestamp: string;
  staffName: string;
  cawangan: string;
  doctorName: string;
  dutyDate: string;
  category: string;
  details: string;
}