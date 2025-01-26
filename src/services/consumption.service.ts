import { ConsumptionRequest, AppleStoreKitConfig } from '../interfaces';
import { BaseService } from './base.service';
export class ConsumptionService extends BaseService {
  constructor(config: AppleStoreKitConfig) {
    super(config);
  }

  /**
   * Send consumption information about a consumable in-app purchase or auto-renewable subscription
   * @param transactionId The transaction identifier for which you're providing consumption information
   * @param consumptionRequest The consumption information
   * @returns Promise<void> - Returns 202 Accepted if successful
   */
  async sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest): Promise<void> {
    if (!consumptionRequest.customerConsented) {
      throw new Error('Customer consent is required to send consumption information');
    }

    await this.makeRequest('put', `/transactions/consumption/${transactionId}`, consumptionRequest);
  }
} 