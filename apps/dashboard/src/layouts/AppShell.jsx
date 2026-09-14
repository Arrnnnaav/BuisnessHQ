import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.jsx";
import { GuideLauncher, GuidePanel } from "../core/guide/GuidePanel.jsx";

// Standard page header (plan section 42): eyebrow, title, one-sentence explanation,
// primary actions on the right.
const HEADINGS = {
  "/home": ["Business command center", "Home", "What changed, what needs you, and what to do today."],
  "/company-brain": ["Business command center", "Company Brain", "The verified facts your apps and AI rely on."],
  "/needs-you": ["Decisions", "Needs You", "Work waiting on your approval before anything leaves the building."],
  "/ask": ["Assistant", "Ask BusinessOS", "Ask about your business in plain language."],
  "/business-profile": ["Business command center", "Business Profile", "The foundation every app and answer is grounded in."],
  "/tasks": ["Today", "Tasks", "Your to-do list, including work the system suggests."],
  "/apps": ["Platform", "Apps & Features", "Everything installed, and how it is behaving."],
  "/marketplace": ["Platform", "Marketplace", "Add capabilities to your business."],
  "/connections": ["Platform", "AI & Connections", "Which AI runs your work, and which accounts are connected."],
  "/test-lab": ["Platform", "Test Lab", "Try actions safely. Nothing leaves your computer."],
  "/activity": ["Platform", "Activity", "Everything the system did, and why."],
  "/settings": ["Platform", "Settings", "Company, safety, notifications, and data."],
};

export function AppShell({ navigation, badges, company }) {
  const { pathname } = useLocation();
  const [guideOpen, setGuideOpen] = useState(false);
  const [eyebrow, title, blurb] = HEADINGS[pathname] ?? ["Growth App", "", ""];

  return (
    <div className="shell">
      <Sidebar navigation={navigation} badges={badges} company={company} />
      <main>
        {title && (
          <header>
            <div>
              <p className="eyebrow">{eyebrow.toUpperCase()}</p>
              <h1>{title}</h1>
              <p className="page-blurb">{blurb}</p>
            </div>
            <div className="header-actions">
              <button type="button" className="icon-btn" aria-label="Search">⌕</button>
              <button type="button" className="avatar" aria-label="Account">{(company ?? "A").slice(0, 1)}</button>
            </div>
          </header>
        )}
        <section className="view">
          <Outlet />
        </section>
      </main>

      {/* Core, so it is present on every page including an empty workspace. */}
      <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} navigation={navigation} />
      <GuideLauncher open={guideOpen} onClick={() => setGuideOpen((value) => !value)} />
    </div>
  );
}
