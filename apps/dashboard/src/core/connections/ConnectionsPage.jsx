import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function ConnectionsPage() {
  const [state, setState] = useState(null); const [error, setError] = useState("");
  useEffect(() => { api.state().then(setState).catch((cause) => setError(cause.message)); }, []);
  if (!state) return <p className="notice">{error || "Loading connections…"}</p>;
  const items = [{ id: "ollama", label: "Local AI (Ollama)", detail: `${state.modelRoute?.model ?? "Qwen local model"} · private by default`, configured: state.aiStatus?.ollama?.available }, ...((state.integrations ?? []).filter((item) => item.provider !== "ollama").map((item) => ({ id: item.provider, label: item.provider, detail: "Credentials are encrypted locally and never shown here.", configured: item.configured })) )];
  return <div className="stack"><div className="card"><h2>Connections</h2><p className="muted">Connect providers independently. BusinessOS keeps credentials in the local encrypted vault and never sends them to PointAI.</p>{items.map((item) => <div className="list-row" key={item.id}><div><b>{item.label}</b><div className="muted">{item.detail}</div></div><span className={`tag ${item.configured ? "green" : "warning"}`}>{item.configured ? "Connected" : "Not connected"}</span></div>)}</div><div className="notice">Provider authorization screens are staged separately so an account password is never entered into the AI chat.</div></div>;
}
