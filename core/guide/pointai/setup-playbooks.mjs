const PLAYBOOKS = {
  "search-console": {
    title: "Connect Google Search Console",
    host: "search.google.com",
    url: "https://search.google.com/search-console",
    steps: [
      { action: "open", target: "Search Console", instruction: "Open Google Search Console and choose the verified property for your website." },
      { action: "click", target: "Settings", instruction: "Open Settings, then choose Users and permissions or Ownership verification." },
      { action: "confirm", target: "Property", instruction: "Confirm the property matches the website you entered in BusinessOS." },
      { action: "return", target: "BusinessOS", instruction: "Return here and continue. Do not paste passwords or private keys into PointAI." },
    ],
  },
  wordpress: {
    title: "Connect WordPress staging",
    host: "wordpress.com",
    url: "https://wordpress.com",
    steps: [
      { action: "open", target: "WordPress staging admin", instruction: "Open the staging site admin, not the production site." },
      { action: "click", target: "Users → Profile → Application Passwords", instruction: "Create an application password for the BusinessOS Connector role." },
      { action: "confirm", target: "Staging URL", instruction: "Check that the URL is a separate HTTPS staging origin from production." },
      { action: "return", target: "BusinessOS", instruction: "Enter the credential directly into the encrypted connection form. PointAI never reads the field value." },
    ],
  },
  email: {
    title: "Connect email",
    host: "provider console",
    url: null,
    steps: [
      { action: "open", target: "Email provider settings", instruction: "Open your provider’s official developer or integrations page." },
      { action: "click", target: "Create connection", instruction: "Create a restricted connection with only the scopes you approve." },
      { action: "confirm", target: "Test recipient", instruction: "Use a dedicated test mailbox before enabling any external send." },
      { action: "return", target: "BusinessOS", instruction: "Save the connection in the encrypted vault and keep sending approval-only." },
    ],
  },
};

export function setupPlaybook(id) {
  const playbook = PLAYBOOKS[id];
  if (!playbook) throw new Error(`Unknown setup playbook: ${id}`);
  return structuredClone(playbook);
}

export function listSetupPlaybooks() { return Object.entries(PLAYBOOKS).map(([id, playbook]) => ({ id, title: playbook.title, host: playbook.host, stepCount: playbook.steps.length })); }
