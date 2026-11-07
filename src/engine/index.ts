import type { EngineApi } from '@contracts';
import {
  normalSide,
  rowTotals,
  computeBalances,
  checkEquation,
  trialBalance,
  orderColumns,
} from './core';
import { checkBooking, checkProblem, pickerAccounts } from './checker';
import { encodeState, decodeSandbox, decodeAttempt } from './urlState';

export const engine: EngineApi = {
  normalSide,
  rowTotals,
  computeBalances,
  checkEquation,
  trialBalance,
  orderColumns,
  checkBooking,
  checkProblem,
  pickerAccounts,
  encodeState,
  decodeSandbox,
  decodeAttempt,
};

export {
  normalSide,
  rowTotals,
  computeBalances,
  checkEquation,
  trialBalance,
  orderColumns,
  checkBooking,
  checkProblem,
  pickerAccounts,
  encodeState,
  decodeSandbox,
  decodeAttempt,
};
