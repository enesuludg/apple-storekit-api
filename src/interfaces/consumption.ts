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

/**
 * Delivery status values for the deprecated V1 consumption endpoint.
 * @deprecated Use DeliveryStatus with sendConsumptionInformationV2().
 */
export enum DeliveryStatusV1 {
  DELIVERED_AND_WORKING_PROPERLY = 0,
  DID_NOT_DELIVER_DUE_TO_QUALITY_ISSUE = 1,
  DELIVERED_WRONG_ITEM = 2,
  DID_NOT_DELIVER_DUE_TO_SERVER_OUTAGE = 3,
  DID_NOT_DELIVER_DUE_TO_IN_GAME_CURRENCY_CHANGE = 4,
  DID_NOT_DELIVER_FOR_OTHER_REASON = 5
}

export enum DeliveryStatus {
  DELIVERED = 'DELIVERED',
  UNDELIVERED_QUALITY_ISSUE = 'UNDELIVERED_QUALITY_ISSUE',
  UNDELIVERED_WRONG_ITEM = 'UNDELIVERED_WRONG_ITEM',
  UNDELIVERED_SERVER_OUTAGE = 'UNDELIVERED_SERVER_OUTAGE',
  UNDELIVERED_OTHER = 'UNDELIVERED_OTHER'
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

/**
 * Refund preference values for the deprecated V1 consumption endpoint.
 * @deprecated Use RefundPreference with sendConsumptionInformationV2().
 */
export enum RefundPreferenceV1 {
  UNDECLARED = 0,
  PREFER_GRANT = 1,
  PREFER_DECLINE = 2,
  NO_PREFERENCE = 3
}

/**
 * The request body for Apple's deprecated V1 consumption endpoint.
 * Apple requires every field except refundPreference. Use the UNDECLARED enum
 * values, or an empty appAccountToken, when information isn't available.
 * @deprecated Use ConsumptionRequest with sendConsumptionInformationV2().
 */
export interface ConsumptionRequestV1 {
  accountTenure: AccountTenure;
  appAccountToken: string;
  consumptionStatus: ConsumptionStatus;
  customerConsented: boolean;
  deliveryStatus: DeliveryStatusV1;
  lifetimeDollarsPurchased: LifetimeDollars;
  lifetimeDollarsRefunded: LifetimeDollars;
  platform: Platform;
  playTime: PlayTime;
  refundPreference?: RefundPreferenceV1;
  sampleContentProvided: boolean;
  userStatus: UserStatus;
}

/** The request body for Apple's V2 consumption endpoint. */
export interface ConsumptionRequest {
  /** Required: Apple accepts the request only when this value is true. */
  customerConsented: boolean;

  /** Optional: The percentage consumed in milliunits, as an integer from 0 through 100000. */
  consumptionPercentage?: number;

  /** Required: Whether the app successfully delivered a working In-App Purchase. */
  deliveryStatus: DeliveryStatus | string;

  /** Optional: The preferred outcome for the refund request. */
  refundPreference?: RefundPreference | string;

  /** Required: Whether a free sample, trial, or functionality information was provided. */
  sampleContentProvided: boolean;
}

export interface ConsumptionResponse {
  /** Indicates whether the consumption information was successfully accepted */
  success: boolean;
  /** The transaction identifier for which consumption information was sent */
  transactionId: string;
  /** HTTP status code (202 when accepted) */
  statusCode: number;
}
