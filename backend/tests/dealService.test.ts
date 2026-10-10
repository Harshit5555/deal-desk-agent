import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors";
import { approve, getDeal, listDeals, proposeDiscount, reject } from "../src/services/dealService";
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
    const deal = approve("d-103", "Hana", "OK for the quarter end push");
    expect(deal.status).toBe("approved");
    expect(deal.approval?.decidedBy).toBe("Hana");
    expect(deal.approval?.comment).toBe("OK for the quarter end push");
  });

  it("rejects a pending deal", () => {
    const deal = reject("d-104", "Hana", "Too deep for this account");
    expect(deal.status).toBe("rejected");
  });

  it("cannot approve a deal that is not waiting for approval", () => {
    expect(() => approve("d-105", "Hana")).toThrow("Deal d-105 is not waiting for approval");
  });

  it("requires an approver name", () => {
    expect(() => approve("d-103", "")).toThrow(ValidationError);
  });
});
