import { getEffectivePolicy } from "./policyService";
import type { ApproverLevel, Deal, Evaluation } from "../types";

/** Levels a person can hold when deciding a deal. */
export const DECIDER_LEVELS = ["manager", "finance", "vp"] as const;

/** Seniority of each level. A person can approve deals at their own level or any level below it. */
const RANK: Record<ApproverLevel, number> = { none: 0, manager: 1, finance: 2, vp: 3 };

export function canApprove(approverLevel: ApproverLevel, requiredLevel: ApproverLevel): boolean {
  return RANK[approverLevel] >= RANK[requiredLevel];
}

export function isHigherLevel(level: ApproverLevel, than: ApproverLevel): boolean {
  return RANK[level] > RANK[than];
}

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
      policy,
    };
  }

  if (discountPct > policy.vpApprovalAbovePct) {
    return {
      decision: "needs_approval",
      requiredLevel: "vp",
      reason: `Discount ${discountPct}% exceeds VP threshold (${policy.vpApprovalAbovePct}%)`,
      policy,
    };
  }

  if (discountPct > policy.managerApprovalAbovePct) {
    return {
      decision: "needs_approval",
      requiredLevel: "manager",
      reason: `Discount ${discountPct}% exceeds manager threshold (${policy.managerApprovalAbovePct}%)`,
      policy,
    };
  }

  return {
    decision: "auto_approved",
    requiredLevel: "none",
    reason: `Discount ${discountPct}% is within rep authority (${policy.managerApprovalAbovePct}%)`,
    policy,
  };
}
