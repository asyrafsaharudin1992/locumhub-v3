import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomCalendar } from './CustomCalendar';
import { LocumSlot, UserProfile } from '../types';
import { MapPin, Info, AlertTriangle, Clock, X, CheckCircle2 } from 'lucide-react';

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

  // Verify the doc's profile checklist (The 3 Pillars verification)
  const isProfileComplete = currentUser.apc && currentUser.apc.length > 2;

  // Doctors should only ever see genuinely open/unbooked slots on this tab
  const availableSlots = slots.filter((s) => s.status === 'Available');

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
      {/* Profile check banner */}
      {!isProfileComplete && currentUser.role === 'Doctor' && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-rose-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 font-sans">
            <h6 className="text-xs font-bold uppercase tracking-wider">Credential Checklist Pending</h6>
            <p className="text-xs text-rose-600 leading-normal">
              Locum booking privileges are locked. Please complete your APC certificate upload under the <strong>My Profile</strong> tab first.
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
