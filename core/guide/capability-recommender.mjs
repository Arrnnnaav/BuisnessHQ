// Deterministic plugin recommendation (adopted guide spec sections 11 and 63).
//
// The rule the spec is emphatic about: the capability index decides which app can satisfy
// a need, and a language model only explains the choice. So nothing here calls a model.
// The same goal produces the same recommendation on a machine with no AI configured.
//
// Manifests do not carry a `capabilities` array. What they do carry is
// `permissions.required` (verbs like `execute:lead_creation`), `keywords`, a category and
// a description. Those are the capability surface, so the index is built from them.

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "without", "into", "from", "that",
  "this", "these", "those", "it", "its", "i", "we", "my", "our", "me", "us", "you", "your",
  "to", "of", "in", "on", "at", "by", "is", "are", "am", "be", "been", "was", "were", "do",
  "does", "did", "doing", "done", "how", "what", "when", "where", "which", "who", "why",
  "can", "could", "should", "would", "want", "need", "needs", "needed", "help", "helps",
  "please", "some", "any", "more", "most", "much", "many", "get", "getting", "got", "make",
  "making", "have", "has", "had", "up", "out", "about", "all", "so", "if", "then", "than",
  "businessos", "plugin", "app", "apps", "business", "company",
]);

// A handful of business words an owner would actually type, mapped onto the vocabulary
// the manifests use. This is a synonym table, not intent classification by a model.
const SYNONYMS = {
  customer: ["crm", "customers", "lead", "leads"],
  customers: ["crm", "lead", "leads"],
  client: ["crm", "customer", "lead"],
  clients: ["crm", "customer", "leads"],
  lead: ["crm", "leads", "lead-management"],
  leads: ["crm", "lead-management"],
  followup: ["crm", "followups", "nurturing"],
  "follow-up": ["crm", "followups"],
  followups: ["crm", "nurturing"],
  quote: ["quotations", "proposal", "quotes"],
  quotes: ["quotations", "proposal"],
  quotation: ["quotations"],
  proposal: ["quotations", "proposals"],
  price: ["pricing", "prices", "margin"],
  prices: ["pricing", "margin"],
  pricing: ["pricing", "margin", "revenue"],
  cost: ["pricing", "margin"],
  charge: ["pricing"],
  google: ["google_business", "search", "seo"],
  search: ["seo", "search-console", "rankings"],
  ranking: ["seo", "rankings"],
  rankings: ["seo"],
  traffic: ["seo", "analytics", "website"],
  visitors: ["analytics", "website"],
  website: ["website", "cms", "site"],
  site: ["website", "cms"],
  blog: ["content", "posts", "articles"],
  post: ["content", "social", "posts"],
  posts: ["content", "social"],
  // No manifest names a platform, so a platform name maps onto the terms that are unique
  // to social media management ("engagement", "community") rather than "social-media",
  // which the content app also declares.
  social: ["social", "engagement", "community", "listening"],
  instagram: ["social", "engagement", "community"],
  facebook: ["social", "engagement", "community"],
  linkedin: ["social", "engagement", "community"],
  whatsapp: ["whatsapp", "messaging"],
  email: ["email", "newsletter"],
  newsletter: ["email", "campaigns"],
  campaign: ["campaigns", "marketing-automation"],
  campaigns: ["campaigns"],
  review: ["reviews", "reputation", "ratings"],
  reviews: ["reviews", "reputation"],
  reputation: ["reviews"],
  rating: ["reviews", "ratings"],
  project: ["projects", "portfolio"],
  projects: ["projects"],
  job: ["projects"],
  jobs: ["projects"],
  product: ["catalog", "products", "inventory"],
  products: ["catalog", "inventory"],
  inventory: ["catalog", "inventory"],
  stock: ["catalog", "inventory"],
  service: ["catalog", "services"],
  services: ["catalog"],
  competitor: ["competitors", "competitive"],
  competitors: ["competitors"],
  report: ["analytics", "reporting", "kpis"],
  reports: ["analytics", "reporting"],
  metric: ["analytics", "kpis"],
  metrics: ["analytics", "kpis"],
  revenue: ["analytics", "pricing", "roi"],
  sales: ["crm", "pipeline", "analytics"],
};

