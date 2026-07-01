import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, Plus, Info } from 'lucide-react';
import { LocumSlot } from '../types';

interface CustomCalendarProps {
  slots: LocumSlot[];
  onSlotClick?: (slot: LocumSlot) => void;
  currentUserRole?: string;
  currentUserPhone?: string;
  selectedBranch?: string; // "Seri Kembangan" | "Kajang" | "All"
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  slots,
  onSlotClick,
  selectedBranch = 'All'
}) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 14)); // Initialised to June 14, 2026
  const [selectedDay, setSelectedDay] = useState<number>(14);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper date generators
  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(month, year);
  const firstDayIndex = getFirstDayOfMonth(month, year);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  // Parse custom format "DD/MM/YYYY" to find matching slots for a specific day in the active view's month/year
  const getSlotsForDate = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dStr = `${formattedDay}/${formattedMonth}/${year}`;

    return slots.filter(slot => {
      const dateMatch = slot.tarikh === dStr;
      
      if (selectedBranch !== 'All') {
        const branchCheck = slot.cawangan.toLowerCase().includes(selectedBranch.toLowerCase());
        return dateMatch && branchCheck;
      }
      return dateMatch;
    });
  };

  // Full date query (handles previous/next month days in the grid)
  const getSlotsForFullDate = (day: number, mIdx: number, yVal: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(mIdx + 1).padStart(2, '0');
    const dStr = `${formattedDay}/${formattedMonth}/${yVal}`;

    return slots.filter(slot => {
      const dateMatch = slot.tarikh === dStr;
      
      if (selectedBranch !== 'All') {
        const branchCheck = slot.cawangan.toLowerCase().includes(selectedBranch.toLowerCase());
        return dateMatch && branchCheck;
      }
      return dateMatch;
    });
  };

  // Helper to color-code slots based on Branch (Cawangan) & Status
  const getSlotStyles = (slot: LocumSlot) => {
    const branchLower = slot.cawangan.toLowerCase();
    const isSK = branchLower.includes('seri') || branchLower.includes('kembangan') || branchLower.includes('sk');
    const isKajang = branchLower.includes('kajang') || branchLower.includes('kj');
    const isCME = branchLower.includes('cme') || branchLower.includes('briefing') || branchLower.includes('cme / briefing');

    if (slot.status === 'Approved') {
      if (isSK) {
        return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-sm';
      }
      if (isKajang) {
        return 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600 shadow-sm';
      }
      if (isCME) {
        return 'bg-purple-500 hover:bg-purple-600 text-white border-purple-600 shadow-sm';
      }
      return 'bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-600 shadow-sm';
    }

    if (slot.status === 'Pending') {
      return 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm';
    }

    // Available / Open turns to a bright red color to stand out immediately
    return 'bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-sm font-bold';
  };

  const getSlotText = (slot: LocumSlot) => {
    const timeLabel = slot.masa || '';
    if (slot.status === 'Approved') {
      const name = slot.dr ? slot.dr.toUpperCase().trim() : 'APPROVED';
      const cleanName = name.startsWith('DR') ? name : `DR ${name}`;
      return `${cleanName} [${timeLabel}]`;
    }
    if (slot.status === 'Pending') {
      const name = slot.dr ? slot.dr.toUpperCase().trim() : 'PENDING';
      const cleanName = name.startsWith('DR') ? name : `DR ${name}`;
      return `⏳ ${cleanName} [${timeLabel}]`;
    }
    return `OPEN [${timeLabel}]`;
  };

  // Generate full grid cells (35 or 42 grid cells)
  const getFullGridCells = () => {
    const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
    const cells = [];
    
    // 1. Previous month trailing days
    const prevMonthIndex = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthDays = getDaysInMonth(prevMonthIndex, prevYear);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        month: prevMonthIndex,
        year: prevYear,
        isCurrentMonth: false
      });
    }
    
    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true
      });
    }
    
    // 3. Next month leading days
    const nextMonthIndex = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        month: nextMonthIndex,
        year: nextYear,
        isCurrentMonth: false
      });
    }
    return cells;
  };

  const gridCells = getFullGridCells();
  const selectedDateSlots = getSlotsForDate(selectedDay);

  // Mobile layout helpers
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blankCells = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <div className="w-full">
      {/* =========================================================================
          DESKTOP CALENDAR VIEW (Direct Scheduler Table)
          ========================================================================= */}
      <div className="hidden md:block w-full space-y-4">
        {/* Calendar control header bar */}
        <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <h4 className="font-display font-bold text-slate-800 text-lg">
                {monthNames[month]} {year}
              </h4>
            </div>

            {/* Custom Branch Color-coding Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                Seri Kembangan (Booked)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-sky-500 inline-block" />
                Kajang (Booked)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-purple-500 inline-block" />
                CME / Briefing (Booked)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
                Pending Approval
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-red-500 inline-block" />
                Open Shift (Red)
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Clinical Schedule Weekdays Title Header Grid */}
          <div className="grid grid-cols-7 border-b border-slate-150 pb-2 text-center">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-xs font-bold tracking-wider uppercase py-1 ${
                  idx === 0 || idx === 6 ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid with Stacked Badges */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {gridCells.map((cell, idx) => {
              const cellSlots = getSlotsForFullDate(cell.day, cell.month, cell.year);
              
              return (
                <div
                  key={`cell-${idx}`}
                  className={`min-h-[120px] p-2 flex flex-col justify-between transition ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  {/* Top day label bar */}
                  <div className="flex justify-between items-start">
                    <span />
                    <span className={`text-xs font-bold ${
                      cell.isCurrentMonth 
                        ? 'text-slate-800' 
                        : 'text-slate-400'
                    }`}>
                      {cell.day}
                    </span>
                  </div>

                  {/* Vertical badge list */}
                  <div className="flex-1 flex flex-col gap-1 mt-1.5 overflow-y-auto max-h-[100px] scrollbar-thin">
                    {cellSlots.length > 0 ? (
                      cellSlots.map(slot => {
                        const bgClasses = getSlotStyles(slot);
                        const labelText = getSlotText(slot);

                        return (
                          <button
                            type="button"
                            key={slot.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onSlotClick) onSlotClick(slot);
                            }}
                            className={`w-full text-[10px] font-bold py-1 px-1.5 rounded-lg border text-left transition truncate cursor-pointer ${bgClasses}`}
                            title={`${slot.cawangan} | ${slot.masa} | ${slot.dr || 'Open'}`}
                          >
                            {labelText}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[9px] text-slate-300 font-medium italic mt-1 select-none">No slots</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE CALENDAR VIEW (Fallback Selector and Cards)
          ========================================================================= */}
      <div className="block md:hidden w-full space-y-4">
        {/* Calendar month selector header card */}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-sky-600" />
              <h5 className="font-display font-bold text-slate-900 tracking-tight text-sm">
                {monthNames[month]} {year}
              </h5>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of week headings */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-[10px] font-bold tracking-wider uppercase py-1 ${
                  idx === 0 || idx === 6 ? 'text-rose-500/80' : 'text-slate-400'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {blankCells.map(cellIdx => (
              <div key={`blank-${cellIdx}`} className="aspect-square bg-slate-50/50 rounded-xl" />
            ))}

            {daysArray.map(day => {
              const daySlots = getSlotsForDate(day);
              const isSelected = selectedDay === day;
              const hasAvailable = daySlots.some(s => s.status === 'Available');
              const hasPending = daySlots.some(s => s.status === 'Pending');
              const hasApproved = daySlots.some(s => s.status === 'Approved');

              // Quick visual checks for indicators
              let badgeColor = '';
              if (hasAvailable) {
                badgeColor = 'bg-red-500';
              } else if (hasPending) {
                badgeColor = 'bg-amber-400';
              } else if (hasApproved) {
                badgeColor = 'bg-indigo-500';
              }

              return (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={`day-${day}`}
                  onFocus={() => setSelectedDay(day)}
                  onClick={() => setSelectedDay(day)}
                  className={`relative aspect-square flex flex-col justify-between items-center p-1.5 rounded-2xl border text-xs transition-all ${
                    isSelected
                      ? 'bg-[#001F3F] text-white border-[#001F3F] font-bold shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-100'
                  }`}
                >
                  <span className="self-start text-[11px] font-medium leading-none">{day}</span>
                  
                  {/* Dot markers */}
                  {daySlots.length > 0 && (
                    <div className="flex gap-1 items-center justify-center mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : badgeColor}`} />
                      {daySlots.length > 1 && (
                        <span className="text-[8px] font-mono opacity-80 scale-90">
                          {daySlots.length}
                        </span>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Session Details Panel */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50/30 p-2.5 space-y-3">
          <h6 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase px-2.5 pt-1.5">
            Sessions on {String(selectedDay).padStart(2,'0')} {monthNames[month]} {year}
          </h6>

          <AnimatePresence mode="popLayout">
            {selectedDateSlots.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-400"
              >
                <p className="text-xs">No active locum schedules for this date.</p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {selectedDateSlots.map((slot) => {
                  const isSK = slot.cawangan.toLowerCase().includes('sk') || slot.cawangan.toLowerCase().includes('seri');
                  const badgeStyle = slot.status === 'Available'
                    ? 'bg-red-50 text-red-700 border-red-100'
                    : slot.status === 'Pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-100';

                  return (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 p-4 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="space-y-1">
                          {/* Branch badge */}
                          <div className="flex items-center gap-1 mb-1">
                            <MapPin className={`w-3.5 h-3.5 ${isSK ? 'text-sky-600' : 'text-emerald-600'}`} />
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${isSK ? 'text-sky-800' : 'text-emerald-800'}`}>
                              Klinik ARA {slot.cawangan}
                            </span>
                          </div>
                          {/* Time frame */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{slot.masa}</span>
                          </div>

                          {/* Requirement 3: Show which doctor is on shift */}
                          {slot.dr ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onSlotClick) onSlotClick(slot);
                              }}
                              className="mt-2.5 text-xs font-bold text-indigo-700 bg-indigo-550/10 py-1 px-2.5 rounded-xl w-fit flex items-center gap-1.5 cursor-pointer hover:bg-indigo-100 transition"
                            >
                              <span>👨‍⚕️</span>
                              <span>Dr. {slot.dr.toUpperCase().trim().replace(/^DR\s+/i, '')}</span>
                            </button>
                          ) : (
                            <div className="mt-2.5 text-xs font-bold text-red-700 bg-red-50 py-1 px-2.5 rounded-xl w-fit flex items-center gap-1.5">
                              <span>🚨</span>
                              <span>Open Shift (Vacant)</span>
                            </div>
                          )}
                        </div>

                        {/* Status pill identifier */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badgeStyle}`}>
                          {slot.status === 'Available' ? 'Open' : slot.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2.5">
                        <div className="flex-1"></div>

                        {onSlotClick && (
                          <button
                            type="button"
                            onClick={() => onSlotClick(slot)}
                            className={`text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                              slot.status === 'Available'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                                : slot.status === 'Pending'
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {slot.status === 'Available' ? (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                Apply Book
                              </>
                            ) : (
                              'Manage Slot'
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
