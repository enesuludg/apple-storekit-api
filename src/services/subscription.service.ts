import { SubscriptionStatus, AppleSubscriptionResponse, AppleStoreKitConfig } from '../interfaces';
import { BaseService } from './base.service';

export class SubscriptionService extends BaseService {
  constructor(config: AppleStoreKitConfig) {
    super(config);
  }

  async getSubscriptionStatus(originalTransactionId: string): Promise<SubscriptionStatus> {
    const response = await this.makeRequest<AppleSubscriptionResponse>('get', `/subscriptions/${originalTransactionId}`);
    
    const data = response.data[0].lastTransactions[0];
    if (!data) {
      throw new Error('No subscription data found');
    }

    const transactionInfo = this.decodeSignedData(data.signedTransactionInfo);
    const renewalInfo = this.decodeSignedData(data.signedRenewalInfo);

    return {
      originalTransactionId: data.originalTransactionId,
      status: data.status,
      expirationDate: new Date(transactionInfo?.expiresDate || 0),
      transactionInfo,
      renewalInfo
    };
  }
} 