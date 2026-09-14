import { api, session } from "../../services/api.js";

export function SettingsPage() {
  const signOut = async () => { try { await api.logout(); } finally { session.clear(); window.location.reload(); } };
  return <div className="stack"><div className="card"><h2>Safety and privacy</h2><div className="list-row"><span>External writes</span><span className="tag green">Approval required</span></div><div className="list-row"><span>PointAI credential access</span><span className="tag green">Never read</span></div><div className="list-row"><span>AI default</span><span className="tag">Local-first</span></div></div><div className="card"><h2>Session</h2><p className="muted">Sign out of this BusinessOS workspace on this device.</p><button className="btn btn-danger" onClick={signOut}>Sign out</button></div></div>;
}
