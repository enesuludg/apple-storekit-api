import { AppleStoreKit } from '../src/appleStoreKit';
import { 
  ConsumptionStatus, 
  Platform, 
  DeliveryStatus,
  AccountTenure,
  PlayTime,
  LifetimeDollars,
  UserStatus,
  RefundPreference 
} from '../src/interfaces';
import { readFileSync } from 'fs';
import { join } from 'path';

// Example with file path
const configWithPath = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '/path/to/private_key.p8',
  bundleId: 'com.yourcompany.yourapp',
  environment: 'sandbox' as const
};

// Example with key content
const configWithContent = {
  issuerId: 'YOUR_ISSUER_ID',
  keyId: 'YOUR_KEY_ID',
  privateKey: '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----',
  bundleId: 'com.yourcompany.yourapp',
  environment: 'sandbox' as const
};

// Example with environment variables (recommended)
const config = {
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,
  bundleId: process.env.APPLE_BUNDLE_ID!
  // environment is optional, will try production first, then sandbox if fails
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
      purchaseDate: new Date(status.transactionInfo.purchaseDate),
      originalPurchaseDate: new Date(status.transactionInfo.originalPurchaseDate),
      // Decoded renewal info
      autoRenewStatus: status.renewalInfo.autoRenewStatus,
      autoRenewProductId: status.renewalInfo.autoRenewProductId,
      priceIncreaseStatus: status.renewalInfo.priceIncreaseStatus
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
      deliveryStatus: DeliveryStatus.DELIVERED_WORKING,
      appAccountToken: 'YOUR_APP_ACCOUNT_TOKEN', // Optional: UUID for user account
      accountTenure: AccountTenure.DAYS_180_365,
      playTime: PlayTime.HOURS_1_6,
      lifetimeDollarsRefunded: LifetimeDollars.USD_0,
      lifetimeDollarsPurchased: LifetimeDollars.USD_50_99_99,
      userStatus: UserStatus.ACTIVE,
      refundPreference: RefundPreference.NO_PREFERENCE
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

    // Get current environment
    const currentEnv = storeKit.getCurrentEnvironment();
    console.log('Current Environment:', currentEnv);

  } catch (error) {
    console.error('Error:', error);
  }
}

example();