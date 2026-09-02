import {
  AccountTenure,
  ConsumptionRequest,
  ConsumptionRequestV1,
  ConsumptionResponse,
  ConsumptionStatus,
  AppleStoreKitConfig,
  DeliveryStatus,
  DeliveryStatusV1,
  LifetimeDollars,
  Platform,
  PlayTime,
  RefundPreference,
  RefundPreferenceV1,
  StoreKitRequestControlOptions,
  UserStatus
} from '../interfaces';
import { createStoreKitClient, StoreKitClient } from './base.service';
import { encodePathSegment, requireUuid } from './validation';

export class ConsumptionService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  /**
   * Send consumption information about a consumable in-app purchase or auto-renewable subscription
   * Uses v1 API endpoint (legacy method for backward compatibility)
   * @param transactionId The transaction identifier for which you're providing consumption information
   * @param consumptionRequest The consumption information
   * @returns Promise<void> - Returns 202 Accepted if successful
   */
  async sendConsumptionInformation(
    transactionId: string,
    consumptionRequest: ConsumptionRequestV1,
    control: StoreKitRequestControlOptions = {}
  ): Promise<void> {
    if (consumptionRequest.customerConsented !== true) {
      throw new Error('Customer consent is required to send consumption information');
    }

    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    if (typeof consumptionRequest.appAccountToken !== 'string') {
      throw new TypeError('appAccountToken must be a string containing a UUID or an empty string');
    }
    if (consumptionRequest.appAccountToken !== '') {
      requireUuid(consumptionRequest.appAccountToken, 'appAccountToken');
    }
    this.requireIntegerRange(
      consumptionRequest.accountTenure,
      AccountTenure.UNDECLARED,
      AccountTenure.DAYS_OVER_365,
      'accountTenure'
    );
    this.requireIntegerRange(
      consumptionRequest.consumptionStatus,
      ConsumptionStatus.UNDECLARED,
      ConsumptionStatus.FULLY_CONSUMED,
      'consumptionStatus'
    );
    this.requireIntegerRange(
      consumptionRequest.deliveryStatus,
      DeliveryStatusV1.DELIVERED_AND_WORKING_PROPERLY,
      DeliveryStatusV1.DID_NOT_DELIVER_FOR_OTHER_REASON,
      'deliveryStatus'
    );
    this.requireIntegerRange(
      consumptionRequest.lifetimeDollarsPurchased,
      LifetimeDollars.UNDECLARED,
      LifetimeDollars.USD_OVER_2000,
      'lifetimeDollarsPurchased'
    );
    this.requireIntegerRange(
      consumptionRequest.lifetimeDollarsRefunded,
      LifetimeDollars.UNDECLARED,
      LifetimeDollars.USD_OVER_2000,
      'lifetimeDollarsRefunded'
    );
    this.requireIntegerRange(
      consumptionRequest.platform,
      Platform.UNDECLARED,
      Platform.NON_APPLE,
      'platform'
    );
    this.requireIntegerRange(
      consumptionRequest.playTime,
      PlayTime.UNDECLARED,
      PlayTime.DAYS_OVER_16,
      'playTime'
    );
    this.requireIntegerRange(
      consumptionRequest.userStatus,
      UserStatus.UNDECLARED,
      UserStatus.LIMITED_ACCESS,
      'userStatus'
    );
    if (typeof consumptionRequest.sampleContentProvided !== 'boolean') {
      throw new TypeError('sampleContentProvided must be a boolean');
    }
    if (consumptionRequest.refundPreference !== undefined) {
      this.requireIntegerRange(
        consumptionRequest.refundPreference,
        RefundPreferenceV1.UNDECLARED,
        RefundPreferenceV1.NO_PREFERENCE,
        'refundPreference'
      );
    }

    const requestBody: ConsumptionRequestV1 = {
      accountTenure: consumptionRequest.accountTenure,
      appAccountToken: consumptionRequest.appAccountToken,
      consumptionStatus: consumptionRequest.consumptionStatus,
      customerConsented: consumptionRequest.customerConsented,
      deliveryStatus: consumptionRequest.deliveryStatus,
      lifetimeDollarsPurchased: consumptionRequest.lifetimeDollarsPurchased,
      lifetimeDollarsRefunded: consumptionRequest.lifetimeDollarsRefunded,
      platform: consumptionRequest.platform,
      playTime: consumptionRequest.playTime,
      sampleContentProvided: consumptionRequest.sampleContentProvided,
      userStatus: consumptionRequest.userStatus
    };
    if (consumptionRequest.refundPreference !== undefined) {
      requestBody.refundPreference = consumptionRequest.refundPreference;
    }

    const environment = await this.client.resolveTransactionEnvironment(transactionId, control);
    await this.client.makeRequest(
      'put',
      `/inApps/v1/transactions/consumption/${encodedTransactionId}`,
      requestBody,
      { environment, retry: true, ...control }
    );
  }

  /**
   * Send consumption information about a consumable in-app purchase or auto-renewable subscription
   * Uses v2 API endpoint (App Store Server API 1.19+)
   * @param transactionId The transaction identifier for which you're providing consumption information
   * @param consumptionRequest The consumption information
   * @returns Promise<ConsumptionResponse> - Returns response with 202 Accepted when successful
   */
  async sendConsumptionInformationV2(
    transactionId: string,
    consumptionRequest: ConsumptionRequest,
    control: StoreKitRequestControlOptions = {}
  ): Promise<ConsumptionResponse> {
    if (consumptionRequest.customerConsented !== true) {
      throw new Error('Customer consent is required to send consumption information');
    }
    if (typeof consumptionRequest.deliveryStatus !== 'string' ||
      consumptionRequest.deliveryStatus.trim().length === 0) {
      throw new TypeError('deliveryStatus must be a non-empty string');
    }
    if (typeof consumptionRequest.sampleContentProvided !== 'boolean') {
      throw new TypeError('sampleContentProvided must be a boolean');
    }
    if (consumptionRequest.refundPreference !== undefined &&
      (typeof consumptionRequest.refundPreference !== 'string' ||
        consumptionRequest.refundPreference.trim().length === 0)) {
      throw new TypeError('refundPreference must be a non-empty string when provided');
    }

    if (consumptionRequest.consumptionPercentage !== undefined) {
      if (
        !Number.isInteger(consumptionRequest.consumptionPercentage) ||
        consumptionRequest.consumptionPercentage < 0 ||
        consumptionRequest.consumptionPercentage > 100000
      ) {
        throw new Error('consumptionPercentage must be an integer between 0 and 100000');
      }
    }
    if (consumptionRequest.deliveryStatus !== DeliveryStatus.DELIVERED &&
      consumptionRequest.consumptionPercentage !== undefined &&
      consumptionRequest.consumptionPercentage !== 0) {
      throw new RangeError(
        'consumptionPercentage must be 0 when deliveryStatus is not DELIVERED'
      );
    }
    if (consumptionRequest.refundPreference === RefundPreference.GRANT_PRORATED &&
      consumptionRequest.consumptionPercentage !== undefined &&
      (consumptionRequest.consumptionPercentage === 0 ||
        consumptionRequest.consumptionPercentage === 100000)) {
      throw new RangeError(
        'consumptionPercentage must be greater than 0 and less than 100000 when refundPreference is GRANT_PRORATED'
      );
    }

    const requestBody: ConsumptionRequest = {
      customerConsented: consumptionRequest.customerConsented,
      deliveryStatus: consumptionRequest.deliveryStatus,
      sampleContentProvided: consumptionRequest.sampleContentProvided
    };
    if (consumptionRequest.consumptionPercentage !== undefined) {
      requestBody.consumptionPercentage = consumptionRequest.consumptionPercentage;
    }
    if (consumptionRequest.refundPreference !== undefined) {
      requestBody.refundPreference = consumptionRequest.refundPreference;
    }

    const environment = await this.client.resolveTransactionEnvironment(transactionId, control);
    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    const response = await this.client.makeRequestWithEnvironment<void>(
      'put',
      `/inApps/v2/transactions/consumption/${encodedTransactionId}`,
      requestBody,
      { environment, retry: true, ...control }
    );

    return {
      success: response.statusCode === 202,
      transactionId,
      statusCode: response.statusCode
    };
  }

  private requireIntegerRange(
    value: unknown,
    minimum: number,
    maximum: number,
    name: string
  ): void {
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
      throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
    }
  }
}
