import { useEffect, useState } from "react";
import { api, type Deal, type Policy } from "./api";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function ApprovalQueue() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [approver, setApprover] = useState("Hana");
  const [error, setError] = useState("");

  const load = () => api.pendingDeals().then(setDeals).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, action: "approve" | "reject") => {
    setError("");
    try {
      await api[action](id, approver);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Waiting for approval ({deals.length})</h2>
        <label>
          Deciding as
          <input value={approver} onChange={(e) => setApprover(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {deals.length === 0 ? (
        <p className="empty">Nothing is waiting for approval.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Owner</th>
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
                <td>{d.region}</td>
                <td className="num">{usd(d.amount)}</td>
                <td className="num">{d.discountPct}%</td>
                <td>{d.approval?.requiredLevel}</td>
                <td className="why">{d.approval?.reason}</td>
                <td className="actions">
                  <button onClick={() => decide(d.id, "approve")}>Approve</button>
                  <button className="secondary" onClick={() => decide(d.id, "reject")}>
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

function PolicyAdmin() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.getPolicy().then(setPolicy);
  }, []);

  if (!policy) return <p className="empty">Loading policy...</p>;

  const field = (key: keyof Policy, label: string) => (
    <label>
      {label}
      <input
        type="number"
        value={policy[key]}
        onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
      />
    </label>
  );

  const save = async () => {
    try {
      setPolicy(await api.savePolicy(policy));
      setMessage("Policy saved.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <section>
      <h2>Discount policy</h2>
      <div className="form">
        {field("managerApprovalAbovePct", "Manager approval above (%)")}
        {field("vpApprovalAbovePct", "VP approval above (%)")}
        {field("financeReviewAboveAmount", "Finance review above deal size (USD)")}
        <button onClick={save}>Save policy</button>
        {message && <p className="note">{message}</p>}
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
