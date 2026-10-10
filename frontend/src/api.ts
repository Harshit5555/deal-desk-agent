export interface Deal {
  id: string;
  account: string;
  owner: string;
  region: string;
  amount: number;
  discountPct: number;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  notes: string;
  approval: { requiredLevel: string; reason: string; decidedBy?: string; comment?: string } | null;
}

export interface Policy {
  managerApprovalAbovePct: number;
  vpApprovalAbovePct: number;
  financeReviewAboveAmount: number;
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
  pendingDeals: () => request<Deal[]>("/deals?status=pending_approval"),
  approve: (id: string, approver: string) =>
    request<Deal>(`/deals/${id}/approve`, { method: "POST", body: JSON.stringify({ approver }) }),
  reject: (id: string, approver: string) =>
    request<Deal>(`/deals/${id}/reject`, { method: "POST", body: JSON.stringify({ approver }) }),
  getPolicy: () => request<Policy>("/policy"),
  savePolicy: (policy: Policy) => request<Policy>("/policy", { method: "PUT", body: JSON.stringify(policy) }),
};
