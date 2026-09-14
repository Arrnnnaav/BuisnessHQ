import assert from "node:assert/strict";
import { dataSufficiency, recommendOptimization, validateBudgetChange } from "../plugins/meta-ads-team/services/safety.mjs";
import { normalizeMetaInsight as normalize } from "../plugins/meta-ads-team/services/metrics.mjs";
import { ExperimentEngine } from "../services/experiments.mjs";

assert.equal(dataSufficiency({ spend: 20, conversions: 1 }).sufficient, false);
assert.equal(validateBudgetChange({ currentDaily: 100, nextDaily: 150, maxDaily: 300, maxChangePercent: 20 }).allowed, false);
assert.equal(validateBudgetChange({ currentDaily: 100, nextDaily: 110, maxDaily: 300, maxChangePercent: 20, approved: true }).allowed, true);
assert.equal(recommendOptimization({ spend: 200, conversions: 4, revenue: 100, targetRoas: 2 }).action, "pause");
assert.equal(recommendOptimization({ spend: 20, conversions: 1, targetCpa: 20 }).action, "hold");
assert.equal(normalize({ spend: "50", clicks: "10", impressions: "100", conversions: "2" }, { revenue: 150, orders: 2, source: "orders" }).roas, 3);
const engine = new ExperimentEngine(); const experiment = engine.create({ clientId: "client-1", hypothesis: "Number hook improves CPA", control: "control", variant: "variant" });
engine.transition(experiment.id, "running"); engine.transition(experiment.id, "data_sufficient"); engine.transition(experiment.id, "winner", { decision: "variant" });
assert.equal(engine.list("client-1")[0].status, "winner");
console.log("meta ads safety self-test passed");
