import {
  AccountTenure,
  AppTransactionInfoResponse,
  AppleStoreKitConfig,
  LookupOrderResponse,
  RefundLookupResponse,
  StoreEnvironment,
  StoreKitPaginationOptions,
  StoreKitRequestControlOptions,
  StoreKitRequestResult,
  TransactionHistoryRequest,
  TransactionHistoryResponse,
  TransactionInfo,
  UpdateAppAccountTokenRequest,
  VerifyPurchaseResponse
} from '../interfaces';
import type { AppTransaction } from '@apple/app-store-server-library';
import { createStoreKitClient, StoreKitClient } from './base.service';
import {
  assertCanAddItems,
  assertCanFetchPage,
  resolvePaginationLimits
} from './pagination';
import {
  encodePathSegment,
  requireNonEmptyString,
  requireUuid,
  validateDateRange
} from './validation';

export class TransactionService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  async verifyPurchase(
    transactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<TransactionInfo> {
    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    const response = await this.client.makeRequestWithEnvironment<VerifyPurchaseResponse>(
      'get',
      `/inApps/v1/transactions/${encodedTransactionId}`,
      undefined,
      { allowEnvironmentFallback: true, ...control }
    );
    requireNonEmptyString(response.data.signedTransactionInfo, 'signedTransactionInfo');
    return this.client.verifyAndDecodeTransaction(
      response.data.signedTransactionInfo,
      response.environment
    );
  }

  async getTransactionHistoryPage(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    revision?: string,
    environment?: StoreEnvironment,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreKitRequestResult<TransactionHistoryResponse>> {
    const encodedTransactionId = encodePathSegment(anyTransactionId, 'anyTransactionId');
    validateDateRange(request.startDate, request.endDate, 'Transaction history');
    const query = {
      revision,
      startDate: request.startDate,
      endDate: request.endDate,
      productId: request.productIds,
      productType: request.productTypes,
      sort: request.sort,
      subscriptionGroupIdentifier: request.subscriptionGroupIdentifiers,
      inAppOwnershipType: request.inAppOwnershipType,
      revoked: request.revoked
    };

    const result = await this.client.makeRequestWithEnvironment<TransactionHistoryResponse>(
      'get',
      `/inApps/v2/history/${encodedTransactionId}`,
      undefined,
      environment
        ? { environment, query, ...control }
        : { allowEnvironmentFallback: true, query, ...control }
    );
    this.validatePaginatedTransactions(result.data, 'transaction history');
    return result;
  }

  async getTransactionHistory(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    options: StoreKitPaginationOptions = {}
  ): Promise<TransactionInfo[]> {
    const transactions: TransactionInfo[] = [];

    for await (const transaction of this.iterateTransactionHistory(
      anyTransactionId,
      request,
      options
    )) {
      transactions.push(transaction);
    }

    return transactions;
  }

  async *iterateTransactionHistory(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<TransactionInfo, void, void> {
    const limits = resolvePaginationLimits(options);
    let revision: string | undefined;
    let environment = options.environment;
    let pagesFetched = 0;
    let itemsRead = 0;

    do {
      assertCanFetchPage(pagesFetched, limits, 'Transaction history');
      const page = await this.getTransactionHistoryPage(
        anyTransactionId,
        request,
        revision,
        environment,
        { signal: options.signal, timeoutMs: options.timeoutMs }
      );
      pagesFetched += 1;
      environment = page.environment;
      assertCanAddItems(
        itemsRead,
        page.data.signedTransactions.length,
        limits,
        'Transaction history'
      );
      const verifiedTransactions = await Promise.all(
        page.data.signedTransactions.map(signedTransaction =>
          this.client.verifyAndDecodeTransaction(signedTransaction, page.environment)
        )
      );
      itemsRead += verifiedTransactions.length;
      for (const transaction of verifiedTransactions) {
        yield transaction;
      }

      if (!page.data.hasMore) {
        break;
      }
      if (!page.data.revision) {
        throw new Error('Apple transaction history response hasMore=true but no revision token.');
      }
      if (page.data.revision === revision) {
        throw new Error('Apple transaction history returned the same revision token twice.');
      }
      revision = page.data.revision;
    } while (true);
  }

  async lookupOrder(
    orderId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<LookupOrderResponse> {
    const encodedOrderId = encodePathSegment(orderId, 'orderId');
    // Look Up Order ID isn't available in sandbox, so never auto-fallback.
    const response = await this.client.makeRequest<{ status: number; signedTransactions: string[] }>(
      'get',
      `/inApps/v1/lookup/${encodedOrderId}`,
      undefined,
      { environment: 'production', ...control }
    );
    if (!Number.isInteger(response.status)) {
      throw new TypeError('Apple order lookup response is missing a valid status.');
    }
    this.requireSignedTransactions(response.signedTransactions, 'order lookup');

    const transactions = await Promise.all(
      response.signedTransactions.map(jwt =>
        this.client.verifyAndDecodeTransaction(jwt, 'production')
      )
    );
    return {
      status: response.status,
      transactions,
      signedTransactions: transactions
    };
  }

  async getRefundHistoryPage(
    anyTransactionId: string,
    revision?: string,
    environment?: StoreEnvironment,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreKitRequestResult<RefundLookupResponse>> {
    const encodedTransactionId = encodePathSegment(anyTransactionId, 'anyTransactionId');
    const result = await this.client.makeRequestWithEnvironment<RefundLookupResponse>(
      'get',
      `/inApps/v2/refund/lookup/${encodedTransactionId}`,
      undefined,
      environment
        ? { environment, query: { revision }, ...control }
        : { allowEnvironmentFallback: true, query: { revision }, ...control }
    );
    this.validatePaginatedTransactions(result.data, 'refund history');
    return result;
  }

  async getRefundHistory(
    anyTransactionId: string,
    options: StoreKitPaginationOptions = {}
  ): Promise<RefundLookupResponse> {
    const signedTransactions: string[] = [];
    let lastPage: StoreKitRequestResult<RefundLookupResponse> | undefined;

    for await (const page of this.iterateRefundHistoryPages(anyTransactionId, options)) {
      lastPage = page;
      signedTransactions.push(...page.data.signedTransactions);
    }

    if (!lastPage) {
      throw new Error('Apple refund history returned no page.');
    }

    return {
      signedTransactions,
      revision: lastPage.data.revision,
      hasMore: false
    };
  }

  async *iterateRefundHistoryPages(
    anyTransactionId: string,
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<StoreKitRequestResult<RefundLookupResponse>, void, void> {
    let revision: string | undefined;
    let environment = options.environment;
    const limits = resolvePaginationLimits(options);
    let pagesFetched = 0;
    let itemsRead = 0;

    do {
      assertCanFetchPage(pagesFetched, limits, 'Refund history');
      const page = await this.getRefundHistoryPage(
        anyTransactionId,
        revision,
        environment,
        { signal: options.signal, timeoutMs: options.timeoutMs }
      );
      pagesFetched += 1;
      environment = page.environment;
      assertCanAddItems(
        itemsRead,
        page.data.signedTransactions.length,
        limits,
        'Refund history'
      );
      itemsRead += page.data.signedTransactions.length;
      yield page;

      if (!page.data.hasMore) {
        return;
      }
      if (!page.data.revision) {
        throw new Error('Apple refund history response hasMore=true but no revision token.');
      }
      if (page.data.revision === revision) {
        throw new Error('Apple refund history returned the same revision token twice.');
      }
      revision = page.data.revision;
    } while (true);
  }

  /** @deprecated Use getRefundHistory(). */
  async refundLookup(
    anyTransactionId: string,
    options: StoreKitPaginationOptions = {}
  ): Promise<RefundLookupResponse> {
    return this.getRefundHistory(anyTransactionId, options);
  }

  async getAppTransactionInfo(
    anyTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppTransactionInfoResponse> {
    const encodedTransactionId = encodePathSegment(anyTransactionId, 'anyTransactionId');
    const response = await this.client.makeRequest<AppTransactionInfoResponse>(
      'get',
      `/inApps/v1/transactions/appTransactions/${encodedTransactionId}`,
      undefined,
      { allowEnvironmentFallback: true, ...control }
    );
    requireNonEmptyString(response.signedAppTransactionInfo, 'signedAppTransactionInfo');
    return response;
  }

  async getVerifiedAppTransactionInfo(
    anyTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppTransaction> {
    const encodedTransactionId = encodePathSegment(anyTransactionId, 'anyTransactionId');
    const result = await this.client.makeRequestWithEnvironment<AppTransactionInfoResponse>(
      'get',
      `/inApps/v1/transactions/appTransactions/${encodedTransactionId}`,
      undefined,
      { allowEnvironmentFallback: true, ...control }
    );
    requireNonEmptyString(
      result.data.signedAppTransactionInfo,
      'signedAppTransactionInfo'
    );
    return this.client.verifyAndDecodeAppTransaction(
      result.data.signedAppTransactionInfo,
      result.environment
    );
  }

  async finishTransaction(
    transactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<void> {
    const environment = await this.client.resolveTransactionEnvironment(transactionId, control);
    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    await this.client.makeRequest<void>(
      'post',
      `/inApps/v1/transactions/${encodedTransactionId}/finish`,
      undefined,
      { environment, retry: false, ...control }
    );
  }

  /**
   * Sets the app account token value for a purchase the customer makes outside of your app,
   * or updates its value in an existing transaction.
   * 
   * @param originalTransactionId The original transaction identifier of the transaction to receive the app account token update
   * @param appAccountToken The app account token value to set for the transaction
   * @returns Promise<void>
   */
  async setAppAccountToken(
    originalTransactionId: string,
    appAccountToken: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<void> {
    requireUuid(appAccountToken, 'appAccountToken');
    const requestBody: UpdateAppAccountTokenRequest = {
      appAccountToken
    };

    const environment = await this.client.resolveTransactionEnvironment(
      originalTransactionId,
      control
    );
    const encodedTransactionId = encodePathSegment(
      originalTransactionId,
      'originalTransactionId'
    );
    await this.client.makeRequest<void>(
      'put',
      `/inApps/v1/transactions/${encodedTransactionId}/appAccountToken`,
      requestBody,
      { environment, retry: true, ...control }
    );
  }

  getAccountTenure(date: Date): AccountTenure {
    const timestamp = date.getTime();
    const now = Date.now();
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('date must be a valid Date.');
    }
    if (timestamp > now) {
      throw new RangeError('date must not be in the future.');
    }
    const diffTime = now - timestamp;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 3) {
      return AccountTenure.DAYS_0_3;
    }
    if (diffDays < 10) {
      return AccountTenure.DAYS_3_10;
    }
    if (diffDays < 30) {
      return AccountTenure.DAYS_10_30;
    }
    if (diffDays < 90) {
      return AccountTenure.DAYS_30_90;
    }
    if (diffDays < 180) {
      return AccountTenure.DAYS_90_180;
    }
    if (diffDays < 365) {
      return AccountTenure.DAYS_180_365;
    }
    return AccountTenure.DAYS_OVER_365;
  }

  private validatePaginatedTransactions(
    response: TransactionHistoryResponse | RefundLookupResponse,
    responseName: string
  ): void {
    this.requireSignedTransactions(response.signedTransactions, responseName);
    if (typeof response.hasMore !== 'boolean') {
      throw new TypeError(`Apple ${responseName} response is missing hasMore.`);
    }
    if (response.hasMore) {
      requireNonEmptyString(response.revision, `${responseName} revision`);
    }
  }

  private requireSignedTransactions(
    value: unknown,
    responseName: string
  ): asserts value is string[] {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
      throw new TypeError(`Apple ${responseName} response has invalid signedTransactions.`);
    }
  }
}
