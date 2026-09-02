import type {
  AppTransaction,
  JWSRenewalInfoDecodedPayload,
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload
} from '@apple/app-store-server-library';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export type StoreEnvironment = 'sandbox' | 'production';

export type StoreEnvironmentMode = StoreEnvironment | 'auto';

export interface StoreKitRequestControlOptions {
  /** Abort the active request and any retry backoff. */
  signal?: AbortSignal;
  /** Per-request timeout in milliseconds (1 through 2147483647). */
  timeoutMs?: number;
}

export interface StoreKitEnvironmentOptions extends StoreKitRequestControlOptions {
  /** Environment for endpoints that can't infer it from a transaction ID. */
  environment?: StoreEnvironment;
}

export interface StoreKitPaginationOptions extends StoreKitEnvironmentOptions {
  /** Maximum number of pages to fetch. Default: 100. */
  maxPages?: number;
  /** Maximum number of items to collect or iterate. Default: 20000. */
  maxItems?: number;
}

export type StoreKitQueryPrimitive = string | number | boolean;

export type StoreKitQueryValue =
  | StoreKitQueryPrimitive
  | StoreKitQueryPrimitive[]
  | null
  | undefined;

export interface StoreKitRequestOptions {
  /** Execute the request in this environment without automatic fallback. */
  environment?: StoreEnvironment;
  /** Allow production-to-sandbox fallback for transaction-based endpoints. */
  allowEnvironmentFallback?: boolean;
  /** Query parameters. Array values are serialized as repeated keys. */
  query?: Record<string, StoreKitQueryValue>;
  /** Request body content type. Default: application/json */
  contentType?: string;
  /** Override retry behavior. POST requests don't retry unless explicitly enabled. */
  retry?: boolean;
  /** Abort this request, including retry backoff, when the signal is aborted. */
  signal?: AbortSignal;
  /** Per-request timeout in milliseconds (1 through 2147483647). Overrides the client default. */
  timeoutMs?: number;
}

export interface StoreKitRequestResult<T> {
  data: T;
  environment: StoreEnvironment;
  statusCode: number;
}

/** Verifier contract used by the client. Primarily useful for isolated tests. */
export interface StoreKitSignedDataVerifier {
  verifyAndDecodeTransaction(signedData: string): Promise<JWSTransactionDecodedPayload>;
  verifyAndDecodeRenewalInfo(signedData: string): Promise<JWSRenewalInfoDecodedPayload>;
  verifyAndDecodeNotification(signedData: string): Promise<ResponseBodyV2DecodedPayload>;
  verifyAndDecodeAppTransaction(signedData: string): Promise<AppTransaction>;
}

/** Minimal HTTP adapter contract used for dependency injection and isolated tests. */
export interface StoreKitHttpClient {
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

export interface AppleStoreKitConfig {
  /** The issuer ID from App Store Connect */
  issuerId: string;
  /** The key ID from App Store Connect */
  keyId: string;
  /** The private key content or path to .p8 file */
  privateKey: string;
  /** Your app's bundle identifier */
  bundleId: string;
  /**
   * DER-encoded Apple root certificates, or paths to those certificate files.
   * Required before signed Apple data can be verified.
   */
  appleRootCertificates?: ReadonlyArray<Buffer | string>;
  /** App Apple ID. Required by Apple when verifying production signed data. */
  appAppleId?: number;
  /** Enable certificate revocation and current-date checks. Default: true. */
  enableOnlineChecks?: boolean;
  /** Advanced dependency-injection hook for tests or custom verifier wrappers. */
  signedDataVerifierFactory?: (environment: StoreEnvironment) => StoreKitSignedDataVerifier;
  /** Advanced HTTP adapter hook. Defaults to an isolated Axios instance. */
  httpClient?: StoreKitHttpClient;
  /** Optional environment setting. If omitted, transaction reads try production and fall back to sandbox only for Apple error 4040010. */
  environment?: StoreEnvironment;
  /** Maximum retries in the same environment for network, rate-limit, and retryable server errors. Default: 2 */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (0 through 2147483647). Default: 250 */
  retryBaseDelayMs?: number;
  /** Maximum retry delay in milliseconds (0 through 2147483647). Default: 5000 */
  maxRetryDelayMs?: number;
  /** HTTP request timeout in milliseconds (1 through 2147483647). Default: 10000 */
  timeoutMs?: number;
}
