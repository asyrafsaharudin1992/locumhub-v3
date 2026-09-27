import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomCalendar } from './CustomCalendar';
import { LocumSlot, UserProfile } from '../types';
import { MapPin, Info, AlertTriangle, Clock, X, CheckCircle2, CalendarDays, Hourglass, Check } from 'lucide-react';

interface DoctorBookingTabProps {
  slots: LocumSlot[];
  currentUser: UserProfile;
  onBookSlot: (slotId: string, name: string, phone: string) => Promise<string>;
  onRefresh: () => void;
}

export const DoctorBookingTab: React.FC<DoctorBookingTabProps> = ({
  slots,
  currentUser,
  onBookSlot,
}) => {
  const [selectedBranch, setSelectedBranch] = useState<'All' | 'Seri Kembangan' | 'Kajang'>('All');
  const [pendingSlot, setPendingSlot] = useState<LocumSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [profileWarning, setProfileWarning] = useState(false);

  // APC remains the only booking gate. Other missing profile details are
  // shown as a reminder so a doctor can still log in and view the schedule.
  const hasApc = Boolean(currentUser.apc && currentUser.apc.trim().length > 2);
  const isSyntheticAuthEmail = currentUser.email.endsWith('@auth.aralocum.local');
  const missingProfileFields = [
    (!currentUser.email.trim() || isSyntheticAuthEmail) ? 'profile email' : '',
    !currentUser.mmc.trim() ? 'MMC number' : '',
    !currentUser.workplace.trim() ? 'workplace' : '',
    !hasApc ? 'APC certificate' : '',
  ].filter(Boolean) as string[];
  const isProfileComplete = hasApc;

  // CME/Briefing entries are not locum shifts and stay out of this page.
  const locumSlots = slots.filter((s) => {
    const branch = s.cawangan.toLowerCase();
    return !branch.includes('cme') && !branch.includes('briefing');
  });
  // Doctors should only ever see genuinely open/unbooked locum slots here.
  const availableSlots = locumSlots.filter((s) => s.status === 'Available');
  const normalizePhone = (value: string) => value.replace(/\D/g, '').replace(/^60/, '0');
  const mySlots = locumSlots.filter((s) => normalizePhone(String(s.phone || '')) === normalizePhone(currentUser.phone));
  const parseSlotDate = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingSlots = mySlots.filter((s) => {
    const date = parseSlotDate(s.tarikh);
    return date && date >= today && (s.status === 'Approved' || s.status === 'Pending');
  });
  const completedSlots = mySlots.filter((s) => {
    const date = parseSlotDate(s.tarikh);
    return date && date < today && s.status === 'Approved';
  });
  const pendingSlots = mySlots.filter((s) => s.status === 'Pending');

  const handleSlotClicked = (slot: LocumSlot) => {
    if (slot.status !== 'Available') return;

    if (!isProfileComplete) {
      setProfileWarning(true);
      return;
    }

    setPendingSlot(slot);
  };

  const confirmBooking = async () => {
    if (!pendingSlot) return;
    setIsSubmitting(true);
    try {
      const response = await onBookSlot(pendingSlot.id, currentUser.name, currentUser.phone);
      setPendingSlot(null);
      setResultMessage(response);
    } catch (err) {
      setResultMessage('⚠️ Something went wrong while submitting your booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Clinical scheduling</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Book a Shift</h2>
          <p className="mt-1 text-sm text-slate-500">Find and request available locum slots.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          <div className="min-w-[86px] rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-slate-500">My shifts</p>
              <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-slate-950">{mySlots.length}</p>
          </div>
          <div className="min-w-[86px] rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-slate-500">Upcoming</p>
              <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-slate-950">{upcomingSlots.length}</p>
          </div>
          <div className="min-w-[86px] rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-slate-500">Completed</p>
              <Check className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-slate-950">{completedSlots.length}</p>
          </div>
          <div className="min-w-[86px] rounded-[20px] border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold tracking-tight text-slate-500">Pending</p>
              <Hourglass className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-slate-950">{pendingSlots.length}</p>
          </div>
        </div>
      </div>

      {/* Profile check banner */}
      {currentUser.role === 'Doctor' && missingProfileFields.length > 0 && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 shadow-sm ${
          !hasApc ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${!hasApc ? 'text-rose-500' : 'text-amber-500'}`} />
          <div className="space-y-1 font-sans">
            <h6 className="text-xs font-bold uppercase tracking-wider">Profile details to complete</h6>
            <p className={`text-xs leading-normal ${!hasApc ? 'text-rose-600' : 'text-amber-700'}`}>
              Please update: <strong>{missingProfileFields.join(', ')}</strong> under <strong>My Profile</strong>.
              {!hasApc && <> Booking clinical shifts remains locked until your APC certificate is uploaded.</>}
            </p>
          </div>
        </div>
      )}

      {/* Booking guide instructions bento */}
      <div className="rounded-xl bg-sky-50/50 border border-sky-100/30 p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-600 leading-snug font-sans">
          Click any date on the calendar below containing indicators. Only open shifts are shown here — click a slot to request it.
        </p>
      </div>

      {/* Branch Location filters switcher */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-sm">
        {(['All', 'Seri Kembangan', 'Kajang'] as const).map(branch => (
          <button
            key={branch}
            onClick={() => setSelectedBranch(branch)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              selectedBranch === branch
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-indigo-900'
            }`}
          >
            {branch === 'All' ? 'All Clinics' : branch === 'Seri Kembangan' ? 'SK Branch' : 'Kajang Branch'}
          </button>
        ))}
      </div>

      {/* Active interactive custom clinical schedule — available slots only */}
      <CustomCalendar
        slots={availableSlots}
        onSlotClick={handleSlotClicked}
        currentUserRole={currentUser.role}
        currentUserPhone={currentUser.phone}
        selectedBranch={selectedBranch}
        openSlotColorMode="branch"
        desktopSlotPanel
      />

      {/* ===================== Confirm Booking Dialog ===================== */}
      <AnimatePresence>
        {pendingSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isSubmitting && setPendingSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 space-y-5 relative"
            >
              <button
                onClick={() => !isSubmitting && setPendingSlot(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h4 className="font-display font-bold text-slate-800 text-lg">Confirm Shift Request</h4>
                <p className="text-xs text-slate-500">Review the details before submitting.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="font-semibold text-slate-700">Klinik ARA {pendingSlot.cawangan}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="font-semibold text-slate-700">{pendingSlot.tarikh} &middot; {pendingSlot.masa}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingSlot(null)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBooking}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== Profile Incomplete Warning ===================== */}
      <AnimatePresence>
        {profileWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setProfileWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 space-y-4 text-center"
            >
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-display font-bold text-slate-800 text-base">Incomplete Profile</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Please upload your APC certificate in the <strong>My Profile</strong> tab before booking clinical shifts.
                </p>
              </div>
              <button
                onClick={() => setProfileWarning(false)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== Result Toast ===================== */}
      <AnimatePresence>
        {resultMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-[90vw]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{resultMessage}</span>
            <button onClick={() => setResultMessage(null)} className="text-slate-400 hover:text-white ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
