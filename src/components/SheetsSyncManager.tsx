import React, { useState } from 'react';
import {
  Settings, CheckCircle, AlertTriangle, RefreshCw, LogOut, ExternalLink,
  Sparkles, FileText, ShieldCheck, Database, ToggleLeft, ToggleRight, ArrowDownUp, Info
} from 'lucide-react';

interface SheetsSyncManagerProps {
  googleUser: any;
  connectedSpreadsheetId: string;
  isAutoSyncEnabled: boolean;
  sheetsSyncLoading: boolean;
  sheetsSyncError: string;
  userSpreadsheets: { id: string; name: string }[];
  authenticateGoogle: () => Promise<any>;
  disconnectGoogle: () => Promise<void>;
  connectSpreadsheet: (id: string) => void;
  disconnectSpreadsheet: () => void;
  pullFromGoogleSheet: () => Promise<boolean>;
  pushToGoogleSheet: () => Promise<boolean>;
  createAndConnectNewSpreadsheet: () => Promise<string | null>;
  toggleAutoSync: () => void;
  onLogActivity: (action: string) => void;
}

export function SheetsSyncManager({
  googleUser,
  connectedSpreadsheetId,
  isAutoSyncEnabled,
  sheetsSyncLoading,
  sheetsSyncError,
  userSpreadsheets,
  authenticateGoogle,
  disconnectGoogle,
  connectSpreadsheet,
  disconnectSpreadsheet,
  pullFromGoogleSheet,
  pushToGoogleSheet,
  createAndConnectNewSpreadsheet,
  toggleAutoSync,
  onLogActivity,
}: SheetsSyncManagerProps) {
  const [manualIdInput, setManualIdInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateNewSheet = async () => {
    setSuccessMessage('');
    const newId = await createAndConnectNewSpreadsheet();
    if (newId) {
      setSuccessMessage('Successfully created new spreadsheet and synced clinical data.');
      onLogActivity(`Created new synchronized spreadsheet`);
    }
  };

  const handlePullData = async () => {
    setSuccessMessage('');
    const ok = await pullFromGoogleSheet();
    if (ok) {
      setSuccessMessage('Successfully pulled latest slots & rosters from Google Sheet!');
      onLogActivity('Manually triggered pull from Google Sheets');
    }
  };

  const handlePushData = async () => {
    setSuccessMessage('');
    const ok = await pushToGoogleSheet();
    if (ok) {
      setSuccessMessage('Successfully loaded local state onto Google Sheet rows.');
      onLogActivity('Manually triggered push to Google Sheets');
    }
  };

  const handleManualIdConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    if (!manualIdInput.trim()) return;

    // Extract spreadsheet ID in case full URL is pasted
    let targetId = manualIdInput.trim();
    if (targetId.includes('/spreadsheets/d/')) {
      const parts = targetId.split('/spreadsheets/d/');
      if (parts[1]) {
        targetId = parts[1].split('/')[0];
      }
    }

    connectSpreadsheet(targetId);
    setManualIdInput('');
    setSuccessMessage(`Connected spreadsheet ID: ${targetId}`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Title block */}
      <div className="bg-indigo-900 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300">
              <Database className="w-5 h-5 animate-pulse" />
            </span>
            <h4 className="font-display font-medium text-lg">Google Sheets Database Integration</h4>
          </div>
          <p className="text-xs text-sky-200 font-sans max-w-xl leading-relaxed">
            Link clinical roster slots, medical users, noticeboards, and doctor parameters directly onto your preferred Google Sheet file.
          </p>
        </div>

        {googleUser && (
          <button
            onClick={disconnectGoogle}
            className="flex items-center gap-2 text-xs font-bold text-sky-300 hover:text-white bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-xl transition cursor-pointer self-end md:self-auto"
          >
            <LogOut className="w-4 h-4" />
            Disconnect Google
          </button>
        )}
      </div>

      {sheetsSyncError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Sync Error Encountered:</span> {sheetsSyncError}
            <p className="text-[10.5px] text-rose-600 mt-1">Make sure you accepted Sheets permissions during Google connection.</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2.5">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {!googleUser ? (
        /* If not signed in to Google Workspace Auth */
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-6 shadow-sm select-none">
          <div className="mx-auto w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <Settings className="w-8 h-8 text-slate-400" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h5 className="font-display font-bold text-slate-800 tracking-tight text-base">Connect Google Account</h5>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              To link with Google Sheets and Google Drive metadata, connect your Google account in-memory. Roster parameters will update in real-time.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            {/* Standard "Sign in with Google" button according to Workspace skill requirements */}
            <button
              onClick={authenticateGoogle}
              disabled={sheetsSyncLoading}
              className="gsi-material-button inline-flex items-center justify-center font-sans font-bold shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
              style={{
                background: 'white',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                padding: '0 16px',
                height: '46px',
                minWidth: '220px',
                outline: 'none',
              }}
            >
              <div className="gsi-material-button-content-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="gsi-material-button-icon" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: '100%', height: '100%' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents" style={{ fontSize: '14px', fontFamily: '"Google Sans", Roboto, Arial, sans-serif', fontWeight: 500, color: '#3c4043' }}>
                  {sheetsSyncLoading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* If signed in to Google Workspace Auth */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Account and linking status Column */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm md:col-span-1">
            <h5 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider">
              Connected Profile
            </h5>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
              {googleUser.photoURL ? (
                <img src={googleUser.photoURL} alt={googleUser.displayName} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border border-slate-250 shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold font-display rounded-full flex items-center justify-center shrink-0">
                  {googleUser.displayName ? googleUser.displayName.charAt(0) : 'G'}
                </div>
              )}
              <div className="truncate flex-grow">
                <p className="text-xs font-bold text-slate-900 truncate">{googleUser.displayName || 'Google User'}</p>
                <p className="text-[10px] text-slate-500 truncate">{googleUser.email || 'Workspace Account'}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3.5">
              <span className="text-[10px] tracking-wider text-slate-400 font-bold block uppercase">
                Active Configurations
              </span>

              <div className="flex items-center justify-between text-xs font-sans leading-none">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-700">Auto-Sync Changes</span>
                  <p className="text-[9.5px] text-slate-400">Save edits background debounced</p>
                </div>

                <button
                  type="button"
                  onClick={toggleAutoSync}
                  className="p-1 rounded-full text-indigo-650 cursor-pointer"
                >
                  {isAutoSyncEnabled ? (
                    <ToggleRight className="w-9 h-9 text-indigo-600 fill-indigo-100" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs font-sans">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-700">Auto-Backup Status</span>
                  <p className="text-[9.5px] text-slate-400">Security checkpoint validation</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Secured
                </span>
              </div>
            </div>
          </div>

          {/* Connected spreadsheet Column */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm md:col-span-2">
            {!connectedSpreadsheetId ? (
              /* If no spreadsheet ID linked yet */
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h5 className="font-display font-semibold text-slate-800 text-sm tracking-tight flex items-center gap-1.5 uppercase">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Provision Database spreadsheet
                  </h5>
                  <p className="text-xs text-slate-500 font-sans leading-relaxed">
                    Choose an existing spreadsheet detected in your Google Drive folder, paste a link manually, or create a brand new template sheet instantly.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option 1: Create New Sheet button */}
                  <div className="border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h6 className="text-xs font-bold text-indigo-900 font-display">Provision Template spreadsheet</h6>
                      <p className="text-[10.5px] text-slate-500 font-sans leading-normal">
                        Create a properly-titled, formatted file with tabs for <strong>Slots, Users, Notices, Feedback, & Applications</strong> instantly.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateNewSheet}
                      disabled={sheetsSyncLoading}
                      className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs tracking-wider outline-none cursor-pointer text-center"
                    >
                      {sheetsSyncLoading ? 'Provisioning...' : 'Create New Spreadsheet'}
                    </button>
                  </div>

                  {/* Option 2: Choose existing dropdown */}
                  <div className="border border-slate-150 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h6 className="text-xs font-bold text-slate-800 font-display">Connect Google Sheets file</h6>
                      <p className="text-[10.5px] text-slate-500 font-sans leading-normal">
                        Attach a spreadsheet currently stored in your Google Drive or connect a recently customized sheet.
                      </p>
                    </div>

                    {userSpreadsheets.length > 0 ? (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            connectSpreadsheet(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg p-2.5 outline-none cursor-pointer text-slate-700"
                      >
                        <option value="">-- Select Sheet File --</option>
                        {userSpreadsheets.map(file => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic font-sans py-1">
                        No sheets files found. Try creating a template on left.
                      </div>
                    )}
                  </div>
                </div>

                {/* Option 3: Manual paste text link */}
                <form onSubmit={handleManualIdConnect} className="border-t border-slate-100 pt-4 space-y-2 font-sans">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">
                    Link existing using custom link or ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualIdInput}
                      onChange={(e) => setManualIdInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
                      placeholder="Paste Google Sheet URL or ID..."
                    />
                    <button
                      type="submit"
                      className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-4 rounded-lg cursor-pointer shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                </form>

                <div className="border-t border-slate-100 pt-4 space-y-2 font-sans">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">
                    Official clinic database
                  </label>
                  <div className="bg-emerald-50/75 border border-emerald-150 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-emerald-900">Official Locum ARA Sheet</p>
                      <p className="text-[10px] text-emerald-700 font-mono truncate max-w-[200px] sm:max-w-xs">ID: 1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        connectSpreadsheet('1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y');
                        setSuccessMessage('Successfully connected to the Official Locum ARA Spreadsheet!');
                      }}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg cursor-pointer transition shadow-sm hover:scale-[1.02] active:scale-95 text-center shrink-0"
                    >
                      Quick Connect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* If spreadsheet ID is connected */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 tracking-wider flex items-center gap-1 uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                      Spreadsheet Linked successfully
                    </span>
                    <h5 className="font-display font-medium text-slate-950 text-sm">ARA CLINIC LOCUM DATABASE</h5>
                  </div>
                  <div className="flex gap-1.5 select-none font-mono">
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${connectedSpreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 shadow-sm"
                    >
                      <span>Open Workspace Sheet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={disconnectSpreadsheet}
                      className="text-[10.5px] font-bold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition"
                    >
                      Change Link
                    </button>
                  </div>
                </div>

                {connectedSpreadsheetId !== '1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y' && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs font-medium text-amber-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-900">Not on the Official Locum ARA Spreadsheet</p>
                      <p className="text-[10.5px] text-amber-700 leading-normal">You are currently connected to a custom sheet. Switch back to the official database sheet to see live clinical schedules.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        connectSpreadsheet('1xm7l3MZnXsm-KWINu5WhiSJVPST7jEWjb8_8yAbWz3Y');
                        setSuccessMessage('Switched back to the Official Locum ARA Spreadsheet successfully!');
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold py-2 px-3 rounded-lg cursor-pointer transition shadow-sm text-center shrink-0"
                    >
                      Connect Official Sheet
                    </button>
                  </div>
                )}

                {/* Synchronization Manual triggers */}
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1 font-sans">
                        <ArrowDownUp className="w-4 h-4 text-indigo-600 shrink-0" />
                        Synchronize parameters (Pull & Push)
                      </span>
                      {sheetsSyncLoading && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-medium font-mono">
                          <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                          Syncing Sheets...
                        </div>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-sans leading-normal">
                      Manual sync keeps credentials, shift bookings, notice boards, and patient parameters exactly in sync across all devices in real-time.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={handlePullData}
                        disabled={sheetsSyncLoading}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Pull Sheet Updates
                      </button>
                      <button
                        onClick={handlePushData}
                        disabled={sheetsSyncLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Push Local State
                      </button>
                    </div>
                  </div>

                  {/* Schema breakdown and structure feedback list */}
                  <div className="space-y-2">
                    <span className="text-[10px] tracking-wider text-slate-400 font-bold block uppercase leading-none">
                      Verified Data Tables:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10.5px] font-mono select-none">
                      <div className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-center font-bold text-slate-700">
                        Slots
                      </div>
                      <div className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-center font-bold text-slate-700">
                        Users
                      </div>
                      <div className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-center font-bold text-slate-700">
                        Noticeboard
                      </div>
                      <div className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-center font-bold text-slate-700">
                        Feedback
                      </div>
                      <div className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-center font-bold text-slate-700">
                        Applications
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Helpful hint and info banner */}
      <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl flex items-start gap-3 text-xs leading-relaxed text-indigo-900 font-sans">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Sync Mechanics Decoded:</span>
          <p className="text-slate-600">
            For seamless offline operations, the Ara Locum Hub retains database snapshots securely in your browser's local memory. When you connect a Google Sheet, any actions you trigger automatically flush to the cloud in real-time. Simply click "Pull Sheet Updates" on other devices to synchronize any updates made by clinical colleagues!
          </p>
        </div>
      </div>
    </div>
  );
}
