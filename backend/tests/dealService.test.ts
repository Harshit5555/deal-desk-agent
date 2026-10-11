import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/errors";
import {
  approve,
  getApprovalQueue,
  getDeal,
  listAutoApprovalsNeedingReview,
  listDeals,
  proposeDiscount,
  reject,
} from "../src/services/dealService";
import { updatePolicy } from "../src/services/policyService";
import { resetStore } from "../src/store";

describe("dealService", () => {
  beforeEach(() => {
    resetStore();
  });

  it("lists every deal when no filter is given", () => {
    expect(listDeals()).toHaveLength(10);
  });

  it("filters the list by status", () => {
    const pending = listDeals({ status: "pending_approval" });
    expect(pending.map((d) => d.id).sort()).toEqual(["d-102", "d-103", "d-104", "d-106", "d-107"]);
  });

  it("throws NotFoundError for an unknown deal", () => {
    expect(() => getDeal("nope")).toThrow(NotFoundError);
  });

  it("auto approves a small discount and records the agent as decider", () => {
    const deal = proposeDiscount("d-105", 6);
    expect(deal.status).toBe("approved");
    expect(deal.discountPct).toBe(6);
    expect(deal.approval?.decidedBy).toBe("agent");
  });

  it("sends a larger discount to the approval queue", () => {
    const deal = proposeDiscount("d-105", 15);
    expect(deal.status).toBe("pending_approval");
    expect(deal.approval?.requiredLevel).toBe("manager");
    expect(deal.approval?.decidedBy).toBeUndefined();
  });

  it("rejects a discount outside 0 to 100", () => {
    expect(() => proposeDiscount("d-105", 140)).toThrow(ValidationError);
    expect(() => proposeDiscount("d-105", -1)).toThrow(ValidationError);
  });

  it("does not let you re-propose a discount on an approved deal", () => {
    expect(() => proposeDiscount("d-101", 5)).toThrow(ConflictError);
  });

  it("approves a pending deal and records who decided", () => {
    const deal = approve("d-103", "Hana", "manager", "OK for the quarter end push");
    expect(deal.status).toBe("approved");
    expect(deal.approval?.decidedBy).toBe("Hana");
    expect(deal.approval?.decidedByLevel).toBe("manager");
    expect(deal.approval?.comment).toBe("OK for the quarter end push");
  });

  it("rejects a pending deal", () => {
    const deal = reject("d-104", "Hana", "vp", "Too deep for this account");
    expect(deal.status).toBe("rejected");
  });

  it("cannot approve a deal that is not waiting for approval", () => {
    expect(() => approve("d-105", "Hana", "manager")).toThrow("Deal d-105 is not waiting for approval");
  });

  it("requires an approver name", () => {
    expect(() => approve("d-103", "", "manager")).toThrow(ValidationError);
  });

  it("requires a valid approver level", () => {
    expect(() => approve("d-103", "Hana", "ceo" as never)).toThrow(ValidationError);
    expect(() => approve("d-103", "Hana", "none")).toThrow(ValidationError);
    expect(() => reject("d-103", "Hana", undefined as never)).toThrow(ValidationError);
  });

  describe("who can approve or reject what", () => {
    // Seed: d-103 needs manager, d-102 needs finance, d-104 needs vp.
    it("lets a manager approve manager deals only", () => {
      expect(approve("d-103", "Hana", "manager").status).toBe("approved");
      expect(() => approve("d-102", "Hana", "manager")).toThrow(ForbiddenError);
      expect(() => approve("d-104", "Hana", "manager")).toThrow(ForbiddenError);
    });

    it("lets finance approve finance and manager deals, but not VP deals", () => {
      expect(approve("d-102", "Fin", "finance").status).toBe("approved");
      expect(approve("d-103", "Fin", "finance").status).toBe("approved");
      expect(() => approve("d-104", "Fin", "finance")).toThrow("Deal d-104 needs vp approval. A finance cannot approve it.");
    });

    it("lets a VP approve VP, finance and manager deals", () => {
      expect(approve("d-104", "Vic", "vp").status).toBe("approved");
      expect(approve("d-102", "Vic", "vp").status).toBe("approved");
      expect(approve("d-103", "Vic", "vp").status).toBe("approved");
    });

    it("leaves a refused deal waiting in the queue", () => {
      expect(() => approve("d-104", "Hana", "manager")).toThrow(ForbiddenError);
      expect(getDeal("d-104").status).toBe("pending_approval");
      expect(getDeal("d-104").approval?.decidedBy).toBeUndefined();
    });

    it("applies the same levels to rejecting as to approving", () => {
      expect(() => reject("d-104", "Hana", "manager")).toThrow("Deal d-104 needs vp approval. A manager cannot reject it.");
      expect(() => reject("d-104", "Fin", "finance")).toThrow(ForbiddenError);
      expect(() => reject("d-102", "Hana", "manager")).toThrow(ForbiddenError);
      expect(getDeal("d-104").status).toBe("pending_approval");

      expect(reject("d-102", "Fin", "finance").status).toBe("rejected");
      expect(reject("d-104", "Vic", "vp").status).toBe("rejected");
      expect(reject("d-103", "Vic", "vp").approval?.decidedByLevel).toBe("vp");
    });
  });

  describe("re-check against the current policy when deciding", () => {
    it("escalates a manager deal to VP after the VP threshold is lowered", () => {
      // d-106: $90,000 at 14%, submitted when the VP threshold was 25%.
      updatePolicy({ managerApprovalAbovePct: 10, vpApprovalAbovePct: 12 });

      expect(() => approve("d-106", "Hana", "manager")).toThrow(
        "The policy changed after this deal was submitted, so it now needs vp approval (Discount 14% exceeds VP threshold (12%)). A manager cannot approve it.",
      );

      const escalated = getDeal("d-106");
      expect(escalated.status).toBe("pending_approval");
      expect(escalated.approval?.requiredLevel).toBe("vp");
      expect(escalated.approval?.escalatedFrom).toBe("manager");
      expect(escalated.approval?.reason).toBe("Discount 14% exceeds VP threshold (12%)");
      expect(escalated.approval?.policyApplied?.vpApprovalAbovePct).toBe(12);

      const approved = approve("d-106", "Vic", "vp");
      expect(approved.status).toBe("approved");
      expect(approved.approval?.escalatedFrom).toBe("manager");
    });

    it("escalates a manager deal to finance after the finance limit is lowered", () => {
      updatePolicy({ financeReviewAboveAmount: 50000 });

      expect(() => approve("d-106", "Hana", "manager")).toThrow(ForbiddenError);
      expect(getDeal("d-106").approval?.requiredLevel).toBe("finance");
      expect(approve("d-106", "Fin", "finance").status).toBe("approved");
    });

    it("approves straight away when the approver already outranks the new level", () => {
      updatePolicy({ vpApprovalAbovePct: 12 });
      const deal = approve("d-106", "Vic", "vp");
      expect(deal.status).toBe("approved");
      expect(deal.approval?.requiredLevel).toBe("vp");
      expect(deal.approval?.escalatedFrom).toBe("manager");
    });

    it("never lowers the level when the policy is loosened", () => {
      // d-103 is 12%; raising the manager threshold to 15% would auto approve it today.
      updatePolicy({ managerApprovalAbovePct: 15 });
      const deal = approve("d-103", "Hana", "manager");
      expect(deal.approval?.requiredLevel).toBe("manager");
      expect(deal.approval?.escalatedFrom).toBeUndefined();
    });

    it("escalates on reject too, and refuses a decider who is no longer senior enough", () => {
      updatePolicy({ vpApprovalAbovePct: 12 });

      expect(() => reject("d-106", "Hana", "manager")).toThrow(
        "The policy changed after this deal was submitted, so it now needs vp approval (Discount 14% exceeds VP threshold (12%)). A manager cannot reject it.",
      );
      expect(getDeal("d-106").approval?.requiredLevel).toBe("vp");

      const rejected = reject("d-106", "Vic", "vp");
      expect(rejected.status).toBe("rejected");
      expect(rejected.approval?.escalatedFrom).toBe("manager");
    });
  });

  it("records the policy applied to an auto approved discount", () => {
    const deal = proposeDiscount("d-105", 6);
    expect(deal.approval?.policyApplied).toEqual({
      managerApprovalAbovePct: 10,
      vpApprovalAbovePct: 25,
      financeReviewAboveAmount: 100000,
    });
  });

  it("records the policy applied to a discount sent for approval", () => {
    updatePolicy({ managerApprovalAbovePct: 5 });
    const deal = proposeDiscount("d-105", 7);
    expect(deal.status).toBe("pending_approval");
    expect(deal.approval?.policyApplied?.managerApprovalAbovePct).toBe(5);
  });

  it("keeps the recorded policy when an approver decides", () => {
    proposeDiscount("d-110", 15);
    const deal = approve("d-110", "Hana", "manager");
    expect(deal.approval?.policyApplied?.managerApprovalAbovePct).toBe(10);
  });

  it("filters the list by region and team", () => {
    expect(listDeals({ region: "EMEA" }).map((d) => d.id).sort()).toEqual(["d-101", "d-106"]);
    expect(listDeals({ status: "pending_approval", team: "Commercial" }).map((d) => d.id)).toEqual(["d-104"]);
  });

  describe("getApprovalQueue", () => {
    it("returns pending deals biggest first", () => {
      const queue = getApprovalQueue();
      expect(queue.deals.map((d) => d.id)).toEqual(["d-107", "d-102", "d-106", "d-104", "d-103"]);
    });

    it("summarises how many deals and how much money are waiting", () => {
      expect(getApprovalQueue().summary).toEqual({
        count: 5,
        totalAmount: 531000,
        totalNetAmount: 426030,
      });
    });

    it("filters by region and the summary follows the filter", () => {
      const queue = getApprovalQueue({ region: "NA" });
      expect(queue.deals.map((d) => d.id)).toEqual(["d-107", "d-102", "d-103"]);
      expect(queue.summary).toEqual({ count: 3, totalAmount: 366000, totalNetAmount: 293880 });
    });

    it("filters by team", () => {
      const queue = getApprovalQueue({ team: "Enterprise" });
      expect(queue.deals.map((d) => d.id)).toEqual(["d-107", "d-102", "d-106", "d-103"]);
    });

    it("combines region and team filters", () => {
      expect(getApprovalQueue({ region: "EMEA", team: "Enterprise" }).deals.map((d) => d.id)).toEqual(["d-106"]);
    });

    it("returns an empty queue with a zero summary when nothing matches", () => {
      const queue = getApprovalQueue({ region: "LATAM" });
      expect(queue.deals).toEqual([]);
      expect(queue.summary).toEqual({ count: 0, totalAmount: 0, totalNetAmount: 0 });
    });

    it("lists the teams with pending deals, regardless of the filter", () => {
      expect(getApprovalQueue({ team: "Commercial" }).teams).toEqual(["Commercial", "Enterprise"]);
    });

    it("drops deals from the queue once they are decided", () => {
      approve("d-107", "Fin", "finance");
      const queue = getApprovalQueue();
      expect(queue.deals.map((d) => d.id)).not.toContain("d-107");
      expect(queue.summary.count).toBe(4);
    });

    it("rejects an unknown region", () => {
      expect(() => getApprovalQueue({ region: "MARS" as never })).toThrow(ValidationError);
    });
  });

  describe("listAutoApprovalsNeedingReview", () => {
    it("returns nothing while the policy is unchanged", () => {
      expect(listAutoApprovalsNeedingReview()).toEqual([]);
    });

    it("flags auto approvals that the current policy would send to an approver", () => {
      updatePolicy({ managerApprovalAbovePct: 5 });

      const flagged = listAutoApprovalsNeedingReview();

      // d-101 (8%) is flagged; d-108 (exactly 5%) is not, since "above" is strict.
      expect(flagged.map((f) => f.deal.id)).toEqual(["d-101"]);
      expect(flagged[0].wouldNowRequire).toBe("manager");
      expect(flagged[0].reason).toBe("Discount 8% exceeds manager threshold (5%)");
    });

    it("ignores deals a person approved", () => {
      approve("d-103", "Hana", "manager"); // 12%, approved by a manager
      updatePolicy({ managerApprovalAbovePct: 5 });

      expect(listAutoApprovalsNeedingReview().map((f) => f.deal.id)).not.toContain("d-103");
    });
  });
});
