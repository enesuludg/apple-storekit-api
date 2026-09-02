import {
  AppleStoreKitConfig,
  DefaultRetentionMessageRequest,
  DefaultRetentionMessageResponse,
  RetentionImageListResponse,
  RetentionImageSize,
  RetentionHeaderPosition,
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
  requireNonEmptyString,
  requireStringMaxLength,
  requireUuid
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
    requireUuid(imageIdentifier, 'imageIdentifier');
    this.validateImageSize(imageSize);
    this.validatePng(image, imageSize);
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
        retry: false,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      }
    );
  }

  async deleteImage(
    imageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    requireUuid(imageIdentifier, 'imageIdentifier');
    const encodedImageIdentifier = encodePathSegment(imageIdentifier, 'imageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention image deletion');
    await this.client.makeRequest<void>(
      'delete',
      `/inApps/v1/messaging/image/${encodedImageIdentifier}`,
      undefined,
      { environment, retry: false, signal: options.signal, timeoutMs: options.timeoutMs }
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
    requireUuid(messageIdentifier, 'messageIdentifier');
    this.validateMessage(request);
    const encodedMessageIdentifier = encodePathSegment(messageIdentifier, 'messageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention message upload');
    await this.client.makeRequest<void>(
      'put',
      `/inApps/v1/messaging/message/${encodedMessageIdentifier}`,
      request,
      { environment, retry: false, signal: options.signal, timeoutMs: options.timeoutMs }
    );
  }

  async deleteMessage(
    messageIdentifier: string,
    options: StoreKitEnvironmentOptions = {}
  ): Promise<void> {
    requireUuid(messageIdentifier, 'messageIdentifier');
    const encodedMessageIdentifier = encodePathSegment(messageIdentifier, 'messageIdentifier');
    const environment = this.resolveEnvironment(options, 'retention message deletion');
    await this.client.makeRequest<void>(
      'delete',
      `/inApps/v1/messaging/message/${encodedMessageIdentifier}`,
      undefined,
      { environment, retry: false, signal: options.signal, timeoutMs: options.timeoutMs }
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
    requireUuid(request.messageIdentifier, 'messageIdentifier');
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
    if (Array.from(request.realtimeURL).length > 256) {
      throw new RangeError('realtimeURL must be at most 256 characters.');
    }
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
    requireUuid(requestId, 'requestId');
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

  private validateImageSize(imageSize: RetentionImageSize | undefined): void {
    if (imageSize !== undefined &&
      imageSize !== RetentionImageSize.FULL_SIZE &&
      imageSize !== RetentionImageSize.BULLET_POINT) {
      throw new TypeError('imageSize must be FULL_SIZE or BULLET_POINT.');
    }
  }

  private validatePng(image: Buffer, imageSize: RetentionImageSize | undefined): void {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!Buffer.isBuffer(image) ||
      image.length < 33 ||
      !signature.every((byte, index) => image[index] === byte)) {
      throw new TypeError('image must contain a supported PNG structure.');
    }

    let offset = signature.length;
    let width: number | undefined;
    let height: number | undefined;
    let sawIdat = false;
    let sawIend = false;

    while (offset < image.length) {
      if (image.length - offset < 12) {
        throw new TypeError('image contains a truncated PNG chunk.');
      }

      const chunkLength = image.readUInt32BE(offset);
      const chunkEnd = offset + 12 + chunkLength;
      if (chunkEnd > image.length) {
        throw new TypeError('image contains a truncated PNG chunk.');
      }

      const chunkType = image.toString('ascii', offset + 4, offset + 8);
      if (!/^[A-Za-z]{4}$/.test(chunkType)) {
        throw new TypeError('image contains an invalid PNG chunk type.');
      }

      if (offset === signature.length) {
        if (chunkType !== 'IHDR' || chunkLength !== 13) {
          throw new TypeError('image must begin with a 13-byte PNG IHDR chunk.');
        }

        width = image.readUInt32BE(offset + 8);
        height = image.readUInt32BE(offset + 12);
        const bitDepth = image[offset + 16];
        const colorType = image[offset + 17];
        const compressionMethod = image[offset + 18];
        const filterMethod = image[offset + 19];
        const interlaceMethod = image[offset + 20];
        const validBitDepths: Readonly<Record<number, ReadonlyArray<number>>> = {
          0: [1, 2, 4, 8, 16],
          2: [8, 16],
          3: [1, 2, 4, 8],
          4: [8, 16],
          6: [8, 16]
        };

        if (!width || !height ||
          !validBitDepths[colorType]?.includes(bitDepth) ||
          compressionMethod !== 0 ||
          filterMethod !== 0 ||
          ![0, 1].includes(interlaceMethod)) {
          throw new TypeError('image contains an invalid PNG IHDR chunk.');
        }
        if (colorType === 4 || colorType === 6) {
          throw new TypeError('image must not use a PNG color type with an alpha channel.');
        }
      } else if (chunkType === 'IHDR') {
        throw new TypeError('image must contain exactly one PNG IHDR chunk.');
      }

      if (chunkType === 'tRNS') {
        throw new TypeError('image must not contain PNG transparency data.');
      }
      if (chunkType === 'IDAT') {
        sawIdat = true;
      }
      if (chunkType === 'IEND') {
        if (chunkLength !== 0 || !sawIdat || chunkEnd !== image.length) {
          throw new TypeError('image contains an invalid PNG IEND chunk.');
        }
        sawIend = true;
        break;
      }

      offset = chunkEnd;
    }

    if (!sawIend || width === undefined || height === undefined) {
      throw new TypeError('image must contain complete PNG IHDR, IDAT, and IEND chunks.');
    }

    const effectiveImageSize = imageSize || RetentionImageSize.FULL_SIZE;
    if (effectiveImageSize === RetentionImageSize.FULL_SIZE &&
      (width !== 3840 || height < 160 || height > 2160)) {
      throw new RangeError(
        'FULL_SIZE images must be 3840 pixels wide and 160 through 2160 pixels high.'
      );
    }
    if (effectiveImageSize === RetentionImageSize.BULLET_POINT &&
      (width !== 1024 || height !== 1024)) {
      throw new RangeError('BULLET_POINT images must be exactly 1024 by 1024 pixels.');
    }
  }

  private validateMessage(request: UploadRetentionMessageRequest): void {
    requireStringMaxLength(request.header, 'message header', 66);
    requireStringMaxLength(request.body, 'message body', 144);
    if (request.headerPosition === RetentionHeaderPosition.ABOVE_IMAGE && !request.image) {
      throw new TypeError('message image is required when headerPosition is ABOVE_IMAGE.');
    }
    if (request.image) {
      requireUuid(request.image.imageIdentifier, 'image.imageIdentifier');
      requireStringMaxLength(request.image.altText, 'image.altText', 150);
    }
    request.bulletPoints?.forEach((bulletPoint, index) => {
      requireStringMaxLength(bulletPoint.text, `bulletPoints[${index}].text`, 66);
      requireUuid(
        bulletPoint.imageIdentifier,
        `bulletPoints[${index}].imageIdentifier`
      );
      requireStringMaxLength(
        bulletPoint.altText,
        `bulletPoints[${index}].altText`,
        150
      );
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
