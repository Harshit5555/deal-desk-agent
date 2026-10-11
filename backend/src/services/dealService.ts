import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { dealStore } from "../store";
import { REGIONS, type Approval, type ApproverLevel, type Deal, type DealStatus, type Region } from "../types";
import { DECIDER_LEVELS, canApprove, evaluate, isHigherLevel } from "./approvalEngine";

export interface DealFilters {
  status?: DealStatus;
  region?: Region;
  team?: string;
}

export interface ReviewCandidate {
  deal: Deal;
  wouldNowRequire: ApproverLevel;
  reason: string;
}

export interface QueueSummary {
  count: number;
  /** Sum of list prices, before discount. */
  totalAmount: number;
  /** Sum of prices after the requested discount, i.e. what the customer would pay. */
  totalNetAmount: number;
}

export interface ApprovalQueue {
  summary: QueueSummary;
  /** Teams that have at least one pending deal, ignoring the current filter. */
  teams: string[];
  deals: Deal[];
}

export function listDeals(filters: DealFilters = {}): Deal[] {
  if (filters.region && !REGIONS.includes(filters.region)) {
    throw new ValidationError(`region must be one of ${REGIONS.join(", ")}`);
  }
  let deals = dealStore.list();
  if (filters.status) {
    deals = deals.filter((d) => d.status === filters.status);
  }
  if (filters.region) {
    deals = deals.filter((d) => d.region === filters.region);
  }
  if (filters.team) {
    deals = deals.filter((d) => d.team === filters.team);
  }
  return deals;
}

const netAmount = (deal: Deal) => deal.amount - (deal.amount * deal.discountPct) / 100;
const roundToCents = (n: number) => Math.round(n * 100) / 100;

/** Deals waiting for approval, biggest list amount first, with totals for the filtered view. */
export function getApprovalQueue(filters: Omit<DealFilters, "status"> = {}): ApprovalQueue {
  const deals = listDeals({ ...filters, status: "pending_approval" }).sort(
    (a, b) => b.amount - a.amount || a.id.localeCompare(b.id),
  );
  const teams = [...new Set(listDeals({ status: "pending_approval" }).map((d) => d.team))].sort();

  return {
    summary: {
      count: deals.length,
      totalAmount: deals.reduce((sum, d) => sum + d.amount, 0),
      totalNetAmount: roundToCents(deals.reduce((sum, d) => sum + netAmount(d), 0)),
    },
    teams,
    deals,
  };
}

/**
 * Deals the agent auto approved that the current policy would send to an
 * approver. Read only: flagged deals are reported, not reopened.
 */
export function listAutoApprovalsNeedingReview(): ReviewCandidate[] {
  return dealStore
    .list()
    .filter((d) => d.status === "approved" && d.approval?.decidedBy === "agent")
    .map((deal) => ({ deal, evaluation: evaluate(deal, deal.discountPct) }))
    .filter(({ evaluation }) => evaluation.decision === "needs_approval")
    .map(({ deal, evaluation }) => ({
      deal,
      wouldNowRequire: evaluation.requiredLevel,
      reason: evaluation.reason,
    }));
}

export function getDeal(id: string): Deal {
  const deal = dealStore.get(id);
  if (!deal) throw new NotFoundError(`Deal ${id} not found`);
  return deal;
}

/**
 * The "agent" step: a rep (or the AI assistant on their behalf) proposes a
 * discount. Small discounts are approved on the spot, larger ones wait in
 * the approval queue.
 */
export function proposeDiscount(id: string, discountPct: number): Deal {
  const deal = getDeal(id);

  if (typeof discountPct !== "number" || Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
    throw new ValidationError("discountPct must be a number between 0 and 100");
  }
  if (deal.status === "approved" || deal.status === "rejected") {
    throw new ConflictError(`Deal ${id} is already ${deal.status}`);
  }

  const evaluation = evaluate(deal, discountPct);

  if (evaluation.decision === "auto_approved") {
    return dealStore.update(id, {
      discountPct,
      status: "approved",
      approval: {
        requiredLevel: "none",
        reason: evaluation.reason,
        decidedBy: "agent",
        decidedAt: new Date().toISOString(),
        policyApplied: evaluation.policy,
      },
    });
  }

  return dealStore.update(id, {
    discountPct,
    status: "pending_approval",
    approval: {
      requiredLevel: evaluation.requiredLevel,
      reason: evaluation.reason,
      policyApplied: evaluation.policy,
    },
  });
}

export function approve(id: string, approver: string, approverLevel: ApproverLevel, comment?: string): Deal {
  return decide(id, "approved", approver, approverLevel, comment);
}

export function reject(id: string, approver: string, approverLevel: ApproverLevel, comment?: string): Deal {
  return decide(id, "rejected", approver, approverLevel, comment);
}

/**
 * Approving and rejecting follow the same rules. The deal is first re-checked
 * against the current policy: if a policy change since submission means it now
 * needs a more senior level, the deal is escalated (and stays escalated even if
 * this decision is refused). The decider must be at the required level or above.
 */
function decide(
  id: string,
  status: "approved" | "rejected",
  approver: string,
  approverLevel: ApproverLevel,
  comment?: string,
): Deal {
  const deal = getPendingDeal(id, approver, approverLevel);
  const approval = recheckAgainstCurrentPolicy(deal);

  if (approval !== deal.approval) {
    dealStore.update(id, { approval });
  }
  if (!canApprove(approverLevel, approval.requiredLevel)) {
    const why = approval.escalatedFrom
      ? `The policy changed after this deal was submitted, so it now needs ${approval.requiredLevel} approval (${approval.reason}).`
      : `Deal ${id} needs ${approval.requiredLevel} approval.`;
    const action = status === "approved" ? "approve" : "reject";
    throw new ForbiddenError(`${why} A ${approverLevel} cannot ${action} it.`);
  }

  return dealStore.update(id, {
    status,
    approval: { ...approval, ...decision(approver, approverLevel, comment) },
  });
}

type PendingDeal = Deal & { approval: Approval };

function getPendingDeal(id: string, approver: string, approverLevel: ApproverLevel): PendingDeal {
  const deal = getDeal(id);
  if (!approver || typeof approver !== "string") {
    throw new ValidationError("approver is required");
  }
  if (!(DECIDER_LEVELS as readonly string[]).includes(approverLevel)) {
    throw new ValidationError(`approverLevel must be one of ${DECIDER_LEVELS.join(", ")}`);
  }
  if (deal.status !== "pending_approval" || !deal.approval) {
    throw new ConflictError(`Deal ${id} is not waiting for approval`);
  }
  return deal as PendingDeal;
}

/**
 * Returns the deal's approval, raised to a more senior level if the current
 * policy demands one. Never lowers the level: a looser policy does not
 * shortcut a review that was already requested.
 */
function recheckAgainstCurrentPolicy(deal: PendingDeal): Approval {
  const current = evaluate(deal, deal.discountPct);
  if (!isHigherLevel(current.requiredLevel, deal.approval.requiredLevel)) {
    return deal.approval;
  }
  return {
    ...deal.approval,
    requiredLevel: current.requiredLevel,
    reason: current.reason,
    policyApplied: current.policy,
    escalatedFrom: deal.approval.escalatedFrom ?? deal.approval.requiredLevel,
  };
}

function decision(approver: string, approverLevel: ApproverLevel, comment?: string) {
  return {
    decidedBy: approver,
    decidedByLevel: approverLevel,
    decidedAt: new Date().toISOString(),
    comment,
  };
}
