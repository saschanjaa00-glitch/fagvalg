import type { StandardField } from '../utils/excelUtils';
import type {
  BalancingConfig,
  ProgressiveHybridBalanceResult,
  SubjectSettingsByNameLike,
} from '../utils/progressiveHybridBalance';

export interface BalancingWorkerRunPayload {
  rows: StandardField[];
  subjectSettingsByName: SubjectSettingsByNameLike;
  config: Partial<BalancingConfig>;
}

export interface BalancingWorkerRunRequest {
  type: 'run';
  requestId: number;
  payload: BalancingWorkerRunPayload;
}

export interface BalancingWorkerSuccessResponse {
  type: 'success';
  requestId: number;
  result: ProgressiveHybridBalanceResult;
}

export interface BalancingWorkerErrorResponse {
  type: 'error';
  requestId: number;
  message: string;
}

export type BalancingWorkerInbound = BalancingWorkerRunRequest;
export type BalancingWorkerOutbound = BalancingWorkerSuccessResponse | BalancingWorkerErrorResponse;
