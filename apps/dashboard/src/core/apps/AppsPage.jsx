import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api.js";

// Apps & Features (plan section 115 item 7). Every bundled app, whether installed or not,
// with its real state. Health is whatever the server reports — never a number this page
// invents.
const HEALTH_TEXT = {
  healthy: ["Working", "ok"],
  disabled: ["Turned off", "off"],
  attention: ["Needs attention", "warn"],
  "update-available": ["Update available", "warn"],
  "not-installed": ["Not installed", "off"],
};

function HealthTag({ health }) {
  const [text, tone] = HEALTH_TEXT[health?.status] ?? [health?.status ?? "Unknown", "off"];
  return <span className={`badge badge-${tone}`} title={health?.reason ?? ""}>{text}</span>;
}

export function AppsPage({ navigation }) {
  const [apps, setApps] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setApps(await api.apps()); setError(null); }
    catch (cause) { setError(cause); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Every action reports its own failure inline. A blocked dependency is a normal answer
  // here, not a crash, so the message is shown next to the app it concerns.
  const act = async (id, action) => {
    setBusy(id);
    setError(null);
    // The sidebar is driven by the same server state, so it has to be refetched too —
    // otherwise Growth Apps keeps showing the list from before the install.
    try { await action(); await reload(); await navigation?.reload(); }
    catch (cause) { setError(cause); }
    finally { setBusy(null); }
  };

  if (loading) return <p className="notice">Loading your apps…</p>;

  const installed = apps.filter((app) => app.installed);
  const available = apps.filter((app) => !app.installed);

  return (
    <div>
      {error && <p className="auth-error" role="alert">{error.message}</p>}

      <h2>Installed ({installed.length})</h2>
      {installed.length === 0 && <p className="notice">No apps installed yet.</p>}
      <div className="app-list">
        {installed.map((app) => (
          <div className="app-row card" key={app.id}>
            <div className="app-main">
              <Link to={`/apps/${app.id}`}><b>{app.name}</b></Link>
              <p className="muted">{app.description}</p>
              <small className="muted">
                v{app.installedVersion} · {app.category}
                {app.dependencies.length > 0 && ` · needs ${app.dependencies.join(", ")}`}
              </small>
            </div>
            <div className="app-actions">
              <HealthTag health={app.health} />
              {app.updateAvailable && (
                <button className="btn" disabled={busy === app.id}
                        onClick={() => act(app.id, () => api.update(app.id))}>
                  Update to {app.version}
                </button>
              )}
              <button className="btn" disabled={busy === app.id}
                      onClick={() => act(app.id, () => app.state === "disabled" ? api.enable(app.id) : api.disable(app.id))}>
                {app.state === "disabled" ? "Turn on" : "Turn off"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section">Available ({available.length})</h2>
      <div className="app-list">
        {available.map((app) => (
          <div className="app-row card" key={app.id}>
            <div className="app-main">
              <b>{app.name}</b>
              <p className="muted">{app.description}</p>
              <small className="muted">
                v{app.version} · {app.category}
                {app.dependencies.length > 0 && ` · installs ${app.dependencies.join(", ")} too`}
              </small>
              <div><span className={`badge badge-${app.installable ? "ok" : "off"}`}>{app.readiness?.label ?? "Planned"}</span></div>
              {app.readiness?.limitation && <small className="muted">{app.readiness.limitation}</small>}
            </div>
            <div className="app-actions">
              <button className="btn btn-primary" disabled={busy === app.id || !app.installable}
                      onClick={() => act(app.id, () => api.install(app.id))}>
                {busy === app.id ? "Installing…" : app.installable ? "Install" : "Planned"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
