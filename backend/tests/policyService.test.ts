import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/errors";
import { getPolicy, updatePolicy } from "../src/services/policyService";
import { resetStore } from "../src/store";

describe("policyService", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns the default policy", () => {
    expect(getPolicy()).toEqual({
      managerApprovalAbovePct: 10,
      vpApprovalAbovePct: 25,
      financeReviewAboveAmount: 100000,
    });
  });

  it("updates one threshold and leaves the others alone", () => {
    const updated = updatePolicy({ managerApprovalAbovePct: 8 });
    expect(updated.managerApprovalAbovePct).toBe(8);
    expect(updated.vpApprovalAbovePct).toBe(25);
    expect(getPolicy().managerApprovalAbovePct).toBe(8);
  });

  it("rejects a VP threshold below the manager threshold", () => {
    expect(() => updatePolicy({ vpApprovalAbovePct: 5 })).toThrow(ValidationError);
  });

  it("rejects thresholds over 100 percent", () => {
    expect(() => updatePolicy({ managerApprovalAbovePct: 120, vpApprovalAbovePct: 130 })).toThrow(ValidationError);
  });

  it("rejects negative values", () => {
    expect(() => updatePolicy({ financeReviewAboveAmount: -1 })).toThrow(ValidationError);
  });
});
