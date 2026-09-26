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
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) {
    res.status(500).json({ error: "Supabase server configuration is incomplete." });
    return;
  }

  const authorization = String(req.headers?.authorization || "");
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!accessToken) {
    res.status(401).json({ error: "You must be signed in as an admin." });
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData } = await publicClient.auth.getUser(accessToken);
  if (!callerData.user) {
    res.status(401).json({ error: "Your login session has expired." });
    return;
  }

  const callerPhone = String(callerData.user.user_metadata?.phone || "").trim();
  const { data: callerProfile } = await admin
    .from("users")
    .select("role")
    .eq("phone", callerPhone)
    .maybeSingle();
  if ((callerProfile?.role || callerData.user.user_metadata?.role) !== "Admin") {
    res.status(403).json({ error: "Only an Admin can disable accounts." });
    return;
  }

  const phone = String(req.body?.phone || "").trim();
  if (!phone) {
    res.status(400).json({ error: "Phone number is required." });
    return;
  }

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    res.status(500).json({ error: listError.message });
    return;
  }

  const targetPhone = normalizePhone(phone);
  const target = (listed.users || []).find(
    (user) =>
      user.phone === targetPhone ||
      String(user.user_metadata?.phone || "").trim() === phone,
  );
  if (!target) {
    const { error: profileError } = await admin.from("users").delete().eq("phone", phone);
    if (profileError) {
      res.status(500).json({ error: profileError.message });
      return;
    }
    res.status(200).json({ ok: true, found: false });
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: "876000h",
    user_metadata: {
      ...target.user_metadata,
      disabled: true,
      disabled_at: new Date().toISOString(),
    },
  });
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  const { error: profileError } = await admin.from("users").delete().eq("phone", phone);
  if (profileError) {
    res.status(500).json({ error: `Auth was disabled, but the profile could not be deleted: ${profileError.message}` });
    return;
  }

  res.status(200).json({ ok: true, found: true });
}
