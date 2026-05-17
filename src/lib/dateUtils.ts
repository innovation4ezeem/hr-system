/**
 * Centralized utilities for Malaysian format consistency.
 */

/**
 * Formats a database date string (YYYY-MM-DD) to Malaysian display format (DD/MM/YYYY).
 * @param dbDate Date string from Supabase (e.g., '2026-04-17')
 * @returns Formatted string (e.g., '17/04/2026') or empty string if invalid.
 */
export function formatToDisplayDate(dbDate: string | null | undefined): string {
  if (!dbDate) return '';
  
  // Handle ISO strings or pure date strings
  const dateStr = dbDate.split('T')[0];
  const parts = dateStr.split('-');
  
  if (parts.length !== 3) return dbDate; // Fallback to original if not YYYY-MM-DD
  
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Parses a display date string (DD/MM/YYYY) into a database-ready date string (YYYY-MM-DD).
 * @param displayDate User input string (e.g., '17/04/2026')
 * @returns Database string (e.g., '2026-04-17') or null if invalid.
 */
export function formatToDbDate(displayDate: string | null | undefined): string | null {
  if (!displayDate) return null;
  
  const parts = displayDate.split('/');
  if (parts.length !== 3) return null;
  
  const [day, month, year] = parts;
  
  // Basic validation for length
  if (day.length > 2 || month.length > 2 || year.length !== 4) return null;
  
  // Pad if necessary
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  
  return `${year}-${m}-${d}`;
}

/**
 * Validates a phone number against the enforced Malaysian format: +60xx-xxxxxxx
 * Pattern: +60 followed by 2 digits, a hyphen, and 7-8 digits.
 */
export function isValidMalaysiaPhone(phone: string): boolean {
  const regex = /^\+60\d{2}-\d{7,8}$/;
  return regex.test(phone);
}

/**
 * Automatically formats a string into the Malaysian phone format: +60xx-xxxxxxx
 */
export function formatMalaysiaPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('60')) {
    // already has country code
  } else if (digits.startsWith('0')) {
    digits = '60' + digits.substring(1);
  } else {
    digits = '60' + digits;
  }

  if (digits.length <= 4) return '+' + digits;
  
  return `+${digits.substring(0, 4)}-${digits.substring(4)}`;
}

/**
 * Current date in database format (YYYY-MM-DD)
 */
export function getTodayDbDate(): string {
  return new Date().toISOString().split('T')[0];
}
