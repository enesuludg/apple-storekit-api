export interface TransactionHistoryResponse {
  revision: string;
  bundleId: string;
  environment: string;
  hasMore: boolean;
  signedTransactions: string[];
  decodedTransactions?: any[];
}

export interface TransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: string;
  transactionReason: string;
  storefront: string;
  storefrontId: string;
  price: number;
  currency: string;
}

export interface VerifyPurchaseResponse {
  signedTransactionInfo: string;
} 
