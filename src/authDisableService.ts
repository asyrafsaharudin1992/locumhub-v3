import { getSupabaseClient } from "./supabaseClient";

export async function disableAuthUser(phone: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Authentication service is unavailable.");
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Please sign in again as an Admin.");

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
