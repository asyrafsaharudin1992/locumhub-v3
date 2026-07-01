import React, { useState, useEffect } from 'react';
import {
  Database, CheckCircle, AlertTriangle, RefreshCw, Eye, EyeOff,
  Server, Table, CloudLightning, ArrowDownUp, Info, Activity, ShieldCheck
} from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../supabaseClient';
import { pushAllLocalStateToSupabase } from '../supabaseService';

interface SupabaseSyncManagerProps {
  onLogActivity: (action: string) => void;
  onPullFromSupabase: () => Promise<boolean>;
  onPushToSupabase: () => Promise<boolean>;
  isSupabaseEnabled: boolean;
  setIsSupabaseEnabled: (enabled: boolean) => void;
  localState: any;
}

export function SupabaseSyncManager({
  onLogActivity,
  onPullFromSupabase,
  onPushToSupabase,
  isSupabaseEnabled,
  setIsSupabaseEnabled,
  localState
}: SupabaseSyncManagerProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [diagnostic, setDiagnostic] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    tables: Record<string, boolean>;
  }>({
    tested: false,
    success: false,
    message: '',
    tables: {}
  });

  // Load config on mount
  useEffect(() => {
    const config = getSupabaseConfig();
    setUrl(config.url);
    setAnonKey(config.anonKey);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!url.trim() || !anonKey.trim()) {
      setError('Both Supabase URL and Anon Key are required to save.');
      return;
    }

    try {
      new URL(url); // Quick validation
    } catch {
      setError('Please enter a valid URL (including https://).');
      return;
    }

    saveSupabaseConfig(url, anonKey, isSupabaseEnabled);
    setSuccess('Supabase connection parameters saved successfully!');
    onLogActivity('Configured Supabase database credentials');
    
    // Automatically run connection diagnostics
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Temporarily save to test with latest inputs
      saveSupabaseConfig(url, anonKey, isSupabaseEnabled);
      const res = await testSupabaseConnection();
      
      setDiagnostic({
        tested: true,
        success: res.success,
        message: res.message,
        tables: res.tables
      });

      if (res.success) {
        setSuccess('Supabase diagnostics finished. Connection is live and authenticated!');
        onLogActivity('Ran Supabase database connection tests - SUCCESS');
      } else {
        setError(`Connection failed: ${res.message}`);
        onLogActivity('Ran Supabase database connection tests - FAILED');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected failure checking database schema.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsSupabaseEnabled(checked);
    saveSupabaseConfig(url, anonKey, checked);
    
    if (checked) {
      setSuccess('Supabase integration activated! Data will load and save to Supabase.');
      onLogActivity('Activated Supabase cloud database integration');
      handleTestConnection();
    } else {
      setSuccess('Supabase integration deactivated. System reverted to local & Cloud state.');
      onLogActivity('Deactivated Supabase cloud database integration');
    }
  };

  const handlePullData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const ok = await onPullFromSupabase();
      if (ok) {
        setSuccess('Successfully pulled latest slots, rosters, and user states from Supabase!');
        onLogActivity('Pulled latest clinical roster from Supabase');
      } else {
        setError('Failed to pull data from Supabase. Ensure tables exist or check connection.');
      }
    } catch (err: any) {
      setError(err?.message || 'Sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePushData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const ok = await onPushToSupabase();
      if (ok) {
        setSuccess('Successfully exported all local clinical states to your Supabase instance!');
        onLogActivity('Exported local state cache to Supabase database');
      } else {
        setError('Failed to push data. Check logs or database permissions (RLS).');
      }
    } catch (err: any) {
      setError(err?.message || 'Sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateToSupabase = async () => {
    if (!window.confirm("This will write all currently loaded slots, users, announcements, and feedbacks onto your Supabase tables. Proceed?")) {
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const ok = await pushAllLocalStateToSupabase(localState);
      if (ok) {
        setSuccess('Successfully seeded and migrated your entire local schema into Supabase!');
        onLogActivity('Seeded local database structure into Supabase');
        handleTestConnection();
      } else {
        setError('Migration partially failed or could not write rows. Ensure your schema exists.');
      }
    } catch (err: any) {
      setError(`Migration error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check if credentials are set
  const hasCredentials = url.trim() !== '' && anonKey.trim() !== '';

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Title block */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5 animate-pulse" />
            </span>
            <h4 className="font-display font-medium text-lg text-emerald-300">Supabase Cloud Database</h4>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Connect directly to your PostgreSQL database. Ideal for real-time synchronization with external services like Make.com, AppSheet, or custom web portals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700 p-2.5 px-4 rounded-xl">
          <span className="text-xs font-semibold text-slate-300">Active Connection:</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSupabaseEnabled} 
              onChange={handleToggleActive}
              disabled={!hasCredentials}
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold font-display">Database Error:</span> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2.5">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Credentials Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm md:col-span-2 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h5 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-600" />
              Supabase Connection Config
            </h5>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs font-sans">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Supabase Project URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="font-bold text-slate-700 block">Supabase Anon Public Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-10 font-mono text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Use your public <code>anon</code> key safely. It is fully restricted by Row-Level Security (RLS) inside your Supabase project.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-lg cursor-pointer transition shadow-sm text-center"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={loading || !url || !anonKey}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3.5 rounded-lg cursor-pointer transition border border-slate-200"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-400" /> : 'Test connection'}
              </button>
            </div>
          </form>
        </div>

        {/* Sync Controls & Diagnostics */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm md:col-span-3 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h5 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CloudLightning className="w-4 h-4 text-emerald-600" />
              Diagnostics & Sync Commands
            </h5>
            {isSupabaseEnabled && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Sync Active
              </span>
            )}
          </div>

          {!diagnostic.tested ? (
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 text-center text-xs space-y-3">
              <Table className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-slate-700">Schema Diagnostics Ready</p>
                <p className="text-slate-500 max-w-sm mx-auto">Save your parameters on the left, then click <strong>"Test connection"</strong> to discover tables and confirm RLS query authorizations.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs font-sans leading-normal ${diagnostic.success ? 'bg-emerald-50/75 border-emerald-150 text-emerald-900' : 'bg-rose-50 border-rose-150 text-rose-900'}`}>
                {diagnostic.success ? <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold">Database Connectivity Status</p>
                  <p className="text-[11px] opacity-90">{diagnostic.message}</p>
                </div>
              </div>

              {/* Table schema breakdown */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identified Database Tables:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10.5px]">
                  {Object.entries(diagnostic.tables).map(([table, exists]) => (
                    <div 
                      key={table}
                      className={`p-2 border rounded-lg flex items-center justify-between px-2.5 ${exists ? 'border-emerald-200 bg-emerald-50/20 text-emerald-800' : 'border-slate-200 bg-slate-50/50 text-slate-400'}`}
                    >
                      <span className="font-semibold truncate pr-1">{table}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${exists ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synchronization Controls */}
              {isSupabaseEnabled && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sync Operations:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <button
                      onClick={handlePullData}
                      disabled={loading}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                      Pull Database Updates
                    </button>
                    <button
                      onClick={handlePushData}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowDownUp className="w-3.5 h-3.5 text-emerald-200" />
                      Push Local State
                    </button>
                    <button
                      onClick={handleMigrateToSupabase}
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-950 text-slate-100 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer font-display text-[11px]"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      Seed / Migrate State
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Helpful Info Panel */}
      <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl flex items-start gap-3 text-xs leading-relaxed text-indigo-950 font-sans">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Automating Connection via Make.com:</span>
          <p className="text-slate-600">
            Since your Google Sheet is linked with Make.com to push data directly to Supabase, Ara Locum Hub can query Supabase as your primary cloud storage! Enable the "Active Connection" toggle above to switch from Database. Any shifts booked or user profiles created on this frontend will immediately synchronize with Supabase, executing real-time workflows automatically!
          </p>
        </div>
      </div>
    </div>
  );
}
