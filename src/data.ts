import { LocumSlot, UserProfile, FeedbackRecord, NewApplication, Announcement } from './types';

export const INITIAL_USERS: UserProfile[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const INITIAL_FEEDBACKS_PATIENT: FeedbackRecord[] = [];

export const INITIAL_FEEDBACKS_STAFF: FeedbackRecord[] = [];

export const INITIAL_FEEDBACKS_LOCUM: FeedbackRecord[] = [];

export const INITIAL_NEW_APPLICATIONS: NewApplication[] = [];

// Helper to generate date string relative to current date (2026-06-14)
export function getInitialSlots(): LocumSlot[] {
  return [];
}