import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomCalendar } from './CustomCalendar';
import { SlotManageModal } from './SlotManageModal';
import { LocumSlot, UserProfile, AdminAlert } from '../types';
import { Plus, Trash2, Calendar, MapPin, Clock, DollarSign, CalendarDays, Key, Users, AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface AdminScheduleTabProps {
  slots: LocumSlot[];
  users: UserProfile[];
  currentUserRole: string;
  onManageSlot: (action: 'DELETE' | 'CANCEL' | 'REPLACE', id: string, phone?: string, manualName?: string) => Promise<string>;
  onEditTiming: (id: string, newMasa: string) => Promise<string>;
  onBulkCreateSlots: (dates: string[], branch: string, time: string, pay: number) => string;
  adminAlerts?: AdminAlert[];
  onDismissAlert?: (id: string) => void;
}

export const AdminScheduleTab: React.FC<AdminScheduleTabProps> = ({
  slots,
  users = [], 
  currentUserRole,
  onManageSlot,
  onEditTiming,
  onBulkCreateSlots,
  adminAlerts = [],
  onDismissAlert
}) => {
  const [selectedBranch, setSelectedBranch] = useState<'All' | 'Seri Kembangan' | 'Kajang'>('All');
  const [managingSlot, setManagingSlot] = useState<LocumSlot | null>(null);

  // Bulk creation planning states
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState('');
  const [bulkBranch, setBulkBranch] = useState('Seri Kembangan');
  const [bulkTime, setBulkTime] = useState('9am-5pm');

  // New non-blocking notification state to replace blocked browser alert()
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Staff clicking an empty (Available) slot — shows a doctor picker so
  // they can WhatsApp one or more doctors directly about the open shift,
  // instead of just being blocked with an access-restricted message.
  const [broadcastSlot, setBroadcastSlot] = useState<LocumSlot | null>(null);

  // Filter available doctors
  const availableDoctors = users.filter(u => {
    const roleStr = (u.role || (u as any).Role || '').toLowerCase().trim();
    return roleStr === 'doctor';
  });

  const handleAddBulkDate = () => {
    setNotification(null);
    if (!dateInput) return;
    if (bulkDates.includes(dateInput)) {
      setNotification({ type: 'error', text: '⚠️ Tarikh ini sudah ada dalam senarai.' });
      return;
    }
    setBulkDates(prev => [...prev, dateInput].sort());
    setDateInput('');
  };

  const handleResetBulk = () => {
    setNotification(null);
    setBulkDates([]);
    setBulkBranch('Seri Kembangan');
    setBulkTime('9am-5pm');
  };

  const handleCreateBulkShift = async (e: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault(); // Prevent unexpected sandbox form reloads
    setNotification(null);

    if (bulkDates.length === 0) {
      setNotification({ 
        type: 'error', 
        text: "⚠️ Sila pilih sekurang-kurangnya satu tarikh sebelum publish." 
      });
      return;
    }

    setIsPublishing(true);

    try {
      // Set payout to 0 as base payout is removed dlm schema Dr
      const response = onBulkCreateSlots(bulkDates, bulkBranch, bulkTime, 0);
      setNotification({ 
        type: 'success', 
        text: response || "✅ Berjaya! Slot jadual baharu telah diterbitkan." 
      });
      setBulkDates([]);
    } catch (err: any) {
      setNotification({ 
        type: 'error', 
        text: err.message || "❌ Gagal untuk menerbitkan slot ke pangkalan data." 
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAdminSlotAct = (slot: LocumSlot) => {
    console.log("Slot clicked:", slot);
    if (!slot) return;
    setNotification(null);

    const currentStatus = (slot.status || '').toLowerCase().trim();

    // Blocked alert() replaced with friendly safe notification UI
    if (currentStatus === 'pending') {
      setNotification({
        type: 'error',
        text: "Status Pending: Sila melawat ke menu 'Booking Approvals' untuk meluluskan permohonan slot ini."
      });
      return;
    }

    if (currentUserRole === 'Staff') {
      // Staff can't manage slots, but if a doctor is already assigned, let
      // them send a quick WhatsApp reminder instead of just blocking them.
      if (currentStatus === 'approved' && slot.dr) {
        // Admin-assigned slots (REPLACE action) often don't capture a phone
        // number directly on the slot record — fall back to looking the
        // doctor up in the Users/Roster table by name.
        let phone = slot.phone;
        if (!phone) {
          const normalize = (s: string) =>
            (s || '').toUpperCase().trim().replace(/^DR\.?\s+/i, '');
          const slotDrNorm = normalize(slot.dr);
          const matchedUser = users.find((u) => {
            const uNameNorm = normalize(u.name);
            return uNameNorm === slotDrNorm || uNameNorm.includes(slotDrNorm) || slotDrNorm.includes(uNameNorm);
          });
          phone = matchedUser?.phone || '';
        }

        if (!phone) {
          setNotification({
            type: 'error',
            text: `⚠️ No phone number found for Dr ${slot.dr} — cannot send WhatsApp reminder.`
          });
          return;
        }

        const drName = slot.dr.toUpperCase().trim().replace(/^DR\.?\s+/i, '');
        const message =
          `Hi Dr. ${drName}, ini peringatan mesra dari Klinik ARA 24 Jam untuk shift anda pada ${slot.tarikh} (${slot.masa}) di Cawangan ${slot.cawangan}. Jumpa doktor esok! Terima kasih! 🙏`;
        const digitsOnly = phone.replace(/\D/g, '');
        const waPhone = digitsOnly.startsWith('0') ? `6${digitsOnly}` : digitsOnly;
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
        window.location.href = waUrl;
        return;
      }

      if (currentStatus === 'available') {
        setBroadcastSlot(slot);
        return;
      }

      setNotification({
        type: 'error',
        text: "🔒 Akses Terhad: Akaun Operations Staff tidak dibenarkan mengurus gantian atau memadam jadual."
      });
      return;
    }

    // Set slot to open management modal
    setManagingSlot(slot);
  };

  return (
    <div className="space-y-4">
      {/* Cancellation heads-up alerts — dismiss once handled */}
      <AnimatePresence mode="popLayout">
        {adminAlerts.length > 0 && (
          <div className="space-y-2.5">
            {adminAlerts.map((alert) => (
              <motion.div
                layout
                key={alert.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 shadow-sm"
              >
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-xs font-bold text-amber-900 leading-snug">
                    {alert.message}
                  </p>
                  <p className="text-[10px] text-amber-600 font-mono">{alert.timestamp}</p>
                </div>
                {onDismissAlert && (
                  <button
                    onClick={() => onDismissAlert(alert.id)}
                    className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                    Read
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Visual calendar display on left side (Col 8) */}
      <div className="xl:col-span-8 space-y-4">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-sm">
          {(['All', 'Seri Kembangan', 'Kajang'] as const).map(branch => (
            <button
              key={branch}
              onClick={() => setSelectedBranch(branch)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                selectedBranch === branch
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-850'
              }`}
            >
              {branch === 'All' ? 'All Branches' : branch === 'Seri Kembangan' ? 'SK branch' : 'Kajang branch'}
            </button>
          ))}
        </div>

        <CustomCalendar
          slots={slots}
          onSlotClick={handleAdminSlotAct}
          currentUserRole="Admin"
          selectedBranch={selectedBranch}
        />
      </div>

      {/* Bulk Planning input panel on right side (Col 4) — Admin only; Staff is read-only */}
      {currentUserRole === 'Staff' ? (
        <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm space-y-2 text-center">
          <Key className="w-6 h-6 text-slate-300 mx-auto" />
          <h5 className="font-display font-bold text-slate-500 tracking-tight text-sm uppercase">
            View-only access
          </h5>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Operations Staff accounts can view the clinical schedule but cannot publish new slots or manage bookings. Click on an assigned doctor's shift to send a WhatsApp reminder.
          </p>
        </div>
      ) : (
      <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-600" />
          <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm uppercase">
            Bulk planners & publishers
          </h5>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          Select multiple dates and publish open locum slots instantly across all doctor workspaces.
        </p>

        {/* Clean Modern Non-blocking Status Notifications */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 relative ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 pr-4">{notification.text}</div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        <form onSubmit={handleCreateBulkShift} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Choose Dates
            </label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddBulkDate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-3 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Date
              </button>
            </div>

            {/* Display queued dates tags drawer */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <AnimatePresence mode="popLayout">
                {bulkDates.map(dStr => {
                  const parts = dStr.split('-');
                  const visualLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
                  return (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      key={dStr}
                      className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-800 font-mono text-xs font-bold px-2.5 py-1 rounded-full border border-sky-100"
                    >
                      {visualLabel}
                      <button
                        type="button"
                        onClick={() => setBulkDates(prev => prev.filter(x => x !== dStr))}
                        className="text-sky-500 hover:text-sky-800 font-bold hover:bg-sky-100 rounded-full h-4.5 w-4.5 flex items-center justify-center p-0 cursor-pointer"
                      >
                        ×
                      </button>
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Target location
              </label>
              <select
                value={bulkBranch}
                onChange={e => setBulkBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                <option value="Seri Kembangan">Seri Kembangan</option>
                <option value="Kajang">Kajang</option>
                <option value="CME / BRIEFING">CME / BRIEFING</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Shift Timing
              </label>
              <input
                type="text"
                required
                value={bulkTime}
                onChange={e => setBulkTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="e.g. 9am-5pm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleResetBulk}
              className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs transition border border-slate-200 cursor-pointer shadow-sm"
            >
              Clear form
            </button>
            <button
              type="submit"
              disabled={isPublishing || bulkDates.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none text-white font-bold py-3 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isPublishing ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></span>
                  <span>Publishing...</span>
                </>
              ) : (
                'Publish slots'
              )}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Modern Beautiful Interactive Custom Slot Management Dialog */}
      <SlotManageModal
        isOpen={managingSlot !== null}
        slot={managingSlot}
        doctors={availableDoctors}
        onClose={() => setManagingSlot(null)}
        onManage={onManageSlot}
        onEditTiming={onEditTiming}
      />

      {/* Staff WhatsApp broadcast picker — pick one or more doctors to
          notify about an open (Available) slot. wa.me links only support
          one recipient at a time, so this opens a fresh WhatsApp chat per
          doctor tapped, letting staff quickly ping several candidates. */}
      <AnimatePresence>
        {broadcastSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setBroadcastSlot(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">Notify Doctors — Open Shift</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {broadcastSlot.tarikh} ({broadcastSlot.masa}) — {broadcastSlot.cawangan}
                  </p>
                </div>
                <button onClick={() => setBroadcastSlot(null)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Tap a doctor to open WhatsApp with a pre-filled message about this open shift.
              </p>
              <div className="space-y-2">
                {availableDoctors.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No doctors found.</p>
                )}
                {availableDoctors.map((doc) => {
                  const digitsOnly = (doc.phone || '').replace(/\D/g, '');
                  const waPhone = digitsOnly.startsWith('0') ? `6${digitsOnly}` : digitsOnly;
                  const message = `Hi/Salam Dr ${doc.name}, KLINIK ARA 24 JAM ${broadcastSlot.cawangan} ada slot kosong pada ${broadcastSlot.tarikh} (${broadcastSlot.masa}). Doktor berminat untuk ambil shift ini?`;
                  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
                  return (
                    <button
                      key={doc.phone}
                      onClick={() => {
                        window.location.href = waUrl;
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition text-sm"
                    >
                      <span className="font-semibold text-slate-700">Dr. {doc.name}</span>
                      <span className="text-emerald-600 text-xs font-bold">WhatsApp →</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setBroadcastSlot(null)}
                className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
};