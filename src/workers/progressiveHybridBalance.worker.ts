/// <reference lib="webworker" />

import { progressiveHybridBalance } from '../utils/progressiveHybridBalance';
import type { BalancingWorkerInbound, BalancingWorkerOutbound } from './progressiveHybridBalance.worker.types';

self.onmessage = (event: MessageEvent<BalancingWorkerInbound>) => {
  const message = event.data;

  if (!message || message.type !== 'run') {
    return;
  }

  const { requestId, payload } = message;

  try {
    const result = progressiveHybridBalance(payload.rows, payload.subjectSettingsByName, payload.config);
    const response: BalancingWorkerOutbound = {
      type: 'success',
      requestId,
      result,
    };

    self.postMessage(response);
  } catch (error) {
    const response: BalancingWorkerOutbound = {
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'Ukjent feil i balanseringsarbeider',
    };

    self.postMessage(response);
  }
};

export {};
