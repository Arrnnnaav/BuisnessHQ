import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api.js";
import { extractElements } from "../../pointai/extract.js";
import { HighlightOverlay } from "../../pointai/HighlightOverlay.jsx";

// Floating Guide (adopted guide spec sections 5, 6, 54, 55). It is core and always
// present, so it works on a workspace with nothing installed.
//
// The panel never acts on its own. Every action it offers came back from the server as a
// validated proposal, and clicking it calls /api/guide/action, which validates again.

function Suggestion({ item, onAct }) {
  return (
    <div className="guide-suggestion">
      <p>{item.text}</p>
      <small className="muted">Because: {item.evidence}</small>
      {item.action && (
        <button type="button" className="btn" onClick={() => onAct(item.action)}>Show me</button>
      )}
    </div>
  );
}

export function GuidePanel({ open, onClose, navigation }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [context, setContext] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pointer, setPointer] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    api.guideContext(pathname).then(setContext).catch(() => setContext(null));
    api.guideSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, [open, pathname]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const act = useCallback(async (action) => {
    try {
      const result = await api.guideAction(action);
      // Navigation is the one action whose effect is in the browser, so the panel
      // performs the routing the server just approved.
      if (result.route) { navigate(result.route); onClose(); }
      if (result.type === "external.open") { window.open(result.url, "_blank", "noopener,noreferrer"); return; }
      if (result.performed === "plugin.install") await navigation?.reload();
      if (result.performed === "tasks.create") {
        setMessages((prior) => [...prior, { role: "guide", text: `Added "${result.task.title}" to your tasks.` }]);
      }
    } catch (cause) {
      setMessages((prior) => [...prior, { role: "guide", text: cause.message }]);
    }
  }, [navigate, onClose, navigation]);

  // "Show me where" — internal PointAI. The DOM is read here, matched on the server, and
  // the answer is a ring. Nothing is clicked, typed or submitted (guide spec section 21).
  const showMeWhere = useCallback(async (goal) => {
    const { refs, compact } = extractElements(document);
    try {
      const result = await api.pointaiMatch({ goal, elements: compact, host: "internal", stepContext: pathname });
      if (result.index === null || result.confidence === "low") {
        setMessages((prior) => [...prior, { role: "guide", text: result.reasoning ?? "I could not find that on this screen." }]);
        return;
      }
      setPointer({
        target: refs[result.index],
        confidence: result.confidence,
        label: result.element?.text || result.element?.aria || goal,
        instruction: result.instruction,
      });
    } catch (cause) {
      setMessages((prior) => [...prior, { role: "guide", text: cause.message }]);
    }
  }, [pathname]);

  const send = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prior) => [...prior, { role: "owner", text }]);
    setBusy(true);
    try {
      const reply = await api.guideMessage({ text, route: pathname });
      // Intent is classified on the server, so the panel only decides how to render the
      // answer. A pointing question is answered by highlighting a real control.
      if (reply.kind === "point") {
        setMessages((prior) => [...prior, { role: "guide", text: reply.text }]);
        await showMeWhere(reply.goal);
        return;
      }
      if (reply.kind === "setup") {
        setMessages((prior) => [...prior, { role: "guide", text: reply.text, setup: reply.setup, actions: reply.actions ?? [] }]);
        return;
      }
      setMessages((prior) => [...prior, { role: "guide", text: reply.text, actions: reply.actions ?? [], canDo: reply.canDo ?? [] }]);
    } catch (cause) {
      setMessages((prior) => [...prior, { role: "guide", text: cause.message }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
    {pointer && (
      <HighlightOverlay target={pointer.target} confidence={pointer.confidence}
                        label={pointer.label} instruction={pointer.instruction}
                        onDismiss={() => setPointer(null)} />
    )}
    <aside className="guide-panel" role="dialog" aria-label="BusinessOS Guide">
      <header className="guide-header">
        <div>
          <b>Guide</b>
          {context?.page && <small className="muted"> · {context.page.title}</small>}
        </div>
        <button type="button" className="icon-btn" aria-label="Close guide" onClick={onClose}>×</button>
      </header>

      <div className="guide-body">
        {messages.length === 0 && (
          <>
            {context?.page && (
              <div className="guide-message guide-from-guide">
                <p>{context.page.what}</p>
                {context.page.can?.length > 0 && (
                  <ul>{context.page.can.map((item) => <li key={item}>{item}</li>)}</ul>
                )}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="guide-suggestions">
                <p className="nav-section-label">Worth a look</p>
                {suggestions.map((item) => <Suggestion key={item.id} item={item} onAct={act} />)}
              </div>
            )}
          </>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`guide-message ${message.role === "owner" ? "guide-from-owner" : "guide-from-guide"}`}>
            <p>{message.text}</p>
            {message.canDo?.length > 0 && <ul>{message.canDo.map((item) => <li key={item}>{item}</li>)}</ul>}
            {message.setup?.steps?.length > 0 && <ol>{message.setup.steps.map((step) => <li key={`${step.action}-${step.target}`}><b>{step.target}:</b> {step.instruction}</li>)}</ol>}
            {message.actions?.length > 0 && (
              <div className="guide-actions">
                {message.actions.map((action) => (
                  <button key={action.label} type="button" className="btn btn-primary" onClick={() => act(action)}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="muted">Thinking…</p>}
        <div ref={endRef} />
      </div>

      <form className="guide-input" onSubmit={send}>
        <input value={input} onChange={(event) => setInput(event.target.value)}
               placeholder="Ask about this page, or what you need" aria-label="Ask the Guide" />
        <button className="btn btn-primary" type="submit" disabled={busy}>Ask</button>
      </form>
    </aside>
    </>
  );
}

export function GuideLauncher({ onClick, open }) {
  return (
    <button type="button" className="guide-launcher" onClick={onClick}
            aria-label={open ? "Close the Guide" : "Open the Guide"} aria-expanded={open}>
      {open ? "×" : "?"}
    </button>
  );
}
