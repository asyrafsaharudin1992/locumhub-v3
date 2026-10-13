import React, { useState } from 'react';
import { motion } from 'motion/react';
import { EyeOff } from 'lucide-react';

interface SlotRestrictionModalProps {
  doctor: { phone: string; name: string };
  timeOptions: { key: string; label: string }[];
  initialAllowedTimes: string[] | null;
  onSave: (allowedTimes: string[]) => Promise<void>;
  onClose: () => void;
}

/** Admin-only: choose which shift times a doctor can see when booking.
 * The doctor is never notified — other slots simply don't appear for them. */
export const SlotRestrictionModal: React.FC<SlotRestrictionModalProps> = ({
  doctor,
  timeOptions,
  initialAllowedTimes,
  onSave,
  onClose,
}) => {
  const [restricted, setRestricted] = useState(Boolean(initialAllowedTimes?.length));
  const [selected, setSelected] = useState<string[]>(initialAllowedTimes || []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Keep previously-saved times visible even if no current slot uses them.
  const options = [
    ...timeOptions,
    ...(initialAllowedTimes || [])
      .filter((key) => !timeOptions.some((o) => o.key === key))
      .map((key) => ({ key, label: key })),
  ];

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleSave = async () => {
    if (restricted && selected.length === 0) {
      setError('Pick at least one shift time, or switch to "All slots".');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSave(restricted ? selected : []);
      onClose();
    } catch (err) {
      console.error('Failed to save slot restriction:', err);
      setError('Could not save. Check that the doctor_slot_restrictions table exists in Supabase.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
      >
        <h3 className="font-display font-medium text-lg text-slate-900 mb-1">Slot Access</h3>
        <p className="text-sm text-slate-500 mb-4">
          Dr. {doctor.name} ({doctor.phone})
        </p>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setRestricted(false)}
            className={`flex-1 py-2 rounded-lg transition ${!restricted ? 'bg-[#001F3F] text-white shadow-sm' : 'text-slate-600'}`}
          >
            All slots
          </button>
          <button
            type="button"
            onClick={() => setRestricted(true)}
            className={`flex-1 py-2 rounded-lg transition ${restricted ? 'bg-[#001F3F] text-white shadow-sm' : 'text-slate-600'}`}
          >
            Only selected times
          </button>
        </div>

        {restricted && (
          <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-100 mb-4">
            {options.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 italic text-center">No shift times found in the schedule yet.</p>
            ) : (
              options.map((option) => (
                <label key={option.key} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.key)}
                    onChange={() => toggle(option.key)}
                    className="h-4 w-4 accent-[#001F3F]"
                  />
                  <span className="font-semibold">{option.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">{option.key}</span>
                </label>
              ))
            )}
          </div>
        )}

        <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-snug mb-4">
          <EyeOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
          The doctor is not notified. Slots at other times are simply hidden from their booking page.
        </p>

        {error && <p className="text-xs text-rose-600 font-semibold mb-3">{error}</p>}

        <div className="flex gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-650 py-2.5 hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-[#001F3F] text-white hover:bg-[#001226] rounded-xl py-2.5 shadow-md disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
