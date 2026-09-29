import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
}

const isLocalDevelopment = import.meta.env.DEV;
const defaultSupabaseUrl = "https://duwmuidrarzgrljhmsjm.supabase.co";
const defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1d211aWRyYXJ6Z3Jsamhtc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDg3NTgsImV4cCI6MjA5ODM4NDc1OH0.FtIZ0vD4wU3WWuWHxftSoXJWYYdcZLaVaX4g9RM_coM";

export function getSupabaseConfig(): SupabaseConfig {
  // Production must use the Vercel-provided public Supabase settings. The
  // localStorage settings are retained only for local development so a
  // visitor cannot disable Supabase and trigger the development fallback.
  const envUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const localUrl = isLocalDevelopment
    ? localStorage.getItem('ara_supabase_url') || ""
    : "";
  const localAnonKey = isLocalDevelopment
    ? localStorage.getItem('ara_supabase_anon_key') || ""
    : "";
  const localEnabled = isLocalDevelopment && localStorage.getItem('ara_supabase_enabled') === 'true';
  const url = envUrl || localUrl || defaultSupabaseUrl;
  const anonKey = envAnonKey || localAnonKey || defaultSupabaseAnonKey;
  const isEnabled = Boolean(url && anonKey) && (isLocalDevelopment ? localEnabled || Boolean(envUrl && envAnonKey) || (!envUrl && !envAnonKey) : true);

  return { 
    url: url.trim(), 
    anonKey: anonKey.trim(), 
    isEnabled
  };
}

// Kekalkan fungsi simpanan untuk mengelakkan ralat kompilasi dlm fail lain
export function saveSupabaseConfig(url: string, anonKey: string, isEnabled: boolean) {
  localStorage.setItem('ara_supabase_url', url.trim());
  localStorage.setItem('ara_supabase_anon_key', anonKey.trim());
  localStorage.setItem('ara_supabase_enabled', isEnabled ? 'true' : 'false');
}

let cachedClient: SupabaseClient | null = null;
let lastConfigHash = '';
let sessionRefreshPromise: Promise<Session> | null = null;
let lastSuccessfulRefreshAt = 0;

const FORCE_REFRESH_COOLDOWN_MS = 30_000;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isEnabled } = getSupabaseConfig();
  if (!url || !anonKey || !isEnabled) {
    cachedClient = null;
    return null;
  }

  const hash = `${url}_${anonKey}`;
  if (cachedClient && lastConfigHash === hash) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    lastConfigHash = hash;
    return cachedClient;
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return null;
  }
}

/**
 * Returns a usable Auth session and coalesces concurrent refresh requests.
 *
 * A tab returning from the background can emit both `visibilitychange` and
 * `focus`, while an admin may click a write action at the same time. Calling
 * refreshSession independently from all three paths can rotate the same
 * refresh token more than once and make a still-signed-in user appear logged
 * out. Keep refreshes single-flight and avoid re-refreshing a token that was
 * renewed only moments ago.
 */
export async function getFreshSupabaseSession(options: {
  force?: boolean;
  minValidityMs?: number;
} = {}): Promise<Session> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Authentication service is unavailable.");

  const { force = false, minValidityMs = 60_000 } = options;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  const currentSession = data.session;
  if (!currentSession) {
    throw new Error("Your login session has expired. Please sign in again.");
  }

  const now = Date.now();
  const validUntil = currentSession.expires_at
    ? currentSession.expires_at * 1000
    : 0;
  const hasEnoughLifetime = validUntil > now + minValidityMs;
  const wasJustRefreshed = now - lastSuccessfulRefreshAt < FORCE_REFRESH_COOLDOWN_MS;

  if (hasEnoughLifetime && (!force || wasJustRefreshed)) {
    return currentSession;
  }

  if (!sessionRefreshPromise) {
    sessionRefreshPromise = client.auth
      .refreshSession()
      .then(({ data: refreshed, error: refreshError }) => {
        if (refreshError || !refreshed.session) {
          throw refreshError || new Error("Session refresh returned no session.");
        }
        lastSuccessfulRefreshAt = Date.now();
        return refreshed.session;
      })
      .finally(() => {
        sessionRefreshPromise = null;
      });
  }

  try {
    return await sessionRefreshPromise;
  } catch (refreshError) {
    // A temporary network failure should not invalidate an access token that
    // is still usable. Actual expired sessions continue to surface as errors.
    if (validUntil > Date.now() + 5_000) {
      console.warn("Session refresh deferred; current access token is still valid:", refreshError);
      return currentSession;
    }
    throw new Error("Your login session has expired. Please sign in again.");
  }
}

export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  tables: Record<string, boolean>;
 }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: "Supabase client not initialized or integration disabled.",
      tables: {}
    };
  }

  const tablesToCheck = [
    'slots', 'Slots',
    'users', 'Users',
    'announcements', 'Announcements',
    'feedbacks_patient', 'feedbacks_staff', 'feedbacks_locum', 'Feedback',
    'applications', 'Applications',
    'activity_logs'
  ];

  const results: Record<string, boolean> = {};

  try {
    const checkPromises = tablesToCheck.map(async (table) => {
      try {
        const { error } = await client.from(table).select('*').limit(1);
        results[table] = !error || (error.code !== '42P01' && error.code !== 'P0001');
      } catch {
        results[table] = false;
      }
    });

    await Promise.all(checkPromises);
    const activeTables = Object.keys(results).filter(k => results[k]);
    
    return {
      success: true,
      message: `Successfully connected! Found ${activeTables.length} accessible tables.`,
      tables: results
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Connection failed with an unexpected error.",
      tables: {}
    };
  }
}
