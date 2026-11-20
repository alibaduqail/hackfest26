// bubble.css (imported by JourneyApp and LiveScreen) holds the portrait, so this module stays loadable in the node tests.
// Mara speaks once when a screen opens: portrait + speech strip, bottom-left. Click it (or wait) to dismiss. Additive: Dialogue.tsx is untouched.
import { useEffect, useState } from "react";
import { holdMs } from "./lines";

export function MaraBubble({ text, resetKey }: { text: string; resetKey?: string | number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(true);
    const t = setTimeout(() => setOpen(false), holdMs(text) + 2500);
    return () => clearTimeout(t);
  }, [text, resetKey]);
  if (!text || !open) return null;
  return (
    <button type="button" className="mara-bubble" onClick={() => setOpen(false)} aria-label={`Mara: ${text}`}>
      <span className="mb-face" aria-hidden />
      <p><small>MARA</small>{text}</p>
    </button>
  );
}
