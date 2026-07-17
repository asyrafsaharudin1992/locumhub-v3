import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, Clock, Trash2, RotateCcw, UserPlus, AlertTriangle } from 'lucide-react';
import { LocumSlot, UserProfile } from '../types';

interface SlotManageModalProps {
  isOpen: boolean;
  slot: LocumSlot | null;
  doctors: UserProfile[];
  onClose: () => void;
  onManage: (action: 'DELETE' | 'CANCEL' | 'REPLACE', id: string, phone?: string, manualName?: string) => Promise<string>;
  onEditTiming: (id: string, newMasa: string) => Promise<string>;
}

type ManagementAction = 'REPLACE' | 'RESET' | 'DELETE';

export const SlotManageModal: React.FC<SlotManageModalProps> = ({
  isOpen,
  slot: incomingSlot,
  doctors = [], 
  onClose,
  onManage,
  onEditTiming,
}) => {
  const [selectedAction, setSelectedAction] = useState<ManagementAction>('REPLACE');
  const [chosenDoctorPhone, setChosenDoctorPhone] = useState<string>('');
  const [manualDoctorName, setManualDoctorName] = useState<string>('');
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isEditingTiming, setIsEditingTiming] = useState<boolean>(false);
  const [editedMasa, setEditedMasa] = useState<string>('');
  const [isSavingTiming, setIsSavingTiming] = useState<boolean>(false);

  const [slot, setSlot] = useState<LocumSlot | null>(null);

  React.useEffect(() => {
    if (incomingSlot) {
      setSlot(incomingSlot);
      setEditedMasa(incomingSlot.masa || '');
    }
  }, [incomingSlot]);

  React.useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      setIsSubmitting(false);
      setChosenDoctorPhone('');
      setManualDoctorName('');
      setIsManualInput(false);
      setSelectedAction('REPLACE');
      setIsEditingTiming(false);
      setIsSavingTiming(false);
    }
  }, [isOpen]);

  const handleSaveTiming = async () => {
    if (!slot || !editedMasa.trim()) return;
    setIsSavingTiming(true);
    setStatusMessage(null);
    try {
      const result = await onEditTiming(slot.id, editedMasa.trim());
      setStatusMessage({ type: 'success', text: result });
      setSlot((prev) => (prev ? { ...prev, masa: editedMasa.trim() } : prev));
      setIsEditingTiming(false);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to update timing. Please try again.' });
    } finally {
      setIsSavingTiming(false);
    }
  };

  const currentDocName = slot?.nama_locum || slot?.dr || 'OPEN';
  const slotDr = currentDocName !== 'OPEN' ? `DR ${currentDocName.toUpperCase().trim().replace(/^DR\s+/i, '')}` : 'OPEN';

  const slotPayment = slot?.bayaran || slot?.gaji || '0';

  const handleExecute = async () => {
    if (!slot) return;
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      if (selectedAction === 'REPLACE') {
        if (isManualInput) {
          if (!manualDoctorName.trim()) {
            throw new Error('⚠️ Sila masukkan nama doktor manual.');
          }
          const res = await onManage('REPLACE', slot.id, undefined, manualDoctorName.trim());
          setStatusMessage({ type: 'success', text: res });
        } else {
          if (!chosenDoctorPhone) {
            throw new Error('⚠️ Sila pilih doktor dari senarai.');
          }
          const res = await onManage('REPLACE', slot.id, chosenDoctorPhone, undefined);
          setStatusMessage({ type: 'success', text: res });
        }
      } else if (selectedAction === 'RESET') {
        const res = await onManage('CANCEL', slot.id);
        setStatusMessage({ type: 'success', text: res });
      } else if (selectedAction === 'DELETE') {
        const res = await onManage('DELETE', slot.id);
        setStatusMessage({ type: 'success', text: res });
      }

      setTimeout(() => {
        onClose();
        setManualDoctorName('');
        setChosenDoctorPhone('');
        setIsManualInput(false);
        setStatusMessage(null);
        setIsSubmitting(false);
      }, 1500);

    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Tindakan gagal diproses.' });
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && slot && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-auto">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-150 overflow-hidden flex flex-col z-10 pointer-events-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-display font-bold text-base tracking-tight leading-none">
                    Manage Schedule Slot
                  </h4>
                  <p className="text-[10px] text-indigo-200 font-mono tracking-wider mt-1 uppercase">
                    ID: {slot.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Container */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Slot Details Banner */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Klinik ARA {slot.cawangan}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">📅 Date</span>
                    <div className="text-sm font-bold text-slate-800">{slot.tarikh}</div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">🕒 Shift Timing</span>
                    {isEditingTiming ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editedMasa}
                          onChange={(e) => setEditedMasa(e.target.value)}
                          placeholder="e.g. 8am-8pm"
                          autoFocus
                          className="text-sm font-bold text-slate-800 border border-indigo-200 rounded-lg px-2 py-1 w-full outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTiming}
                          disabled={isSavingTiming || !editedMasa.trim()}
                          className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2 py-1.5 disabled:opacity-50 shrink-0"
                        >
                          {isSavingTiming ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingTiming(false);
                            setEditedMasa(slot.masa || '');
                          }}
                          disabled={isSavingTiming}
                          className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1.5 shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingTiming(true)}
                        className="text-sm font-bold text-slate-800 cursor-pointer hover:text-indigo-600 flex items-center gap-1.5 group"
                      >
                        <span>{slot.masa}</span>
                        <span className="text-[9px] text-slate-400 group-hover:text-indigo-500 font-bold uppercase tracking-widest">
                          (click to edit)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-150 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Current Doctor</span>
                    <div className="text-sm font-extrabold text-indigo-950 font-sans flex items-center gap-1.5">
                      <span>👨‍⚕️</span>
                      <span>{slotDr}</span>
                    </div>
                  </div>
                  <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 text-right">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest block">Payment</span>
                    {Number(slotPayment) > 0 ? (
                      <span className="text-sm font-bold text-indigo-750 font-mono">RM {slotPayment}</span>
                    ) : (
                      <span className="text-[10px] font-bold text-indigo-700">
                        Refer to noticeboard tab for locum rate
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toast Status Message */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl border text-xs font-bold text-center ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {statusMessage.text}
                </motion.div>
              )}

              {/* Action Buttons Tabs Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block font-sans">
                  Please Select Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedAction('REPLACE'); setStatusMessage(null); }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition cursor-pointer gap-2 ${
                      selectedAction === 'REPLACE'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserPlus className={`w-5 h-5 ${selectedAction === 'REPLACE' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] tracking-tight leading-tight uppercase font-bold">Replace / Assign</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedAction('RESET'); setStatusMessage(null); }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition cursor-pointer gap-2 ${
                      selectedAction === 'RESET'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className={`w-5 h-5 ${selectedAction === 'RESET' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] tracking-tight leading-tight uppercase font-bold">Reset Available</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedAction('DELETE'); setStatusMessage(null); }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition cursor-pointer gap-2 ${
                      selectedAction === 'DELETE'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold ring-2 ring-rose-500/20 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2 className={`w-5 h-5 ${selectedAction === 'DELETE' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] tracking-tight leading-tight uppercase font-bold">Delete Slot</span>
                  </button>
                </div>
              </div>

              {/* Dynamic View Panels */}
              <div className="pt-2">
                {selectedAction === 'REPLACE' && (
                  <div className="space-y-4">
                    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-full border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsManualInput(false)}
                        className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition cursor-pointer ${
                          !isManualInput ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Select from Doctor List
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsManualInput(true)}
                        className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition cursor-pointer ${
                          isManualInput ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Enter Name Manually
                      </button>
                    </div>

                    {!isManualInput ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                          Select Doctor
                        </label>
                        <select
                          value={chosenDoctorPhone}
                          onChange={(e) => setChosenDoctorPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="">-- Please Select Doctor --</option>
                          {doctors.map((doc) => {
                            const docPhone = doc.phone || (doc as any).Phone || '';
                            const docName = doc.name || (doc as any).nama || (doc as any).Nama || 'DOCTOR';
                            return (
                              <option key={docPhone} value={docPhone}>
                                Dr. {docName.toUpperCase().trim()} ({docPhone})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                          Doctor Name (External / Manual)
                        </label>
                        <input
                          type="text"
                          value={manualDoctorName}
                          onChange={(e) => setManualDoctorName(e.target.value)}
                          placeholder="Example: Dr. John"
                          className="w-full bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedAction === 'RESET' && (
                  <div className="bg-amber-50/50 border border-amber-150 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-amber-900">Are you sure you want to reset?</p>
                      <p className="text-amber-700 leading-relaxed font-medium">
                        This action will clear existing doctor bookings and change this slot status back to <span className="font-bold">AVAILABLE</span>.
                      </p>
                    </div>
                  </div>
                )}

                {selectedAction === 'DELETE' && (
                  <div className="bg-rose-50/60 border border-rose-150 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-rose-900 text-sm">🚨 CRITICAL WARNING!</p>
                      <p className="text-rose-700 leading-relaxed font-semibold">
                        This slot will be deleted permanently. This action <span className="text-rose-950 font-extrabold underline">CANNOT BE UNDONE</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Button Bar */}
            <div className="bg-slate-50 px-6 py-4.5 border-t border-slate-150 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={isSubmitting}
                className={`text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  selectedAction === 'REPLACE'
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    : selectedAction === 'RESET'
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    Saving...
                  </span>
                ) : (
                  'Confirm Action'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};