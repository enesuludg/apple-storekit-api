import {
  AppleStoreKit,
  AppleStoreKitConfig,
  TransactionInfo
} from 'apple-storekit-api';
import { AccountTenure } from 'apple-storekit-api/dist/interfaces';
import type { ConsumptionRequest } from 'apple-storekit-api/dist/interfaces/consumption.js';
import { BaseService } from 'apple-storekit-api/dist/services/base.service';
import { TransactionService } from 'apple-storekit-api/dist/services/transaction.service.js';

declare const config: AppleStoreKitConfig;
declare const consumption: ConsumptionRequest;
declare const transaction: TransactionInfo;

const client = new AppleStoreKit(config);
const baseService = new BaseService(config);
const transactionService = new TransactionService(config);
const tenure: AccountTenure = AccountTenure.DAYS_0_3;

void client;
void baseService;
void consumption;
void transactionService;
void tenure;
transaction.transactionId?.toString();
