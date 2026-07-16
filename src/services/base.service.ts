import axios from 'axios';
import jwt from 'jsonwebtoken';
import {
  AppTransaction,
  Environment,
  JWSRenewalInfoDecodedPayload,
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
  SignedDataVerifier
} from '@apple/app-store-server-library';
import { readFileSync } from 'fs';
import { Agent as HttpsAgent } from 'https';
import { resolve } from 'path';
import {
  AppleStoreKitConfig,
  StoreEnvironment,
  StoreEnvironmentMode,
  StoreKitHttpClient,
  StoreKitSignedDataVerifier,
  StoreKitRequestOptions,
  StoreKitRequestResult
} from '../interfaces';
import { encodePathSegment, requireNonEmptyString } from './validation';

type HttpMethod = 'delete' | 'get' | 'post' | 'put';
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ETIMEDOUT'
]);
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface StoreKitAttemptError {
  environment: StoreEnvironment;
  error: unknown;
}

export class AppleStoreKitApiError extends Error {
  readonly statusCode?: number;
  readonly errorCode?: number;
  readonly environment: StoreEnvironment;
  readonly retryAfterMs?: number;
  readonly retryable: boolean;
  readonly cause: unknown;
  readonly attempts?: ReadonlyArray<StoreKitAttemptError>;
  /** @deprecated Use cause. */
  readonly originalError: unknown;

  constructor(
    message: string,
    environment: StoreEnvironment,
    originalError: unknown,
    statusCode?: number,
    errorCode?: number,
    retryAfterMs?: number,
    retryable = false,
    attempts?: ReadonlyArray<StoreKitAttemptError>
  ) {
    super(message);
    this.name = 'AppleStoreKitApiError';
    this.environment = environment;
    this.originalError = originalError;
    this.cause = originalError;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

export class AppleStoreKitVerificationError extends Error {
  readonly environment: StoreEnvironment;
  readonly cause: unknown;

  constructor(message: string, environment: StoreEnvironment, cause: unknown) {
    super(message);
    this.name = 'AppleStoreKitVerificationError';
    this.environment = environment;
    this.cause = cause;
  }
}

export interface StoreKitClient {
  makeRequest<T>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options?: StoreKitRequestOptions
  ): Promise<T>;
  makeRequestWithEnvironment<T>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options?: StoreKitRequestOptions
  ): Promise<StoreKitRequestResult<T>>;
  resolveTransactionEnvironment(
    transactionId: string,
    control?: Pick<StoreKitRequestOptions, 'signal' | 'timeoutMs'>
  ): Promise<StoreEnvironment>;
  getConfiguredEnvironment(): StoreEnvironmentMode;
  requireEnvironment(
    explicitEnvironment: StoreEnvironment | undefined,
    operation: string
  ): StoreEnvironment;
  verifyAndDecodeTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<JWSTransactionDecodedPayload>;
  verifyAndDecodeRenewalInfo(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<JWSRenewalInfoDecodedPayload>;
  verifyAndDecodeNotification(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<ResponseBodyV2DecodedPayload>;
  verifyAndDecodeAppTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<AppTransaction>;
}

export function createStoreKitClient(
  clientOrConfig: StoreKitClient | AppleStoreKitConfig
): StoreKitClient {
  if (isStoreKitClient(clientOrConfig)) {
    return clientOrConfig;
  }
  return new BaseService(clientOrConfig);
}

function isStoreKitClient(value: unknown): value is StoreKitClient {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Record<keyof StoreKitClient, unknown>>;
  return typeof candidate.makeRequest === 'function' &&
    typeof candidate.makeRequestWithEnvironment === 'function' &&
    typeof candidate.resolveTransactionEnvironment === 'function' &&
    typeof candidate.verifyAndDecodeTransaction === 'function';
}

export class BaseService implements StoreKitClient {
  protected readonly config: AppleStoreKitConfig;
  protected readonly privateKeyContent: string;
  private readonly httpClient: StoreKitHttpClient;
  private readonly signedDataVerifiers = new Map<StoreEnvironment, StoreKitSignedDataVerifier>();
  private cachedToken?: { value: string; expiresAt: number };

  constructor(config: AppleStoreKitConfig) {
    this.validateConfig(config);
    this.config = config;
    this.privateKeyContent = this.loadPrivateKey(config.privateKey);
    this.httpClient = config.httpClient || axios.create({
      httpsAgent: new HttpsAgent({ keepAlive: true }),
      maxRedirects: 0
    });
  }

  protected getBaseUrl(environment: StoreEnvironment): string {
    return environment === 'sandbox'
      ? 'https://api.storekit-sandbox.apple.com'
      : 'https://api.storekit.apple.com';
  }

  protected loadPrivateKey(privateKey: string): string {
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      return this.normalizePrivateKey(privateKey);
    }

    try {
      const resolvedPath = resolve(privateKey);
      const keyContent = readFileSync(resolvedPath, 'utf8');
      return this.normalizePrivateKey(keyContent);
    } catch (error) {
      const keyError = new Error(
        'Invalid private key: expected a readable .p8 path or PKCS#8 private key content.'
      ) as Error & { cause?: unknown };
      keyError.cause = error;
      throw keyError;
    }
  }

  private normalizePrivateKey(key: string): string {
    // Remove any whitespace and ensure proper PEM format
    const cleanKey = key.replace(/\\n/g, '\n').trim();
    if (!cleanKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Invalid private key format: Must start with -----BEGIN PRIVATE KEY-----');
    }
    if (!cleanKey.endsWith('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format: Must end with -----END PRIVATE KEY-----');
    }
    return cleanKey;
  }

  protected generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && now < this.cachedToken.expiresAt - 30) {
      return this.cachedToken.value;
    }

