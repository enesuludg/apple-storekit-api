import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';

export interface TransactionHistoryResponse {
  revision?: string;
  bundleId: string;
  appAppleId?: number;
  environment: string;
  hasMore: boolean;
  signedTransactions: string[];
  decodedTransactions?: TransactionInfo[];
}

export enum TransactionProductType {
  AUTO_RENEWABLE = 'AUTO_RENEWABLE',
  NON_RENEWABLE = 'NON_RENEWABLE',
  CONSUMABLE = 'CONSUMABLE',
  NON_CONSUMABLE = 'NON_CONSUMABLE'
}

export enum TransactionHistoryOrder {
  ASCENDING = 'ASCENDING',
  DESCENDING = 'DESCENDING'
}

export enum InAppOwnershipType {
  FAMILY_SHARED = 'FAMILY_SHARED',
  PURCHASED = 'PURCHASED'
}

export interface TransactionHistoryRequest {
  startDate?: number;
  endDate?: number;
  productIds?: string[];
  productTypes?: TransactionProductType[];
  sort?: TransactionHistoryOrder;
  subscriptionGroupIdentifiers?: string[];
  inAppOwnershipType?: InAppOwnershipType;
  revoked?: boolean;
}

/** A transaction payload whose Apple JWS signature and claims were verified. */
export type TransactionInfo = JWSTransactionDecodedPayload;

export interface VerifyPurchaseResponse {
  signedTransactionInfo: string;
}

export interface AppTransactionInfoResponse {
  signedAppTransactionInfo: string;
}

export interface UpdateAppAccountTokenRequest {
  /** The app account token value to set for the transaction */
  appAccountToken: string;
}

export interface RefundLookupResponse {
  /** Array of signed transaction JWTs */
  signedTransactions: string[];
  /** Revision identifier for the refund lookup */
  revision?: string;
  /** Indicates if there are more refunds to fetch */
  hasMore: boolean;
}

/** Preferred V2 name. */
export type RefundHistoryResponse = RefundLookupResponse;

export interface LookupOrderResponse {
  /** Status code of the order lookup */
  status: number;
  /** Array of verified and decoded transaction information. */
  transactions: TransactionInfo[];
  /** Array of decoded transaction information */
  /** @deprecated Use transactions. */
  signedTransactions: TransactionInfo[];
}
