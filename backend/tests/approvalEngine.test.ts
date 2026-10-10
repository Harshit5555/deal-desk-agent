import { beforeEach, describe, expect, it } from "vitest";
import { evaluate } from "../src/services/approvalEngine";
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
});
