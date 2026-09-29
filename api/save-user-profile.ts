import { createClient } from "@supabase/supabase-js";

function isAdminRole(value: unknown): boolean {
  return ["admin", "super admin", "superadmin"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) {
    res.status(500).json({ error: "Supabase server configuration is incomplete." });
    return;
  }

  const authorization = String(req.headers?.authorization || "");
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) {
    res.status(401).json({ error: "You must be signed in." });
    return;
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerData, error: callerError } = await publicClient.auth.getUser(accessToken);
  if (callerError || !callerData.user) {
    res.status(401).json({ error: "Your login session has expired." });
    return;
  }

  const body = req.body || {};
  const targetPhone = String(body.phone || "").trim();
  const callerPhone = String(callerData.user.user_metadata?.phone || "").trim();
  const { data: callerProfile } = await admin.from("users").select("role").eq("phone", callerPhone).maybeSingle();
  const callerRole = callerProfile?.role || callerData.user.user_metadata?.role;
  if (!targetPhone || (!isAdminRole(callerRole) && targetPhone !== callerPhone)) {
    res.status(403).json({ error: "You are not allowed to update this profile." });
    return;
  }

  // Never accept or write a password here. Auth owns credentials now.
  const record = {
    nama: String(body.name || ""),
    role: String(body.role || "Doctor"),
    email: String(body.email || ""),
    mmc: String(body.mmc || ""),
    apc_2026: String(body.apc || ""),
    indemnity_insurance: String(body.indemnity || "Tiada"),
    tempat_berkhidmat: String(body.workplace || ""),
    points: Number(body.points || 0),
    badges: String(body.badges || ""),
  };
  const { data, error } = await admin.from("users").update(record).eq("phone", targetPhone).select("phone");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data || data.length === 0) {
    res.status(404).json({ error: "User profile not found." });
    return;
  }
  res.status(200).json({ ok: true });
}
