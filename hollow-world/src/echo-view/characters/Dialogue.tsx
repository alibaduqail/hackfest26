// Director and Mara talk over the Descent map. Mount once inside the map (.world); it listens to the run through props only.
import { useEffect, useRef, useState } from "react";
import type { Observation } from "../../echo/types";
import { enqueue, holdMs, type Line, type LineCtx, newLines } from "./lines";
import directorImg from "./art/director-a-portrait-64x64.png";
import maraImg from "./art/mara-portrait-64x64.png";
import "./dialogue.css";

const WHO = {
  director: { img: directorImg, label: "THE DIRECTOR · TOWER PA" },
  mara: { img: maraImg, label: "MARA" },
};
const FADE_MS = 350;

export function Dialogue({ obs, previous, ended, stars, coach, placed }: { obs: Observation; previous: Observation } & LineCtx) {
  const fired = useRef(new Set<string>());
  const queue = useRef<Line[]>([]);
  const busy = useRef(false);
  const [cur, setCur] = useState<{ line: Line; n: number } | null>(null);
  const [out, setOut] = useState(false);
  const count = useRef(0);
  const ctx = useRef({ ended, stars, coach, placed });
  ctx.current = { ended, stars, coach, placed };

  function pump() {
    if (busy.current) return;
    const line = queue.current.shift();
    if (!line) return;
    busy.current = true;
    setOut(false);
    setCur({ line, n: ++count.current });
  }
  useEffect(() => {
    if (obs.tick === 0) { // a fresh or restarted run
      fired.current.clear();
      queue.current = [];
      busy.current = false;
      setCur(null);
      return;
    }
    const lines = newLines(previous, obs, fired.current, ctx.current);
    if (!lines.length) return;
    for (const l of lines) fired.current.add(l.id);
    queue.current = enqueue(queue.current, lines);
    pump();
  }, [obs, previous]);
  useEffect(() => {
    if (!cur) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = holdMs(cur.line.text);
    const fade = setTimeout(() => setOut(true), hold);
    const done = setTimeout(() => {
      busy.current = false;
      setCur(null);
      pump();
    }, hold + (reduced ? 0 : FADE_MS));
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [cur]);

  return (
    <div className="dialogue-layer"> {/* clips the slide-in at the map edge so it never adds scrollbars */}
      {cur && (
        <div className={`dialogue ${cur.line.who}${out ? " out" : ""}`} role="status" aria-live="polite" key={cur.n}>
          <img src={WHO[cur.line.who].img} alt="" width={192} height={192} />
          <p><small>{WHO[cur.line.who].label}</small>{cur.line.text}</p>
        </div>
      )}
    </div>
  );
}