    const header = {
      alg: 'ES256',
      kid: this.config.keyId,
      typ: 'JWT'
    };

    const payload = {
      iss: this.config.issuerId,
      iat: now,
      exp: now + 300,
      aud: 'appstoreconnect-v1',
      bid: this.config.bundleId
    };

    try {
      const value = jwt.sign(payload, this.privateKeyContent, {
        algorithm: 'ES256',
        header,
        noTimestamp: true
      });
      this.cachedToken = { value, expiresAt: payload.exp };
      return value;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Token generation failed: ${error.message}. Please ensure your private key is in the correct ECDSA format.`);
      }
      throw error;
    }
  }

  async verifyAndDecodeTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<JWSTransactionDecodedPayload> {
    return this.verifySignedData(
      environment,
      verifier => verifier.verifyAndDecodeTransaction(signedData),
      'transaction'
    );
  }

  async verifyAndDecodeRenewalInfo(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<JWSRenewalInfoDecodedPayload> {
    return this.verifySignedData(
      environment,
      verifier => verifier.verifyAndDecodeRenewalInfo(signedData),
      'renewal information'
    );
  }

  async verifyAndDecodeNotification(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<ResponseBodyV2DecodedPayload> {
    return this.verifySignedData(
      environment,
      verifier => verifier.verifyAndDecodeNotification(signedData),
      'notification'
    );
  }

  async verifyAndDecodeAppTransaction(
    signedData: string,
    environment: StoreEnvironment
  ): Promise<AppTransaction> {
    return this.verifySignedData(
      environment,
      verifier => verifier.verifyAndDecodeAppTransaction(signedData),
      'app transaction'
    );
  }

  /**
   * @deprecated Use verifyAndDecodeTransaction() and pass the request environment.
   * This method now verifies the JWS and is therefore asynchronous.
   */
  async decodeSignedData(
    signedData: string,
    environment?: StoreEnvironment
  ): Promise<JWSTransactionDecodedPayload> {
    const resolvedEnvironment = environment || this.config.environment;
    if (!resolvedEnvironment) {
      throw new Error(
        'Signed data verification requires an explicit environment when the client uses auto mode.'
      );
    }

    return this.verifyAndDecodeTransaction(signedData, resolvedEnvironment);
  }

  private async verifySignedData<T>(
    environment: StoreEnvironment,
    operation: (verifier: StoreKitSignedDataVerifier) => Promise<T>,
    dataType: string
  ): Promise<T> {
    try {
      return await operation(this.getSignedDataVerifier(environment));
    } catch (error) {
      if (error instanceof AppleStoreKitVerificationError) {
        throw error;
      }

      throw new AppleStoreKitVerificationError(
        `Apple ${dataType} JWS verification failed for ${environment}.`,
        environment,
        error
      );
    }
  }

  private getSignedDataVerifier(environment: StoreEnvironment): StoreKitSignedDataVerifier {
    const existingVerifier = this.signedDataVerifiers.get(environment);
    if (existingVerifier) {
      return existingVerifier;
    }

    const injectedVerifier = this.config.signedDataVerifierFactory?.(environment);
    if (injectedVerifier) {
      this.signedDataVerifiers.set(environment, injectedVerifier);
      return injectedVerifier;
    }

    const configuredRoots = this.config.appleRootCertificates;
    if (!configuredRoots || configuredRoots.length === 0) {
      throw new AppleStoreKitVerificationError(
        'Signed data verification requires at least one Apple root certificate in appleRootCertificates.',
        environment,
        undefined
      );
    }

    if (environment === 'production' && !Number.isSafeInteger(this.config.appAppleId)) {
      throw new AppleStoreKitVerificationError(
        'Production signed data verification requires a valid appAppleId.',
        environment,
        undefined
      );
    }

    try {
      const rootCertificates = configuredRoots.map(certificate =>
        Buffer.isBuffer(certificate)
          ? Buffer.from(certificate)
          : readFileSync(resolve(certificate))
      );
      const verifier = new SignedDataVerifier(
        rootCertificates,
        this.config.enableOnlineChecks !== false,
        environment === 'production' ? Environment.PRODUCTION : Environment.SANDBOX,
        this.config.bundleId,
        environment === 'production' ? this.config.appAppleId : undefined
      );
      this.signedDataVerifiers.set(environment, verifier);
      return verifier;
    } catch (error) {
      throw new AppleStoreKitVerificationError(
        `Unable to initialize Apple signed data verification for ${environment}.`,
        environment,
        error
      );
    }
  }

  async makeRequest<T>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options: StoreKitRequestOptions = {}
  ): Promise<T> {
    const result = await this.makeRequestWithEnvironment<T>(method, endpoint, data, options);
    return result.data;
  }

  async makeRequestWithEnvironment<T>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options: StoreKitRequestOptions = {}
  ): Promise<StoreKitRequestResult<T>> {
    const fixedEnvironment = options.environment || this.config.environment;

    if (fixedEnvironment) {
      try {
        return await this.requestInEnvironment<T>(fixedEnvironment, method, endpoint, data, options);
      } catch (error) {
        throw this.normalizeError(error, fixedEnvironment);
      }
    }

    let productionNotFoundError: unknown;
    try {
      return await this.requestInEnvironment<T>('production', method, endpoint, data, options);
    } catch (productionError) {
      if (
        !options.allowEnvironmentFallback ||
        !this.isTransactionNotFound(productionError)
      ) {
        throw this.normalizeError(productionError, 'production');
      }
      productionNotFoundError = productionError;
    }

    try {
      return await this.requestInEnvironment<T>('sandbox', method, endpoint, data, options);
    } catch (sandboxError) {
      if (this.isTransactionNotFound(sandboxError)) {
        throw new AppleStoreKitApiError(
          'Apple StoreKit API Error: Transaction id was not found in production or sandbox. (Error Code: 4040010)',
          'sandbox',
          sandboxError,
          404,
          4040010,
          undefined,
          false,
          [
            { environment: 'production', error: productionNotFoundError },
            { environment: 'sandbox', error: sandboxError }
          ]
        );
      }

      throw this.normalizeError(sandboxError, 'sandbox', [
        { environment: 'production', error: productionNotFoundError },
        { environment: 'sandbox', error: sandboxError }
      ]);
    }
  }

  async resolveTransactionEnvironment(
    transactionId: string,
    control: Pick<StoreKitRequestOptions, 'signal' | 'timeoutMs'> = {}
  ): Promise<StoreEnvironment> {
    const encodedTransactionId = encodePathSegment(transactionId, 'transactionId');
    if (this.config.environment) {
      return this.config.environment;
    }

    const result = await this.makeRequestWithEnvironment<unknown>(
      'get',
      `/inApps/v1/transactions/${encodedTransactionId}`,
      undefined,
      { allowEnvironmentFallback: true, ...control }
    );

    return result.environment;
  }

  getConfiguredEnvironment(): StoreEnvironmentMode {
    return this.config.environment || 'auto';
  }

  requireEnvironment(
    explicitEnvironment: StoreEnvironment | undefined,
    operation: string
  ): StoreEnvironment {
    const environment = explicitEnvironment || this.config.environment;
    if (!environment) {
      throw new Error(
        `An explicit environment is required for ${operation} when the client uses auto mode.`
      );
    }
    return environment;
  }

  /**
   * @deprecated Environment is resolved per request in auto mode. Use
   * getConfiguredEnvironment() or resolveTransactionEnvironment().
   */
  getCurrentEnvironment(): StoreEnvironmentMode {
    return this.getConfiguredEnvironment();
  }

  private async requestInEnvironment<T>(
    environment: StoreEnvironment,
    method: HttpMethod,
    endpoint: string,
    data: unknown,
    options: StoreKitRequestOptions
  ): Promise<StoreKitRequestResult<T>> {
    const retriesEnabled = options.retry === true ||
      (options.retry === undefined && method === 'get');
    const maxRetries = retriesEnabled
      ? this.normalizeNonNegativeInteger(this.config.maxRetries, 2)
      : 0;
    let attempt = 0;

    while (true) {
      try {
        const response = await this.httpClient.request<T>({
          method,
          url: this.buildRequestUrl(environment, endpoint, options.query),
          data,
          signal: options.signal,
          timeout: this.getRequestTimeout(options.timeoutMs),
          headers: {
            'Authorization': `Bearer ${this.generateToken()}`,
            'Content-Type': options.contentType || 'application/json'
          }
        });

        return {
          data: response.data,
          environment,
          statusCode: response.status
        };
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }

        const retryDelay = this.getRetryDelay(error, attempt);
        if (retryDelay === null) {
          throw error;
        }

        attempt += 1;
        await this.wait(retryDelay, options.signal);
      }
    }
  }

  private getRetryDelay(error: unknown, attempt: number): number | null {
    if (!axios.isAxiosError(error)) {
      return null;
    }

    const status = error.response?.status;
    const errorCode = Number(error.response?.data?.errorCode);
    const isRetryableNetworkError = !error.response &&
      RETRYABLE_NETWORK_CODES.has(error.code || '');
    const isRetryable =
      isRetryableNetworkError ||
      (status !== undefined && RETRYABLE_HTTP_STATUS_CODES.has(status)) ||
      errorCode === 5000001;

    if (!isRetryable) {
      return null;
    }

    const maxDelay = this.normalizeNonNegativeInteger(this.config.maxRetryDelayMs, 5000);
    const retryAfterMs = status === 429 ? this.getRetryAfterMs(error) : undefined;

    if (retryAfterMs !== undefined) {
      return retryAfterMs <= maxDelay ? retryAfterMs : null;
    }

    const baseDelay = this.normalizeNonNegativeInteger(this.config.retryBaseDelayMs, 250);
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = exponentialDelay * Math.random() * 0.2;
    return Math.min(Math.round(exponentialDelay + jitter), maxDelay);
  }

  private buildRequestUrl(
    environment: StoreEnvironment,
    endpoint: string,
    query: StoreKitRequestOptions['query']
  ): string {
    const url = `${this.getBaseUrl(environment)}${endpoint}`;
    if (!query) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      const values = Array.isArray(value) ? value : [value];
      values.forEach(item => searchParams.append(key, String(item)));
    });

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  private getRetryAfterMs(error: unknown): number | undefined {
    if (!axios.isAxiosError(error)) {
      return undefined;
    }

    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter === undefined) {
      return undefined;
    }

    const numericValue = Number(retryAfter);
    if (Number.isFinite(numericValue)) {
      // Apple returns a UNIX timestamp in milliseconds. Also support the
      // standard Retry-After delay-in-seconds representation.
      return numericValue > 1_000_000_000_000
        ? Math.max(0, numericValue - Date.now())
        : Math.max(0, numericValue * 1000);
    }

    const retryDate = Date.parse(String(retryAfter));
    return Number.isNaN(retryDate) ? undefined : Math.max(0, retryDate - Date.now());
  }

  private isTransactionNotFound(error: unknown): boolean {
    return axios.isAxiosError(error) &&
      error.response?.status === 404 &&
      Number(error.response?.data?.errorCode) === 4040010;
  }

  private normalizeError(
    error: unknown,
    environment: StoreEnvironment,
    attempts?: ReadonlyArray<StoreKitAttemptError>
  ): Error {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const responseData = error.response?.data;
    const statusCode = error.response?.status;
    const errorCode = Number(responseData?.errorCode);
    const normalizedErrorCode = Number.isFinite(errorCode) ? errorCode : undefined;
    const retryAfterMs = this.getRetryAfterMs(error);
    let detail = error.message;

    if (typeof responseData === 'string') {
      detail = responseData;
    } else if (responseData && typeof responseData === 'object') {
      detail = responseData.errorMessage ||
        responseData.message ||
        responseData.error ||
        (normalizedErrorCode !== undefined
          ? `Error Code: ${normalizedErrorCode}`
          : JSON.stringify(responseData));
    }

    const statusSuffix = statusCode ? ` (Status: ${statusCode})` : '';
    const codeSuffix = normalizedErrorCode !== undefined && !detail.includes(String(normalizedErrorCode))
      ? ` (Error Code: ${normalizedErrorCode})`
      : '';

    return new AppleStoreKitApiError(
      `Apple StoreKit API Error [${environment}]: ${detail}${codeSuffix}${statusSuffix}`,
      environment,
      error,
      statusCode,
      normalizedErrorCode,
      retryAfterMs,
      this.isRetryableError(error),
      attempts
    );
  }

  private normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
    if (value === undefined || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(0, Math.floor(value));
  }

  private isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error) || error.code === 'ERR_CANCELED') {
      return false;
    }
    const status = error.response?.status;
    const errorCode = Number(error.response?.data?.errorCode);
    return (!error.response && RETRYABLE_NETWORK_CODES.has(error.code || '')) ||
      (status !== undefined && RETRYABLE_HTTP_STATUS_CODES.has(status)) ||
      errorCode === 5000001;
  }

  private validateConfig(config: AppleStoreKitConfig): void {
    requireNonEmptyString(config.issuerId, 'issuerId');
    requireNonEmptyString(config.keyId, 'keyId');
    requireNonEmptyString(config.privateKey, 'privateKey');
    requireNonEmptyString(config.bundleId, 'bundleId');

    if (config.environment !== undefined &&
      config.environment !== 'production' &&
      config.environment !== 'sandbox') {
      throw new TypeError('environment must be production or sandbox.');
    }
    if (config.appAppleId !== undefined &&
      (!Number.isSafeInteger(config.appAppleId) || config.appAppleId <= 0)) {
      throw new RangeError('appAppleId must be a positive safe integer.');
    }
    for (const [name, value] of [
      ['maxRetries', config.maxRetries],
      ['retryBaseDelayMs', config.retryBaseDelayMs],
      ['maxRetryDelayMs', config.maxRetryDelayMs]
    ] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
      }
    }
    if (config.timeoutMs !== undefined &&
      (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0)) {
      throw new RangeError('timeoutMs must be a positive finite number.');
    }
    if (config.httpClient && typeof config.httpClient.request !== 'function') {
      throw new TypeError('httpClient must provide a request function.');
    }
    if (config.signedDataVerifierFactory &&
      typeof config.signedDataVerifierFactory !== 'function') {
      throw new TypeError('signedDataVerifierFactory must be a function.');
    }
  }

  private getRequestTimeout(override: number | undefined): number {
    const timeout = override === undefined ? this.config.timeoutMs : override;
    if (timeout === undefined) {
      return 10_000;
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new RangeError('timeoutMs must be a positive finite number.');
    }
    return Math.floor(timeout);
  }

  private wait(delayMs: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason || new Error('The request was aborted.'));
    }

    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolvePromise();
      }, delayMs);
      const abort = () => {
        clearTimeout(timeout);
        rejectPromise(signal?.reason || new Error('The request was aborted.'));
      };
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
