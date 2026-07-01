import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
}

// 🌟 FIX 1: Paksa hardcode maklumat Supabase Dr dlm config supaya selamat di peranti mobile/desktop
export function getSupabaseConfig(): SupabaseConfig {
  // Sila masukkan URL Project dan Anon Key Supabase Dr yang sebenar di dalam pembuka string "" di bawah:
  const targetUrl = "https://duwmuidrarzgrljhmsjm.supabase.co"; 
  const targetKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1d211aWRyYXJ6Z3Jsamhtc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDg3NTgsImV4cCI6MjA5ODM4NDc1OH0.FtIZ0vD4wU3WWuWHxftSoXJWYYdcZLaVaX4g9RM_coM";

  return { 
    url: targetUrl.trim(), 
    anonKey: targetKey.trim(), 
    isEnabled: true // 🔥 PAKSA TRUE: Memotong semua sekatan localStorage browser yang mati kat mobile!
  };
}

// Kekalkan fungsi simpanan untuk mengelakkan ralat kompilasi dlm fail lain
export function saveSupabaseConfig(url: string, anonKey: string, isEnabled: boolean) {
  localStorage.setItem('ara_supabase_url', url.trim());
  localStorage.setItem('ara_supabase_anon_key', anonKey.trim());
  localStorage.setItem('ara_supabase_enabled', 'true');
}

let cachedClient: SupabaseClient | null = null;
let lastConfigHash = '';

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