import { SubscriptionStatus, AppleSubscriptionResponse, AppleStoreKitConfig, SubscriptionStatusType, SubscriptionStatusTypeString } from '../interfaces';
import { BaseService } from './base.service';

export class SubscriptionService extends BaseService {
  constructor(config: AppleStoreKitConfig) {
    super(config);
  }

  private getStatusType(status: number): SubscriptionStatusTypeString {
    return SubscriptionStatusType[status] as SubscriptionStatusTypeString;
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
      statusType: this.getStatusType(data.status),
      expirationDate: new Date(transactionInfo?.expiresDate || 0),
      transactionInfo,
      renewalInfo
    };
  }
} 