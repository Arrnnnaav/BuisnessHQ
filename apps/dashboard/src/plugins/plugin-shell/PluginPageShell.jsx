import { useState } from "react";

// Standard shell every plugin page opens inside (plan section 11). The header, health
// badge and the Danger Zone are owned by core, so a plugin cannot ship its own uninstall
// flow or quietly omit one.

const STATE_LABELS = {
  enabled: { text: "Enabled · healthy", tone: "ok" },
  disabled: { text: "Disabled", tone: "off" },
  installed: { text: "Installed — setup required", tone: "warn" },
  configured: { text: "Ready to enable", tone: "warn" },
  attention: { text: "Enabled — attention needed", tone: "warn" },
};

export function PluginHealthBadge({ state }) {
  const label = STATE_LABELS[state] ?? { text: state ?? "Unknown", tone: "off" };
  return <span className={`badge badge-${label.tone}`}>{label.text}</span>;
}

// Uninstall asks about data separately, because removing an app and destroying its
// history are different decisions (plan section 90).
function DangerZone({ plugin, onDisable, onUninstall }) {
  const [confirming, setConfirming] = useState(false);
  const [keepData, setKeepData] = useState(true);

  return (
    <section className="danger-zone">
      <h3>Danger Zone</h3>

      <div className="danger-row">
        <div>
          <b>{plugin.state === "disabled" ? "Enable" : "Disable"} {plugin.title}</b>
          <p>
            {plugin.state === "disabled"
              ? "Turns its work back on. Nothing was deleted while it was off."
              : "Stops its work and scheduled checks. Your data is kept."}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => onDisable(plugin.state !== "disabled")}>
          {plugin.state === "disabled" ? "Enable" : "Disable"}
        </button>
      </div>

      <div className="danger-row">
        <div>
          <b>Uninstall {plugin.title}</b>
          <p>Removes the app. Choose whether to keep the history it collected.</p>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
          Uninstall
        </button>
      </div>

      {confirming && (
        <div className="danger-confirm" role="dialog" aria-label={`Uninstall ${plugin.title}`}>
          <p><b>Uninstall {plugin.title}?</b></p>
          <label>
            <input type="radio" name="data" checked={keepData} onChange={() => setKeepData(true)} />
            Keep historical {plugin.title} data
          </label>
          <label>
            <input type="radio" name="data" checked={!keepData} onChange={() => setKeepData(false)} />
            Delete {plugin.title} data permanently
          </label>
          <div className="danger-actions">
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => onUninstall({ keepData })}>
              {keepData ? "Uninstall, keep data" : "Uninstall and delete data"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function PluginPageShell({ plugin, children, onDisable, onUninstall, error }) {
  return (
    <div className="plugin-shell">
      <header className="plugin-header">
        <div>
          <p className="eyebrow">Growth App</p>
          <h2>{plugin.title}</h2>
          <p className="plugin-description">{plugin.description}</p>
        </div>
        <div className="plugin-header-status">
          <PluginHealthBadge state={plugin.state} />
          {plugin.version && <small>Version {plugin.version}</small>}
        </div>
      </header>

      <div className="plugin-body">
        {plugin.state === "disabled" ? (
          <p className="notice">
            {plugin.title} is turned off. Its data is safe. Enable it below to resume its work.
          </p>
        ) : (
          children
        )}
      </div>

      {error && <p className="auth-error" role="alert">{error.message}</p>}
      <DangerZone plugin={plugin} onDisable={onDisable} onUninstall={onUninstall} />
    </div>
  );
}
