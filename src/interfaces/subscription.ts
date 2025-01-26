export interface SubscriptionStatus {
  /** The original transaction identifier */
  originalTransactionId: string;
  /** The current status of the subscription */
  status: number;
  /** The expiration date of the subscription */
  expirationDate: Date;
  /** Decoded transaction information */
  transactionInfo: any;
  /** Decoded renewal information */
  renewalInfo: any;
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