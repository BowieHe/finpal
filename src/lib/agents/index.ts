/**
 * Sub-Agents — Barrel Export
 */

// Types
export type {
  DBAgentInput,
  DBAgentOutput,
  DBAgentTask,
  WebAgentInput,
  WebAgentOutput,
  WebAgentTask,
  QuantAgentInput,
  QuantAgentOutput,
  AgentTask,
  ExecutionPlan,
} from './types';

// Agent functions
export { dbAgent } from './db-agent';
export { webAgent } from './web-agent';
export { quantAgent } from './quant-agent';

// Quant math utilities (for reuse in comparison.ts, risk.ts, etc.)
export {
  calcAnnualizedVolatility,
  calcMaxDrawdown,
  calcAnnualReturn,
  calcSharpeRatio,
  calcCalmarRatio,
} from './quant-agent';
