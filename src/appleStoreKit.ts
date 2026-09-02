import type {
  AppTransaction,
  JWSRenewalInfoDecodedPayload,
  ResponseBodyV2DecodedPayload
} from '@apple/app-store-server-library';
import { 
  AppleStoreKitConfig,
  ConsumptionRequest,
  AccountTenure,
  AppTransactionInfoResponse,
  AppleSubscriptionResponse,
  CheckTestNotificationResponse,
  DefaultRetentionMessageRequest,
  DefaultRetentionMessageResponse,
  ExtendRenewalDateRequest,
  ExtendRenewalDateResponse,
  MassExtendRenewalDateRequest,
  MassExtendRenewalDateResponse,
  MassExtendRenewalDateStatusResponse,
  NotificationHistoryRequest,
  NotificationHistoryResponse,
  RetentionImageListResponse,
  RetentionImageSize,
  RetentionMessageListResponse,
  RetentionPerformanceTestRequest,
  RetentionPerformanceTestResponse,
  RetentionPerformanceTestResultResponse,
  RetentionRealtimeUrlRequest,
  RetentionRealtimeUrlResponse,
  SendTestNotificationResponse,
  StoreEnvironment,
  StoreEnvironmentMode,
  StoreKitEnvironmentOptions,
  StoreKitPaginationOptions,
  StoreKitRequestControlOptions,
  StoreKitRequestResult,
  SubscriptionStatus,
  SubscriptionStatusType,
  TransactionHistoryRequest,
  TransactionHistoryResponse,
  TransactionInfo,
  LookupOrderResponse,
  RefundLookupResponse,
  UploadRetentionMessageRequest
} from './interfaces';
import { 
  BaseService, 
  ConsumptionService, 
  NotificationService,
  RenewalService,
  RetentionService,
  SubscriptionService, 
  TransactionService 
} from './services';

export class AppleStoreKit {
  private readonly client: BaseService;
  private readonly consumptionService: ConsumptionService;
  private readonly notificationService: NotificationService;
  private readonly renewalService: RenewalService;
  private readonly retentionService: RetentionService;
  private readonly subscriptionService: SubscriptionService;
  private readonly transactionService: TransactionService;

  constructor(config: AppleStoreKitConfig) {
    this.client = new BaseService(config);
    this.consumptionService = new ConsumptionService(this.client);
    this.notificationService = new NotificationService(this.client);
    this.renewalService = new RenewalService(this.client);
    this.retentionService = new RetentionService(this.client);
    this.subscriptionService = new SubscriptionService(this.client);
    this.transactionService = new TransactionService(this.client);
  }

  getConfiguredEnvironment(): StoreEnvironmentMode {
    return this.client.getConfiguredEnvironment();
  }

  /** @deprecated Use getConfiguredEnvironment(). */
  getCurrentEnvironment(): StoreEnvironmentMode {
    return this.getConfiguredEnvironment();
  }

