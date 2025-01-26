import axios from 'axios';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AppleStoreKitConfig } from '../interfaces';

export class BaseService {
  protected config: AppleStoreKitConfig;
  protected baseUrl: string;
  protected privateKeyContent: string;
  protected currentEnvironment: 'sandbox' | 'production';

  constructor(config: AppleStoreKitConfig) {
    this.config = config;
    this.currentEnvironment = config.environment || 'production';
    this.baseUrl = this.getBaseUrl();
    this.privateKeyContent = this.loadPrivateKey(config.privateKey);
  }

  protected getBaseUrl(): string {
    return this.currentEnvironment === 'sandbox'
      ? 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1'
      : 'https://api.storekit.itunes.apple.com/inApps/v1';
  }

  protected async switchEnvironment(): Promise<void> {
    if (this.currentEnvironment === 'production') {
      this.currentEnvironment = 'sandbox';
    } else {
      this.currentEnvironment = 'production';
    }
    console.log(this.getBaseUrl());
    this.baseUrl = this.getBaseUrl();
  }

  protected loadPrivateKey(privateKey: string): string {
    try {
      const resolvedPath = resolve(privateKey);
      return readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        return privateKey;
      }
      throw new Error('Invalid private key: Must be either a valid file path or the key content');
    }
  }

  protected generateToken(): string {
    const header = {
      alg: 'ES256',
      kid: this.config.keyId,
      typ: 'JWT'
    };

    const payload = {
      iss: this.config.issuerId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'appstoreconnect-v1',
      bid: this.config.bundleId
    };

    return jwt.sign(payload, this.privateKeyContent, { 
      algorithm: 'ES256', 
      header 
    });
  }

  protected decodeSignedData(signedData: string): any {
    try {
      const [, payload] = signedData.split('.');
      const decodedData = Buffer.from(payload, 'base64').toString('utf-8');
      return JSON.parse(decodedData);
    } catch (error) {
      console.error('Error decoding signed data:', error);
      return null;
    }
  }

  protected async makeRequest<T>(
    method: 'get' | 'post' | 'put',
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

      const makeHttpRequest = async () => {
        switch (method) {
          case 'get':
            return await axios.get(`${this.baseUrl}${endpoint}`, config);
          case 'post':
            return await axios.post(`${this.baseUrl}${endpoint}`, data, config);
          case 'put':
            return await axios.put(`${this.baseUrl}${endpoint}`, data, config);
        }
      };

      try {
        const response = await makeHttpRequest();
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && !this.config.environment) {
          await this.switchEnvironment();
          const response = await makeHttpRequest();
          return response.data;
        }
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        //console.log(error)
        throw new Error(`Apple StoreKit API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }

  getCurrentEnvironment(): 'sandbox' | 'production' {
    return this.currentEnvironment;
  }
} 