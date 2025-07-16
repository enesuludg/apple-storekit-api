import { 
  AppleStoreKitConfig,
  ConsumptionRequest, 
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
  async getSubscriptionStatus(originalTransactionId: string) {
    return this.subscriptionService.getSubscriptionStatus(originalTransactionId);
  }

  // Transaction methods
  async verifyPurchase(transactionId: string) {
    return this.transactionService.verifyPurchase(transactionId);
  }

  async getTransactionHistory(transactionId: string) {
    return this.transactionService.getTransactionHistory(transactionId);
  }

  async lookupOrder(orderId: string) {
    return this.transactionService.lookupOrder(orderId);
  }

  async refundLookup(transactionId: string) {
    return this.transactionService.refundLookup(transactionId);
  }

  async setAppAccountToken(originalTransactionId: string, appAccountToken: string) {
    return this.transactionService.setAppAccountToken(originalTransactionId, appAccountToken);
  }

  getAccountTenure(date: Date) {
    return this.transactionService.getAccountTenure(date);
  }

  // Consumption methods
  async sendConsumptionInformation(transactionId: string, consumptionRequest: ConsumptionRequest) {
    return this.consumptionService.sendConsumptionInformation(transactionId, consumptionRequest);
  }
} 