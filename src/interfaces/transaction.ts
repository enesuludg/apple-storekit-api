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

export interface UpdateAppAccountTokenRequest {
  /** The app account token value to set for the transaction */
  appAccountToken: string;
}

export interface RefundLookupResponse {
  /** Array of signed transaction JWTs */
  signedTransactions: string[];
  /** Revision identifier for the refund lookup */
  revision: string;
  /** Indicates if there are more refunds to fetch */
  hasMore: boolean;
}

export interface LookupOrderResponse {
  /** Status code of the order lookup */
  status: number;
  /** Array of decoded transaction information */
  signedTransactions: TransactionInfo[];
} 