const tokenize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

// Weights reflect how specific a signal is. A keyword match is a much stronger statement
// about what an app is for than a word appearing somewhere in its description.
const WEIGHTS = { keyword: 6, permission: 4, name: 3, category: 2, description: 1 };

export class CapabilityRecommender {
  constructor({ pluginManager } = {}) {
    this.plugins = pluginManager;
    this.index = new Map();
  }

  // Built once from the discovered manifests. Each app becomes a bag of weighted terms.
  build() {
    this.index.clear();
    for (const { id } of this.plugins?.list() ?? []) {
      const manifest = this.plugins.manifestFor(id);
      if (!manifest) continue;
      const terms = new Map();
      const add = (word, weight) => {
        if (!word || STOP_WORDS.has(word)) return;
        terms.set(word, Math.max(terms.get(word) ?? 0, weight));
      };

      for (const keyword of manifest.keywords ?? []) {
        for (const word of tokenize(keyword)) add(word, WEIGHTS.keyword);
      }
      // `execute:lead_creation` contributes "lead" and "creation".
      for (const permission of manifest.permissions?.required ?? []) {
        for (const word of tokenize(permission.replace(/[:_]/g, " "))) add(word, WEIGHTS.permission);
      }
      for (const word of tokenize(manifest.name)) add(word, WEIGHTS.name);
      for (const word of tokenize(manifest.category)) add(word, WEIGHTS.category);
      for (const word of tokenize(manifest.description)) add(word, WEIGHTS.description);

      this.index.set(id, {
        id,
        name: manifest.name,
        description: manifest.description,
        category: manifest.category ?? "uncategorized",
        dependencies: manifest.dependencies ?? [],
        capabilities: manifest.permissions?.required ?? [],
        terms,
      });
    }
    return this;
  }

  #expand(goal) {
    const words = tokenize(goal);
    const expanded = new Set(words);
    for (const word of words) for (const synonym of SYNONYMS[word] ?? []) expanded.add(synonym);
    return expanded;
  }

  // Returns every app that matched, best first, with the terms that caused the match.
  // Those matched terms are what an explanation is allowed to cite.
  score(goal) {
    if (!this.index.size) this.build();
    const wanted = this.#expand(goal);
    const results = [];

    for (const entry of this.index.values()) {
      let score = 0;
      const matched = [];
      for (const word of wanted) {
        const weight = entry.terms.get(word);
        if (weight) { score += weight; matched.push(word); }
      }
      if (score > 0) results.push({ ...entry, score, matched });
    }

    return results.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  }

  // The spec's section 63 response. `already_installed` matters: the honest answer to
  // "I need to track customers" when CRM is installed is "you already have it", not a
  // second install prompt.
  recommend(goal, { installedIds = [] } = {}) {
    const ranked = this.score(goal);
    const installed = new Set(installedIds);

    if (!ranked.length) {
      return {
        goal,
        recommended_plugin: null,
        reason: "No installed or available app declares a capability that matches this goal.",
        required_capabilities: [],
        already_installed: false,
        alternatives: [],
      };
    }

    // An app the owner already has always wins over suggesting a new install, as long as
    // it is a genuine match rather than a weak one.
    const best = ranked[0];
    const installedMatch = ranked.find((entry) => installed.has(entry.id) && entry.score >= best.score * 0.6);
    const chosen = installedMatch ?? best;

    return {
      goal,
      recommended_plugin: chosen.id,
      recommended_name: chosen.name,
      reason: `${chosen.name} covers ${chosen.matched.slice(0, 3).join(", ")}.`,
      required_capabilities: chosen.capabilities.slice(0, 6),
      already_installed: installed.has(chosen.id),
      confidence: chosen.score,
      matched_terms: chosen.matched,
      alternatives: ranked
        .filter((entry) => entry.id !== chosen.id)
        .slice(0, 3)
        .map((entry) => ({ id: entry.id, name: entry.name, already_installed: installed.has(entry.id) })),
    };
  }
}
