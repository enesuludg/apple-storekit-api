import {
  SubscriptionStatus,
  AppleSubscriptionResponse,
  AppleStoreKitConfig,
  StoreEnvironment,
  StoreKitRequestControlOptions,
  StoreKitRequestResult,
  SubscriptionStatusType,
  SubscriptionStatusTypeString
} from '../interfaces';
import { createStoreKitClient, StoreKitClient } from './base.service';
import { encodePathSegment } from './validation';

export class SubscriptionService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  private getStatusType(status: number): SubscriptionStatusTypeString {
    const statusType = SubscriptionStatusType[status];
    return typeof statusType === 'string'
      ? statusType as SubscriptionStatusTypeString
      : 'UNKNOWN';
  }

  async getAllSubscriptionStatuses(
    anyTransactionId: string,
    statuses?: SubscriptionStatusType[],
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppleSubscriptionResponse> {
    const result = await this.getAllSubscriptionStatusesWithEnvironment(
      anyTransactionId,
      statuses,
      undefined,
      control
    );
    return result.data;
  }

  private async getAllSubscriptionStatusesWithEnvironment(
    anyTransactionId: string,
    statuses?: SubscriptionStatusType[],
    environment?: StoreEnvironment,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreKitRequestResult<AppleSubscriptionResponse>> {
    const encodedTransactionId = encodePathSegment(anyTransactionId, 'anyTransactionId');
    const result = await this.client.makeRequestWithEnvironment<AppleSubscriptionResponse>(
      'get',
      `/inApps/v1/subscriptions/${encodedTransactionId}`,
      undefined,
      environment
        ? { environment, query: { status: statuses }, ...control }
        : { allowEnvironmentFallback: true, query: { status: statuses }, ...control }
    );
    if (!Array.isArray(result.data.data) || result.data.data.some(group =>
      !group ||
      typeof group.subscriptionGroupIdentifier !== 'string' ||
      !Array.isArray(group.lastTransactions)
    )) {
      throw new TypeError('Apple subscription status response has invalid data.');
    }
    return result;
  }

  async getSubscriptionStatus(
    originalTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<SubscriptionStatus> {
    const result = await this.getAllSubscriptionStatusesWithEnvironment(
      originalTransactionId,
      undefined,
      undefined,
      control
    );
    const response = result.data;
    
    if (!response.data || response.data.length === 0) {
      throw new Error('No subscription data found. This might be a consumption transaction ID instead of a subscription transaction ID.');
    }

    const candidates = response.data.flatMap(group => group.lastTransactions || []);
    if (candidates.length === 0) {
      throw new Error('No transaction data found for this subscription.');
    }

    const exactMatches = candidates.filter(
      candidate => candidate.originalTransactionId === originalTransactionId
    );
    const data = exactMatches.length === 1
      ? exactMatches[0]
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (!data) {
      throw new Error(
        'Subscription status is ambiguous. Use getAllSubscriptionStatuses() and select the intended subscription group.'
      );
    }
    if (!data.signedTransactionInfo || !data.signedRenewalInfo) {
      throw new Error('Invalid subscription data: Missing transaction or renewal information.');
    }

    const [transactionInfo, renewalInfo] = await Promise.all([
      this.client.verifyAndDecodeTransaction(data.signedTransactionInfo, result.environment),
      this.client.verifyAndDecodeRenewalInfo(data.signedRenewalInfo, result.environment)
    ]);

    if (transactionInfo.expiresDate === undefined) {
      throw new Error('Verified subscription transaction is missing expiresDate.');
    }

    return {
      originalTransactionId: data.originalTransactionId,
      status: data.status,
      statusType: this.getStatusType(data.status),
      expirationDate: new Date(transactionInfo.expiresDate),
      transactionInfo,
      renewalInfo
    };
  }
}
