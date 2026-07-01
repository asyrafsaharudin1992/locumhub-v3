import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, ShieldAlert, AlertCircle, Clock, Trash, MapPin, CheckCircle } from 'lucide-react';
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

  // Find slots booked by this doctor (by phone)
  const mySlots = slots.filter(s => s.phone === currentUser.phone);

  const filteredSlots = mySlots.filter(s => {
    if (filterType === 'Approved') return s.status === 'Approved';
    if (filterType === 'Pending') return s.status === 'Pending';
    return true; // All
  });

  const handleCancelClick = async (slot: LocumSlot) => {
    // Show warnings if canceling already approved shift
    const msg = slot.status === 'Approved'
      ? "🚨 CRITICAL WARNING!\nThis shift is already APPROVED. Withdrawing within short order will be logged. It will disqualify you from earning the coveted 'The Unstoppable' monthly recognition award (which yields RM/Points boosters).\n\nProceed with cancellation anyway?"
      : "Are you sure you want to withdraw this application?";

    if (window.confirm(msg)) {
      const response = await onCancelSlot(slot.id, slot.status, currentUser.phone);
      alert(response);
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
          Cancellation policy: Approved slots cancelled with less than 48 hours notice triggers review and locks automated monthly reward evaluation routines.
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
                      <span className="font-mono font-semibold text-slate-600">RM {slot.gaji} payout</span>
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
    </div>
  );
};
