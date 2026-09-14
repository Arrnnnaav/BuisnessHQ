import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

const fields = [["businessName", "Business name"], ["industry", "Industry"], ["website", "Website"], ["description", "What does the company do?"], ["email", "Business email"], ["phone", "Phone"], ["city", "City"], ["state", "State / province"], ["country", "Country"]];

export function BusinessProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api.state().then((state) => { setProfile(state.profile); setForm(state.profile); }).catch((cause) => setError(cause.message)); }, []);
  const save = async (event) => { event.preventDefault(); try { const result = await api.updateProfile({ ...form, serviceAreas: String(form.serviceAreas ?? "").split(",").map((item) => item.trim()).filter(Boolean), goals: String(form.goals ?? "").split(",").map((item) => item.trim()).filter(Boolean) }); setProfile(result); setForm(result); setMessage("Profile saved"); setError(""); } catch (cause) { setError(cause.message); } };
  if (!profile) return <p className="notice">Loading profile…</p>;
  return <div className="stack">
    {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="notice" aria-live="polite">{message}</p>}
    <form className="card form-grid profile-form" onSubmit={save}>{fields.map(([key, label]) => <label key={key}>{label}<input value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}<label>Service areas<input value={Array.isArray(form.serviceAreas) ? form.serviceAreas.join(", ") : form.serviceAreas ?? ""} onChange={(event) => setForm({ ...form, serviceAreas: event.target.value })} /></label><label>Business goals<input value={Array.isArray(form.goals) ? form.goals.join(", ") : form.goals ?? ""} onChange={(event) => setForm({ ...form, goals: event.target.value })} /></label><div><button className="btn btn-primary">Save profile</button></div></form>
    <div className="card"><h2>How this is used</h2><p className="muted">This verified profile grounds the catalog, Company Brain, AI answers, SEO recommendations, and setup guidance. Credentials belong in Connections, not here.</p></div>
  </div>;
}
