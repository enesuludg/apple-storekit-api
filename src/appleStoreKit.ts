import axios from 'axios';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface AppleStoreKitConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  environment?: 'sandbox' | 'production';
}

interface SubscriptionStatus {
  originalTransactionId: string;
  status: number;
  expirationDate: Date;
  transactionInfo: any;
  renewalInfo: any;
}

interface AppleSubscriptionResponse {
  environment: 'Sandbox' | 'Production';
  bundleId: string;
  data: Array<{
    subscriptionGroupIdentifier: string;
    lastTransactions: Array<{
      originalTransactionId: string;
      status: number;
      signedTransactionInfo: string;
      signedRenewalInfo: string;
    }>;
  }>;
}

export class AppleStoreKit {
  private config: AppleStoreKitConfig;
  private baseUrl: string;
  private privateKeyContent: string;
  private currentEnvironment: 'sandbox' | 'production';

  constructor(config: AppleStoreKitConfig) {
    this.config = config;
    this.currentEnvironment = config.environment || 'production';
    this.baseUrl = this.getBaseUrl();
    this.privateKeyContent = this.loadPrivateKey(config.privateKey);
  }

  private getBaseUrl(): string {
    return this.currentEnvironment === 'sandbox'
      ? 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1'
      : 'https://api.storekit.itunes.apple.com/inApps/v1';
  }

  private async switchEnvironment(): Promise<void> {
    if (this.currentEnvironment === 'production') {
      this.currentEnvironment = 'sandbox';
    } else {
      this.currentEnvironment = 'production';
    }
    this.baseUrl = this.getBaseUrl();
  }

  private loadPrivateKey(privateKey: string): string {
    try {
      // First try to read as a file path
      const resolvedPath = resolve(privateKey);
      return readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      // If file reading fails, assume it's the key content directly
      if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        return privateKey;
      }
      throw new Error('Invalid private key: Must be either a valid file path or the key content');
    }
  }

  private generateToken(): string {
    const header = {
      alg: 'ES256',
      kid: this.config.keyId,
      typ: 'JWT'
    };

    const payload = {
      iss: this.config.issuerId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
      aud: 'appstoreconnect-v1',
      bid: this.config.bundleId
    };

    return jwt.sign(payload, this.privateKeyContent, { 
      algorithm: 'ES256', 
      header 
    });
  }

  private decodeSignedData(signedData: string): any {
    try {
      // JWT'nin üç parçasından ortadaki payload kısmını alıyoruz
      const [, payload] = signedData.split('.');
      // Base64 decode işlemi
      const decodedData = Buffer.from(payload, 'base64').toString('utf-8');
      return JSON.parse(decodedData);
    } catch (error) {
      console.error('Error decoding signed data:', error);
      return null;
    }
  }

  private async makeRequest<T>(
    method: 'get' | 'post',
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      const token = this.generateToken();
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      let response;
      try {
        if (method === 'get') {
          response = await axios.get(`${this.baseUrl}${endpoint}`, config);
        } else {
          response = await axios.post(`${this.baseUrl}${endpoint}`, data, config);
        }
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && !this.config.environment) {
          // If environment is not specified and request fails, try the other environment
          await this.switchEnvironment();
          if (method === 'get') {
            response = await axios.get(`${this.baseUrl}${endpoint}`, config);
          } else {
            response = await axios.post(`${this.baseUrl}${endpoint}`, data, config);
          }
          return response.data;
        }
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Apple StoreKit API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }

  async getSubscriptionStatus(originalTransactionId: string): Promise<SubscriptionStatus> {
    const response = await this.makeRequest<AppleSubscriptionResponse>('get', `/subscriptions/${originalTransactionId}`);
    
    const data = response.data[0].lastTransactions[0]
    if (!data) {
      throw new Error('No subscription data found');
    }

    const transactionInfo = this.decodeSignedData(data.signedTransactionInfo);
    const renewalInfo = this.decodeSignedData(data.signedRenewalInfo);

    return {
      originalTransactionId: data.originalTransactionId,
      status: data.status,
      expirationDate: new Date(transactionInfo?.expiresDate || 0),
      transactionInfo,
      renewalInfo
    };
  }

  async getAllSubscriptions(originalTransactionId: string) {
    return this.makeRequest('get', `/subscriptions/${originalTransactionId}/all`);
  }

  async verifyPurchase(transactionId: string) {
    return this.makeRequest('get', `/transactions/${transactionId}`);
  }

  async getTransactionHistory(transactionId: string) {
    return this.makeRequest('get', `/history/${transactionId}`);
  }

  async lookupOrder(orderId: string) {
    return this.makeRequest('get', `/lookup/${orderId}`);
  }

  async refundLookup(transactionId: string) {
    return this.makeRequest('get', `/refund/lookup/${transactionId}`);
  }

  getCurrentEnvironment(): 'sandbox' | 'production' {
    return this.currentEnvironment;
  }
} 