import { createClient } from "@supabase/supabase-js";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  return `+${digits}`;
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
    res.status(401).json({ error: "You must be signed in as an admin." });
    return;
  }
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerData } = await publicClient.auth.getUser(accessToken);
  if (!callerData.user) {
    res.status(401).json({ error: "Your login session has expired." });
    return;
  }
  const callerPhone = String(callerData.user.user_metadata?.phone || "").trim();
  const { data: callerProfile } = await admin.from("users").select("role").eq("phone", callerPhone).maybeSingle();
  const phone = String(req.body?.phone || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();
  const callerRole = callerProfile?.role || callerData.user.user_metadata?.role;
  const isSelfReset = phone === callerPhone;
  if (callerRole !== "Admin" && !isSelfReset) {
    res.status(403).json({ error: "Only an Admin can reset another user's password." });
    return;
  }
  if (!phone || (newPassword.length < 6 && !/^\d{5}$/.test(newPassword))) {
    res.status(400).json({ error: "Password must be at least 6 characters, or exactly 5 digits for an MMC password." });
    return;
  }
  const authPassword = /^\d{5}$/.test(newPassword) ? `0${newPassword}` : newPassword;
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    res.status(500).json({ error: listError.message });
    return;
  }
  const targetPhone = normalizePhone(phone);
  const target = (listed.users || []).find(
    (user) => user.phone === targetPhone || String(user.user_metadata?.phone || "").trim() === phone,
  );
  if (!target) {
    res.status(404).json({ error: "No Auth account found for this user. Run the Auth migration first." });
    return;
  }
  const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password: authPassword });
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }
  res.status(200).json({ ok: true });
}
