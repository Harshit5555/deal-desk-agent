import { ValidationError } from "../errors";
import { policyStore } from "../store";
import type { Policy } from "../types";

/** The policy as shown on the admin screen. */
export function getPolicy(): Policy {
  return policyStore.get();
}

/**
 * The policy the approval engine applies to new discount requests.
 * Must always match what the admin screen shows, so it is read from the
 * store on every call and never cached.
 */
export function getEffectivePolicy(): Policy {
  return policyStore.get();
}

export function updatePolicy(patch: Partial<Policy>): Policy {
  const next: Policy = { ...policyStore.get(), ...patch };

  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
      throw new ValidationError(`${key} must be a non-negative number`);
    }
  }
  if (next.managerApprovalAbovePct > 100 || next.vpApprovalAbovePct > 100) {
    throw new ValidationError("Discount thresholds cannot exceed 100%");
  }
  if (next.vpApprovalAbovePct < next.managerApprovalAbovePct) {
    throw new ValidationError("VP threshold cannot be lower than the manager threshold");
  }

  return policyStore.set(next);
}
