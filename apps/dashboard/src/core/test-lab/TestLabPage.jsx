import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function TestLabPage() {
  const [runs, setRuns] = useState([]); const [action, setAction] = useState("content.draft"); const [input, setInput] = useState("{}"); const [error, setError] = useState("");
  const refresh = () => api.state().then((state) => setRuns(state.sandboxRuns ?? [])).catch((cause) => setError(cause.message));
  useEffect(refresh, []);
  const run = async (event) => { event.preventDefault(); try { await api.sandboxRun({ action, input: JSON.parse(input) }); setError(""); await refresh(); } catch (cause) { setError(cause.message); } };
  return <div className="stack"><div className="notice">Test Lab simulates supported actions only. It has no external effects and does not publish, send, or modify a connected account.</div>{error && <p className="auth-error" role="alert">{error}</p>}<form className="card form-grid" onSubmit={run}><select value={action} onChange={(event) => setAction(event.target.value)}><option>content.draft</option><option>seo.audit</option><option>reviews.reply</option><option>pricing.recommend</option></select><textarea aria-label="Simulation input JSON" rows="2" value={input} onChange={(event) => setInput(event.target.value)} /><button className="btn btn-primary">Run simulation</button></form><div className="card">{runs.slice().reverse().map((item) => <div className="list-row" key={item.id}><div><b>{item.action}</b><div className="muted">{item.result?.status ?? item.status} · external effects: {String(item.externalEffects)}</div></div><small className="muted">{item.createdAt}</small></div>)}{!runs.length && <div className="empty">No simulations yet.</div>}</div></div>;
}
