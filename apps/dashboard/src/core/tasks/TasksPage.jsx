import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setTasks(await api.tasks(filter)); setError(""); }
    catch (cause) { setError(cause.message); }
  };

  useEffect(() => { refresh(); }, [filter]);

  const create = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.createTask({ title, detail, dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null, source: "owner" });
      setTitle(""); setDetail(""); setDueAt(""); await refresh();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const setStatus = async (task, status) => {
    try { await api.setTaskStatus(task.id, status); await refresh(); }
    catch (cause) { setError(cause.message); }
  };

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Today</p><h1>Tasks</h1><p className="muted">A durable list for owner work and suggestions from BusinessOS.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Open</option><option value="done">Done</option><option value="dismissed">Dismissed</option></select></div>
    {error && <div className="notice notice-error">{error}</div>}
    <form className="card task-form" onSubmit={create}><div className="form-grid"><input aria-label="Task title" placeholder="What needs doing?" value={title} onChange={(event) => setTitle(event.target.value)} required /><input aria-label="Due date" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><input aria-label="Task detail" placeholder="Optional detail" value={detail} onChange={(event) => setDetail(event.target.value)} /><button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add task"}</button></div></form>
    <div className="stack">{tasks.map((task) => <article className="card task-row" key={task.id}><div><h3>{task.title}</h3><p className="muted">{task.detail || "No additional detail."}</p><small className="muted">{task.source}{task.pluginId ? ` · ${task.pluginId}` : ""}{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</small></div><div className="task-actions">{task.status === "open" ? <><button className="btn" onClick={() => setStatus(task, "done")}>Done</button><button className="btn btn-quiet" onClick={() => setStatus(task, "dismissed")}>Dismiss</button></> : <button className="btn btn-quiet" onClick={() => setStatus(task, "open")}>Reopen</button>}</div></article>)}{!tasks.length && <div className="empty-state"><h2>No {filter} tasks</h2><p>Create one above, or ask the Guide to add work for you.</p></div>}</div>
  </div>;
}
