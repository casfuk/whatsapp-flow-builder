/**
 * Normalize phone number for consistent storage
 * Removes spaces, hyphens, parentheses and ensures consistent format
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all spaces, hyphens, parentheses, and other common separators
  let normalized = phone.replace(/[\s\-\(\)\.]/g, "");

  // Ensure it starts with + if it's an international number
  if (!normalized.startsWith("+") && normalized.length > 10) {
    normalized = "+" + normalized;
  }

  return normalized;
}
