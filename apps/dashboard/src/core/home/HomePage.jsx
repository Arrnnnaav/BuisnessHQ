import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function HomePage() {
  const [state, setState] = useState(null); const [error, setError] = useState("");
  useEffect(() => { api.state().then(setState).catch((cause) => setError(cause.message)); }, []);
  if (!state) return <p className="notice">{error || "Loading your command center…"}</p>;
  const open = (state.workflows ?? []).filter((item) => item.status === "awaiting-approval").length;
  return <div className="stack"><section className="card hero"><p className="eyebrow">BUSINESS COMMAND CENTER</p><h2>Good to see you, {state.user?.name ?? "owner"}.</h2><p className="muted">Your verified business context is ready. Start with what needs your attention today.</p></section><div className="grid metrics"><div className="card"><span className="metric-label">Open approvals</span><div className="metric-value">{open}</div></div><div className="card"><span className="metric-label">Installed apps</span><div className="metric-value">{state.apps?.filter((app) => app.installed).length ?? 0}</div></div><div className="card"><span className="metric-label">Company facts</span><div className="metric-value">{state.brain?.length ?? 0}</div></div></div><div className="grid two"><div className="card"><h2>Recent activity</h2>{(state.audit ?? []).slice(-5).reverse().map((item, index) => <div className="list-row" key={`${item.action}-${index}`}><span>{item.action}</span><small className="muted">{item.timestamp ?? item.at ?? ""}</small></div>)}{!state.audit?.length && <p className="muted">Your activity will appear here.</p>}</div><div className="card"><h2>Safety status</h2><p className="muted">External writes are controlled by approval workflows. PointAI can guide you, but it cannot read credential values or submit forms.</p><span className="tag green">Protected by default</span></div></div></div>;
}
