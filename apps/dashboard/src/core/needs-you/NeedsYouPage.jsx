import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api.js";

// Needs You (plan sections 12 and 44). Nothing that leaves the building happens without a
// decision here. The point of this screen is that the owner sees exactly what would
// change before they allow it — so a proposal is shown as a before/after diff, not a
// summary of one.

function Field({ label, before, after }) {
  const changed = before !== after;
  return (
    <div className="diff-field">
      <p className="nav-section-label">{label}</p>
      <div className={`diff-row ${changed ? "diff-changed" : ""}`}>
        <div className="diff-before">
          <small className="muted">Now</small>
          <p>{before || <em className="muted">empty</em>}</p>
        </div>
        <div className="diff-after">
          <small className="muted">Proposed</small>
          <p>{after || <em className="muted">empty</em>}</p>
        </div>
      </div>
    </div>
  );
}

function Approval({ run, busy, onDecide }) {
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const proposed = run.input?.proposed ?? {};
  const current = run.input?.current ?? {};

  return (
    <div className="card approval-card">
      <div className="approval-head">
        <div>
          <b>{run.expectedEffect ?? run.type ?? "Pending decision"}</b>
          <p className="muted">{run.input?.targetUrl ?? ""}</p>
        </div>
        <span className={`badge badge-${run.externalEffect ? "warn" : "off"}`}>
          {run.externalEffect ? "Leaves your computer" : "Stays local"}
        </span>
      </div>

      {(proposed.title || proposed.metaDescription) && (
        <div className="diff">
          <Field label="Page title" before={current.title} after={proposed.title} />
          <Field label="Description" before={current.metaDescription} after={proposed.metaDescription} />
        </div>
      )}

      <button type="button" className="link-btn" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Hide the full record" : "Why is this being suggested?"}
      </button>
      {expanded && (
        <pre className="code">{JSON.stringify(run.input?.evidence ?? run.input ?? {}, null, 2)}</pre>
      )}

      <div className="approval-actions">
        <input value={comment} onChange={(event) => setComment(event.target.value)}
               placeholder="Add a note (optional)" aria-label="Decision note" />
        <button className="btn" disabled={busy} onClick={() => onDecide(run.id, "rejected", comment)}>Reject</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => onDecide(run.id, "approved", comment)}>Approve</button>
      </div>
    </div>
  );
}

export function NeedsYouPage() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setRuns(await api.workflows()); setError(null); }
    catch (cause) { setError(cause); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const decide = async (id, decision, comment) => {
    setBusy(true); setError(null);
    try { await api.decide(id, decision, comment); await reload(); }
    catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="notice">Loading…</p>;

  const waiting = runs.filter((run) => run.status === "awaiting-approval");
  const decided = runs.filter((run) => run.status !== "awaiting-approval").slice(-8).reverse();

  return (
    <div>
      {error && <p className="auth-error" role="alert">{error.message}</p>}

      {waiting.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing needs you</h2>
          <p>When the system prepares something that needs your say-so, it waits here.</p>
        </div>
      ) : (
        <div className="app-list">
          {waiting.map((run) => (
            <Approval key={run.id} run={run} busy={busy} onDecide={decide} />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <section className="section">
          <h2>Recently decided</h2>
          <div className="card">
            {decided.map((run) => (
              <div className="list-row" key={run.id}>
                <span>{run.expectedEffect ?? run.type}</span>
                <span className={`tag ${run.status === "completed" ? "green" : "warning"}`}>{run.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
