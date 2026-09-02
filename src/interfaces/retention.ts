import { SendAttemptResult } from './notification';

export enum RetentionImageSize {
  FULL_SIZE = 'FULL_SIZE',
  BULLET_POINT = 'BULLET_POINT'
}

export enum RetentionAssetState {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum RetentionHeaderPosition {
  ABOVE_BODY = 'ABOVE_BODY',
  ABOVE_IMAGE = 'ABOVE_IMAGE'
}

export interface RetentionImageListItem {
  imageIdentifier?: string;
  imageState?: RetentionAssetState | string;
  imageSize?: RetentionImageSize | string;
}

export interface RetentionImageListResponse {
  imageIdentifiers?: RetentionImageListItem[];
}

export interface RetentionMessageImage {
  imageIdentifier: string;
  altText: string;
}

export interface RetentionBulletPoint {
  text: string;
  imageIdentifier: string;
  altText: string;
}

export interface UploadRetentionMessageRequest {
  header: string;
  body: string;
  image?: RetentionMessageImage;
  headerPosition?: RetentionHeaderPosition;
  bulletPoints?: RetentionBulletPoint[];
}

export interface RetentionMessageListItem {
  messageIdentifier?: string;
  messageState?: RetentionAssetState | string;
}

export interface RetentionMessageListResponse {
  messageIdentifiers?: RetentionMessageListItem[];
}

export interface DefaultRetentionMessageRequest {
  messageIdentifier: string;
}

export interface DefaultRetentionMessageResponse {
  messageIdentifier: string;
}

export interface RetentionRealtimeUrlRequest {
  realtimeURL: string;
}

export interface RetentionRealtimeUrlResponse {
  realtimeURL: string;
}

export interface RetentionPerformanceTestRequest {
  originalTransactionId: string;
}

export interface RetentionPerformanceTestConfig {
  maxConcurrentRequests: number;
  totalRequests: number;
  totalDuration: number;
  responseTimeThreshold: number;
  successRateThreshold: number;
}

export interface RetentionPerformanceTestResponse {
  config: RetentionPerformanceTestConfig;
  requestId: string;
}

export interface RetentionPerformanceResponseTimes {
  average: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export enum RetentionPerformanceTestStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL'
}

export interface RetentionPerformanceTestResultResponse {
  config: RetentionPerformanceTestConfig;
  target: string;
  result: RetentionPerformanceTestStatus | string;
  successRate: number;
  numPending: number;
  responseTimes: RetentionPerformanceResponseTimes;
  failures: Partial<Record<string, number>>;
}
