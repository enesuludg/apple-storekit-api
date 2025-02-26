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
    
    if (!response.data || response.data.length === 0) {
      throw new Error('No subscription data found. This might be a consumption transaction ID instead of a subscription transaction ID.');
    }

    const lastTransactions = response.data[0].lastTransactions;
    if (!lastTransactions || lastTransactions.length === 0) {
      throw new Error('No transaction data found for this subscription.');
    }

    const data = lastTransactions[0];
    if (!data.signedTransactionInfo || !data.signedRenewalInfo) {
      throw new Error('Invalid subscription data: Missing transaction or renewal information.');
    }

    const transactionInfo = this.decodeSignedData(data.signedTransactionInfo);
    const renewalInfo = this.decodeSignedData(data.signedRenewalInfo);

    if (!transactionInfo || !renewalInfo) {
      throw new Error('Failed to decode subscription data.');
    }

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