  resolveTransactionEnvironment(
    transactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreEnvironment> {
    return this.client.resolveTransactionEnvironment(transactionId, control);
  }

  verifyAndDecodeTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<TransactionInfo> {
    return this.client.verifyAndDecodeTransaction(signedData, environment);
  }

  verifyAndDecodeRenewalInfo(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<JWSRenewalInfoDecodedPayload> {
    return this.client.verifyAndDecodeRenewalInfo(signedData, environment);
  }

  verifyAndDecodeNotification(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<ResponseBodyV2DecodedPayload> {
    return this.client.verifyAndDecodeNotification(signedData, environment);
  }

  verifyAndDecodeAppTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<AppTransaction> {
    return this.client.verifyAndDecodeAppTransaction(signedData, environment);
  }

  /**
   * @deprecated Use verifyAndDecodeTransaction() and pass the request environment.
   * This method verifies the JWS and is therefore asynchronous.
   */
  decodeSignedData(
    signedData: string,
    environment?: StoreEnvironment
  ): Promise<TransactionInfo> {
    return this.client.decodeSignedData(signedData, environment);
  }

  // Subscription methods
  async getSubscriptionStatus(
    originalTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<SubscriptionStatus> {
    return this.subscriptionService.getSubscriptionStatus(originalTransactionId, control);
  }

  async getAllSubscriptionStatuses(
    anyTransactionId: string,
    statuses?: SubscriptionStatusType[],
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppleSubscriptionResponse> {
    return this.subscriptionService.getAllSubscriptionStatuses(
      anyTransactionId,
      statuses,
      control
    );
  }

  // Transaction methods
  async verifyPurchase(
    transactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<TransactionInfo> {
    return this.transactionService.verifyPurchase(transactionId, control);
  }

  async getTransactionHistory(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    options: StoreKitPaginationOptions = {}
  ): Promise<TransactionInfo[]> {
    return this.transactionService.getTransactionHistory(anyTransactionId, request, options);
  }

  iterateTransactionHistory(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<TransactionInfo, void, void> {
    return this.transactionService.iterateTransactionHistory(anyTransactionId, request, options);
  }

  async getTransactionHistoryPage(
    anyTransactionId: string,
    request: TransactionHistoryRequest = {},
    revision?: string,
    environment?: StoreEnvironment,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreKitRequestResult<TransactionHistoryResponse>> {
    return this.transactionService.getTransactionHistoryPage(
      anyTransactionId,
      request,
      revision,
      environment,
      control
    );
  }

  async lookupOrder(
    orderId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<LookupOrderResponse> {
    return this.transactionService.lookupOrder(orderId, control);
  }

  async refundLookup(
    transactionId: string,
    options: StoreKitPaginationOptions = {}
  ): Promise<RefundLookupResponse> {
    return this.transactionService.refundLookup(transactionId, options);
  }

  async getRefundHistory(
    anyTransactionId: string,
    options: StoreKitPaginationOptions = {}
  ): Promise<RefundLookupResponse> {
    return this.transactionService.getRefundHistory(anyTransactionId, options);
  }

  iterateRefundHistoryPages(
    anyTransactionId: string,
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<StoreKitRequestResult<RefundLookupResponse>, void, void> {
    return this.transactionService.iterateRefundHistoryPages(anyTransactionId, options);
  }

  async getRefundHistoryPage(
    anyTransactionId: string,
    revision?: string,
    environment?: StoreEnvironment,
    control: StoreKitRequestControlOptions = {}
  ): Promise<StoreKitRequestResult<RefundLookupResponse>> {
    return this.transactionService.getRefundHistoryPage(
      anyTransactionId,
      revision,
      environment,
      control
    );
  }

  async getAppTransactionInfo(
    anyTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppTransactionInfoResponse> {
    return this.transactionService.getAppTransactionInfo(anyTransactionId, control);
  }

  async getVerifiedAppTransactionInfo(
    anyTransactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<AppTransaction> {
    return this.transactionService.getVerifiedAppTransactionInfo(anyTransactionId, control);
  }

  async finishTransaction(
    transactionId: string,
    control: StoreKitRequestControlOptions = {}
  ): Promise<void> {
    return this.transactionService.finishTransaction(transactionId, control);
  }

  async setAppAccountToken(
    originalTransactionId: string,
    appAccountToken: string,
    control: StoreKitRequestControlOptions = {}
  ) {
    return this.transactionService.setAppAccountToken(
      originalTransactionId,
      appAccountToken,
      control
    );
  }

  getAccountTenure(date: Date): AccountTenure {
    return this.transactionService.getAccountTenure(date);
  }

  // Consumption methods
  async sendConsumptionInformation(
    transactionId: string,
    consumptionRequest: ConsumptionRequest,
    control: StoreKitRequestControlOptions = {}
  ) {
    return this.consumptionService.sendConsumptionInformation(
      transactionId,
      consumptionRequest,
      control
    );
  }
  async sendConsumptionInformationV2(
    transactionId: string,
    consumptionRequest: ConsumptionRequest,
    control: StoreKitRequestControlOptions = {}
  ) {
    return this.consumptionService.sendConsumptionInformationV2(
      transactionId,
      consumptionRequest,
      control
    );
  }

  // App Store Server Notifications methods
  async getNotificationHistory(
    request: NotificationHistoryRequest,
    paginationToken?: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<NotificationHistoryResponse> {
    return this.notificationService.getNotificationHistory(request, paginationToken, options);
  }

  async getAllNotificationHistory(
    request: NotificationHistoryRequest,
    options: StoreKitPaginationOptions = {}
  ): Promise<NotificationHistoryResponse> {
    return this.notificationService.getAllNotificationHistory(request, options);
  }

  iterateNotificationHistoryPages(
    request: NotificationHistoryRequest,
    options: StoreKitPaginationOptions = {}
  ): AsyncGenerator<NotificationHistoryResponse, void, void> {
    return this.notificationService.iterateNotificationHistoryPages(request, options);
  }

  async requestTestNotification(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<SendTestNotificationResponse> {
    return this.notificationService.requestTestNotification(options);
  }

  async getTestNotificationStatus(
    testNotificationToken: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<CheckTestNotificationResponse> {
    return this.notificationService.getTestNotificationStatus(testNotificationToken, options);
  }

  // Subscription renewal extension methods
  async extendSubscriptionRenewalDate(
    originalTransactionId: string,
    request: ExtendRenewalDateRequest,
    control: StoreKitRequestControlOptions = {}
  ): Promise<ExtendRenewalDateResponse> {
    return this.renewalService.extendSubscriptionRenewalDate(
      originalTransactionId,
      request,
      control
    );
  }

  async extendRenewalDateForAllActiveSubscribers(
    request: MassExtendRenewalDateRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<MassExtendRenewalDateResponse> {
    return this.renewalService.extendRenewalDateForAllActiveSubscribers(request, options);
  }

  async getStatusOfSubscriptionRenewalDateExtensions(
    requestIdentifier: string,
    productId: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<MassExtendRenewalDateStatusResponse> {
    return this.renewalService.getStatusOfSubscriptionRenewalDateExtensions(
      requestIdentifier,
      productId,
      options
    );
  }

  // Retention Messaging methods
  async uploadImage(
    imageIdentifier: string,
    image: Buffer,
    imageSize?: RetentionImageSize,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.uploadImage(imageIdentifier, image, imageSize, options);
  }

  async deleteImage(
    imageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.deleteImage(imageIdentifier, options);
  }

  async getImageList(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionImageListResponse> {
    return this.retentionService.getImageList(options);
  }

  async uploadMessage(
    messageIdentifier: string,
    request: UploadRetentionMessageRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.uploadMessage(messageIdentifier, request, options);
  }

  async deleteMessage(
    messageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.deleteMessage(messageIdentifier, options);
  }

  async getMessageList(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionMessageListResponse> {
    return this.retentionService.getMessageList(options);
  }

  async configureDefaultMessage(
    productId: string,
    locale: string,
    request: DefaultRetentionMessageRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.configureDefaultMessage(productId, locale, request, options);
  }

  async deleteDefaultMessage(
    productId: string,
    locale: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.deleteDefaultMessage(productId, locale, options);
  }

  async getDefaultMessage(
    productId: string,
    locale: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<DefaultRetentionMessageResponse> {
    return this.retentionService.getDefaultMessage(productId, locale, options);
  }

  async configureRealtimeURL(
    request: RetentionRealtimeUrlRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    return this.retentionService.configureRealtimeURL(request, options);
  }

  async deleteRealtimeURL(options: StoreKitEnvironmentOptions = {}): Promise<void> {
    return this.retentionService.deleteRealtimeURL(options);
  }

  async getRealtimeURL(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionRealtimeUrlResponse> {
    return this.retentionService.getRealtimeURL(options);
  }

  async initiatePerformanceTest(
    request: RetentionPerformanceTestRequest
  ): Promise<RetentionPerformanceTestResponse> {
    return this.retentionService.initiatePerformanceTest(request);
  }

  async getPerformanceTestResults(
    requestId: string
  ): Promise<RetentionPerformanceTestResultResponse> {
    return this.retentionService.getPerformanceTestResults(requestId);
  }
}
