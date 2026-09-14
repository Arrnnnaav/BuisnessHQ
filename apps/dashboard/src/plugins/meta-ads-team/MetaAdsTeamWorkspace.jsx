const employees = [
  ["Strategist", "Finds the angle before spend: research, audience, offer economics."],
  ["Copywriter", "Creates proof-led hooks, primary text, headlines, and placement variants."],
  ["Creative", "Prepares static, video, carousel, and 9:16 / 4:5 / 1:1 variants."],
  ["Media Buyer", "Builds draft campaigns, targeting, budgets, and launch plans."],
  ["Optimizer", "Checks evidence sufficiency and proposes guarded hold, reduce, pause, or scale decisions."],
  ["Analyst", "Normalizes metrics, reconciles sales attribution, and diagnoses performance."],
  ["Account Manager", "Prepares reports, approval requests, client messages, and next-test briefs."],
];
const phases = ["Research", "Copy", "Creative", "Build", "Launch", "Optimize", "Report", "Client", "Repeat"];

export function MetaAdsTeamWorkspace() {
  return <div className="stack"><section className="card hero"><p className="eyebrow">AI META ADS TEAM · STAGING</p><h2>One coordinated advertising team.</h2><p className="muted">Seven specialists share structured artifacts, one approval layer, and one evidence-bound feedback loop.</p><span className="tag green">Recommendations only · no Meta writes</span></section><section className="card"><h2>Current workflow</h2><div className="workflow-steps">{phases.map((phase, index) => <div className="workflow-step" key={phase}><span>{index + 1}</span><small>{phase}</small></div>)}</div></section><section className="card"><h2>Team</h2><div className="agent-grid">{employees.map(([name, detail]) => <article className="agent-card" key={name}><b>{name}</b><p className="muted">{detail}</p></article>)}</div></section><section className="grid two"><div className="card"><h2>Safety gates</h2><div className="list-row"><span>Budget changes</span><span className="tag green">Approval required</span></div><div className="list-row"><span>Data sufficiency</span><span className="tag green">Checked first</span></div><div className="list-row"><span>Attribution</span><span className="tag">Sales source preferred</span></div></div><div className="card"><h2>What to connect next</h2><p className="muted">Connect Meta read access and a verified sales source before importing campaigns or evaluating winners. Launch and automated optimization remain disabled until reviewed adapters exist.</p></div></section></div>;
}
