import { AppleStoreKit } from '../src/appleStoreKit';
import { readFileSync } from 'node:fs';
import { 
  ConsumptionStatus, 
  Platform, 
  DeliveryStatus,
  AccountTenure,
  PlayTime,
  LifetimeDollars,
  UserStatus
} from '../src/interfaces';

// Example with file path
const configWithPath = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '/path/to/private_key.p8',
  bundleId: 'com.yourcompany.yourapp',
  appleRootCertificates: [readFileSync('/path/to/AppleRootCA-G3.cer')],
  environment: 'sandbox' as const
};

// Example with key content
const configWithContent = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----',
  bundleId: 'com.yourcompany.yourapp',
  appleRootCertificates: [readFileSync('/path/to/AppleRootCA-G3.cer')],
  environment: 'sandbox' as const
};

// Example with environment variables (recommended)
const config = {
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,
  bundleId: process.env.APPLE_BUNDLE_ID!,
  appleRootCertificates: [process.env.APPLE_ROOT_CA_PATH!],
  appAppleId: Number(process.env.APPLE_APP_ID)
  // environment is optional; sandbox fallback happens only for Apple error 4040010
};

async function example() {
  const storeKit = new AppleStoreKit(config);

  try {
    // Check subscription status
    const status = await storeKit.getSubscriptionStatus('TRANSACTION_ID');
    console.log('Subscription Status:', {
      originalTransactionId: status.originalTransactionId,
      status: status.status,
      expirationDate: status.expirationDate,
      // Decoded transaction info
      productId: status.transactionInfo.productId,
      purchaseDate: status.transactionInfo.purchaseDate === undefined
        ? undefined
        : new Date(status.transactionInfo.purchaseDate),
      originalPurchaseDate: status.transactionInfo.originalPurchaseDate === undefined
        ? undefined
        : new Date(status.transactionInfo.originalPurchaseDate),
      // Decoded renewal info
      autoRenewStatus: status.renewalInfo.autoRenewStatus,
      autoRenewProductId: status.renewalInfo.autoRenewProductId,
      renewalDate: status.renewalInfo.renewalDate
    });
    // Get transaction history
    const history = await storeKit.getTransactionHistory('TRANSACTION_ID');
    console.log('Transaction History:', history);

    // Send consumption information (requires user consent)
    const consumptionData = {
      customerConsented: true, // Make sure you have obtained valid consent
      consumptionStatus: ConsumptionStatus.FULLY_CONSUMED,
      platform: Platform.APPLE,
      sampleContentProvided: true,
      deliveryStatus: DeliveryStatus.DELIVERED,
      appAccountToken: 'YOUR_APP_ACCOUNT_TOKEN', // Optional: UUID for user account
      accountTenure: AccountTenure.DAYS_180_365,
      playTime: PlayTime.HOURS_1_6,
      lifetimeDollarsRefunded: LifetimeDollars.USD_0,
      lifetimeDollarsPurchased: LifetimeDollars.USD_50_99_99,
      userStatus: UserStatus.ACTIVE
    };
    
    await storeKit.sendConsumptionInformation('TRANSACTION_ID', consumptionData);
    console.log('Consumption information sent successfully');
    // Verify purchase
    const purchase = await storeKit.verifyPurchase('TRANSACTION_ID');
    console.log('Purchase Verification:', purchase);

    

    // Look up order information
    const order = await storeKit.lookupOrder('ORDER_ID');
    console.log('Order Info:', order);

    // Check refund status
    const refund = await storeKit.refundLookup('TRANSACTION_ID');
    console.log('Refund Status:', refund);

    // Inspect configuration and resolve a specific transaction environment
    console.log('Configured Environment:', storeKit.getConfiguredEnvironment());
    const transactionEnvironment = await storeKit.resolveTransactionEnvironment('TRANSACTION_ID');
    console.log('Transaction Environment:', transactionEnvironment);

  } catch (error) {
    console.error('Error:', error);
  }
}

example();
