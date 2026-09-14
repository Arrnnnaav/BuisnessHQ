import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api.js";

// The SEO workspace (plan section 100). Every step is evidence-first: nothing is proposed
// without Search Console data and a real crawl behind it, and nothing reaches the live
// site without the owner approving the exact wording.
//
// Shown as steps because each one genuinely gates the next — the server refuses
// out-of-order calls, so the screen says why a step is not available yet rather than
// letting the owner click into an error message.

function Step({ index, title, blurb, done, blocked, blockedReason, children }) {
  return (
    <section className={`seo-step ${done ? "seo-step-done" : ""} ${blocked ? "seo-step-blocked" : ""}`}>
      <div className="seo-step-mark">{done ? "✓" : index}</div>
      <div className="seo-step-body">
        <h3>{title}</h3>
        <p className="muted">{blurb}</p>
        {blocked ? <p className="notice">{blockedReason}</p> : children}
      </div>
    </section>
  );
}

const fmt = (value, digits = 0) => (typeof value === "number" ? value.toFixed(digits) : "—");

export function SeoWorkspace() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const reload = useCallback(async () => {
    try { setState(await api.state()); setError(null); }
    catch (cause) { setError(cause); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const run = async (name, action) => {
    setBusy(name); setError(null); setNotice(null);
    try {
      const result = await action();
      await reload();
      return result;
    } catch (cause) { setError(cause); return null; }
    finally { setBusy(null); }
  };

  if (!state) return <p className="notice">Loading…</p>;

  const audit = state.seoAudits?.[0] ?? null;
  const evidence = state.searchConsoleImports?.[0] ?? null;
  const opportunities = state.seoOpportunities ?? [];
  const experiments = state.seoExperiments ?? [];
  const website = state.profile?.website;

  return (
    <div className="seo-workspace">
      {error && <p className="auth-error" role="alert">{error.message}</p>}
      {notice && <p className="notice">{notice}</p>}

      <Step
        index={1}
        title="Crawl your public website"
        blurb="Reads your pages the way a search engine sees them. Nothing is changed."
        done={Boolean(audit)}
        blocked={!website}
        blockedReason={<>Add your website address to the <Link to="/business-profile">Business Profile</Link> first.</>}
      >
        {audit && (
          <p className="muted">
            {audit.pagesAudited} pages · average score {fmt(audit.averageScore)}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy === "audit"}
                onClick={() => run("audit", () => api.seoAudit({}))}>
          {busy === "audit" ? "Crawling…" : audit ? "Crawl again" : "Crawl my site"}
        </button>
      </Step>

      <Step
        index={2}
        title="Add Search Console evidence"
        blurb="Real search data decides what is worth changing. Without it, nothing is proposed."
        done={Boolean(evidence)}
      >
        {evidence && <p className="muted">{evidence.rows?.length ?? evidence.rowCount ?? 0} rows imported.</p>}
        <label className="btn file-btn">
          Upload a Search Analytics export
          <input
            type="file" accept="application/json,.json" hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const parsed = JSON.parse(await file.text());
                await run("import", () => api.searchConsoleImport(parsed));
                setNotice("Evidence imported.");
              } catch {
                setError(new Error("That file is not valid Search Console JSON."));
              }
              event.target.value = "";
            }}
          />
        </label>
      </Step>

      <Step
        index={3}
        title="Find what is worth fixing"
        blurb="Pages people already see but do not click. Each one cites its own numbers."
        done={opportunities.length > 0}
        blocked={!audit || !evidence}
        blockedReason="Finish the crawl and import evidence first."
      >
        <button className="btn" disabled={busy === "discover"}
                onClick={() => run("discover", () => api.seoDiscover())}>
          {busy === "discover" ? "Looking…" : "Find opportunities"}
        </button>

        {opportunities.length > 0 && (
          <div className="seo-list">
            {opportunities.map((item) => (
              <div className="seo-opportunity" key={item.id}>
                <div>
                  <b>{item.evidence?.query ?? item.type}</b>
                  <p className="muted">{item.page}</p>
                  {/* The numbers are the argument, so they are shown rather than summarised away. */}
                  <small className="muted">
                    {item.evidence?.impressions} impressions · {item.evidence?.clicks} clicks · CTR{" "}
                    {fmt((item.evidence?.ctr ?? 0) * 100, 2)}% · position {fmt(item.evidence?.position, 1)}
                  </small>
                </div>
                <button className="btn btn-primary" disabled={busy === item.id}
                        onClick={() => run(item.id, async () => {
                          await api.seoPropose(item.id);
                          setNotice("Draft written and sent to Needs You for your approval.");
                        })}>
                  {busy === item.id ? "Drafting…" : "Draft a fix"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Step>

      <Step
        index={4}
        title="Approve the exact wording"
        blurb="Drafts wait in Needs You. Publishing uses the text you approved, not the text that was drafted."
        done={experiments.some((item) => ["APPROVED", "ACTIVE", "VERIFICATION_PENDING"].includes(item.status))}
        blocked={experiments.length === 0}
        blockedReason="Nothing is drafted yet."
      >
        <Link className="btn" to="/needs-you">Open Needs You</Link>
      </Step>

      <Step
        index={5}
        title="Publish to staging and verify"
        blurb="Writes a draft to your staging site, then checks your live site is untouched."
        done={experiments.some((item) => item.status === "ACTIVE")}
        blocked={!experiments.some((item) => ["AWAITING_APPROVAL", "APPROVED"].includes(item.status))}
        blockedReason="Approve a draft first."
      >
        {experiments
          .filter((item) => ["APPROVED", "AWAITING_APPROVAL"].includes(item.status))
          .map((item) => (
            <div className="seo-opportunity" key={item.id}>
              <div>
                <b>{item.page}</b>
                <p className="muted">{item.status.replaceAll("_", " ").toLowerCase()}</p>
              </div>
              <button className="btn btn-primary" disabled={busy === item.id}
                      onClick={() => run(item.id, () => api.seoPublishStaging(item.id))}>
                {busy === item.id ? "Publishing…" : "Publish to staging"}
              </button>
            </div>
          ))}
      </Step>

      {experiments.length > 0 && (
        <section className="section">
          <h2>Experiments</h2>
          <div className="card">
            {experiments.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <b>{item.page}</b>
                  <div className="muted">{item.proposalVersions?.at(-1)?.proposed?.title}</div>
                </div>
                <span className={`tag ${item.status === "ACTIVE" ? "green" : item.status.includes("FAILED") ? "warning" : ""}`}>
                  {item.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
