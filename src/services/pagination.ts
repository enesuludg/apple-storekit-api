import { StoreKitPaginationOptions } from '../interfaces';

export interface PaginationLimits {
  maxPages: number;
  maxItems: number;
}

export function resolvePaginationLimits(
  options: StoreKitPaginationOptions
): PaginationLimits {
  return {
    maxPages: positiveInteger(options.maxPages, 100, 'maxPages'),
    maxItems: positiveInteger(options.maxItems, 20_000, 'maxItems')
  };
}

export function assertCanFetchPage(
  pagesFetched: number,
  limits: PaginationLimits,
  resourceName: string
): void {
  if (pagesFetched >= limits.maxPages) {
    throw new RangeError(
      `${resourceName} exceeded maxPages (${limits.maxPages}) before pagination completed.`
    );
  }
}

export function assertCanAddItems(
  itemsRead: number,
  nextItemCount: number,
  limits: PaginationLimits,
  resourceName: string
): void {
  if (itemsRead + nextItemCount > limits.maxItems) {
    throw new RangeError(
      `${resourceName} exceeded maxItems (${limits.maxItems}) before pagination completed.`
    );
  }
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}
