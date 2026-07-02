import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, AlertTriangle, RefreshCw, Scale } from 'lucide-react';

export const PediatricCalculator: React.FC = () => {
  const [weight, setWeight] = useState<number>(10);
  const [customMg, setCustomMg] = useState<number>(120);
  const [customMl, setCustomMl] = useState<number>(5);
  const [targetDose, setTargetDose] = useState<number>(15);

  // Calculate Dose
  const mgPerMl = customMg / (customMl || 1);
  const totalMgRequired = weight * targetDose;
  const volumeMl = totalMgRequired / (mgPerMl || 1);

  const handleClear = () => {
    setWeight(10);
    setCustomMg(120);
    setCustomMl(5);
    setTargetDose(15);
  };

  return (
    <div className="w-full max-w-xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Visual Header Banner */}
      <div className="bg-indigo-900 p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300">
            <Calculator className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-display text-lg font-bold tracking-tight">Pediatric Dose Calculator</h4>
            <p className="text-xs text-sky-200">Clinical-grade formulation helper</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-xs flex items-center gap-1.5 text-sky-300 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Step 1: Weight input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              Patient's Weight (kg)
            </label>
            <span className="text-sm font-mono font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md">
              {weight.toFixed(1)} kg
            </span>
          </div>

          <div className="flex gap-4 items-center">
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <input
              type="number"
              min="1"
              max="150"
              value={weight || ''}
              onChange={(e) => setWeight(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              onBlur={(e) => { if (!e.target.value || parseFloat(e.target.value) < 1) setWeight(1); }}
              className="w-20 font-mono text-center font-bold text-slate-850 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Step 2: Formulation Strengths (manual entry) */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">
              Strength (mg)
            </label>
            <input
              type="number"
              value={customMg || ''}
              onChange={(e) => setCustomMg(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
              onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) setCustomMg(1); }}
              className="w-full text-center font-mono font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-750"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">
              In Volume (ml)
            </label>
            <input
              type="number"
              value={customMl || ''}
              onChange={(e) => setCustomMl(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
              onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) setCustomMl(1); }}
              className="w-full text-center font-mono font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-750"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">
              Target Dose (mg/kg)
            </label>
            <input
              type="number"
              value={targetDose || ''}
              onChange={(e) => setTargetDose(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              onBlur={(e) => { if (!e.target.value || parseFloat(e.target.value) < 1) setTargetDose(1); }}
              className="w-full text-center font-mono font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-750"
            />
          </div>
        </div>

        {/* Calculations display panel */}
        <motion.div
          layout
          className="rounded-xl bg-gradient-to-br from-indigo-50/45 via-indigo-50/20 to-blue-50/30 border border-indigo-150 p-5 text-center relative overflow-hidden"
        >
          <span className="text-[10px] font-bold tracking-widest text-indigo-900 block mb-1 uppercase">
            Recommended volume
          </span>
          <div className="flex goods-center justify-center gap-1">
            <h1 className="font-display text-4xl sm:text-5xl font-black text-indigo-950">
              {volumeMl.toFixed(2)}
            </h1>
            <span className="font-display text-lg font-bold text-indigo-900 self-end mb-1">
              ml
            </span>
          </div>
        </motion.div>

        {/* Important security caution warning panel */}
        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-rose-800 leading-snug flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider">CRITICAL CLINICAL SAFEGUARD</p>
            <p className="text-xs text-rose-600 font-sans">
              Always double-verify if the target dose is <strong>per single dose</strong> (mg/kg/dose) or <strong>per 24-hr day</strong> (mg/kg/day) partitioned across intervals. Consult latest MOH Clinical Practice Guidelines (CPG) prior to prescription.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
