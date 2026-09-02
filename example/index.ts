import { AppleStoreKit } from '../src';
import { DeliveryStatus } from '../src/interfaces';
import { readFileSync } from 'node:fs';

const config = {
  issuerId: 'your-issuer-id',
  keyId: 'your-key-id',
  privateKey: 'path/to/your/private-key.p8',
  bundleId: 'your-bundle-id',
  appleRootCertificates: [readFileSync('/path/to/AppleRootCA-G3.cer')],
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

    // Send V2 consumption information
    const consumptionData = {
      customerConsented: true,
      sampleContentProvided: false,
      deliveryStatus: DeliveryStatus.DELIVERED,
      consumptionPercentage: 100_000
    };

    await storeKit.sendConsumptionInformationV2('transaction-id', consumptionData);
    console.log('Consumption information sent successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
