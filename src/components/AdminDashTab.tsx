import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardCharts } from './DashboardCharts';
import { LocumSlot, UserProfile } from '../types';
import { ClipboardCheck, Sparkles, Filter, CheckCircle2, UserCheck, BarChart2, MessageSquare } from 'lucide-react';

interface AdminDashTabProps {
  slots: LocumSlot[];
  users: UserProfile[];
  onCompleteSlot: (slotId: string, sales: number, patients: number, pay: number, period: string) => string;
}

export const AdminDashTab: React.FC<AdminDashTabProps> = ({
  slots,
  users,
  onCompleteSlot
}) => {
  const [month, setMonth] = useState('06'); // Initialised to June
  const [year, setYear] = useState('2026');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');

  // Close-out states
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [salesVal, setSalesVal] = useState<number>(0);
  const [ptsVal, setPtsVal] = useState<number>(0);
  const [payVal, setPayVal] = useState<number>(0);

  // Statistics summaries
  const monthlySlots = slots.filter(s => {
    const parts = s.tarikh.split('/');
    if (parts.length === 3) {
      return parts[1].padStart(2, '0') === month && parts[2] === year;
    }
    return false;
  });

  const totalShiftsCount = monthlySlots.length;
  const pendingCount = monthlySlots.filter(s => s.status === 'Pending').length;
  const approvedCount = monthlySlots.filter(s => s.status === 'Approved').length;
  const availableCount = monthlySlots.filter(s => s.status === 'Available').length;

  // Filter approved completed shifts of the doctor for editing performance outputs
  const completedApprovedShifts = slots.filter(s => {
    if (s.status !== 'Approved') return false;
    if (selectedDoctorFilter) {
      return s.dr?.toUpperCase().trim().includes(selectedDoctorFilter.toUpperCase().trim());
    }
    return false;
  });

  const uniqueDoctorsList = Array.from(
    new Set(
      slots
        .filter(s => s.status === 'Approved' && s.dr)
        .map(s => s.dr.trim())
    )
  ).sort();

  const handleActiveSlotSelect = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot) {
      if (slot.performanceRecorded) {
        alert("This slot is already closed and performance values are logged.");
        return;
      }
      setSelectedSlotId(slotId);
      setSalesVal(slot.sales || 0);
      setPtsVal(slot.pesakit || 0);
      setPayVal(slot.gaji);
    }
  };

  const handleSavePerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      alert("⚠️ Please select a valid shift/slot ID to update.");
      return;
    }
    
    // Extra safety check before saving
    const currentSlot = slots.find(s => s.id === selectedSlotId);
    if (currentSlot && currentSlot.performanceRecorded) {
      alert("This slot was already closed by someone else.");
      return;
    }

    const period = `${month}/${year}`;
    const resultMsg = await onCompleteSlot(selectedSlotId, salesVal, ptsVal, payVal, period);
    alert(resultMsg);

    // Reset closeout values
    setSelectedSlotId('');
    setSalesVal(0);
    setPtsVal(0);
    setPayVal(0);
  };

  return (
    <div className="space-y-6">
      {/* Date Filters Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm">Clinical Insights Filter</h5>
          <p className="text-xs text-slate-500">Filter parameters determine chart scopes and leaderboards</p>
        </div>

        <div className="flex gap-2.5">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
          >
            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
              <option key={m} value={m}>
                {m === '01' ? 'January' : m === '02' ? 'February' : m === '03' ? 'March' : m === '04' ? 'April' : m === '05' ? 'May' : m === '06' ? 'June' : m === '07' ? 'July' : m === '08' ? 'August' : m === '09' ? 'September' : m === '10' ? 'October' : m === '11' ? 'November' : 'December'}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
          >
            {['2025', '2026', '2027'].map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics Counter Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
          <span className="text-[10px] tracking-wider text-slate-400 font-bold block uppercase font-sans">Total active slots</span>
          <h2 className="font-display text-2xl font-extrabold text-indigo-950 pt-1">{totalShiftsCount}</h2>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
          <span className="text-[10px] tracking-wider text-amber-600 font-bold block uppercase font-sans">Pending Approval</span>
          <h2 className="font-display text-2xl font-extrabold text-amber-500 pt-1">{pendingCount}</h2>
        </div>
        <div className="bg-emerald-50/35 border border-emerald-250 p-5 rounded-xl shadow-sm text-center">
          <span className="text-[10px] tracking-wider text-emerald-700 font-bold block uppercase font-sans">Approved shifts</span>
          <h2 className="font-display text-2xl font-extrabold text-emerald-700 pt-1">{approvedCount}</h2>
        </div>
        <div className="bg-slate-50/50 border border-slate-250 p-5 rounded-xl shadow-sm text-center">
          <span className="text-[10px] tracking-wider text-slate-500 font-bold block uppercase font-sans">Unfilled hours</span>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 pt-1">{availableCount}</h2>
        </div>
      </div>

      {/* Interactive Charts Dashboard Wrapper */}
      <DashboardCharts
        pastSlots={monthlySlots}
        users={users}
        selectedMonth={month}
        selectedYear={year}
      />

      {/* Clinical Close-out Data Form Panel - PRESERVED HYBRID LOGIC */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h5 className="font-display font-medium text-slate-900 tracking-tight text-sm uppercase flex items-center gap-1.5 font-bold">
            <ClipboardCheck className="w-4 h-4 text-indigo-650" />
            Clinical Performance Close-Out Form
          </h5>
          <p className="text-xs text-slate-500">Log clinic production parameters for approved locum doctor shifts</p>
        </div>

        {/* Form controls layout */}
        <div className="space-y-4">
          <div className="space-y-1.5 max-w-sm">
            <label className="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Filter by Doctor list
            </label>
            <select
              value={selectedDoctorFilter}
              onChange={e => {
                setSelectedDoctorFilter(e.target.value);
                setSelectedSlotId('');
              }}
              className="w-full bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">-- Choose Doctor to Close Shift --</option>
              {uniqueDoctorsList.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <AnimatePresence mode="popLayout">
            {selectedDoctorFilter && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 border-t border-slate-100 pt-4"
              >
                {completedApprovedShifts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No approved shifts requiring close-out actions for Dr. {selectedDoctorFilter} in this database.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Shift list cards to choose */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                      <span className="text-[10px] tracking-wider text-slate-400 font-bold block uppercase mb-1">
                        Select Pending Completed Shift/Slot
                      </span>
                      {completedApprovedShifts.map(s => {
                        const isChosen = selectedSlotId === s.id;
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (s.performanceRecorded) {
                                alert("This slot is already closed and performance values are logged.");
                                return;
                              }
                              handleActiveSlotSelect(s.id);
                            }}
                            className={`p-3 rounded-2xl border text-xs cursor-pointer transition ${
                              isChosen
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-600'
                            } ${s.performanceRecorded ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <div className="font-bold">{s.tarikh} ({s.masa})</div>
                            <div className="text-slate-500">Branch: {s.cawangan} | Base Pay: RM {s.gaji}</div>
                            {s.performanceRecorded ? (
                              <div className="inline-block mt-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wide">
                                ✓ Done
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Performance values editor input panel */}
                    <AnimatePresence mode="popLayout">
                      {selectedSlotId && (
                        <motion.form
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          onSubmit={handleSavePerformance}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
                        >
                          <span className="text-[10px] tracking-wider text-indigo-900 font-bold block uppercase">
                            Enter shift output parameters
                          </span>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Sales RM</label>
                              <input
                                type="number"
                                required
                                value={salesVal || ''}
                                onChange={e => setSalesVal(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Patients pts</label>
                              <input
                                type="number"
                                required
                                value={ptsVal || ''}
                                onChange={e => setPtsVal(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Payout RM</label>
                              <input
                                type="number"
                                required
                                value={payVal || ''}
                                onChange={e => setPayVal(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs w-full shadow-sm mt-3 transition cursor-pointer uppercase tracking-wider"
                          >
                            Save Shift Closing Parameters
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
