export function encodePathSegment(value: string, name: string): string {
  requireNonEmptyString(value, name);
  return encodeURIComponent(value);
}

export function requireNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}

export function requireStringMaxLength(
  value: unknown,
  name: string,
  maxLength: number
): asserts value is string {
  requireNonEmptyString(value, name);
  if (Array.from(value).length > maxLength) {
    throw new RangeError(`${name} must be at most ${maxLength} characters.`);
  }
}

export function requireUuid(value: string, name: string): void {
  requireNonEmptyString(value, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`${name} must be a valid UUID.`);
  }
}

export function validateDateRange(
  startDate: number | undefined,
  endDate: number | undefined,
  name: string
): void {
  for (const [field, value] of [['startDate', startDate], ['endDate', endDate]] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new RangeError(`${name} ${field} must be a non-negative millisecond timestamp.`);
    }
  }
  if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
    throw new RangeError(`${name} startDate must not be later than endDate.`);
  }
}

export function validateRequiredDateRange(
  startDate: number | undefined,
  endDate: number | undefined,
  name: string
): void {
  if (startDate === undefined || endDate === undefined) {
    throw new TypeError(`${name} requires both startDate and endDate.`);
  }
  validateDateRange(startDate, endDate, name);
  if (startDate >= endDate) {
    throw new RangeError(`${name} startDate must be earlier than endDate.`);
  }
}

export function requireHttpsUrl(value: string, name: string): void {
  requireNonEmptyString(value, name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${name} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new TypeError(`${name} must use HTTPS.`);
  }
}
