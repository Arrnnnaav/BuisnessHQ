import { useEffect, useRef, useState } from "react";

// The PointAI highlight ring, ported from the standalone project's PointAI.js.
//
// Kept from the original: a ring tracked every frame with requestAnimationFrame against
// getBoundingClientRect, two visual states (solid for confident, dashed for a guess), and
// scrollIntoView to bring the target into view.
//
// Changed: the original measured through an iframe and subtracted two offset rects. Here
// the element is in this document, so viewport coordinates and a fixed-position ring are
// enough — which also means the ring cannot drift out of sync with what it points at.
//
// PERMANENT RULE (guide spec section 21): this component reads geometry and draws. It must
// never call .click(), .focus(), .submit(), set a value, or dispatch an event. PointAI
// points; the owner acts.

export function HighlightOverlay({ target, confidence = "high", label, instruction, onDismiss }) {
  const [rect, setRect] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!target) { setRect(null); return undefined; }

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    // Polled rather than observed, so scrolling, reflow and animation are all tracked by
    // the same cheap path the original used.
    const tick = () => {
      const box = target.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        setRect(null);
      } else {
        setRect((previous) => {
          const next = { top: box.top, left: box.left, width: box.width, height: box.height };
          if (previous && previous.top === next.top && previous.left === next.left
              && previous.width === next.width && previous.height === next.height) return previous;
          return next;
        });
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onDismiss?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  if (!rect) return null;

  const padding = 6;
  return (
    <div className="pointai-layer" aria-live="polite">
      <div
        className={`pointai-ring pointai-ring-${confidence}`}
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />
      <div
        className="pointai-tooltip"
        style={{ top: rect.top + rect.height + padding + 8, left: rect.left - padding }}
      >
        <b>{confidence === "high" ? "Here" : "Best guess"}</b>
        <p>{instruction ?? label}</p>
        {/* Said plainly, because the owner is the one who has to act. */}
        <small>PointAI shows you where. You do the clicking.</small>
        <button type="button" className="btn" onClick={onDismiss}>Got it</button>
      </div>
    </div>
  );
}
