import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function PricingWorkspace() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const refresh = async () => { try { setState(await api.state()); setError(null); } catch (cause) { setError(cause.message); } };
  useEffect(() => { refresh(); }, []);
  const latest = state?.pricingRuns?.at(-1);

  const stage = async () => {
    setBusy(true); setError(null);
    try { await api.pricingStage(); await refresh(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="stack">
    <section className="card hero">
      <p className="eyebrow">PRICING · CUSTOMER PILOT</p>
      <h2>Evidence-based price recommendations.</h2>
      <p className="muted">The analyzer uses verified catalog cost and selling-price fields. It never changes a live price.</p>
      <button className="btn btn-primary" disabled={busy} onClick={stage}>{busy ? "Analyzing…" : "Analyze catalog"}</button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </section>
    <section className="card">
      <h2>Latest recommendation run</h2>
      {!latest && <p className="notice">No run yet. Add at least one catalog row with verified price and cost, then analyze.</p>}
      {latest?.recommendations?.map((item) => <div className="list-row" key={item.sku}>
        <div><b>{item.sku}</b><div className="muted">{item.reasoning ?? item.reason ?? "Model recommendation"}</div></div>
        <div><b>{item.recommended_price ?? item.recommendedPrice}</b><div className="muted">confidence {item.confidence ?? "not scored"}</div></div>
      </div>)}
    </section>
  </div>;
}
