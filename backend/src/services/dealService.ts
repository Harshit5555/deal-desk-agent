import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { dealStore } from "../store";
import type { Deal, DealStatus } from "../types";
import { evaluate } from "./approvalEngine";

export interface DealFilters {
  status?: DealStatus;
}

export function listDeals(filters: DealFilters = {}): Deal[] {
  let deals = dealStore.list();
  if (filters.status) {
    deals = deals.filter((d) => d.status === filters.status);
  }
  return deals;
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
      },
    });
  }

  return dealStore.update(id, {
    discountPct,
    status: "pending_approval",
    approval: {
      requiredLevel: evaluation.requiredLevel,
      reason: evaluation.reason,
    },
  });
}

export function approve(id: string, approver: string, comment?: string): Deal {
  return decide(id, "approved", approver, comment);
}

export function reject(id: string, approver: string, comment?: string): Deal {
  return decide(id, "rejected", approver, comment);
}

function decide(id: string, status: "approved" | "rejected", approver: string, comment?: string): Deal {
  const deal = getDeal(id);
  if (!approver || typeof approver !== "string") {
    throw new ValidationError("approver is required");
  }
  if (deal.status !== "pending_approval" || !deal.approval) {
    throw new ConflictError(`Deal ${id} is not waiting for approval`);
  }
  return dealStore.update(id, {
    status,
    approval: {
      ...deal.approval,
      decidedBy: approver,
      decidedAt: new Date().toISOString(),
      comment,
    },
  });
}
