import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function ActivityPage() {
  const [entries, setEntries] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api.state().then((state) => setEntries(state.audit ?? [])).catch((cause) => setError(cause.message)); }, []);
  return <div className="card">{error && <p className="auth-error" role="alert">{error}</p>}{entries.slice().reverse().map((entry, index) => <div className="list-row" key={`${entry.at ?? entry.createdAt ?? index}-${index}`}><div><b>{entry.action ?? "Activity"}</b><div className="muted">{entry.pluginId ?? entry.ownerId ?? "BusinessOS"}</div></div><small className="muted">{entry.at ?? entry.createdAt ?? ""}</small></div>)}{!entries.length && <div className="empty-state"><h2>No activity yet</h2><p>Actions, approvals, and imports will appear here with their provenance.</p></div>}</div>;
}
