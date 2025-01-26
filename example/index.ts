import { AppleStoreKit } from '../src';
import { ConsumptionStatus, Platform, DeliveryStatus } from '../src/interfaces';

const config = {
  issuerId: 'your-issuer-id',
  keyId: 'your-key-id',
  privateKey: 'path/to/your/private-key.p8',
  bundleId: 'your-bundle-id',
  environment: 'sandbox' as const // or 'production'
};

const storeKit = new AppleStoreKit(config);

async function main() {
  try {
    // Subscription status check
    const subscriptionStatus = await storeKit.getSubscriptionStatus('original-transaction-id');
    console.log('Subscription Status:', subscriptionStatus);

    // Verify a purchase
    const purchase = await storeKit.verifyPurchase('transaction-id');
    console.log('Purchase:', purchase);

    // Get transaction history
    const history = await storeKit.getTransactionHistory('transaction-id');
    console.log('Transaction History:', history);

    // Order lookup
    const order = await storeKit.lookupOrder('order-id');
    console.log('Order:', order);

    // Refund lookup
    const refund = await storeKit.refundLookup('transaction-id');
    console.log('Refund:', refund);

    // Send consumption information
    const consumptionData = {
      customerConsented: true,
      consumptionStatus: ConsumptionStatus.FULLY_CONSUMED,
      platform: Platform.APPLE,
      sampleContentProvided: false,
      deliveryStatus: DeliveryStatus.DELIVERED_WORKING
    };

    await storeKit.sendConsumptionInformation('transaction-id', consumptionData);
    console.log('Consumption information sent successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 