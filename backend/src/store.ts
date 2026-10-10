import type { Deal, Policy } from "./types";
import { DEFAULT_POLICY, SEED_DEALS } from "./seed";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

let deals = new Map<string, Deal>();
let policy: Policy = clone(DEFAULT_POLICY);

export function resetStore(): void {
  deals = new Map(SEED_DEALS.map((d) => [d.id, clone(d)]));
  policy = clone(DEFAULT_POLICY);
}

resetStore();

export const dealStore = {
  get(id: string): Deal | undefined {
    const deal = deals.get(id);
    return deal ? clone(deal) : undefined;
  },

  list(): Deal[] {
    return Array.from(deals.values()).map(clone);
  },

  /** Merge a partial patch into an existing deal and return the result. */
  update(id: string, patch: Partial<Deal>): Deal {
    const existing = deals.get(id);
    if (!existing) throw new Error(`Deal ${id} not found`);
    const merged: Deal = { ...existing, ...patch };
    deals.set(id, merged);
    return clone(merged);
  },
};

export const policyStore = {
  get(): Policy {
    return clone(policy);
  },

  set(next: Policy): Policy {
    policy = clone(next);
    return clone(policy);
  },
};
