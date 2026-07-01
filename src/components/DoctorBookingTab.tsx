import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CustomCalendar } from './CustomCalendar';
import { LocumSlot, UserProfile } from '../types';
import { MapPin, Info, AlertTriangle, ShieldAlert } from 'lucide-react';

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

  // Verify the doc's profile checklist (The 3 Pillars verification)
  const isProfileComplete = currentUser.apc && currentUser.apc.length > 2;

  const handleSlotClicked = async (slot: LocumSlot) => {
    if (slot.status !== 'Available') return;

    if (!isProfileComplete) {
      alert("⚠️ INCOMPLETE PROFILE!\nPlease upload your APC certificate in the My Profile tab before booking clinical shifts.");
      return;
    }

    const tarikhLabel = slot.tarikh.substring(0, 5);
    const confirmation = window.confirm(
      `Apply Shift Request:\n--------------------\n📍 Location: Klinik ARA ${slot.cawangan}\n📅 Date: ${tarikhLabel}\n🕒 Shift hours: ${slot.masa}\n🪙 Base rate: RM ${slot.gaji}\n\nConfirm submission?`
    );

    if (confirmation) {
      const response = await onBookSlot(slot.id, currentUser.name, currentUser.phone);
      alert(response);
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
          Click any date on the calendar below containing indicators. Available shifts for your selected date will materialize underneath.
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

      {/* Active interactive custom clinical schedule */}
      <CustomCalendar
        slots={slots}
        onSlotClick={handleSlotClicked}
        currentUserRole={currentUser.role}
        currentUserPhone={currentUser.phone}
        selectedBranch={selectedBranch}
      />

    </div>
  );
};
