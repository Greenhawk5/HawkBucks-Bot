// Centralized administrator authorization.
//
// The primary administrator's Telegram user ID comes exclusively from the
// runtime environment (Cloudflare Worker Secret ADMIN_TELEGRAM_ID).
// There must be no hardcoded fallback: if the secret is missing or invalid,
// every admin feature fails closed.

export function getAdminId(env) {
  const raw = env?.ADMIN_TELEGRAM_ID;
  if (typeof raw !== "string" || !/^\d{3,20}$/.test(raw.trim())) {
    // Safe log: no secret values, no partial ID.
    console.error("ADMIN_CONFIG_INVALID", { configured: Boolean(raw) });
    return null;
  }
  const adminId = Number(raw.trim());
  if (!Number.isSafeInteger(adminId) || adminId <= 0) {
    console.error("ADMIN_CONFIG_INVALID", { configured: true });
    return null;
  }
  return adminId;
}

/**
 * Centralized admin check. Fails closed: without a valid
 * ADMIN_TELEGRAM_ID secret, nobody is an administrator.
 */
export function isAdmin(env, telegramId) {
  const adminId = getAdminId(env);
  if (adminId === null) return false;
  const senderId = Number(telegramId);
  return Number.isSafeInteger(senderId) && senderId === adminId;
}
