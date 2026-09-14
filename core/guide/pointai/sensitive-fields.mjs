// Sensitive field handling (adopted guide spec sections 22 and 23, acceptance criterion 15).
//
// PointAI describes fields; it never learns what is in them. This module is the choke
// point: every element list coming from a browser passes through `sanitizeElements`
// before it reaches a matcher, a model, a playbook or the audit log.
//
// The rule is deliberately one-directional. A field is treated as sensitive on any hint,
// because the cost of over-redacting is a slightly vaguer instruction, while the cost of
// under-redacting is a password in a log file.

const SENSITIVE_TYPES = new Set(["password"]);

const SENSITIVE_PATTERN = new RegExp(
  [
    "password", "passwd", "passphrase",
    "otp", "one[-_ ]?time", "2fa", "mfa", "verification[-_ ]?code", "auth(?!or)[-_ ]?code",
    "secret", "api[-_ ]?key", "apikey", "access[-_ ]?token", "refresh[-_ ]?token",
    "\\btoken\\b", "private[-_ ]?key", "client[-_ ]?secret", "credential",
    "card[-_ ]?number", "cardnumber", "\\bcvv\\b", "\\bcvc\\b", "security[-_ ]?code",
    "\\bpin\\b", "account[-_ ]?number", "routing[-_ ]?number", "\\bssn\\b", "social[-_ ]?security",
    "app(lication)?[-_ ]?password",
  ].join("|"),
  "i",
);

// What a field is called is a hint; what a field *is* is stronger. `autocomplete` is the
// most reliable single signal browsers give us.
const SENSITIVE_AUTOCOMPLETE = /current-password|new-password|one-time-code|cc-number|cc-csc|cc-exp/i;

export function isSensitive(element = {}) {
  if (SENSITIVE_TYPES.has(String(element.type ?? "").toLowerCase())) return true;
  if (SENSITIVE_AUTOCOMPLETE.test(String(element.autocomplete ?? ""))) return true;
  const described = [element.name, element.id, element.aria, element.placeholder, element.label, element.text]
    .filter(Boolean)
    .join(" ");
  return SENSITIVE_PATTERN.test(described);
}

// A value must never travel, so it is dropped for every element rather than only for the
// ones we classified as sensitive: a classifier that is wrong once should not be the only
// thing standing between a password and a log line.
export function sanitizeElement(element = {}) {
  const { value, checked, innerHTML, outerHTML, ...rest } = element;
  const sensitive = isSensitive(element);
  if (!sensitive) return { ...rest, sensitive: false };

  // For a sensitive field even the label is kept only so the owner can be pointed at it.
  return {
    ...rest,
    sensitive: true,
    text: rest.text ? String(rest.text).slice(0, 60) : "",
    // The instruction PointAI is allowed to give about a field it must not read.
    instruction: "Enter the value requested by the provider here.",
  };
}

export function sanitizeElements(elements = []) {
  return elements.map(sanitizeElement);
}

// Used before anything is written to the audit log or handed to a model.
export function redactGoal(goal) {
  const text = String(goal ?? "");
  // A goal that contains something shaped like a secret is recorded as the shape, not the
  // secret. Owners do paste tokens into chat boxes.
  return text
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\b\d{12,19}\b/g, "[redacted]")
    .slice(0, 400);
}

export { SENSITIVE_PATTERN };
