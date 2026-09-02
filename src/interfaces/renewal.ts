export enum ExtendReasonCode {
  UNDECLARED = 0,
  CUSTOMER_SATISFACTION = 1,
  OTHER = 2,
  SERVICE_ISSUE_OR_OUTAGE = 3
}

export interface ExtendRenewalDateRequest {
  extendByDays: number;
  extendReasonCode: ExtendReasonCode;
  requestIdentifier: string;
}

export interface ExtendRenewalDateResponse {
  originalTransactionId?: string;
  webOrderLineItemId?: string;
  success?: boolean;
  effectiveDate?: number;
}

export interface MassExtendRenewalDateRequest extends ExtendRenewalDateRequest {
  productId: string;
  storefrontCountryCodes?: string[];
}

export interface MassExtendRenewalDateResponse {
  requestIdentifier?: string;
}

export interface MassExtendRenewalDateStatusResponse {
  requestIdentifier?: string;
  complete?: boolean;
  completeDate?: number;
  succeededCount?: number;
  failedCount?: number;
}
