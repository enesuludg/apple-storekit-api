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
  DELIVERED_WORKING = 0,
  NOT_DELIVERED_QUALITY_ISSUE = 1,
  DELIVERED_WRONG_ITEM = 2,
  NOT_DELIVERED_SERVER_OUTAGE = 3,
  NOT_DELIVERED_CURRENCY_CHANGE = 4,
  NOT_DELIVERED_OTHER = 5
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
  UNDECLARED = 0,
  GRANT = 1,
  DECLINE = 2,
  NO_PREFERENCE = 3
}

export interface ConsumptionRequest {
  /** Required: User must consent to provide consumption data */
  customerConsented: boolean;

  /** Required: The extent to which the customer consumed the in-app purchase */
  consumptionStatus: ConsumptionStatus;

  /** Required: The platform on which the customer consumed the in-app purchase */
  platform: Platform;

  /** Required: Whether you provided a free sample/trial before purchase */
  sampleContentProvided: boolean;

  /** Required: Whether the app successfully delivered the purchase */
  deliveryStatus: DeliveryStatus;

  /** Optional: UUID of the in-app user account */
  appAccountToken?: string;

  /** Optional: Age of the customer's account */
  accountTenure?: AccountTenure;

  /** Optional: Amount of time the customer used the app */
  playTime?: PlayTime;

  /** Optional: Total amount of refunds received across all platforms */
  lifetimeDollarsRefunded?: LifetimeDollars;

  /** Optional: Total amount of purchases made across all platforms */
  lifetimeDollarsPurchased?: LifetimeDollars;

  /** Optional: Status of the customer's account */
  userStatus?: UserStatus;

  /** Optional: Your preference for the refund request outcome */
  refundPreference?: RefundPreference;
} 