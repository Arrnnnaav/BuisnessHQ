// The privacy boundary between a customer's machine and our control plane (ruling R6).
//
// BusinessOS is local-first. That promise survives centralised management only if the
// channel between the two is narrow *by construction*, so this module is an allowlist:
// anything not named here is dropped rather than forwarded. A future caller that passes a
// whole tenant object leaks nothing, because the fields it did not expect never make it
// through.
//
// The inverse — a denylist of "sensitive" fields — was rejected. It fails open: the day
// someone adds a new field holding business content, a denylist forwards it.

// Everything the control plane is allowed to know about an installation.
const ALLOWED = Object.freeze({
  tenantId: "string",
  companyName: "string",
  coreVersion: "string",
  channel: "string",
  plan: "string",
  healthState: "string",
  lastSeenAt: "string",
  country: "string",
});

// Per-plugin facts. Ids and versions only — never plugin data.
const ALLOWED_PLUGIN = Object.freeze({
  id: "string",
  version: "string",
  state: "string",
  health: "string",
});

const HEALTH_STATES = new Set(["healthy", "attention", "failed", "unknown"]);

// Names that must never appear in a payload. This is not the enforcement mechanism — the
// allowlist is — but a match means a caller tried to send business content, which is worth
// failing loudly over rather than silently dropping.
const FORBIDDEN = /brain|customer|contact|lead|invoice|price|pricing|credential|secret|token|password|email|message|conversation|prompt|completion|document|file|audit(?!State)|address|phone/i;

export class TelemetryContractViolation extends Error {}

function pick(source, schema) {
  const out = {};
  for (const [key, type] of Object.entries(schema)) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== type) continue;
    out[key] = value;
  }
  return out;
}

// Called on the client before anything is sent, and again on the control plane before
// anything is stored. Checking twice is deliberate: neither side has to trust the other.
export function sanitizeHeartbeat(input = {}) {
  for (const key of Object.keys(input)) {
    if (key === "plugins") continue;
    if (FORBIDDEN.test(key)) {
      throw new TelemetryContractViolation(`Field '${key}' may not be sent to the control plane`);
    }
  }

  const beat = pick(input, ALLOWED);
  if (!beat.tenantId) throw new TelemetryContractViolation("A heartbeat needs a tenantId");
  if (beat.healthState && !HEALTH_STATES.has(beat.healthState)) beat.healthState = "unknown";

  beat.plugins = (Array.isArray(input.plugins) ? input.plugins : [])
    .map((plugin) => pick(plugin, ALLOWED_PLUGIN))
    .filter((plugin) => plugin.id);

  return beat;
}

// Used by tests and by the operator console to state plainly what the channel carries.
export const TELEMETRY_FIELDS = Object.freeze(Object.keys(ALLOWED).concat(["plugins"]));
export const TELEMETRY_PLUGIN_FIELDS = Object.freeze(Object.keys(ALLOWED_PLUGIN));
