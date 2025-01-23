# Apple StoreKit API

A TypeScript/JavaScript library for Apple StoreKit API integration. Handles In-App Purchases and subscription management using the latest StoreKit 2 API.

## Features

- Subscription status verification
- View all subscriptions
- Purchase verification (using StoreKit 2)
- Transaction history
- Order information lookup
- Refund status checking
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
const status = await storeKit.getSubscriptionStatus('originalTransactionId');

// Get all subscriptions
const subscriptions = await storeKit.getAllSubscriptions('originalTransactionId');

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

### Subscriptions
- `getSubscriptionStatus(originalTransactionId: string)`: Get current subscription status
- `getAllSubscriptions(originalTransactionId: string)`: Get all subscriptions for a transaction

### Purchases
- `verifyPurchase(transactionId: string)`: Verify a specific purchase using StoreKit 2 API
- `getTransactionHistory(transactionId: string)`: Get transaction history
- `lookupOrder(orderId: string)`: Look up order details
- `refundLookup(transactionId: string)`: Check refund status

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