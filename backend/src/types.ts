export type Region = "NA" | "EMEA" | "APAC" | "LATAM";

export type DealStatus = "draft" | "pending_approval" | "approved" | "rejected";

export type ApproverLevel = "none" | "manager" | "vp" | "finance";

export interface Approval {
  requiredLevel: ApproverLevel;
  reason: string;
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
}

export interface Deal {
  id: string;
  account: string;
  owner: string;
  region: Region;
  /** List price of the deal in USD, before any discount. */
  amount: number;
  /** Discount requested on the deal, as a percentage (e.g. 12 means 12%). */
  discountPct: number;
  status: DealStatus;
  /** Free text typed by the sales rep or pasted from the customer's email. */
  notes: string;
  approval: Approval | null;
}

export interface Policy {
  /** Discounts ABOVE this percentage need a manager. */
  managerApprovalAbovePct: number;
  /** Discounts ABOVE this percentage need a VP. */
  vpApprovalAbovePct: number;
  /** Deals ABOVE this amount (USD) that are also discounted past the manager threshold need finance. */
  financeReviewAboveAmount: number;
}

export interface Evaluation {
  decision: "auto_approved" | "needs_approval";
  requiredLevel: ApproverLevel;
  reason: string;
}
