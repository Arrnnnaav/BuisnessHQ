const ACTIONS = new Set(["hold", "pause", "reduce", "scale", "refresh", "investigate"]);

export function dataSufficiency({ spend = 0, conversions = 0, minSpend = 100, minConversions = 3 } = {}) {
  const reasons = [];
  if (Number(spend) < Number(minSpend)) reasons.push(`spend ${spend} is below ${minSpend}`);
  if (Number(conversions) < Number(minConversions)) reasons.push(`conversions ${conversions} are below ${minConversions}`);
  return { sufficient: reasons.length === 0, reasons };
}

export function validateBudgetChange({ currentDaily = 0, nextDaily = 0, maxDaily = Infinity, maxChangePercent = 20, approved = false } = {}) {
  const current = Number(currentDaily); const next = Number(nextDaily); const reasons = [];
  if (!Number.isFinite(current) || !Number.isFinite(next) || current < 0 || next < 0) reasons.push("daily budgets must be non-negative numbers");
  if (next > Number(maxDaily)) reasons.push(`next daily budget ${next} exceeds maximum ${maxDaily}`);
  const changePercent = current === 0 ? (next === 0 ? 0 : Infinity) : Math.abs((next - current) / current) * 100;
  if (changePercent > Number(maxChangePercent)) reasons.push(`budget change ${Math.round(changePercent)}% exceeds ${maxChangePercent}% limit`);
  return { allowed: reasons.length === 0 && (approved || changePercent === 0), requiresApproval: changePercent > 0, changePercent, reasons };
}

export function recommendOptimization({ spend, conversions, revenue, targetCpa, targetRoas, currentDaily, maxDaily, minSpend = 100, minConversions = 3 } = {}) {
  const sufficiency = dataSufficiency({ spend, conversions, minSpend, minConversions });
  if (!sufficiency.sufficient) return { action: "hold", approvalRequired: false, dataSufficiency: sufficiency, reason: "Wait for enough evidence before changing spend." };
  const cpa = Number(conversions) > 0 ? Number(spend) / Number(conversions) : Infinity;
  const roas = Number(spend) > 0 ? Number(revenue ?? 0) / Number(spend) : 0;
  if (targetCpa && cpa > Number(targetCpa) * 1.4) return { action: "reduce", approvalRequired: true, dataSufficiency: sufficiency, cpa, roas, reason: `CPA ${cpa.toFixed(2)} is materially above target ${targetCpa}.` };
  if (targetRoas && roas < Number(targetRoas) * 0.6) return { action: "pause", approvalRequired: true, dataSufficiency: sufficiency, cpa, roas, reason: `ROAS ${roas.toFixed(2)} is materially below target ${targetRoas}.` };
  if (targetCpa && cpa <= Number(targetCpa) && currentDaily < maxDaily) return { action: "scale", approvalRequired: true, dataSufficiency: sufficiency, cpa, roas, reason: "Evidence supports a possible scale; budget policy and owner approval are still required." };
  return { action: "hold", approvalRequired: false, dataSufficiency: sufficiency, cpa, roas, reason: "No guarded change is justified by the configured thresholds." };
}

export function assertOptimizationAction(action) { if (!ACTIONS.has(action)) throw new Error(`Unknown optimization action: ${action}`); return action; }
