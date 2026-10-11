export interface Deal {
  id: string;
  account: string;
  owner: string;
  team: string;
  region: string;
  amount: number;
  discountPct: number;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  notes: string;
  approval: {
    requiredLevel: string;
    reason: string;
    decidedBy?: string;
    decidedByLevel?: ApproverLevel;
    comment?: string;
    escalatedFrom?: string;
  } | null;
}

export type ApproverLevel = "manager" | "finance" | "vp";

export interface Policy {
  managerApprovalAbovePct: number;
  vpApprovalAbovePct: number;
  financeReviewAboveAmount: number;
}

export interface QueueFilters {
  region?: string;
  team?: string;
}

export interface ApprovalQueue {
  summary: { count: number; totalAmount: number; totalNetAmount: number };
  teams: string[];
  deals: Deal[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export const api = {
  queue: (filters: QueueFilters) => {
    const params = new URLSearchParams();
    if (filters.region) params.set("region", filters.region);
    if (filters.team) params.set("team", filters.team);
    const qs = params.toString();
    return request<ApprovalQueue>(`/queue${qs ? `?${qs}` : ""}`);
  },
  approve: (id: string, approver: string, approverLevel: ApproverLevel) =>
    request<Deal>(`/deals/${id}/approve`, { method: "POST", body: JSON.stringify({ approver, approverLevel }) }),
  reject: (id: string, approver: string, approverLevel: ApproverLevel) =>
    request<Deal>(`/deals/${id}/reject`, { method: "POST", body: JSON.stringify({ approver, approverLevel }) }),
  getPolicy: () => request<Policy>("/policy"),
  savePolicy: (policy: Policy) => request<Policy>("/policy", { method: "PUT", body: JSON.stringify(policy) }),
};
