/**
 * Input validation helpers (no external dependencies).
 * Prevents injection, XSS, and malformed input.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 100;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_INGREDIENTS_LENGTH = 5000;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== "string") return { valid: false, error: "Email must be a string" };
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: "Email is required" };
  if (trimmed.length > MAX_EMAIL_LENGTH) return { valid: false, error: "Email too long" };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, error: "Invalid email format" };
  return { valid: true };
}

export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== "string") return { valid: false, error: "Password must be a string" };
  if (password.length < MIN_PASSWORD_LENGTH)
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  if (password.length > MAX_PASSWORD_LENGTH)
    return { valid: false, error: `Password must be under ${MAX_PASSWORD_LENGTH} characters` };
  return { valid: true };
}

export function validateName(name: unknown): ValidationResult {
  if (typeof name !== "string") return { valid: false, error: "Name must be a string" };
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "Name is required" };
  if (trimmed.length > MAX_NAME_LENGTH) return { valid: false, error: "Name too long" };
  return { valid: true };
}

export function validateIngredients(ingredients: unknown): ValidationResult {
  if (typeof ingredients !== "string")
    return { valid: false, error: "Ingredients must be a string" };
  const trimmed = ingredients.trim();
  if (!trimmed) return { valid: false, error: "Ingredients are required" };
  if (trimmed.length > MAX_INGREDIENTS_LENGTH)
    return { valid: false, error: "Ingredients list too long" };
  return { valid: true };
}

/**
 * Sanitize string for safe storage (removes null bytes, control chars).
 */
export function sanitizeString(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}
