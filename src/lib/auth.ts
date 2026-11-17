/**
 * Users sign in with a username and password. Supabase Auth identifies users by email:
 * users are created with their work email (`<username>@<AUTH_USERNAME_DOMAIN>`, by default
 * the network's domain shinaim.biz), and sign in with the part before the "@".
 * A full email address (containing "@") is used as-is.
 */
export function loginEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (value.includes("@")) return value;
  const domain = process.env.AUTH_USERNAME_DOMAIN || "shinaim.biz";
  return `${value}@${domain}`;
}

export const MIN_PASSWORD_LENGTH = 8;

/** The username shown for an account: the part before "@" for work emails, else the full email. */
export function displayUsername(email: string | null | undefined): string {
  const value = (email ?? "").toLowerCase();
  const domain = process.env.AUTH_USERNAME_DOMAIN || "shinaim.biz";
  return value.endsWith(`@${domain}`) ? value.slice(0, -domain.length - 1) : value;
}
