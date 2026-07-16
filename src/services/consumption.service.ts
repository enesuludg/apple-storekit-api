import {
  ConsumptionRequest,
  ConsumptionResponse,
  AppleStoreKitConfig,
  StoreKitRequestControlOptions
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
    consumptionRequest: ConsumptionRequest,
    control: StoreKitRequestControlOptions = {}
  ): Promise<void> {
    if (!consumptionRequest.customerConsented) {
      throw new Error('Customer consent is required to send consumption information');
    }

    const environment = await this.client.resolveTransactionEnvironment(transactionId, control);
    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    if (consumptionRequest.appAccountToken) {
      requireUuid(consumptionRequest.appAccountToken, 'appAccountToken');
    }
    await this.client.makeRequest(
      'put',
      `/inApps/v1/transactions/consumption/${encodedTransactionId}`,
      consumptionRequest,
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
    // Validate required fields
    if (consumptionRequest.customerConsented === undefined) {
      throw new Error('customerConsented is required');
    }
    if (consumptionRequest.deliveryStatus === undefined) {
      throw new Error('deliveryStatus is required');
    }
    if (consumptionRequest.sampleContentProvided === undefined) {
      throw new Error('sampleContentProvided is required');
    }

    // Validate consumptionPercentage if provided
    if (consumptionRequest.consumptionPercentage !== undefined) {
      if (consumptionRequest.consumptionPercentage < 0 || consumptionRequest.consumptionPercentage > 100000) {
        throw new Error('consumptionPercentage must be between 0 and 100000');
      }
    }
    if (consumptionRequest.appAccountToken) {
      requireUuid(consumptionRequest.appAccountToken, 'appAccountToken');
    }

    // If customer did not consent, only send required fields with customerConsented: false
    // Apple only uses consumption data if customerConsented is true
    const requestBody = consumptionRequest.customerConsented === false
      ? {
        customerConsented: false,
        deliveryStatus: consumptionRequest.deliveryStatus,
        sampleContentProvided: consumptionRequest.sampleContentProvided
      }
      : consumptionRequest;

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
}
