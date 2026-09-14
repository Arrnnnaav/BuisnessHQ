import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PluginPageShell } from "../plugin-shell/PluginPageShell.jsx";
import { api } from "../../services/api.js";
import { SeoWorkspace } from "../seo/SeoWorkspace.jsx";
import { CatalogWorkspace } from "../catalog/CatalogWorkspace.jsx";
import { MetaAdsTeamWorkspace } from "../meta-ads-team/MetaAdsTeamWorkspace.jsx";
import { PricingWorkspace } from "../pricing/PricingWorkspace.jsx";

// Resolves /apps/:pluginId against the navigation registry. Plugin-supplied page
// components will register here; until then every installed app gets the standard shell
// with a placeholder body, which is enough to exercise disable/uninstall.
const PLUGIN_PAGES = { seo: SeoWorkspace, catalog: CatalogWorkspace, pricing: PricingWorkspace, "meta-ads-team": MetaAdsTeamWorkspace };

export function registerPluginPage(id, component) { PLUGIN_PAGES[id] = component; }

export function PluginHost({ navigation }) {
  const { pluginId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const plugin = navigation.plugins.find((item) => item.id === pluginId);

  if (navigation.loading) return <p className="notice">Loading…</p>;

  if (!plugin) {
    return (
      <div className="empty-state">
        <h2>That app isn’t installed</h2>
        <p>It may have been uninstalled, or it was never added to this company.</p>
        <Link className="btn" to="/marketplace">Browse the Marketplace</Link>
      </div>
    );
  }

  const Page = PLUGIN_PAGES[plugin.id];

  // The server refuses a disable or uninstall that would break another installed app.
  // That refusal is shown here rather than swallowed, because it names what to do first.
  const run = async (action) => {
    setError(null);
    try { await action(); await navigation.reload(); return true; }
    catch (cause) { setError(cause); return false; }
  };

  return (
    <PluginPageShell
      plugin={{ ...plugin, description: plugin.description ?? "" }}
      error={error}
      onDisable={(disable) => run(() => (disable ? api.disable(plugin.id) : api.enable(plugin.id)))}
      onUninstall={async ({ keepData }) => {
        if (await run(() => api.uninstall(plugin.id, { keepData }))) navigate("/apps");
      }}
    >
      {Page ? <Page plugin={plugin} /> : (
        <p className="notice">
          {plugin.title} is installed and its workspace is being built. Management actions below work now.
        </p>
      )}
    </PluginPageShell>
  );
}
