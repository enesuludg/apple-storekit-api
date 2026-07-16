# Apple StoreKit API

[![npm version](https://img.shields.io/npm/v/apple-storekit-api.svg)](https://www.npmjs.com/package/apple-storekit-api)
[![npm downloads](https://img.shields.io/npm/dm/apple-storekit-api.svg)](https://www.npmjs.com/package/apple-storekit-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A TypeScript/JavaScript library for Apple StoreKit API integration. Handles In-App Purchases and subscription management using the latest StoreKit 2 API.

## Features

- Subscription status verification
- Purchase verification with Apple JWS certificate-chain and claim validation
- Transaction history
- Order information lookup
- Refund status checking
- Consumption information reporting
- Flexible private key handling (file path or string content)
- Auto environment detection (production/sandbox)
- Bounded retries, request timeouts, cancellation, and streaming pagination

## Installation

```bash
npm install apple-storekit-api
```

See [CHANGES.md](./CHANGES.md) for release notes and migration guidance.

### Version 2 migration notes

- Signed payload helpers now verify asynchronously and require Apple root certificates.
- Production signed-data verification requires `appAppleId`.
- `AppleStoreKit` uses composition and no longer exposes low-level transport methods.
- Endpoints without a transaction identifier require an explicit environment in auto mode.
- The supported runtime is Node.js 22 or newer.

## Requirements

- Node.js >= 22
- App Store Connect API access
- Private key in `.p8` format (file or content)
- Issuer ID and Key ID
- Apple root certificates from [Apple PKI](https://www.apple.com/certificateauthority/)
- App Apple ID for production signed-data verification

## Usage

```typescript
import { AppleStoreKit } from 'apple-storekit-api';
import { readFileSync } from 'node:fs';

const appleRootCertificates = [
  readFileSync('/path/to/AppleRootCA-G3.cer')
];

// Example with file path
const configWithPath = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '/path/to/private_key.p8',
  bundleId: 'com.yourcompany.yourapp',
  appleRootCertificates,
  environment: 'sandbox' // or 'production'
};

// Example with key content
const configWithContent = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----',
  bundleId: 'com.yourcompany.yourapp',
  appleRootCertificates,
  environment: 'sandbox' // or 'production'
};

// Example with environment variables (recommended for production)
const configWithEnv = {
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,
  bundleId: process.env.APPLE_BUNDLE_ID!,
  appleRootCertificates: [process.env.APPLE_ROOT_CA_PATH!],
  appAppleId: Number(process.env.APPLE_APP_ID),
  // environment is optional. Auto mode falls back to sandbox only when
  // Apple returns 4040010 (TransactionIdNotFoundError).
  maxRetries: 2,
  timeoutMs: 10_000
};

const storeKit = new AppleStoreKit(configWithPath); // or configWithContent or configWithEnv

// Check subscription status
const status = await storeKit.getSubscriptionStatus('original-transaction-id');


// Verify purchase
const purchase = await storeKit.verifyPurchase('transactionId');

// Get transaction history
const history = await storeKit.getTransactionHistory('transactionId');

// Look up order information
const order = await storeKit.lookupOrder('orderId');

// Check refund status
const refund = await storeKit.refundLookup('transactionId');

// Inspect the configured mode
const mode = storeKit.getConfiguredEnvironment(); // 'production', 'sandbox', or 'auto'

// Resolve the environment for a specific transaction
const transactionEnvironment = await storeKit.resolveTransactionEnvironment('transactionId');
```

## Configuration

### Generating API Credentials

1. Go to App Store Connect:
   - Visit [App Store Connect](https://appstoreconnect.apple.com)
   - Navigate to "Users and Access" > "Keys"

2. Create API Key:
   - Click the "+" button to create a new key
   - Enter a name for your key
   - Select "App Store Connect API" access
   - For In-App Purchases, ensure you have the following access rights:
     - App Access
     - Sales and Finance
     - In-App Purchase Management

3. Generate and Download Key:
   - Click "Generate" to create the key
   - Your browser will download a `.p8` file
   - **Important**: Save this file securely. You can only download it once!
   - Note the Key ID (visible in the keys list)

4. Get Issuer ID:
   - The Issuer ID is shown at the top of the Keys page
   - It's the same for all keys in your organization

5. Bundle ID:
   - This is your app's bundle identifier
   - Found in Xcode or App Store Connect under app settings
   - Format: `com.yourcompany.yourapp`

### Private Key Handling

The library accepts the private key in two formats:

1. **File Path**: Provide the path to your `.p8` file
   ```typescript
   privateKey: '/absolute/path/to/private_key.p8'
   // or
   privateKey: './relative/path/to/private_key.p8'
   ```

2. **Key Content**: Provide the private key content directly
   ```typescript
   privateKey: '-----BEGIN PRIVATE KEY-----\nYOUR_KEY_CONTENT\n-----END PRIVATE KEY-----'
   ```

### Signed Data Verification

`verifyPurchase`, transaction history, order lookup, subscription helpers, and the
`verifyAndDecode*` methods verify Apple's JWS signature and certificate chain before
returning decoded data. Pass DER-encoded Apple root certificates as buffers or file
paths. Production verification also requires `appAppleId`.

Certificate revocation and current-date checks are enabled by default. Set
`enableOnlineChecks: false` only when your deployment cannot perform the required
online checks and you accept the reduced verification guarantees.

### Environment Detection

The library supports automatic environment detection:

1. **Auto Detection** (recommended for development):
   ```typescript
   const config = {
     // ... other config
     // environment not specified
   };
   ```
   - Transaction-based reads first try production
   - The request falls back to sandbox only when Apple returns error `4040010` (`TransactionIdNotFoundError`)
   - Authentication, validation, rate-limit, server, and network errors never cause an environment switch
   - Write operations resolve the transaction environment first, then send the write to one environment
   - Look Up Order ID never falls back because Apple doesn't provide that endpoint in sandbox

2. **Manual Setting**:
   ```typescript
   const config = {
     // ... other config
     environment: 'production' // or 'sandbox'
   };
   ```
   - Explicitly sets the environment
   - No automatic switching
   - Recommended for production use

### Retry Policy

Retries always stay in the same environment:

- Selected transient network errors and HTTP `408`, `429`, `500`, `502`, `503`, and `504` use bounded exponential backoff
- HTTP `429` honors Apple's `Retry-After` value when it is within `maxRetryDelayMs`
- HTTP `400`, `401`, `403`, and other non-retryable responses fail immediately
- GET requests retry by default; write endpoints opt in only when their semantics are idempotent

```typescript
const config = {
  // ... credentials
  maxRetries: 2,       // default: 2
  retryBaseDelayMs: 250,
  maxRetryDelayMs: 5000,
  timeoutMs: 10_000
};
```

Every request also accepts an `AbortSignal` through its options where options are
available. Pagination helpers stop at 100 pages or 20,000 items by default; override
these bounds with `maxPages` and `maxItems`.

## API Methods

### Subscription Status

```typescript
const status = await storeKit.getSubscriptionStatus('original-transaction-id');
```

This method returns the current status of a subscription, including:
- Original transaction ID
- Status (numeric) and statusType (string)
- Expiration date
- Transaction info
- Renewal info

**SubscriptionStatusType**
```typescript
{
  ACTIVE = 1,        // The auto-renewable subscription is active
  EXPIRED = 2,       // The auto-renewable subscription is expired
  BILLING_RETRY = 3, // The subscription is in a billing retry period
  GRACE_PERIOD = 4,  // The subscription is in a Billing Grace Period
  REVOKED = 5        // The subscription is revoked (refunded or removed from Family Sharing)
}
```

### Purchases
- `verifyPurchase(transactionId: string)`: Verify a specific purchase using StoreKit 2 API
- `getTransactionHistory(anyTransactionId, request?, options?)`: Get and verify bounded V2 transaction history
- `iterateTransactionHistory(anyTransactionId, request?, options?)`: Stream verified transactions
- `getTransactionHistoryPage(anyTransactionId, request?, revision?, environment?)`: Get one V2 history page
- `getAppTransactionInfo(anyTransactionId)`: Get the signed app transaction
- `getVerifiedAppTransactionInfo(anyTransactionId)`: Get the verified app transaction
- `finishTransaction(transactionId)`: Mark server-side transaction processing as finished
- `lookupOrder(orderId: string)`: Look up order details
- `getRefundHistory(anyTransactionId, options?)`: Get bounded V2 refund history pages
- `iterateRefundHistoryPages(anyTransactionId, options?)`: Stream V2 refund history pages
- `getRefundHistoryPage(anyTransactionId, revision?, environment?)`: Get one V2 refund page
- `refundLookup(anyTransactionId)`: Deprecated alias for `getRefundHistory`
- `setAppAccountToken(originalTransactionId: string, appAccountToken: string)`: Set or update app account token for a transaction

Transaction history supports Apple filters:

```typescript
const history = await storeKit.getTransactionHistory('transaction-id', {
  startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
  productIds: ['com.example.product'],
  productTypes: [TransactionProductType.AUTO_RENEWABLE],
  sort: TransactionHistoryOrder.DESCENDING,
  revoked: false
});
```

### Subscription Status and Renewal Extensions

- `getAllSubscriptionStatuses(anyTransactionId, statuses?)`: Return Apple's complete status response with optional repeated status filters
- `getSubscriptionStatus(originalTransactionId)`: Return an exact matching status, or fail if the response is ambiguous
- `extendSubscriptionRenewalDate(originalTransactionId, request)`
- `extendRenewalDateForAllActiveSubscribers(request, options?)`
- `getStatusOfSubscriptionRenewalDateExtensions(requestIdentifier, productId, options?)`

For endpoints without a transaction ID, pass an explicit environment. Auto mode
throws instead of silently selecting production for these endpoints.

### App Store Server Notifications

- `getNotificationHistory(request, paginationToken?, options?)`: Get one notification-history page
- `getAllNotificationHistory(request, options?)`: Get all notification-history pages
- `iterateNotificationHistoryPages(request, options?)`: Stream notification-history pages
- `requestTestNotification(options?)`: Request a test notification
- `getTestNotificationStatus(testNotificationToken, options?)`: Check a test notification

```typescript
const notifications = await storeKit.getAllNotificationHistory(
  { startDate, endDate, onlyFailures: true },
  { environment: 'sandbox' }
);
```

### Retention Messaging

Image endpoints:

- `uploadImage(imageIdentifier, image, imageSize?, options?)`
- `deleteImage(imageIdentifier, options?)`
- `getImageList(options?)`

Message and default-configuration endpoints:

- `uploadMessage(messageIdentifier, request, options?)`
- `deleteMessage(messageIdentifier, options?)`
- `getMessageList(options?)`
- `configureDefaultMessage(productId, locale, request, options?)`
- `deleteDefaultMessage(productId, locale, options?)`
- `getDefaultMessage(productId, locale, options?)`

Realtime URL and sandbox performance-test endpoints:

- `configureRealtimeURL(request, options?)`
- `deleteRealtimeURL(options?)`
- `getRealtimeURL(options?)`
- `initiatePerformanceTest(request)`
- `getPerformanceTestResults(requestId)`

Performance tests always use Apple's sandbox environment. Image uploads use `image/png`, and repeated query parameters are encoded in Apple's expected format.

### Consumption Information
- `sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest)`: Send consumption information using the deprecated V1 endpoint
- `sendConsumptionInformationV2(transactionId: string, consumptionRequest: ConsumptionRequest)`: Send consumption information using V2 API

The `ConsumptionRequest` interface includes required and optional fields with their corresponding enum values:

#### Required Fields:
```typescript
{
  customerConsented: boolean;             // User consent (must be true)
  deliveryStatus: DeliveryStatus;         // Delivery success status
  sampleContentProvided: boolean;         // Free sample provided
}
```

#### Optional Fields:
```typescript
{
  consumptionPercentage?: number;         // Percentage consumed (0-100000 milliunits)
  refundPreference?: RefundPreference;    // Your refund preference
  accountTenure?: AccountTenure;          // Age of customer's account
  appAccountToken?: string;               // UUID of user account
  consumptionStatus?: ConsumptionStatus;  // Extent of consumption
  lifetimeDollarsPurchased?: LifetimeDollars; // Total purchases (USD)
  lifetimeDollarsRefunded?: LifetimeDollars;  // Total refunds (USD)
  platform?: Platform;                    // Purchase platform
  playTime?: PlayTime;                    // App usage time
  userStatus?: UserStatus;                // Customer account status
}
```

#### Enum Values:

**ConsumptionStatus**
```typescript
{
  UNDECLARED = 0,        // Use to avoid providing information
  NOT_CONSUMED = 1,      // Not consumed at all
  PARTIALLY_CONSUMED = 2, // Partially consumed
  FULLY_CONSUMED = 3     // Fully consumed
}
```

**Platform**
```typescript
{
  UNDECLARED = 0,  // Use to avoid providing information
  APPLE = 1,       // Apple platform
  NON_APPLE = 2    // Non-Apple platform
}
```

**DeliveryStatus**
```typescript
{
  DELIVERED = 'DELIVERED',                           // Delivered and working properly
  UNDELIVERED_QUALITY_ISSUE = 'UNDELIVERED_QUALITY_ISSUE',   // Not delivered due to quality issue
  UNDELIVERED_WRONG_ITEM = 'UNDELIVERED_WRONG_ITEM',         // Wrong item delivered
  UNDELIVERED_SERVER_OUTAGE = 'UNDELIVERED_SERVER_OUTAGE',   // Not delivered due to server outage
  UNDELIVERED_OTHER = 'UNDELIVERED_OTHER'                    // Not delivered for other reasons
}
```

**AccountTenure**
```typescript
{
  UNDECLARED = 0,     // Use to avoid providing information
  DAYS_0_3 = 1,       // 0-3 days
  DAYS_3_10 = 2,      // 3-10 days
  DAYS_10_30 = 3,     // 10-30 days
  DAYS_30_90 = 4,     // 30-90 days
  DAYS_90_180 = 5,    // 90-180 days
  DAYS_180_365 = 6,   // 180-365 days
  DAYS_OVER_365 = 7   // Over 365 days
}
```

**PlayTime**
```typescript
{
  UNDECLARED = 0,    // Use to avoid providing information
  MINUTES_0_5 = 1,   // 0-5 minutes
  MINUTES_5_60 = 2,  // 5-60 minutes
  HOURS_1_6 = 3,     // 1-6 hours
  HOURS_6_24 = 4,    // 6-24 hours
  DAYS_1_4 = 5,      // 1-4 days
  DAYS_4_16 = 6,     // 4-16 days
  DAYS_OVER_16 = 7   // Over 16 days
}
```

**LifetimeDollars** (for both purchased and refunded)
```typescript
{
  UNDECLARED = 0,        // Use to avoid providing information
  USD_0 = 1,            // $0
  USD_0_01_49_99 = 2,   // $0.01-$49.99
  USD_50_99_99 = 3,     // $50-$99.99
  USD_100_499_99 = 4,   // $100-$499.99
  USD_500_999_99 = 5,   // $500-$999.99
  USD_1000_1999_99 = 6, // $1000-$1999.99
  USD_OVER_2000 = 7     // Over $2000
}
```

**UserStatus**
```typescript
{
  UNDECLARED = 0,      // Use to avoid providing information
  ACTIVE = 1,          // Account is active
  SUSPENDED = 2,       // Account is suspended
  TERMINATED = 3,      // Account is terminated
  LIMITED_ACCESS = 4   // Account has limited access
}
```

**RefundPreference**
```typescript
{
  DECLINE = 'DECLINE',            // Prefer to decline the refund
  GRANT_FULL = 'GRANT_FULL',      // Prefer to grant a full refund
  GRANT_PRORATED = 'GRANT_PRORATED' // Prefer to grant a prorated refund
}
```

Example usage:
```typescript
const consumptionData = {
  // Required fields
  customerConsented: true,  // Make sure you have obtained valid consent
  deliveryStatus: DeliveryStatus.DELIVERED,
  sampleContentProvided: true,

  // Optional fields
  consumptionStatus: ConsumptionStatus.FULLY_CONSUMED,
  platform: Platform.APPLE,
  appAccountToken: 'YOUR_APP_ACCOUNT_TOKEN',
  accountTenure: AccountTenure.DAYS_180_365,
  playTime: PlayTime.HOURS_1_6,
  lifetimeDollarsRefunded: LifetimeDollars.USD_0,
  lifetimeDollarsPurchased: LifetimeDollars.USD_50_99_99,
  userStatus: UserStatus.ACTIVE,
  refundPreference: RefundPreference.GRANT_FULL
};

await storeKit.sendConsumptionInformation('transactionId', consumptionData);
```

### Important Notes on Consumption Information

1. **User Consent Required**
   - You MUST obtain valid consent before sharing consumption data
   - Consent must be freely given, specific, informed, and unambiguous
   - Users should be able to withdraw consent at any time
   - Do NOT use App Tracking Transparency prompt for this consent
   - The API will return HTTP 400 with `InvalidCustomerConsentError` if `customerConsented` is not `true`

2. **Response to Refund Requests**
   - Send consumption information when you receive a `CONSUMPTION_REQUEST` notification
   - Respond within 12 hours of receiving the notification
   - Only send data if user has provided consent

3. **Privacy Considerations**
   - Never store sensitive user data unencrypted
   - Update your app's privacy labels to reflect data usage
   - Implement user data access and deletion requests
   - Follow Apple's privacy guidelines

4. **Best Practices**
   - Use `UNDECLARED` (0) for any field where you don't want to provide information
   - Always validate the data ranges before sending
   - Keep track of user consent status
   - Implement proper error handling for API responses

### Utility
- `getConfiguredEnvironment()`: Get `'production'`, `'sandbox'`, or `'auto'`
- `resolveTransactionEnvironment(transactionId: string)`: Resolve the environment for one transaction
- `getCurrentEnvironment()`: Deprecated alias for `getConfiguredEnvironment()`
- `getAccountTenure(date: Date)`: Calculate the account tenure enum value based on account creation date

## Security Best Practices

1. **Private Key Storage**:
   - Never commit your `.p8` file to version control
   - Store the key securely (e.g., environment variables, secure key management service)
   - Consider using environment variables for all sensitive data:
     ```typescript
     const config = {
       issuerId: process.env.APPLE_ISSUER_ID,
       keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      bundleId: process.env.APPLE_BUNDLE_ID,
      appleRootCertificates: [process.env.APPLE_ROOT_CA_PATH],
      appAppleId: Number(process.env.APPLE_APP_ID)
     };
     ```

2. **Environment Management**:
   - Use 'sandbox' for development and testing
   - Use 'production' for live apps
   - Consider using different keys for sandbox and production

## Compatibility

This library is compatible with:
- Node.js versions 22 and 24
- TypeScript 5.9.x and above
- All major Node.js frameworks (Express, Koa, Nest.js, etc.)
- CommonJS packages and TypeScript declarations

### Set App Account Token

Sets or updates the app account token for a transaction made outside of your app:

```typescript
try {
  await storeKit.setAppAccountToken(
    'original-transaction-id',
    '00000000-0000-4000-8000-000000000001'
  );
  console.log('App account token updated successfully');
} catch (error) {
  console.error('Failed to update app account token:', error.message);
}
```

**Note**: This method is available in App Store Server API 1.16+ and is useful for:
- Linking transactions to specific user accounts
- Updating account tokens for purchases made outside your app
- Improving transaction tracking and analytics

## Error Handling

The library includes comprehensive error handling for API responses. All methods throw descriptive errors that include the original Apple StoreKit API error message when available.

```typescript
try {
  const status = await storeKit.getSubscriptionStatus('originalTransactionId');
} catch (error) {
  console.error('StoreKit API Error:', error.message);
}
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: amazing new feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and feature requests, please use the GitHub issue tracker.
