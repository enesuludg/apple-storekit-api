export enum AccountTenure {
  UNDECLARED = 0,
  DAYS_0_3 = 1,
  DAYS_3_10 = 2,
  DAYS_10_30 = 3,
  DAYS_30_90 = 4,
  DAYS_90_180 = 5,
  DAYS_180_365 = 6,
  DAYS_OVER_365 = 7
}

export enum ConsumptionStatus {
  UNDECLARED = 0,
  NOT_CONSUMED = 1,
  PARTIALLY_CONSUMED = 2,
  FULLY_CONSUMED = 3
}

export enum DeliveryStatus {
  DELIVERED='DELIVERED',
  UNDELIVERED_QUALITY_ISSUE='UNDELIVERED_QUALITY_ISSUE',
  UNDELIVERED_WRONG_ITEM='UNDELIVERED_WRONG_ITEM',
  UNDELIVERED_SERVER_OUTAGE='UNDELIVERED_SERVER_OUTAGE',
  UNDELIVERED_OTHER='UNDELIVERED_OTHER'

}

export enum Platform {
  UNDECLARED = 0,
  APPLE = 1,
  NON_APPLE = 2
}

export enum PlayTime {
  UNDECLARED = 0,
  MINUTES_0_5 = 1,
  MINUTES_5_60 = 2,
  HOURS_1_6 = 3,
  HOURS_6_24 = 4,
  DAYS_1_4 = 5,
  DAYS_4_16 = 6,
  DAYS_OVER_16 = 7
}

export enum LifetimeDollars {
  UNDECLARED = 0,
  USD_0 = 1,
  USD_0_01_49_99 = 2,
  USD_50_99_99 = 3,
  USD_100_499_99 = 4,
  USD_500_999_99 = 5,
  USD_1000_1999_99 = 6,
  USD_OVER_2000 = 7
}

export enum UserStatus {
  UNDECLARED = 0,
  ACTIVE = 1,
  SUSPENDED = 2,
  TERMINATED = 3,
  LIMITED_ACCESS = 4
}

export enum RefundPreference {
  DECLINE = 'DECLINE',
  GRANT_FULL = 'GRANT_FULL',
  GRANT_PRORATED = 'GRANT_PRORATED'
}

export interface ConsumptionRequest {
  /** Required: A Boolean value of true or false that indicates whether the customer consented to provide consumption data */
  customerConsented: boolean;

  /** Optional: An integer that indicates the percentage of the In-App Purchase the customer consumed, in milliunits. Minimum: 0, Maximum: 100000 */
  consumptionPercentage?: number;

  /** Required: A value that indicates whether the app successfully delivered an In-App Purchase that works properly */
  deliveryStatus: DeliveryStatus;

  /** Optional: A value that indicates your preference, based on your operational logic, as to whether the App Store should grant the refund */
  refundPreference?: RefundPreference;

  /** Required: A Boolean value of true or false that indicates whether you provided, prior to its purchase, a free sample or trial of the content, or information about its functionality */
  sampleContentProvided: boolean;

  // Legacy/Additional optional fields (may still be supported)
  /** Optional: The age of the customer's account */
  accountTenure?: AccountTenure;

  /** Optional: The UUID of the in-app user account that completed the in-app purchase transaction */
  appAccountToken?: string;

  /** Optional: The extent to which the customer consumed the in-app purchase */
  consumptionStatus?: ConsumptionStatus;

  /** Optional: Total amount of purchases made across all platforms (in USD) */
  lifetimeDollarsPurchased?: LifetimeDollars;

  /** Optional: Total amount of refunds received across all platforms (in USD) */
  lifetimeDollarsRefunded?: LifetimeDollars;

  /** Optional: The platform on which the customer consumed the in-app purchase */
  platform?: Platform;

  /** Optional: Amount of time the customer used the app */
  playTime?: PlayTime;

  /** Optional: Status of the customer's account */
  userStatus?: UserStatus;
}

export interface ConsumptionResponse {
  /** Indicates whether the consumption information was successfully accepted */
  success: boolean;
  /** The transaction identifier for which consumption information was sent */
  transactionId: string;
  /** HTTP status code (202 when accepted) */
  statusCode: number;
} 