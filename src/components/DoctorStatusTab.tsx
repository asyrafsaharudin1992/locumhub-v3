import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, AlertCircle, AlertTriangle, Clock, Trash, X, CheckCircle2 } from 'lucide-react';
import { LocumSlot, UserProfile } from '../types';

interface DoctorStatusTabProps {
  slots: LocumSlot[];
  currentUser: UserProfile;
  onCancelSlot: (slotId: string, statusAsal: string, phone: string) => Promise<string>;
}

export const DoctorStatusTab: React.FC<DoctorStatusTabProps> = ({
  slots,
  currentUser,
  onCancelSlot
}) => {
  const [filterType, setFilterType] = useState<'All' | 'Approved' | 'Pending'>('All');
  const [pendingCancelSlot, setPendingCancelSlot] = useState<LocumSlot | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Find slots booked by this doctor (by phone) — whether self-booked or assigned by admin.
  // Slots reset back to "Available" (cancelled by admin or withdrawn by the doctor) should
  // never appear here, even if a stale phone value lingers on the record.
  const mySlots = slots.filter(
    s => s.phone === currentUser.phone && s.status !== 'Available'
  );

  // Parse "DD/MM/YYYY, HH:MM:SS" (en-GB toLocaleString format) safely; unknown/missing dates sort last
  const parseBookedAt = (raw?: string): number => {
    if (!raw) return 0;
    const parts = raw.split(/[\s,/:]+/).filter(Boolean);
    if (parts.length >= 6) {
      const [d, m, y, h, min, s] = parts.map((p) => parseInt(p, 10));
      const dt = new Date(y, (m || 1) - 1, d, h || 0, min || 0, s || 0);
      if (!isNaN(dt.getTime())) return dt.getTime();
    }
    const fallback = new Date(raw).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  const sortedMySlots = [...mySlots].sort(
    (a, b) => parseBookedAt(b.bookedAt) - parseBookedAt(a.bookedAt)
  );

  const filteredSlots = sortedMySlots.filter(s => {
    if (filterType === 'Approved') return s.status === 'Approved';
    if (filterType === 'Pending') return s.status === 'Pending';
    return true; // All
  });

  const handleCancelClick = (slot: LocumSlot) => {
    setPendingCancelSlot(slot);
  };

  const confirmCancel = async () => {
    if (!pendingCancelSlot) return;
    setIsCancelling(true);
    try {
      const response = await onCancelSlot(pendingCancelSlot.id, pendingCancelSlot.status, currentUser.phone);
      setPendingCancelSlot(null);
      setResultMessage(response);
    } catch (err) {
      setResultMessage('⚠️ Something went wrong while withdrawing. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control header filter pills */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        {(['All', 'Approved', 'Pending'] as const).map(fType => (
          <button
            key={fType}
            onClick={() => setFilterType(fType)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
              filterType === fType
                ? 'bg-[#001F3F] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {fType === 'All' ? `All Shifts (${mySlots.length})` : fType === 'Approved' ? 'Approved' : 'Pending'}
          </button>
        ))}
      </div>

      {/* Disclaimers card */}
      <div className="p-3 bg-amber-50/50 border border-amber-200/40 rounded-2xl flex gap-2 text-xs text-amber-800 leading-snug">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="font-semibold font-sans">
          For last-minute cancellations of approved shifts, kindly notify the admin directly via PM as well.
        </p>
      </div>

      {/* Slots List container */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredSlots.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-slate-400 shadow-sm"
            >
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">No shift requests found matching filter.</p>
              <p className="text-xs">Once you select and book available dates they will compile here.</p>
            </motion.div>
          ) : (
            filteredSlots.map(slot => {
              const isApproved = slot.status === 'Approved';
              const isSK = slot.cawangan.toLowerCase().includes('sk') || slot.cawangan.toLowerCase().includes('seri');

              return (
                <motion.div
                  layout
                  key={slot.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden"
                >
                  <div className="space-y-1.5 pl-2">
                    {/* Location & custom badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSK ? 'bg-sky-600' : 'bg-emerald-600'}`} />
                      <span className="font-display font-bold text-slate-800 text-sm tracking-tight">
                        Klinik ARA {slot.cawangan}
                      </span>
                    </div>

                    {/* DateTime */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-bold text-slate-700">{slot.tarikh}</span>
                      <span className="font-mono">({slot.masa})</span>
                    </div>

                    {/* Booked timer note */}
                    {slot.bookedAt && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        <span>Submitted {slot.bookedAt}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Status indicators */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t border-slate-50 sm:border-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                    >
                      {slot.status === 'Approved' ? 'Approved ✓' : 'Pending Approval ⌛'}
                    </span>

                    <button
                      onClick={() => handleCancelClick(slot)}
                      className="text-xs hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold p-2.5 rounded-xl transition flex items-center gap-1"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Withdraw</span>
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* ===================== Confirm Withdraw Dialog ===================== */}
      <AnimatePresence>
        {pendingCancelSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isCancelling && setPendingCancelSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 space-y-5 relative"
            >
              <button
                onClick={() => !isCancelling && setPendingCancelSlot(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-3">
                <AlertTriangle className="w-8 h-8 text-rose-500 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-slate-800 text-base">
                    Cancel this slot?
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to cancel this slot?
                  </p>
                  {pendingCancelSlot.status === 'Approved' && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
                      For last-minute cancellations, kindly notify the admin directly via PM too.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5 border border-slate-100 text-xs">
                <p className="font-semibold text-slate-700">Klinik ARA {pendingCancelSlot.cawangan}</p>
                <p className="text-slate-500">{pendingCancelSlot.tarikh} &middot; {pendingCancelSlot.masa}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingCancelSlot(null)}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Keep Shift
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {isCancelling ? 'Withdrawing...' : 'Yes, Withdraw'}
                </button>
              </div>
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
