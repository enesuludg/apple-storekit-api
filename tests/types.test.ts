import {
  AppleStoreKit,
  AppleStoreKitConfig,
  StoreKitPaginationOptions,
  TransactionInfo
} from '../src';

const config = {
  issuerId: '00000000-0000-4000-8000-000000000000',
  keyId: 'TESTKEY123',
  privateKey: '-----BEGIN PRIVATE KEY-----\nvalue\n-----END PRIVATE KEY-----',
  bundleId: 'com.example.app',
  environment: 'sandbox',
  appleRootCertificates: [Buffer.from('certificate')],
  timeoutMs: 10_000
} satisfies AppleStoreKitConfig;

const client = new AppleStoreKit(config);
const pagination: StoreKitPaginationOptions = {
  maxPages: 5,
  maxItems: 500,
  signal: new AbortController().signal
};

async function consumerUsage(): Promise<void> {
  const transaction: TransactionInfo = await client.verifyPurchase(
    'transaction-id',
    { signal: pagination.signal }
  );
  transaction.productId?.toUpperCase();

  const decoded: TransactionInfo = await client.decodeSignedData(
    'signed-transaction',
    'sandbox'
  );
  decoded.transactionId?.toString();

  for await (const item of client.iterateTransactionHistory(
    'transaction-id',
    {},
    pagination
  )) {
    item.transactionId?.toString();
  }
}

void consumerUsage;
