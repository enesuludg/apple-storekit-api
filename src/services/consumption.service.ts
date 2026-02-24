import axios from 'axios';
import { ConsumptionRequest, ConsumptionResponse, AppleStoreKitConfig } from '../interfaces';
import { BaseService } from './base.service';

export class ConsumptionService extends BaseService {
  constructor(config: AppleStoreKitConfig) {
    super(config);
  }

  /**
   * Send consumption information about a consumable in-app purchase or auto-renewable subscription
   * Uses v1 API endpoint (legacy method for backward compatibility)
   * @param transactionId The transaction identifier for which you're providing consumption information
   * @param consumptionRequest The consumption information
   * @returns Promise<void> - Returns 202 Accepted if successful
   */
  async sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest): Promise<void> {
    if (!consumptionRequest.customerConsented) {
      throw new Error('Customer consent is required to send consumption information');
    }

    await this.makeRequest('put', `/inApps/v1/transactions/consumption/${transactionId}`, consumptionRequest);
  }

  /**
   * Send consumption information about a consumable in-app purchase or auto-renewable subscription
   * Uses v2 API endpoint (App Store Server API 1.19+)
   * @param transactionId The transaction identifier for which you're providing consumption information
   * @param consumptionRequest The consumption information
   * @returns Promise<ConsumptionResponse> - Returns response with 202 Accepted when successful
   */
  async sendConsumptionInformationV2(transactionId: string, consumptionRequest: ConsumptionRequest): Promise<ConsumptionResponse> {
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

    // Use v2 API endpoint for Send Consumption Information
    const baseUrl = this.getBaseUrl();
    const token = this.generateToken();
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    // If customer did not consent, only send required fields with customerConsented: false
    // Apple only uses consumption data if customerConsented is true
    if (consumptionRequest.customerConsented === false) {
      const response = await axios.put(
        `${baseUrl}/inApps/v2/transactions/consumption/${transactionId}`,
        {
          customerConsented: false,
          deliveryStatus: consumptionRequest.deliveryStatus,
          sampleContentProvided: consumptionRequest.sampleContentProvided
        },
        config
      );
      return {
        success: response.status === 202,
        transactionId,
        statusCode: response.status
      };
    }

    // If customer consented, send all provided consumption data
    const response = await axios.put(
      `${baseUrl}/inApps/v2/transactions/consumption/${transactionId}`,
      consumptionRequest,
      config
    );
    return {
      success: response.status === 202,
      transactionId,
      statusCode: response.status
    };
  }
} 