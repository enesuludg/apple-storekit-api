import { TransactionHistoryResponse, VerifyPurchaseResponse, TransactionInfo, UpdateAppAccountTokenRequest, AccountTenure } from '../interfaces';
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

  /**
   * Sets the app account token value for a purchase the customer makes outside of your app,
   * or updates its value in an existing transaction.
   * 
   * @param originalTransactionId The original transaction identifier of the transaction to receive the app account token update
   * @param appAccountToken The app account token value to set for the transaction
   * @returns Promise<void>
   */
  async setAppAccountToken(originalTransactionId: string, appAccountToken: string): Promise<void> {
    const requestBody: UpdateAppAccountTokenRequest = {
      appAccountToken
    };

    await this.makeRequest<void>('put', `/transactions/${originalTransactionId}/appAccountToken`, requestBody);
  }

  getAccountTenure(date: Date) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
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
} 