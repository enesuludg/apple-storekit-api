# Changes

This document summarizes notable releases and migration requirements for
`apple-storekit-api`.

## 2.0.0 — 2026-07-13

This release is a major security and reliability update. It adds cryptographic
verification, stateless environment resolution, bounded retries and pagination,
and broader App Store Server API coverage.

### Breaking changes

- The minimum supported Node.js version is now `22`.
- `AppleStoreKit` no longer extends `BaseService`; low-level transport methods are
  no longer exposed through the main facade.
- Signed Apple payloads are cryptographically verified instead of merely decoded.
- `appleRootCertificates` is required before signed data can be verified.
- `appAppleId` is required when verifying production signed data.
- The deprecated `decodeSignedData()` method is now async and performs verification.
- Notification, mass-renewal, and retention endpoints without a transaction ID
  require an explicit environment when the client is in auto mode.
- `TransactionInfo` now uses Apple's official `JWSTransactionDecodedPayload` type.
  Fields that Apple provides conditionally may therefore be optional.
- `RenewalInfo` now uses Apple's official `JWSRenewalInfoDecodedPayload` type.
- Invalid JWS data now throws `AppleStoreKitVerificationError` instead of returning
  `null`.
- TypeScript consumers now require TypeScript `5.2` or newer.
- The deprecated `sendConsumptionInformation()` V1 method now accepts the
  Apple-compatible `ConsumptionRequestV1` type and numeric `DeliveryStatusV1` and
  `RefundPreferenceV1` enums. Use `sendConsumptionInformationV2()` with
  `ConsumptionRequest`, `DeliveryStatus`, and `RefundPreference` for the current API.

### Migration

Before:

```ts
const storeKit = new AppleStoreKit({
  issuerId,
  keyId,
  privateKey,
  bundleId,
  environment: 'production'
});
```

After:

```ts
import { readFileSync } from 'node:fs';
import { AppleStoreKit } from 'apple-storekit-api';

const storeKit = new AppleStoreKit({
  issuerId,
  keyId,
  privateKey,
  bundleId,
  environment: 'production',
  appAppleId: 123456789,
  appleRootCertificates: [
    readFileSync('/path/to/AppleRootCA-G3.cer')
  ],
  timeoutMs: 10_000
});
```

