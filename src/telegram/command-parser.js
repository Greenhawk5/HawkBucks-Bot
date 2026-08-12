/**
 * Return the normalized Telegram command name without the leading slash or
 * optional @bot username suffix.
 */
export function getTelegramCommand(text) {
  if (typeof text !== "string") return null;

  const match = text.trim().match(/^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/);
  return match ? match[1].toLowerCase() : null;
}
