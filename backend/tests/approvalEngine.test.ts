import { beforeEach, describe, expect, it } from "vitest";
import { canApprove, evaluate } from "../src/services/approvalEngine";
import { updatePolicy } from "../src/services/policyService";
import { dealStore, resetStore } from "../src/store";

describe("approvalEngine.evaluate", () => {
  beforeEach(() => {
    resetStore();
  });

  it("auto approves a discount at exactly the manager threshold", () => {
    const deal = dealStore.get("d-105")!; // $22,000
    const result = evaluate(deal, 10);
    expect(result.decision).toBe("auto_approved");
    expect(result.requiredLevel).toBe("none");
  });

  it("asks for a manager just above the manager threshold", () => {
    const deal = dealStore.get("d-105")!;
    const result = evaluate(deal, 10.5);
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredLevel).toBe("manager");
    expect(result.reason).toBe("Discount 10.5% exceeds manager threshold (10%)");
  });

  it("keeps a manager as the approver at exactly the VP threshold", () => {
    const deal = dealStore.get("d-105")!;
    expect(evaluate(deal, 25).requiredLevel).toBe("manager");
  });

  it("asks for a VP above the VP threshold", () => {
    const deal = dealStore.get("d-105")!;
    const result = evaluate(deal, 26);
    expect(result.requiredLevel).toBe("vp");
    expect(result.reason).toBe("Discount 26% exceeds VP threshold (25%)");
  });

  it("asks for finance on a large deal discounted past the manager threshold", () => {
    const deal = dealStore.get("d-107")!; // $210,000
    const result = evaluate(deal, 15);
    expect(result.requiredLevel).toBe("finance");
  });

  it("does not need finance on a large deal with a small discount", () => {
    const deal = dealStore.get("d-107")!;
    expect(evaluate(deal, 5).decision).toBe("auto_approved");
  });

  describe("canApprove", () => {
    it.each([
      ["manager", "manager", true],
      ["manager", "finance", false],
      ["manager", "vp", false],
      ["finance", "manager", true],
      ["finance", "finance", true],
      ["finance", "vp", false],
      ["vp", "manager", true],
      ["vp", "finance", true],
      ["vp", "vp", true],
    ] as const)("a %s approving a %s deal -> %s", (approver, required, expected) => {
      expect(canApprove(approver, required)).toBe(expected);
    });
  });

  describe("after the policy is changed", () => {
    it("applies a lowered manager threshold to the next discount", () => {
      const deal = dealStore.get("d-105")!; // $22,000
      expect(evaluate(deal, 7).decision).toBe("auto_approved");

      updatePolicy({ managerApprovalAbovePct: 5 });

      const result = evaluate(deal, 7);
      expect(result.decision).toBe("needs_approval");
      expect(result.requiredLevel).toBe("manager");
      expect(result.reason).toBe("Discount 7% exceeds manager threshold (5%)");
    });

    it("applies a lowered finance limit to the next discount", () => {
      const deal = dealStore.get("d-106")!; // $90,000
      expect(evaluate(deal, 14).requiredLevel).toBe("manager");

      updatePolicy({ financeReviewAboveAmount: 50000 });

      expect(evaluate(deal, 14).requiredLevel).toBe("finance");
    });

    it("returns the policy it used", () => {
      updatePolicy({ managerApprovalAbovePct: 5 });
      const result = evaluate(dealStore.get("d-105")!, 7);
      expect(result.policy).toEqual({
        managerApprovalAbovePct: 5,
        vpApprovalAbovePct: 25,
        financeReviewAboveAmount: 100000,
      });
    });
  });
});
