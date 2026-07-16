export enum SendAttemptResult {
  SUCCESS = 'SUCCESS',
  TIMED_OUT = 'TIMED_OUT',
  TLS_ISSUE = 'TLS_ISSUE',
  CIRCULAR_REDIRECT = 'CIRCULAR_REDIRECT',
  NO_RESPONSE = 'NO_RESPONSE',
  SOCKET_ISSUE = 'SOCKET_ISSUE',
  UNSUPPORTED_CHARSET = 'UNSUPPORTED_CHARSET',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PREMATURE_CLOSE = 'PREMATURE_CLOSE',
  UNSUCCESSFUL_HTTP_RESPONSE_CODE = 'UNSUCCESSFUL_HTTP_RESPONSE_CODE',
  OTHER = 'OTHER'
}

export interface SendAttemptItem {
  attemptDate?: number;
  sendAttemptResult?: SendAttemptResult | string;
}

export interface NotificationHistoryRequest {
  startDate: number;
  endDate: number;
  notificationType?: NotificationTypeV2;
  notificationSubtype?: Subtype;
  transactionId?: string;
  onlyFailures?: boolean;
}

export interface NotificationHistoryResponseItem {
  signedPayload?: string;
  sendAttempts?: SendAttemptItem[];
}

export interface NotificationHistoryResponse {
  paginationToken?: string;
  hasMore?: boolean;
  notificationHistory?: NotificationHistoryResponseItem[];
}

export interface SendTestNotificationResponse {
  testNotificationToken?: string;
}

export interface CheckTestNotificationResponse {
  signedPayload?: string;
  sendAttempts?: SendAttemptItem[];
}
import type {
  NotificationTypeV2,
  Subtype
} from '@apple/app-store-server-library';

export { NotificationTypeV2, Subtype } from '@apple/app-store-server-library';
