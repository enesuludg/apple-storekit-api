import { 
  AppleStoreKitConfig,
  ConsumptionRequest,
  AccountTenure,
  SubscriptionStatus,
  TransactionInfo,
  LookupOrderResponse,
  RefundLookupResponse
} from './interfaces';
import { 
  BaseService, 
  ConsumptionService, 
  SubscriptionService, 
  TransactionService 
} from './services';

export class AppleStoreKit extends BaseService {
  private consumptionService: ConsumptionService;
  private subscriptionService: SubscriptionService;
  private transactionService: TransactionService;

  constructor(config: AppleStoreKitConfig) {
    super(config);
    this.consumptionService = new ConsumptionService(config);
    this.subscriptionService = new SubscriptionService(config);
    this.transactionService = new TransactionService(config);
  }

  // Subscription methods
  async getSubscriptionStatus(originalTransactionId: string): Promise<SubscriptionStatus> {
    return this.subscriptionService.getSubscriptionStatus(originalTransactionId);
  }

  // Transaction methods
  async verifyPurchase(transactionId: string): Promise<TransactionInfo> {
    return this.transactionService.verifyPurchase(transactionId);
  }

  async getTransactionHistory(transactionId: string): Promise<TransactionInfo[]> {
    return this.transactionService.getTransactionHistory(transactionId);
  }

  async lookupOrder(orderId: string): Promise<LookupOrderResponse> {
    return this.transactionService.lookupOrder(orderId);
  }

  async refundLookup(transactionId: string): Promise<RefundLookupResponse> {
    return this.transactionService.refundLookup(transactionId);
  }

  async setAppAccountToken(originalTransactionId: string, appAccountToken: string) {
    return this.transactionService.setAppAccountToken(originalTransactionId, appAccountToken);
  }

  getAccountTenure(date: Date): AccountTenure {
    return this.transactionService.getAccountTenure(date);
  }

  // Consumption methods
  async sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest) {
    return this.consumptionService.sendConsumptionInformation(transactionId, consumptionRequest);
  }
} 