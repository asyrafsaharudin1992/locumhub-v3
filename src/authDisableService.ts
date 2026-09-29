import { getFreshSupabaseSession, getSupabaseClient } from "./supabaseClient";

export async function disableAuthUser(phone: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Authentication service is unavailable.");
  const session = await getFreshSupabaseSession();
  const accessToken = session.access_token;

  const response = await fetch("/api/disable-auth-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phone }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Failed to disable Auth user.");
}
