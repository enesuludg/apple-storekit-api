# Apple StoreKit API

A TypeScript/JavaScript library for Apple StoreKit API integration. Handles In-App Purchases and subscription management using the latest StoreKit 2 API.

## Features

- Subscription status verification
- Purchase verification (using StoreKit 2)
- Transaction history
- Order information lookup
- Refund status checking
- Consumption information reporting
- Flexible private key handling (file path or string content)
- Auto environment detection (production/sandbox)
- Wide Node.js version support (10.24.1 and above)

## Installation

```bash
npm install apple-storekit-api
```

## Requirements

- Node.js >= 10.24.1
- App Store Connect API access
- Private key in `.p8` format (file or content)
- Issuer ID and Key ID

## Usage

```typescript
import { AppleStoreKit } from 'apple-storekit-api';

// Example with file path
const configWithPath = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '/path/to/private_key.p8',
  bundleId: 'com.yourcompany.yourapp',
  environment: 'sandbox' // or 'production'
};

// Example with key content
const configWithContent = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----',
  bundleId: 'com.yourcompany.yourapp',
  environment: 'sandbox' // or 'production'
};

// Example with environment variables (recommended for production)
const configWithEnv = {
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,
  bundleId: process.env.APPLE_BUNDLE_ID!
  // environment is optional, will try production first, then sandbox if fails
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

// Get current environment
const currentEnv = storeKit.getCurrentEnvironment(); // 'production' or 'sandbox'
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

### Environment Detection

The library supports automatic environment detection:

1. **Auto Detection** (recommended for development):
   ```typescript
   const config = {
     // ... other config
     // environment not specified
   };
   ```
   - First tries production environment
   - If request fails, automatically retries with sandbox
   - Useful during development and testing

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

## API Methods

### Subscription Status

```typescript
const status = await storeKit.getSubscriptionStatus('original-transaction-id');
```

This method returns the current status of a subscription, including:
- Original transaction ID
- Status
- Expiration date
- Transaction info
- Renewal info

### Purchases
- `verifyPurchase(transactionId: string)`: Verify a specific purchase using StoreKit 2 API
- `getTransactionHistory(transactionId: string)`: Get transaction history
- `lookupOrder(orderId: string)`: Look up order details
- `refundLookup(transactionId: string)`: Check refund status
- `setAppAccountToken(originalTransactionId: string, appAccountToken: string)`: Set or update app account token for a transaction

### Consumption Information
- `sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest)`: Send consumption information for refund decisions

The `ConsumptionRequest` interface includes required and optional fields with their corresponding enum values:

#### Required Fields:
```typescript
{
  accountTenure: AccountTenure;           // Age of customer's account
  appAccountToken: string;                // UUID of user account
  consumptionStatus: ConsumptionStatus;   // Extent of consumption
  customerConsented: boolean;             // User consent (must be true)
  deliveryStatus: DeliveryStatus;         // Delivery success status
  lifetimeDollarsPurchased: LifetimeDollars; // Total purchases (USD)
  lifetimeDollarsRefunded: LifetimeDollars;  // Total refunds (USD)
  platform: Platform;                     // Purchase platform
  playTime: PlayTime;                     // App usage time
  sampleContentProvided: boolean;         // Free sample provided
  userStatus: UserStatus;                 // Customer account status
}
```

#### Optional Fields:
```typescript
{
  refundPreference?: RefundPreference;    // Your refund preference
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
  DELIVERED_WORKING = 0,              // Delivered and working properly
  NOT_DELIVERED_QUALITY_ISSUE = 1,    // Not delivered due to quality issue
  DELIVERED_WRONG_ITEM = 2,           // Wrong item delivered
  NOT_DELIVERED_SERVER_OUTAGE = 3,    // Not delivered due to server outage
  NOT_DELIVERED_CURRENCY_CHANGE = 4,  // Not delivered due to currency change
  NOT_DELIVERED_OTHER = 5             // Not delivered for other reasons
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
  UNDECLARED = 0,     // Use to avoid providing information
  GRANT = 1,          // Prefer to grant the refund
  DECLINE = 2,        // Prefer to decline the refund
  NO_PREFERENCE = 3   // No preference
}
```

Example usage:
```typescript
const consumptionData = {
  customerConsented: true,  // Make sure you have obtained valid consent
  consumptionStatus: ConsumptionStatus.FULLY_CONSUMED,
  platform: Platform.APPLE,
  sampleContentProvided: true,
  deliveryStatus: DeliveryStatus.DELIVERED_WORKING,
  appAccountToken: 'YOUR_APP_ACCOUNT_TOKEN',
  accountTenure: AccountTenure.DAYS_180_365,
  playTime: PlayTime.HOURS_1_6,
  lifetimeDollarsRefunded: LifetimeDollars.USD_0,
  lifetimeDollarsPurchased: LifetimeDollars.USD_50_99_99,
  userStatus: UserStatus.ACTIVE,
  refundPreference: RefundPreference.NO_PREFERENCE
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
- `getCurrentEnvironment()`: Get the current environment being used

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
       bundleId: process.env.APPLE_BUNDLE_ID
     };
     ```

2. **Environment Management**:
   - Use 'sandbox' for development and testing
   - Use 'production' for live apps
   - Consider using different keys for sandbox and production

## Compatibility

This library is compatible with:
- Node.js versions 10.24.1 and above
- TypeScript 4.9.x and above
- All major Node.js frameworks (Express, Koa, Nest.js, etc.)
- Both CommonJS and ES Modules

### Set App Account Token

Sets or updates the app account token for a transaction made outside of your app:

```typescript
try {
  await storeKit.setAppAccountToken(
    'original-transaction-id',
    'user-account-uuid'
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