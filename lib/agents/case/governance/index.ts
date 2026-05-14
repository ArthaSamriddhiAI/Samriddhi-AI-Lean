/* Governance gate re-exports for the Samriddhi 1 pipeline. */

export { runG1 } from "./g1-mandate";
export { runG2 } from "./g2-sebi";
export { runG3 } from "./g3-permission";
export {
  passResult,
  failResult,
  requiresClarificationResult,
  type GateResult,
  type GateStatus,
  type GateId,
} from "./types";
