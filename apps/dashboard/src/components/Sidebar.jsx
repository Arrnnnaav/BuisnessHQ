import { NavLink } from "react-router-dom";

// Three labelled sections (plan sections 10 and 40). Growth Apps is the only one that
// changes; a newly installed app appears at the bottom of it because the registry
// orders by install sequence.
// Manifest icons may be a glyph or an asset path, and the referenced files do not all
// exist yet. Render a real image only when one resolves; otherwise fall back to a glyph
// so the sidebar never shows a raw file path.
function NavIcon({ icon, title }) {
  const isPath = typeof icon === "string" && (icon.startsWith("/") || icon.startsWith("http"));
  if (!isPath) return <span className="nav-icon" aria-hidden="true">{icon ?? "▦"}</span>;
  return (
    <span className="nav-icon" aria-hidden="true">
      <img
        src={icon}
        alt=""
        className="nav-icon-img"
        onError={(event) => { event.currentTarget.replaceWith(document.createTextNode("▦")); }}
      />
    </span>
  );
}

function Section({ label, items, badges }) {
  if (!items.length) return null;
  return (
    <div className="nav-section">
      <p className="nav-section-label">{label}</p>
      {items.map((item) => (
        <NavLink
          key={item.id}
          to={item.route}
          className={({ isActive }) =>
            ["nav-item", isActive ? "active" : "", item.active === false ? "nav-item-disabled" : ""]
              .filter(Boolean)
              .join(" ")
          }
          title={item.active === false ? `${item.title} is disabled` : item.title}
        >
          <NavIcon icon={item.icon} title={item.title} />
          <span className="nav-title">{item.title}</span>
          {item.active === false && <em className="nav-flag">Off</em>}
          {badges?.[item.badge] > 0 && <i className="nav-badge">{badges[item.badge]}</i>}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar({ navigation, badges, company = "ABizCreator" }) {
  const { core, plugins, platform, loading, error } = navigation;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">{company.slice(0, 1)}</span>
        <div>
          <b>{company}</b>
          <small>GrowthOS</small>
        </div>
      </div>

      <nav aria-label="Primary">
        <Section label="Core" items={core} badges={badges} />
        {/* Empty Growth Apps is a real state on a fresh install, so it gets a prompt
            rather than a blank gap (plan section 88). */}
        {plugins.length > 0 ? (
          <Section label="Growth Apps" items={plugins} badges={badges} />
        ) : (
          !loading && (
            <div className="nav-section">
              <p className="nav-section-label">Growth Apps</p>
              <NavLink to="/marketplace" className="nav-item nav-empty">
                <span className="nav-icon" aria-hidden="true">＋</span>
                <span className="nav-title">Add your first app</span>
              </NavLink>
            </div>
          )
        )}
        <Section label="Platform" items={platform} badges={badges} />
      </nav>

      <div className="sidebar-footer">
        {error ? (
          <><span className="status-dot status-dot-warn" /> Navigation unavailable</>
        ) : (
          <><span className="status-dot" /> System healthy</>
        )}
        <br />
        <small>Local-first · Copilot mode</small>
      </div>
    </aside>
  );
}
