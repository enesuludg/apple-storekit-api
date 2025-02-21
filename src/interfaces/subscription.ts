import { TransactionInfo } from "./transaction";

export enum SubscriptionStatusType {
  /** The auto-renewable subscription is active */
  ACTIVE = 1,
  /** The auto-renewable subscription is expired */
  EXPIRED = 2,
  /** The auto-renewable subscription is in a billing retry period */
  BILLING_RETRY = 3,
  /** The auto-renewable subscription is in a Billing Grace Period */
  GRACE_PERIOD = 4,
  /** The auto-renewable subscription is revoked. The App Store refunded the transaction or revoked it from Family Sharing */
  REVOKED = 5
}

export type SubscriptionStatusTypeString = keyof typeof SubscriptionStatusType;

export interface SubscriptionStatus {
  /** The original transaction identifier */
  originalTransactionId: string;
  /** The current status of the subscription */
  status: number;
  /** The current status of the subscription as string */
  statusType: SubscriptionStatusTypeString;
  /** The expiration date of the subscription */
  expirationDate: Date;
  /** Decoded transaction information */
  transactionInfo: TransactionInfo;
  /** Decoded renewal information */
  renewalInfo: RenewalInfo;
}

export interface RenewalInfo {
  originalTransactionId: string;
  autoRenewProductId: string;
  productId: string;
  autoRenewStatus: number;
  renewalPrice: number;
  currency: string;
  signedDate: number;
  environment: string;
  recentSubscriptionStartDate: number;
  renewalDate: number;
}

export interface AppleSubscriptionResponse {
  /** The environment where the transaction occurred */
  environment: 'Sandbox' | 'Production';
  /** The bundle identifier of the app */
  bundleId: string;
  /** Array of subscription data */
  data: Array<{
    /** The identifier for the subscription group */
    subscriptionGroupIdentifier: string;
    /** Array of the most recent transactions */
    lastTransactions: Array<{
      /** The original transaction identifier */
      originalTransactionId: string;
      /** The status of the subscription */
      status: number;
      /** The signed transaction information JWT */
      signedTransactionInfo: string;
      /** The signed renewal information JWT */
      signedRenewalInfo: string;
    }>;
  }>;
} 