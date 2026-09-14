import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function CompanyBrainPage() {
  const [facts, setFacts] = useState([]); const [key, setKey] = useState(""); const [value, setValue] = useState(""); const [error, setError] = useState("");
  const refresh = () => api.state().then((state) => setFacts(state.brain ?? [])).catch((cause) => setError(cause.message));
  useEffect(refresh, []);
  const add = async (event) => { event.preventDefault(); try { await api.addBrain({ type: "fact", key, value, source: "owner dashboard", confidence: 1, status: "verified", tags: ["owner"] }); setKey(""); setValue(""); await refresh(); } catch (cause) { setError(cause.message); } };
  return <div className="stack">{error && <p className="auth-error" role="alert">{error}</p>}<form className="card form-grid brain-form" onSubmit={add}><input aria-label="Fact name" placeholder="Fact or rule name" value={key} onChange={(event) => setKey(event.target.value)} required /><input aria-label="Fact value" placeholder="What should BusinessOS know?" value={value} onChange={(event) => setValue(event.target.value)} required /><button className="btn btn-primary">Add verified fact</button></form><div className="card">{facts.map((fact) => <div className="list-row" key={fact.id}><div><b>{fact.key}</b><div className="muted">{fact.value}</div><small className="muted">{fact.source} · confidence {fact.confidence}</small></div><span className={`tag ${fact.status === "verified" ? "green" : "warning"}`}>{fact.status}</span></div>)}{!facts.length && <div className="empty">No verified facts yet.</div>}</div></div>;
}
