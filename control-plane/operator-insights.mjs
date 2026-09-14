const capabilitySet = (plugin) => new Set((plugin.capabilities ?? []).map((item) => typeof item === "string" ? item : item.id).filter(Boolean));

export function pluginAnalytics(plugins, tenants) {
  return plugins.map((plugin) => {
    const installations = tenants.flatMap((tenant) => tenant.plugins.filter((installed) => installed.id === plugin.id).map((installed) => ({ tenantId: tenant.tenantId, ...installed })));
    return {
      pluginId: plugin.id,
      name: plugin.name,
      status: plugin.status,
      activeInstalls: installations.filter((item) => item.state !== "disabled").length,
      disabledInstalls: installations.filter((item) => item.state === "disabled").length,
      tenantCount: new Set(installations.map((item) => item.tenantId)).size,
      installations,
    };
  });
}

export function operatorRecommendations(plugins, tenants) {
  const recommendations = [];
  const analytics = pluginAnalytics(plugins, tenants);
  for (const item of analytics.filter((entry) => entry.activeInstalls === 0)) {
    recommendations.push({ type: "unused-plugin", severity: "info", pluginId: item.pluginId, message: `${item.name} has no active installations.` });
  }
  for (let left = 0; left < plugins.length; left += 1) {
    for (let right = left + 1; right < plugins.length; right += 1) {
      const a = capabilitySet(plugins[left]);
      const b = capabilitySet(plugins[right]);
      const shared = [...a].filter((capability) => b.has(capability));
      const smaller = Math.min(a.size, b.size);
      if (shared.length >= 2 && smaller > 0 && shared.length / smaller >= 0.6) {
        recommendations.push({ type: "overlap", severity: "warning", plugins: [plugins[left].id, plugins[right].id], sharedCapabilities: shared, message: `${plugins[left].name} and ${plugins[right].name} overlap in ${shared.length} capabilities; review whether they should be merged.` });
      }
    }
  }
  for (const tenant of tenants) {
    const stale = tenant.lastSeenAt && Date.now() - Date.parse(tenant.lastSeenAt) > 48 * 60 * 60 * 1000;
    if (stale) recommendations.push({ type: "stale-tenant", severity: "warning", tenantId: tenant.tenantId, message: `${tenant.companyName} has not checked in for more than 48 hours.` });
  }
  return recommendations;
}
