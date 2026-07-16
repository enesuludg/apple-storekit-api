import {
  AppleStoreKitConfig,
  CheckTestNotificationResponse,
  NotificationHistoryRequest,
  NotificationHistoryResponse,
  SendTestNotificationResponse,
  StoreEnvironment,
  StoreKitEnvironmentOptions,
  StoreKitPaginationOptions
} from '../interfaces';
import { createStoreKitClient, StoreKitClient } from './base.service';
import {
  assertCanAddItems,
  assertCanFetchPage,
  resolvePaginationLimits
} from './pagination';
import { encodePathSegment, requireNonEmptyString, validateDateRange } from './validation';

export class NotificationService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  async getNotificationHistory(
    request: NotificationHistoryRequest,
    paginationToken?: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<NotificationHistoryResponse> {
    validateDateRange(request.startDate, request.endDate, 'Notification history');
    if (request.notificationType !== undefined) {
      requireNonEmptyString(request.notificationType, 'notificationType');
    }
    if (request.notificationSubtype !== undefined) {
      requireNonEmptyString(request.notificationSubtype, 'notificationSubtype');
    }
    const environment = await this.resolveEnvironment(
      options.environment,
      request.transactionId,
      options
    );

    const response = await this.client.makeRequest<NotificationHistoryResponse>(
      'post',
      '/inApps/v1/notifications/history',
      request,
      {
        environment,
        query: { paginationToken },
        retry: true,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );
    if (response.hasMore !== undefined && typeof response.hasMore !== 'boolean') {
      throw new TypeError('Apple notification history response has invalid hasMore.');
    }
    if (response.notificationHistory !== undefined &&
      !Array.isArray(response.notificationHistory)) {
      throw new TypeError('Apple notification history response has invalid notificationHistory.');
    }
    return response;
  }

  async getAllNotificationHistory(
    request: NotificationHistoryRequest,
    options: StoreKitPaginationOptions = {}
  ): Promise<NotificationHistoryResponse> {
    const notificationHistory: NonNullable<NotificationHistoryResponse['notificationHistory']> = [];
    let lastPage: NotificationHistoryResponse | undefined;

    for await (const page of this.iterateNotificationHistoryPages(request, options)) {
      lastPage = page;
      notificationHistory.push(...(page.notificationHistory || []));
    }

    return {
      notificationHistory,
      paginationToken: lastPage?.paginationToken,
      hasMore: false
    };
  }

  async *iterateNotificationHistoryPages(
    request: NotificationHistoryRequest,
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<NotificationHistoryResponse, void, void> {
    const limits = resolvePaginationLimits(options);
    const environment = await this.resolveEnvironment(
      options.environment,
      request.transactionId,
      options
    );
    const resolvedOptions = {
      environment,
      signal: options.signal,
      timeoutMs: options.timeoutMs
    };
    let paginationToken: string | undefined;
    let pagesFetched = 0;
    let itemsRead = 0;

    do {
      assertCanFetchPage(pagesFetched, limits, 'Notification history');
      const page = await this.getNotificationHistory(request, paginationToken, resolvedOptions);
      pagesFetched += 1;
      const pageItems = page.notificationHistory || [];
      assertCanAddItems(itemsRead, pageItems.length, limits, 'Notification history');
      itemsRead += pageItems.length;
      yield page;

      if (!page.hasMore) {
        return;
      }
      if (!page.paginationToken) {
        throw new Error('Apple notification history response hasMore=true but no pagination token.');
      }
      if (page.paginationToken === paginationToken) {
        throw new Error('Apple notification history returned the same pagination token twice.');
      }
      paginationToken = page.paginationToken;
    } while (true);
  }

  async requestTestNotification(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<SendTestNotificationResponse> {
    const environment = await this.resolveEnvironment(options.environment, undefined, options);
    return this.client.makeRequest<SendTestNotificationResponse>(
      'post',
      '/inApps/v1/notifications/test',
      undefined,
      {
        environment,
        retry: false,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );
  }

  async getTestNotificationStatus(
    testNotificationToken: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<CheckTestNotificationResponse> {
    const environment = await this.resolveEnvironment(options.environment, undefined, options);
    const encodedToken = encodePathSegment(testNotificationToken, 'testNotificationToken');
    return this.client.makeRequest<CheckTestNotificationResponse>(
      'get',
      `/inApps/v1/notifications/test/${encodedToken}`,
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  private async resolveEnvironment(
    explicitEnvironment?: StoreEnvironment,
    transactionId?: string,
    control: StoreKitEnvironmentOptions = {}
  ): Promise<StoreEnvironment> {
    if (explicitEnvironment) {
      return explicitEnvironment;
    }
    if (transactionId) {
      return this.client.resolveTransactionEnvironment(transactionId, control);
    }

    return this.client.requireEnvironment(undefined, 'notification endpoints');
  }
}
