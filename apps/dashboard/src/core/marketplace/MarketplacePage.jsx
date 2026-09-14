import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api.js";

// Curated Marketplace (plan sections 97 and 115 item 8). Everything offered here is a
// packaged app that ships with the product. Registering a GitHub repository is developer
// tooling and deliberately absent: an owner should never have to reason about
// repositories, commits or sandbox adapters to add a capability.

const TABS = [
  ["discover", "Discover"],
  ["installed", "Installed"],
  ["updates", "Updates"],
];

// Plain-language category names. The manifest values are engineering words.
const CATEGORY_LABELS = {
  growth: "Get more customers",
  business: "Run the business",
  intelligence: "Understand the business",
  operations: "Operations",
  uncategorized: "Other",
};

function AppCard({ app, busy, onInstall, onUpdate }) {
  const readiness = app.readiness ?? { label: app.remote ? "Signed release" : "Planned", installable: app.remote === true };
  return (
    <div className="card market-card">
      <div>
        <b>{app.name}</b>
        <p className="muted">{app.description}</p>
        <small className="muted">
          v{app.installed ? app.installedVersion : app.version}
          {app.dependencies.length > 0 && ` · also installs ${app.dependencies.join(", ")}`}
        </small>
        <div><span className={`badge badge-${readiness.installable ? "ok" : "off"}`}>{readiness.label}</span></div>
        {readiness.limitation && <small className="muted">{readiness.limitation}</small>}
      </div>
      <div className="market-actions">
        {app.installed ? (
          <>
            <Link className="btn" to={`/apps/${app.id}`}>Open</Link>
            {app.updateAvailable && (
              <button className="btn btn-primary" disabled={busy} onClick={() => onUpdate(app.id)}>
                Update to {app.version}
              </button>
            )}
          </>
        ) : (
          <button className="btn btn-primary" disabled={busy || readiness.installable === false} onClick={() => onInstall(app.id)}>
            {busy ? "Adding…" : readiness.installable === false ? "Not ready" : "Add to my business"}
          </button>
        )}
      </div>
    </div>
  );
}

export function MarketplacePage({ navigation }) {
  const [apps, setApps] = useState([]);
  const [packages, setPackages] = useState([]);
  const [installedPackages, setInstalledPackages] = useState([]);
  const [tab, setTab] = useState("discover");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [bundled, remote, packageCatalog, installed] = await Promise.all([api.apps(), api.controlPlaneMarketplace().catch(() => []), api.marketplacePackages().catch(() => []), api.installedPackages().catch(() => [])]);
      setApps([...bundled, ...remote.map((app) => ({ ...app, remote: true, installed: false, dependencies: app.dependencies ?? [] }))]); setError(null);
      setPackages(packageCatalog);
      setInstalledPackages(installed);
    }
    catch (cause) { setError(cause); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const act = async (id, action) => {
    setBusy(id); setError(null);
    try { await action(); await reload(); await navigation?.reload(); }
    catch (cause) { setError(cause); }
    finally { setBusy(null); }
  };

  const install = (id) => { const app = apps.find((item) => item.id === id); return act(id, () => app?.remote ? api.installRemote(id) : api.install(id)); };
  const update = (id) => act(id, () => api.update(id));

  const shown = useMemo(() => {
    if (tab === "installed") return apps.filter((app) => app.installed);
    if (tab === "updates") return apps.filter((app) => app.updateAvailable);
    return apps.filter((app) => !app.installed);
  }, [apps, tab]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const app of shown) {
      const label = CATEGORY_LABELS[app.category] ?? CATEGORY_LABELS.uncategorized;
      groups.set(label, [...(groups.get(label) ?? []), app]);
    }
    return [...groups.entries()];
  }, [shown]);

  if (loading) return <p className="notice">Loading the marketplace…</p>;

  const updateCount = apps.filter((app) => app.updateAvailable).length;

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id}
                  className={`tab ${tab === id ? "tab-active" : ""}`}
                  onClick={() => setTab(id)}>
            {label}
            {id === "updates" && updateCount > 0 && <i className="nav-badge">{updateCount}</i>}
          </button>
        ))}
      </div>

      {error && <p className="auth-error" role="alert">{error.message}</p>}

      {shown.length === 0 && (
        <p className="notice">
          {tab === "updates" ? "Everything is up to date."
            : tab === "installed" ? "You have not added any apps yet."
            : "You have already added every available app."}
        </p>
      )}

      {grouped.map(([label, list]) => (
        <section key={label} className="section">
          <h2>{label}</h2>
          <div className="app-list">
            {list.map((app) => (
              <AppCard key={app.id} app={app} busy={busy === app.id}
                       onInstall={install} onUpdate={update} />
            ))}
          </div>
        </section>
      ))}
      {packages.length > 0 && <section className="section"><h2>Agents, skills & connectors</h2><p className="muted">These first-party packages are reviewed building blocks. They become useful only through approved BusinessOS plugins and workflows.</p><div className="app-list">{packages.map((item) => { const installed = installedPackages.find((entry) => entry.type === item.type && entry.id === item.id); const updateAvailable = installed && installed.version !== item.version; return <div className="card market-card" key={`${item.type}-${item.id}`}><div><b>{item.id}</b><p className="muted">{item.type} · v{installed?.version ?? item.version} · {(item.capabilities || []).join(", ")}</p><small className="muted">{item.note}</small></div>{installed ? <><span className={`badge badge-${installed.state === "enabled" ? "ok" : "off"}`}>{updateAvailable ? `v${item.version} available` : installed.state}</span>{updateAvailable && <button className="btn btn-primary" disabled={!item.installable} onClick={() => act(`${item.type}-${item.id}`, () => api.installPackage(item.type, item.id))}>Update</button>}<button className="btn" onClick={() => act(`${item.type}-${item.id}`, () => api.setPackageState(item.type, item.id, installed.state === "enabled" ? "disabled" : "enabled"))}>{installed.state === "enabled" ? "Disable" : "Enable"}</button></> : <button className="btn btn-primary" disabled={!item.installable} onClick={() => act(`${item.type}-${item.id}`, () => api.installPackage(item.type, item.id))}>{item.installable ? "Add package" : "Needs app"}</button>}</div>; })}</div></section>}
    </div>
  );
}