Download trusted Apple root certificates from
[Apple PKI](https://www.apple.com/certificateauthority/).

Applications that subclassed `AppleStoreKit` to access `BaseService` internals need
to migrate to the public facade methods. Package-root imports remain unchanged. The
exact v1 `dist/...` deep imports are preserved through a deprecated compatibility
allowlist so applications can migrate incrementally, but service implementation
details and subclass behavior are not part of the v2 API. New code should import
public classes and types from `apple-storekit-api`.

### Security and request validation

- StoreKit JWTs retain Apple's required `iat` claim, and request paths are constrained
  to Apple's selected API origin before authorization headers are created.
- Transport diagnostics are bounded and credential-redacted, including custom HTTP
  adapter errors and automatic-environment attempt history.
- Timeout and retry-delay values are validated against Node.js's safe timer range.
- Consumption, renewal extension, notification history, and Retention Messaging
  requests perform Apple-contract validation before network I/O. Retention PNG uploads
  validate image type, dimensions, structure, and transparency constraints.

### Signed-data verification

- Added Apple's official `@apple/app-store-server-library` package.
- Added dedicated verification methods for each signed payload type:
  - `verifyAndDecodeTransaction()`
  - `verifyAndDecodeRenewalInfo()`
  - `verifyAndDecodeNotification()`
  - `verifyAndDecodeAppTransaction()`
- Verification checks the certificate chain, bundle ID, and environment claims.
- Production verification also checks the App Apple ID.
- Certificate revocation and current-date checks are enabled by default.
- Verification failures preserve their original `cause` through
  `AppleStoreKitVerificationError`.

### Environment handling

- Environment selection is now stateless and scoped to each request.
- Production-to-sandbox fallback occurs only for Apple error `4040010`
  (`TransactionIdNotFoundError`).
- Authentication, validation, rate-limit, server, and network errors never switch
  environments.
- Retries always remain in the same environment.
- `lookupOrder()` always uses production because Apple does not provide it in sandbox.
- Added `getConfiguredEnvironment()`.
- `getCurrentEnvironment()` remains as a deprecated alias and returns the configured
  mode instead of the environment used by the most recent request.
- Added `resolveTransactionEnvironment()` for stateless transaction lookup.

### HTTP and retry behavior

- Added a default request timeout of `10_000 ms`.
- Added client-level and request-level `timeoutMs` configuration.
- Added `AbortSignal` support, including cancellation during retry backoff.
- Added an isolated, keep-alive Axios instance.
- Added HTTP adapter injection for tests and custom transports.
- Disabled redirect following.
- Reduced App Store Connect JWT lifetime to five minutes and added short-lived caching.
- GET requests retry by default.
- Write endpoints opt in to retries only when their semantics are idempotent.
- Non-idempotent Retention Messaging image and message upload/delete operations never
  retry automatically; callers receive the original uncertain network result.
- Retryable HTTP statuses are limited to `408`, `429`, `500`, `502`, `503`, and `504`.
- Permanent DNS, TLS, and unknown network failures are not retried automatically.
- A `Retry-After` value above `maxRetryDelayMs` prevents a retry.

### Pagination

- Added default bounds to aggregate history methods:
  - `maxPages: 100`
  - `maxItems: 20_000`
- Repeated revision and pagination tokens are detected.
- Responses with `hasMore=true` but no revision or pagination token are rejected.
- Added streaming iterators:
  - `iterateTransactionHistory()`
  - `iterateRefundHistoryPages()`
  - `iterateNotificationHistoryPages()`

### Response changes

#### `verifyPurchase()`

The response is now Apple's verified transaction payload:

```ts
type TransactionInfo = JWSTransactionDecodedPayload;
```

#### `getTransactionHistory()`

- Uses the V2 history endpoint instead of V1.
- Collects all pages within the configured bounds.
- Verifies every transaction JWS.
- Still returns `TransactionInfo[]`, but each item now uses Apple's official model.

#### `lookupOrder()`

The response now includes the correctly named `transactions` field:

```ts
interface LookupOrderResponse {
  status: number;
  transactions: TransactionInfo[];

  /** @deprecated Use transactions. */
  signedTransactions: TransactionInfo[];
}
```

`signedTransactions` remains for backward compatibility. Both fields contain
verified and decoded transaction objects, not raw JWS strings.

#### `refundLookup()` and `getRefundHistory()`

- Uses V2 refund history instead of the legacy V1 endpoint.
- Aggregates all pages and returns:

```ts
interface RefundLookupResponse {
  signedTransactions: string[];
  revision?: string;
  hasMore: boolean;
}
```

The aggregate response always has `hasMore: false`. `refundLookup()` remains as a
deprecated alias for `getRefundHistory()`.

#### `getSubscriptionStatus()`

- No longer selects the first subscription group and transaction arbitrarily.
- Prefers an exact `originalTransactionId` match.
- Throws when multiple candidates make the response ambiguous.
- Returns verified Apple models in `transactionInfo` and `renewalInfo`.
- Returns `statusType: 'UNKNOWN'` for a future, unrecognized status value.
- Throws when `expiresDate` is missing instead of producing `1970-01-01`.

#### Error responses

`AppleStoreKitApiError` now exposes additional diagnostic metadata:

```ts
interface AppleStoreKitApiError {
  statusCode?: number;
  errorCode?: number;
  environment: 'production' | 'sandbox';
  retryAfterMs?: number;
  retryable: boolean;
  cause: unknown;
  attempts?: Array<{
    environment: 'production' | 'sandbox';
    error: unknown;
  }>;
}
```

### Added App Store Server API methods

#### Transactions

- `getTransactionHistoryPage()`
- `iterateTransactionHistory()`
- `getRefundHistory()`
- `getRefundHistoryPage()`
- `iterateRefundHistoryPages()`
- `getAppTransactionInfo()`
- `getVerifiedAppTransactionInfo()`
- `finishTransaction()`

#### Subscriptions and renewal extensions

- `getAllSubscriptionStatuses()`
- `extendSubscriptionRenewalDate()`
- `extendRenewalDateForAllActiveSubscribers()`
- `getStatusOfSubscriptionRenewalDateExtensions()`

#### App Store Server Notifications

- `getNotificationHistory()`
- `getAllNotificationHistory()`
- `iterateNotificationHistoryPages()`
- `requestTestNotification()`
- `getTestNotificationStatus()`

#### Retention Messaging

- `uploadImage()`
- `deleteImage()`
- `getImageList()`
- `uploadMessage()`
- `deleteMessage()`
- `getMessageList()`
- `configureDefaultMessage()`
- `deleteDefaultMessage()`
- `getDefaultMessage()`
- `configureRealtimeURL()`
- `deleteRealtimeURL()`
- `getRealtimeURL()`
- `initiatePerformanceTest()`
- `getPerformanceTestResults()`

### Validation and type safety

- Added runtime validation for configuration values.
- Added validation for UUIDs, date ranges, pagination limits, HTTPS URLs, PNG
  signatures, locales, and renewal request fields.
- URL path segments are now encoded.
- Paginated Apple response shapes are validated before use.
- Removed `any[]` from transaction response types.
- Notification type and subtype values now use Apple's official enums.
- `getAccountTenure()` rejects invalid dates and future dates.

### Package and quality

- Updated the package version to `2.0.0`.
- Added a CommonJS export map and `sideEffects: false`.
- Updated dependencies and resolved all production and development audit findings.
- Added the MIT `LICENSE` file.
- Removed the duplicated legacy `package/` directory.
- Added GitHub Actions CI for Node.js 22 and 24.
- Added runtime, type-level, and coverage tests.
- Added installed-tarball consumer tests for CommonJS, ESM, TypeScript 5.2, current
  TypeScript, and the v1 compatibility entrypoints.
- Enforced minimum coverage thresholds:
  - Lines: `75%`
  - Branches: `70%`
  - Functions: `75%`
- Package contents are validated in CI with `publint` and `npm pack --dry-run`.
