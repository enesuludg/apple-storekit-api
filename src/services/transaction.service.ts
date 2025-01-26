import { TransactionHistoryResponse, VerifyPurchaseResponse, TransactionInfo } from '../interfaces';
import { BaseService } from './base.service';

export class TransactionService extends BaseService {
  async verifyPurchase(transactionId: string): Promise<TransactionInfo> {
    const response = await this.makeRequest<VerifyPurchaseResponse>('get', `/transactions/${transactionId}`);
    return this.decodeSignedData(response.signedTransactionInfo);
  }

  async getTransactionHistory(transactionId: string): Promise<TransactionInfo[]> {
    const response = await this.makeRequest<TransactionHistoryResponse>('get', `/history/${transactionId}`);
    return response.signedTransactions.map((jwt: string) => this.decodeSignedData(jwt));
  }

  async lookupOrder(orderId: string) {
    return this.makeRequest('get', `/lookup/${orderId}`);
  }

  async refundLookup(transactionId: string) {
    return this.makeRequest('get', `/refund/lookup/${transactionId}`);
  }
} 