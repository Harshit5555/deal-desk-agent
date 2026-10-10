import { getEffectivePolicy } from "./policyService";
import type { Deal, Evaluation } from "../types";

/**
 * Decides whether a requested discount can be approved automatically
 * or needs a human approver. Rules, from strictest to loosest:
 *   1. Deal over the finance limit AND discount over the manager threshold -> finance
 *   2. Discount over the VP threshold -> vp
 *   3. Discount over the manager threshold -> manager
 *   4. Otherwise -> auto approved
 */
export function evaluate(deal: Deal, discountPct: number): Evaluation {
  const policy = getEffectivePolicy();

  if (deal.amount > policy.financeReviewAboveAmount && discountPct > policy.managerApprovalAbovePct) {
    return {
      decision: "needs_approval",
      requiredLevel: "finance",
      reason: `Deal over $${policy.financeReviewAboveAmount.toLocaleString("en-US")} with discount ${discountPct}% above manager threshold (${policy.managerApprovalAbovePct}%)`,
    };
  }

  if (discountPct > policy.vpApprovalAbovePct) {
    return {
      decision: "needs_approval",
      requiredLevel: "vp",
      reason: `Discount ${discountPct}% exceeds VP threshold (${policy.vpApprovalAbovePct}%)`,
    };
  }

  if (discountPct > policy.managerApprovalAbovePct) {
    return {
      decision: "needs_approval",
      requiredLevel: "manager",
      reason: `Discount ${discountPct}% exceeds manager threshold (${policy.managerApprovalAbovePct}%)`,
    };
  }

  return {
    decision: "auto_approved",
    requiredLevel: "none",
    reason: `Discount ${discountPct}% is within rep authority (${policy.managerApprovalAbovePct}%)`,
  };
}
