import {
  AppleStoreKitConfig,
  DefaultRetentionMessageRequest,
  DefaultRetentionMessageResponse,
  RetentionImageListResponse,
  RetentionImageSize,
  RetentionMessageListResponse,
  RetentionPerformanceTestRequest,
  RetentionPerformanceTestResponse,
  RetentionPerformanceTestResultResponse,
  RetentionRealtimeUrlRequest,
  RetentionRealtimeUrlResponse,
  StoreKitEnvironmentOptions,
  UploadRetentionMessageRequest
} from '../interfaces';
import { createStoreKitClient, StoreKitClient } from './base.service';
import {
  encodePathSegment,
  requireHttpsUrl,
  requireNonEmptyString
} from './validation';

export class RetentionService {
  private readonly client: StoreKitClient;

  constructor(clientOrConfig: StoreKitClient | AppleStoreKitConfig) {
    this.client = createStoreKitClient(clientOrConfig);
  }

  async uploadImage(
    imageIdentifier: string,
    image: Buffer,
    imageSize?: RetentionImageSize,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    this.validatePng(image);
    const encodedImageIdentifier = encodePathSegment(imageIdentifier, 'imageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention image upload');
    await this.client.makeRequest<void>(
      'put',
      `/inApps/v1/messaging/image/${encodedImageIdentifier}`,
      image,
      {
        environment,
        query: { imageSize },
        contentType: 'image/png',
        retry: true,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );
  }

  async deleteImage(
    imageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    const encodedImageIdentifier = encodePathSegment(imageIdentifier, 'imageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention image deletion');
    await this.client.makeRequest<void>(
      'delete',
      `/inApps/v1/messaging/image/${encodedImageIdentifier}`,
      undefined,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async getImageList(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionImageListResponse> {
    const environment = this.resolveEnvironment(options, 'retention image listing');
    return this.client.makeRequest<RetentionImageListResponse>(
      'get',
      '/inApps/v1/messaging/image/list',
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async uploadMessage(
    messageIdentifier: string,
    request: UploadRetentionMessageRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    this.validateMessage(request);
    const encodedMessageIdentifier = encodePathSegment(messageIdentifier, 'messageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention message upload');
    await this.client.makeRequest<void>(
      'put',
      `/inApps/v1/messaging/message/${encodedMessageIdentifier}`,
      request,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async deleteMessage(
    messageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    const encodedMessageIdentifier = encodePathSegment(messageIdentifier, 'messageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention message deletion');
    await this.client.makeRequest<void>(
      'delete',
      `/inApps/v1/messaging/message/${encodedMessageIdentifier}`,
      undefined,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async getMessageList(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionMessageListResponse> {
    const environment = this.resolveEnvironment(options, 'retention message listing');
    return this.client.makeRequest<RetentionMessageListResponse>(
      'get',
      '/inApps/v1/messaging/message/list',
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async configureDefaultMessage(
    productId: string,
    locale: string,
    request: DefaultRetentionMessageRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    requireNonEmptyString(request.messageIdentifier, 'messageIdentifier');
    const encodedProductId = encodePathSegment(productId, 'productId');
    const encodedLocale = encodePathSegment(this.validateLocale(locale), 'locale');
    const environment = this.resolveEnvironment(options, 'default retention message configuration');
    await this.client.makeRequest<void>(
      'put',
      `/inApps/v1/messaging/default/${encodedProductId}/${encodedLocale}`,
      request,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async deleteDefaultMessage(
    productId: string,
    locale: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    const encodedProductId = encodePathSegment(productId, 'productId');
    const encodedLocale = encodePathSegment(this.validateLocale(locale), 'locale');
    const environment = this.resolveEnvironment(options, 'default retention message deletion');
    await this.client.makeRequest<void>(
      'delete',
      `/inApps/v1/messaging/default/${encodedProductId}/${encodedLocale}`,
      undefined,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async getDefaultMessage(
    productId: string,
    locale: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<DefaultRetentionMessageResponse> {
    const encodedProductId = encodePathSegment(productId, 'productId');
    const encodedLocale = encodePathSegment(this.validateLocale(locale), 'locale');
    const environment = this.resolveEnvironment(options, 'default retention message lookup');
    return this.client.makeRequest<DefaultRetentionMessageResponse>(
      'get',
      `/inApps/v1/messaging/default/${encodedProductId}/${encodedLocale}`,
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async configureRealtimeURL(
    request: RetentionRealtimeUrlRequest,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    requireHttpsUrl(request.realtimeURL, 'realtimeURL');
    const environment = this.resolveEnvironment(options, 'retention realtime URL configuration');
    await this.client.makeRequest<void>(
      'put',
      '/inApps/v1/messaging/realtime/url',
      request,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async deleteRealtimeURL(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    const environment = this.resolveEnvironment(options, 'retention realtime URL deletion');
    await this.client.makeRequest<void>(
      'delete',
      '/inApps/v1/messaging/realtime/url',
      undefined,
      { environment, retry: true, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async getRealtimeURL(
    options: StoreKitEnvironmentOptions = {}
  ): Promise<RetentionRealtimeUrlResponse> {
    const environment = this.resolveEnvironment(options, 'retention realtime URL lookup');
    return this.client.makeRequest<RetentionRealtimeUrlResponse>(
      'get',
      '/inApps/v1/messaging/realtime/url',
      undefined,
      { environment, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async initiatePerformanceTest(
    request: RetentionPerformanceTestRequest
  ): Promise<RetentionPerformanceTestResponse> {
    requireNonEmptyString(request.originalTransactionId, 'originalTransactionId');
    return this.client.makeRequest<RetentionPerformanceTestResponse>(
      'post',
      '/inApps/v1/messaging/performanceTest',
      request,
      { environment: 'sandbox', retry: false }
    );
  }

  async getPerformanceTestResults(
    requestId: string
  ): Promise<RetentionPerformanceTestResultResponse> {
    const encodedRequestId = encodePathSegment(requestId, 'requestId');
    return this.client.makeRequest<RetentionPerformanceTestResultResponse>(
      'get',
      `/inApps/v1/messaging/performanceTest/result/${encodedRequestId}`,
      undefined,
      { environment: 'sandbox' }
    );
  }

  private resolveEnvironment(
    options: StoreKitEnvironmentOptions,
    operation: string
  ) {
    return this.client.requireEnvironment(options.environment, operation);
  }

  private validatePng(image: Buffer): void {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!Buffer.isBuffer(image) ||
      image.length < signature.length ||
      !signature.every((byte, index) => image[index] === byte)) {
      throw new TypeError('image must be a non-empty PNG buffer.');
    }
  }

  private validateMessage(request: UploadRetentionMessageRequest): void {
    requireNonEmptyString(request.header, 'message header');
    requireNonEmptyString(request.body, 'message body');
    if (request.image) {
      requireNonEmptyString(request.image.imageIdentifier, 'image.imageIdentifier');
      requireNonEmptyString(request.image.altText, 'image.altText');
    }
    request.bulletPoints?.forEach((bulletPoint, index) => {
      requireNonEmptyString(bulletPoint.text, `bulletPoints[${index}].text`);
      requireNonEmptyString(
        bulletPoint.imageIdentifier,
        `bulletPoints[${index}].imageIdentifier`
      );
      requireNonEmptyString(bulletPoint.altText, `bulletPoints[${index}].altText`);
    });
  }

  private validateLocale(locale: string): string {
    requireNonEmptyString(locale, 'locale');
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
      throw new TypeError('locale must be a valid BCP 47 language tag.');
    }
    return locale;
  }
}
