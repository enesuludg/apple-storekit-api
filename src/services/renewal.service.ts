import {
  AppleStoreKitConfig,
  ExtendRenewalDateRequest,
  ExtendRenewalDateResponse,
  MassExtendRenewalDateRequest,
  MassExtendRenewalDateResponse,
  MassExtendRenewalDateStatusResponse,
  StoreKitEnvironmentOptions,
  StoreKitRequestControlOptions
} from '../interfaces';
import { createStoreKitClient, StoreKitClient } from './base.service';
import { encodePathSegment, requireNonEmptyString, requireUuid } from './validation';

export class RenewalService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  async extendSubscriptionRenewalDate(
    originalTransactionId: string,
    request: ExtendRenewalDateRequest,
    control: StoreKitRequestControlOptions = {}
  ): Promise<ExtendRenewalDateResponse> {
    this.validateExtendRequest(request);
    const environment = await this.client.resolveTransactionEnvironment(
      originalTransactionId,
      control
    );
    const encodedTransactionId = encodePathSegment(
      originalTransactionId,
      'originalTransactionId'
    );
    return this.client.makeRequest<ExtendRenewalDateResponse>(
      'put',
      `/inApps/v1/subscriptions/extend/${encodedTransactionId}`,
      request,
      { environment, retry: true, ...control }
    );
  }

  async extendRenewalDateForAllActiveSubscribers(
    request: MassExtendRenewalDateRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<MassExtendRenewalDateResponse> {
    this.validateExtendRequest(request);
    requireNonEmptyString(request.productId, 'productId');
    request.storefrontCountryCodes?.forEach(code => {
      if (!/^[A-Z]{2}$/.test(code)) {
        throw new TypeError('storefrontCountryCodes must contain ISO 3166-1 alpha-2 codes.');
      }
    });
    const environment = this.client.requireEnvironment(
      options.environment,
      'mass subscription renewal extension'
    );
    return this.client.makeRequest<MassExtendRenewalDateResponse>(
      'post',
      '/inApps/v1/subscriptions/extend/mass',
      request,
      {
        environment,
        retry: true,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );
  }

  async getStatusOfSubscriptionRenewalDateExtensions(
    requestIdentifier: string,
    productId: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<MassExtendRenewalDateStatusResponse> {
    requireUuid(requestIdentifier, 'requestIdentifier');
    const encodedRequestIdentifier = encodePathSegment(requestIdentifier, 'requestIdentifier');
    const encodedProductId = encodePathSegment(productId, 'productId');
    const environment = this.client.requireEnvironment(
      options.environment,
      'mass subscription renewal extension status'
    );
    return this.client.makeRequest<MassExtendRenewalDateStatusResponse>(
      'get',
      `/inApps/v1/subscriptions/extend/mass/${encodedProductId}/${encodedRequestIdentifier}`,
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  private validateExtendRequest(request: ExtendRenewalDateRequest): void {
    if (!Number.isSafeInteger(request.extendByDays) ||
      request.extendByDays < 1 ||
      request.extendByDays > 90) {
      throw new RangeError('extendByDays must be an integer between 1 and 90.');
    }
    if (![0, 1, 2, 3].includes(request.extendReasonCode)) {
      throw new RangeError('extendReasonCode must be one of 0, 1, 2, or 3.');
    }
    requireUuid(request.requestIdentifier, 'requestIdentifier');
  }
}
