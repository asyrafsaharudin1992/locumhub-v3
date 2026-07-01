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
  tarikh: string;
  nama: string; // Sender or Subject
  reviewer: string; // Reviewer name
  target: string; // Doctor name or Clinic
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
