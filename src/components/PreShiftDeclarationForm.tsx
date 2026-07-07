import React, { useState, useEffect } from 'react';
import { saveShiftDeclarationToSupabase, fetchUsersFromSupabase } from '../supabaseService';
import { UserProfile } from '../types';

const BRANCHES = ['Kajang', 'Seri Kembangan', 'Semenyih'];

export const DECLARATION_TEXT = [
  {
    title: '1. Use of Latest Malaysian Guidelines',
    body: [
      'All clinical decisions and patient management throughout this shift will be based on the latest guidelines provided by the Malaysian Ministry of Health (KKM).',
      'I will ensure evidence-based and up-to-date practices are maintained throughout my shift.',
    ],
  },
  {
    title: '2. Pathway for Case Discussion',
    body: [
      'For any complex, complicated, or emergency case during this shift, I will contact the standby resident doctor on call immediately for case discussion and advice.',
      'I will ensure relevant patient information (including a screenshot of the case file where needed) is prepared and available for discussion.',
      'I will follow the instructions and advice provided by the resident doctor promptly, and document the discussion and its outcome in the patient\u2019s medical notes.',
    ],
  },
  {
    title: '3. High-Risk Patient Management',
    body: [
      'All high-risk patients (e.g., elderly, patients with comorbidities, or unstable vital signs) will be identified and managed appropriately according to KKM guidelines.',
    ],
  },
  {
    title: '4. Emergency Case Ambulance Protocol',
    body: [
      'In the event of an emergency case, the appropriate ambulance protocol will be followed. If a patient declines ambulance service, an At Own Risk (AOR) form will be signed by the patient and documented.',
    ],
  },
  {
    title: '5. Safe Prescription of Medication',
    body: [
      'All medications prescribed will be reviewed for possible contraindications and interactions. High-risk medications will be used only when absolutely necessary and in line with guidelines.',
    ],
  },
  {
    title: '6. Patient Follow-Up Plan',
    body: [
      'All patients, especially those with unresolved or chronic conditions, will be given clear follow-up plans and instructions, and informed about symptoms that require urgent attention.',
    ],
  },
  {
    title: '7. Accurate Documentation',
    body: [
      'All patient interactions, diagnoses, treatments, and advice will be thoroughly and accurately documented in the patient\u2019s medical record.',
    ],
  },
  {
    title: '8. Declaration of Conduct and Compliance',
    body: [
      'I will not engage in any misconduct or deviation from the expected standards of professional behaviour during my shift.',
      'I will adhere to all clinical practice guidelines outlined by the Malaysian Ministry of Health (KKM).',
      'I will actively seek guidance and support from colleagues or the standby resident doctor when necessary to ensure safe and appropriate patient care.',
    ],
  },
];

interface PreShiftDeclarationFormProps {
  initialBranch?: string;
}

export const PreShiftDeclarationForm: React.FC<PreShiftDeclarationFormProps> = ({
  initialBranch,
}) => {
  const [branch, setBranch] = useState(
    initialBranch && BRANCHES.includes(initialBranch) ? initialBranch : BRANCHES[0],
  );
  const [doctors, setDoctors] = useState<UserProfile[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [residentDoctorName, setResidentDoctorName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const users = await fetchUsersFromSupabase();
        const doctorList = (users || [])
          .filter((u) => u.role === 'Doctor')
          .sort((a, b) => a.name.localeCompare(b.name));
        setDoctors(doctorList);
      } catch (err) {
        console.error('Failed to load doctor list:', err);
      } finally {
        setLoadingDoctors(false);
      }
    })();
  }, []);

  const handleDoctorSelect = (phone: string) => {
    setDoctorPhone(phone);
    const match = doctors.find((d) => d.phone === phone);
    setDoctorName(match ? match.name : '');
  };

  const handleSubmit = async () => {
    if (!doctorName.trim()) {
      setError('Please select your name from the list.');
      return;
    }
    if (!acknowledged) {
      setError('Please read and acknowledge the declaration before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    const res = await saveShiftDeclarationToSupabase({
      doctorName: doctorName.trim(),
      doctorPhone: doctorPhone.trim() || undefined,
      branch,
      residentDoctorName: residentDoctorName.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
    } else {
      setError('Something went wrong submitting your declaration. Please try again or notify the admin.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-slate-800">Declaration Submitted</h2>
          <p className="text-sm text-slate-500">
            Thank you, Dr. {doctorName}. Your pre-shift declaration for{' '}
            <strong>{branch}</strong> has been recorded. Have a safe and productive shift!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1 pb-4 border-b border-slate-100">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            Klinik ARA 24 Jam
          </p>
          <h1 className="text-xl font-bold text-slate-800">
            Locum Doctor: Declaration &amp; Rules of Safe Clinical Practice
          </h1>
          <p className="text-xs text-slate-400">To be completed before starting your shift</p>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          All locum doctors are required to adhere to the following rules of safe clinical
          practice before starting their shift. Please read carefully and agree to the terms
          below to ensure the highest standard of patient care and safety.
        </p>

        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
          {DECLARATION_TEXT.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-bold text-slate-700 mb-1">{section.title}</h3>
              <ul className="list-disc list-inside space-y-0.5">
                {section.body.map((line, i) => (
                  <li key={i} className="text-[11px] text-slate-500 leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-3 cursor-pointer"
            >
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Your Name (Locum Doctor)
            </label>
            <select
              value={doctorPhone}
              onChange={(e) => handleDoctorSelect(e.target.value)}
              disabled={loadingDoctors}
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-3 cursor-pointer disabled:opacity-60"
            >
              <option value="">
                {loadingDoctors ? 'Loading doctors...' : '-- Select your name --'}
              </option>
              {doctors.map((d) => (
                <option key={d.phone} value={d.phone}>
                  Dr. {d.name}
                </option>
              ))}
            </select>
            {!loadingDoctors && doctors.length === 0 && (
              <p className="text-[10px] text-rose-500">
                Could not load the doctor list. Please notify the admin.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Resident Doctor on Standby (if known)
            </label>
            <input
              type="text"
              value={residentDoctorName}
              onChange={(e) => setResidentDoctorName(e.target.value)}
              placeholder="Dr. Name"
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-3"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-slate-600 leading-relaxed">
            I hereby acknowledge and agree to the above terms and conditions, and commit to
            upholding them throughout my shift.
          </span>
        </label>

        {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#001F3F] text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : '✓ Submit Declaration'}
        </button>
      </div>
    </div>
  );
};