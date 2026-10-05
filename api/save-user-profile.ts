import { createClient } from "@supabase/supabase-js";

function isAdminRole(value: unknown): boolean {
  return ["admin", "super admin", "superadmin"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  return `+${digits}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  const profileEmail = String(body.email || "").trim().toLowerCase();
  if (profileEmail && !isValidEmail(profileEmail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  // Keep the public profile email and the Supabase Auth email in sync. Auth
  // remains the owner of the password; changing an email here must never
  // replace or reset the password.
  if (profileEmail) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      res.status(500).json({ error: listError.message });
      return;
    }
    const normalizedTargetPhone = normalizePhone(targetPhone);
    const authUser = (listed.users || []).find(
      (user) =>
        user.phone === normalizedTargetPhone ||
        String(user.user_metadata?.phone || "").trim() === targetPhone,
    );
    if (!authUser) {
      res.status(409).json({
        error: "This profile has no Supabase Auth account yet. Create the Auth account before changing its email.",
      });
      return;
    }
    if (String(authUser.email || "").trim().toLowerCase() !== profileEmail) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(
        authUser.id,
        { email: profileEmail, email_confirm: true },
      );
      if (authUpdateError) {
        res.status(409).json({ error: `Auth email was not updated: ${authUpdateError.message}` });
        return;
      }
    }
  }

  const record = {
    nama: String(body.name || ""),
    role: String(body.role || "Doctor"),
    email: profileEmail,
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
