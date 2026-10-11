import { useEffect, useState } from "react";
import { api, type ApprovalQueue as Queue, type ApproverLevel, type Policy } from "./api";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const REGIONS = ["NA", "EMEA", "APAC", "LATAM"];

const LEVELS: { value: ApproverLevel; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "finance", label: "Finance" },
  { value: "vp", label: "VP" },
];

// Mirrors the backend ranking. The server is the authority; this only greys out buttons.
const RANK: Record<string, number> = { none: 0, manager: 1, finance: 2, vp: 3 };

function ApprovalQueue() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [region, setRegion] = useState("");
  const [team, setTeam] = useState("");
  const [approver, setApprover] = useState("Hana");
  const [approverLevel, setApproverLevel] = useState<ApproverLevel>("manager");
  const [error, setError] = useState("");

  const load = () =>
    api
      .queue({ region, team })
      .then(setQueue)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [region, team]);

  const deals = queue?.deals ?? [];
  // Keep the selected team listed even after its last pending deal is decided.
  const teams = queue ? [...new Set([...queue.teams, ...(team ? [team] : [])])].sort() : [];

  const canApprove = (requiredLevel = "none") => RANK[approverLevel] >= RANK[requiredLevel];

  const decide = async (id: string, action: "approve" | "reject") => {
    setError("");
    try {
      await api[action](id, approver, approverLevel);
    } catch (e) {
      setError((e as Error).message);
    }
    // Reload even on failure: a refused approval may have escalated the deal.
    await load();
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Waiting for approval</h2>
        <div className="filters">
          <label>
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deciding as
            <input value={approver} onChange={(e) => setApprover(e.target.value)} />
          </label>
          <label>
            Level
            <select value={approverLevel} onChange={(e) => setApproverLevel(e.target.value as ApproverLevel)}>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {queue && (
        <div className="summary">
          <div>
            <span className="summary-value">{queue.summary.count}</span>
            <span className="summary-label">deals waiting</span>
          </div>
          <div>
            <span className="summary-value">{usd(queue.summary.totalAmount)}</span>
            <span className="summary-label">list value waiting</span>
          </div>
          <div>
            <span className="summary-value">{usd(queue.summary.totalNetAmount)}</span>
            <span className="summary-label">after requested discounts</span>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {deals.length === 0 ? (
        <p className="empty">Nothing is waiting for approval.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Owner</th>
              <th>Team</th>
              <th>Region</th>
              <th className="num">Amount</th>
              <th className="num">Discount</th>
              <th>Needs</th>
              <th>Why</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td>{d.account}</td>
                <td>{d.owner}</td>
                <td>{d.team}</td>
                <td>{d.region}</td>
                <td className="num">{usd(d.amount)}</td>
                <td className="num">{d.discountPct}%</td>
                <td>
                  {d.approval?.requiredLevel}
                  {d.approval?.escalatedFrom && (
                    <span className="escalated">policy changed, was {d.approval.escalatedFrom}</span>
                  )}
                </td>
                <td className="why">{d.approval?.reason}</td>
                <td className="actions">
                  <button
                    onClick={() => decide(d.id, "approve")}
                    disabled={!canApprove(d.approval?.requiredLevel)}
                    title={canApprove(d.approval?.requiredLevel) ? undefined : `Needs ${d.approval?.requiredLevel} or above`}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary"
                    onClick={() => decide(d.id, "reject")}
                    disabled={!canApprove(d.approval?.requiredLevel)}
                    title={canApprove(d.approval?.requiredLevel) ? undefined : `Needs ${d.approval?.requiredLevel} or above`}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const POLICY_FIELDS: { key: keyof Policy; label: string; max?: number }[] = [
  { key: "managerApprovalAbovePct", label: "Manager approval above (%)", max: 100 },
  { key: "vpApprovalAbovePct", label: "VP approval above (%)", max: 100 },
  { key: "financeReviewAboveAmount", label: "Finance review above deal size (USD)" },
];

// Inputs hold the raw text so a field can be emptied and retyped; it is only
// converted to numbers on save. Converting on every keystroke turned "" into 0.
type PolicyDraft = Record<keyof Policy, string>;

const toDraft = (policy: Policy): PolicyDraft =>
  Object.fromEntries(POLICY_FIELDS.map(({ key }) => [key, String(policy[key])])) as PolicyDraft;

function PolicyAdmin() {
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    api.getPolicy().then((p) => setDraft(toDraft(p)));
  }, []);

  if (!draft) return <p className="empty">Loading policy...</p>;

  const save = async () => {
    const policy = {} as Policy;
    for (const { key, label } of POLICY_FIELDS) {
      const raw = draft[key].trim();
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) {
        setMessage({ text: `${label} must be a number.`, isError: true });
        return;
      }
      policy[key] = value;
    }
    try {
      setDraft(toDraft(await api.savePolicy(policy)));
      setMessage({ text: "Policy saved.", isError: false });
    } catch (e) {
      setMessage({ text: (e as Error).message, isError: true });
    }
  };

  return (
    <section>
      <h2>Discount policy</h2>
      <div className="form">
        {POLICY_FIELDS.map(({ key, label, max }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step="any"
              value={draft[key]}
              onChange={(e) => {
                setDraft({ ...draft, [key]: e.target.value });
                setMessage(null);
              }}
            />
          </label>
        ))}
        <button onClick={save}>Save policy</button>
        {message && <p className={message.isError ? "error" : "note"}>{message.text}</p>}
      </div>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState<"queue" | "policy">("queue");
  return (
    <main>
      <header>
        <h1>Deal Desk</h1>
        <nav>
          <button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}>
            Approval queue
          </button>
          <button className={tab === "policy" ? "active" : ""} onClick={() => setTab("policy")}>
            Policy
          </button>
        </nav>
      </header>
      {tab === "queue" ? <ApprovalQueue /> : <PolicyAdmin />}
    </main>
  );
}
