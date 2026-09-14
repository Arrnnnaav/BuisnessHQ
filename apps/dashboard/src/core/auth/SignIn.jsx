import { useEffect, useState } from "react";
import { api, session } from "../../services/api.js";

// Sign-in / first-run owner creation. Registration is only offered when no owner exists
// yet, because this is a single-owner workspace.
export function SignIn({ onSignedIn }) {
  const [status, setStatus] = useState(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.authStatus()
      .then((result) => { setStatus(result); setRegisterMode(!result.initialized); })
      .catch((cause) => setError(cause));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = registerMode ? form : { email: form.email, password: form.password };
      const result = registerMode ? await api.register(input) : await api.login(input);
      session.set(result.session.token);
      onSignedIn();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div className="empty-state signed-out"><p>Loading…</p></div>;

  return (
    <div className="empty-state signed-out">
      <h2>{registerMode ? "Create your workspace" : "Welcome back"}</h2>
      <p>
        {registerMode
          ? "Create the owner account for this company workspace."
          : `Sign in to manage your business.${status.ownerHint ? ` Owner: ${status.ownerHint}` : ""}`}
      </p>
      <form className="auth-form" onSubmit={submit}>
        {registerMode && (
          <input placeholder="Your name" value={form.name} autoComplete="name"
                 onChange={(event) => setForm({ ...form, name: event.target.value })} />
        )}
        <input type="email" placeholder="Email address" value={form.email} autoComplete="username"
               onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input type="password" placeholder="Password (12+ characters)" value={form.password}
               autoComplete={registerMode ? "new-password" : "current-password"}
               onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Working…" : registerMode ? "Create workspace" : "Sign in"}
        </button>
      </form>
      {error && <p className="auth-error">{error.message}</p>}
      {status.initialized && (
        <button type="button" className="link-btn" onClick={() => { setRegisterMode(!registerMode); setError(null); }}>
          {registerMode ? "I already have an account — sign in" : "First time here — create an owner account"}
        </button>
      )}
    </div>
  );
}
