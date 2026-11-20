import { useEffect, useRef } from "react";
import maraSprite from "../cutaway/art/mara.png";
import podImg from "../cutaway/art/med-1.webp";
import {
  ART_H, ART_W, B3A, B3B, B3C, BOLT, BOLT1, BX, BY, DARK, DIR, ECHO0, ECHO1, HANDOFF, HOP, LAMP, PAOFF, PL, POD0, POD1, ROUTE, CLINIC,
  SEG, LEN, STILLS, STILL_HOLD, TITLE, bandAlpha, BANDS, clamp, ease, fadeIn, inout, lights, podAt, pulseY,
} from "./premiseTimeline";
import { markPremiseSeen } from "./premiseFlag";
import "./premise.css";

const ROUTE_D = "M430 196 H857 V888 H1150", DET_D = "M857 545 H700 V720 H857";

type Props = {
  /** The dark has started to lift and the real title should begin fading in. Called once. */
  onTitle: () => void;
  /** The intro is finished and can be unmounted. Called once. */
  onDone: () => void;
};

/**
 * The premise: the Director's PA kills the levels top to bottom, Mara's radio plea, and three shown beats (bolt a beacon, news hops, the pod
 * reroutes). Set into the Descent art in art pixels, so every word stays pinned to the shaft. No boxes. The light is the art relit through a
 * half-resolution dark canvas; the rest is transforms and opacity driven from one rAF loop, never React state. Any key or the Skip node jumps
 * to the title. Reduced motion shows stills, crossfaded.
 */
export function PremiseIntro({ onTitle, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef({ onTitle, onDone });
  cb.current = { onTitle, onDone };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = (k: string) => el.querySelector<SVGElement | HTMLElement>(`[data-k="${k}"]`) as HTMLElement & SVGElement;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cv = $("dark") as unknown as HTMLCanvasElement, ctx = cv.getContext("2d");
    const stage = $("stage"), skip = $("skip");
    const NS = "http://www.w3.org/2000/svg";
    const op = (e: Element, v: number) => { (e as HTMLElement).style.opacity = String(v); };

    // beacons: amber dot with a hairline ring that closes onto it like a bolt tightening
    const beac = BY.map((y) => {
      const g = document.createElementNS(NS, "g");
      g.innerHTML = `<circle cx="${BX}" cy="${y}" r="11" fill="none" stroke-width="1.5"/><circle cx="${BX}" cy="${y}" r="6" fill="#d2a76a"/>`;
      $("beacons").appendChild(g);
      return g;
    });
    const mr = $("mrP") as unknown as SVGGeometryElement & HTMLElement, md = $("mdP") as unknown as SVGGeometryElement & HTMLElement;
    const lenR = mr.getTotalLength(), lenD = md.getTotalLength();
    mr.style.strokeDasharray = String(lenR);
    md.style.strokeDasharray = String(lenD);
    const sDet = SEG.slice(0, 2).reduce((a, b) => a + b, 0);
    const ptrans = (e: Element, v: string) => e.setAttribute("transform", v);

    function drawDark(t: number) {
      if (!ctx) return;
      const k = cv.width / ART_W;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, cv.width, cv.height);
      const lift = 1 - ease((t - TITLE) / 1800);
      BANDS.forEach(([a, b], i) => {
        const al = bandAlpha(t, i, reduced) * lift;
        if (al > 0) { ctx.fillStyle = `rgba(4,7,9,${al})`; ctx.fillRect(0, a * k, cv.width, (b - a) * k + 1); }
      });
      ctx.globalCompositeOperation = "destination-out";
      for (const [x, y, r] of lights(t)) {
        if (r < 2) continue;
        const g = ctx.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(.5, "rgba(0,0,0,.82)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect((x - r) * k, (y - r) * k, 2 * r * k, 2 * r * k);
      }
    }

    function render(t: number) {
      drawDark(t);
      const rec = ease((t - TITLE) / 1400), keep = 1 - rec;
      // 1 the Director: cut in, no fade; the PA clicks off all at once
      const on = (s: number) => (t >= s && t < PAOFF ? 1 : 0);
      op($("dirMark"), on(DIR[0]));
      DIR.forEach((s, i) => op($("d" + (i + 1)), on(s)));
      // 2 Mara: the lamp first, then her words in radio phrases
      op($("mara"), fadeIn(t, LAMP + 200, 400) * (1 - fadeIn(t, POD0 - 50, 150)));
      const pleaOut = 1 - fadeIn(t, B3A, 400);
      const tag = fadeIn(t, PL[0] - 200, 300) * pleaOut;
      op($("cord"), tag); op($("ptag"), tag);
      PL.forEach((s, i) => {
        const e = $("pl" + i), f = fadeIn(t, s, 240);
        op(e, f * pleaOut);
        ptrans(e, `translate(0,${reduced ? 0 : 4 * (1 - ease(f))})`);
      });
      op($("clinic"), fadeIn(t, CLINIC, 400) * keep);
      $("clinicFill").setAttribute("opacity", String(fadeIn(t, POD1, 300)));
      mr.style.strokeDashoffset = String(lenR * (1 - inout((t - ROUTE) / 1000)));
      op($("route"), (t >= ROUTE ? 1 : 0) * (t > B3A ? .45 : .8) * keep);
      // 3a / 3b beacons: dot settles, ring closes; teal flash when the news lands
      beac.forEach((g, i) => {
        const b = t - BOLT[i], ring = g.children[0], dot = g.children[1];
        op(g, (b >= 0 ? 1 : 0) * keep);
        dot.setAttribute("r", String(6 * ease(b / 160)));
        const flash = Math.max(i > 0 && t >= HOP[i] ? clamp(1 - (t - HOP[i]) / 500) : 0, t > ECHO0 && t < TITLE ? clamp(1 - Math.abs(pulseY(t) - BY[i]) / 60) : 0);
        ring.setAttribute("r", String(11 + 16 * (1 - ease(b / 300))));
        ring.setAttribute("stroke", flash > .05 ? "#7ec8b3" : "#e4c494");
        ring.setAttribute("stroke-opacity", String(.5 + .5 * flash));
      });
      // the news: one teal pulse hopping down, beacon to beacon; then the echo back up
      const pulse = $("pulse");
      let py: number | null = null;
      for (let i = 1; i < 5; i++) if (t >= HOP[i] - 280 && t < HOP[i]) py = BY[i - 1] + (BY[i] - BY[i - 1]) * inout((t - (HOP[i] - 280)) / 280);
      if (t > ECHO0 && t < ECHO1) py = pulseY(t);
      if (py != null && !reduced) { ptrans(pulse, `translate(${BX},${py})`); op(pulse, 1); } else op(pulse, 0);
      // 3c the pod leaves Mara's room, meets the Director's seal, finds the side passage
      op($("seal"), (t >= B3C ? 1 : 0) * keep);
      const [px, pyy, dir] = podAt(t);
      ptrans($("pod"), `translate(${px},${pyy}) scale(${dir},1)`);
      op($("pod"), (t >= POD0 - 50 ? 1 : 0) * keep);
      const dTrav = clamp((inout((t - POD0) / (POD1 - POD0)) * LEN - sDet) / lenD);
      md.style.strokeDashoffset = String(lenD * (1 - dTrav));
      op($("det"), keep);
      // captions
      op($("cap1"), fadeIn(t, BOLT1 + 200, 300) * (1 - fadeIn(t, B3B - 250, 250)));
      op($("cap2"), fadeIn(t, B3B + 150, 300) * (1 - fadeIn(t, B3C - 250, 250)));
      op($("cap3"), fadeIn(t, B3C + 150, 300) * keep);
      // the shade comes up to match the title backdrop; the Skip node leaves with the intro
      op($("shade"), rec);
      op(skip, t < TITLE ? 1 : 0);
      skip.style.pointerEvents = t < TITLE ? "auto" : "none";
    }

    let titled = false, done = false, raf = 0, tm = 0, skipped = false;
    const fireTitle = () => { if (!titled) { titled = true; cb.current.onTitle(); } };
    const finish = () => {
      if (done) return;
      done = true; titled = true;
      cancelAnimationFrame(raf); clearTimeout(tm); markPremiseSeen();
      cb.current.onDone();
    };

    // Block keys the title would otherwise act on (Enter on a focused Begin) while the intro owns the screen; any key skips.
    let jump = () => {};
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || titled) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) jump();
    };
    window.addEventListener("keydown", onKey, true);
    skip.addEventListener("click", () => jump());

    if (reduced) {
      let i = 0;
      render(STILLS[0]);
      const next = () => {
        if (skipped || i >= STILLS.length - 1) {
          stage.style.opacity = "0";
          tm = window.setTimeout(() => { fireTitle(); render(TITLE + 2600); stage.style.opacity = "1"; tm = window.setTimeout(finish, 350); }, 300);
          return;
        }
        stage.style.opacity = "0";
        tm = window.setTimeout(() => { render(STILLS[++i]); stage.style.opacity = "1"; tm = window.setTimeout(next, STILL_HOLD); }, 300);
      };
      tm = window.setTimeout(next, STILL_HOLD);
      jump = () => { skipped = true; clearTimeout(tm); next(); };
    } else {
      let t = 0, last = performance.now();
      jump = () => { skipped = true; if (t < TITLE) t = TITLE; };
      const loop = (now: number) => {
        t += Math.min(now - last, 250); last = now;
        if (t >= TITLE) fireTitle();
        if (t >= HANDOFF) { finish(); return; }
        render(t);
        raf = requestAnimationFrame(loop);
      };
      render(0);
      raf = requestAnimationFrame(loop);
    }
    return () => { window.removeEventListener("keydown", onKey, true); cancelAnimationFrame(raf); clearTimeout(tm); };
  }, []);

  return (
    <div className="pi" ref={root} aria-hidden="false">
      <div className="pi-stage" data-k="stage">
        <div className="pi-art" />
        <canvas className="pi-dark" data-k="dark" width={ART_W / 2} height={Math.round(ART_H / 2)} aria-hidden="true" />
        <div className="pi-shade" data-k="shade" />
        <svg className="pi-world" viewBox={`0 0 ${ART_W} ${ART_H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <mask id="pi-mRoute" maskUnits="userSpaceOnUse" x="0" y="0" width={ART_W} height={ART_H}><path data-k="mrP" d={ROUTE_D} fill="none" stroke="#fff" strokeWidth="6" /></mask>
            <mask id="pi-mDet" maskUnits="userSpaceOnUse" x="0" y="0" width={ART_W} height={ART_H}><path data-k="mdP" d={DET_D} fill="none" stroke="#fff" strokeWidth="6" /></mask>
          </defs>
          {/* 1. the Director: one cold line per level, cut in as each level dies */}
          <g fill="#c3cbcd" fontSize="28" role="group" aria-label="Tower address from the Director">
            <rect data-k="dirMark" x="996" y="118" width="12" height="12" fill="#e0634f" />
            <text data-k="d1" x="1024" y="136">This is the Director.</text>
            <text data-k="d2" x="1024" y="320">All transit is suspended.</text>
            <text data-k="d3" x="1024" y="492">I am shutting the tower down.</text>
          </g>
          <g data-k="route" mask="url(#pi-mRoute)"><path d={ROUTE_D} fill="none" stroke="#7ec8b3" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" /></g>
          <g data-k="det" mask="url(#pi-mDet)"><path d={DET_D} fill="none" stroke="#7ec8b3" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" /></g>
          <g data-k="seal"><rect x="825" y="626" width="64" height="12" fill="#1c0d0c" stroke="#e0634f" strokeWidth="2" /></g>
          {/* 2. Mara in her room, and her plea hung from her on a cord */}
          <g data-k="mara">
            <image href={maraSprite} x="396" y="140" width="48" height="72" />
            <text x="420" y="124" textAnchor="middle" fill="#d9c49c" fontSize="16">Mara</text>
          </g>
          <g fontSize="20" fill="#e9e0c8" role="group" aria-label="Radio message from level 1">
            <line data-k="cord" x1="420" y1="224" x2="420" y2="420" stroke="#e9e0c8" strokeOpacity=".28" strokeWidth="1.5" />
            <text data-k="ptag" x="420" y="444" fontSize="16" fill="#90a59f">Level 1, open channel</text>
            <text data-k="pl0" x="420" y="484">Anyone on the relay?</text>
            <text data-k="pl1" x="420" y="516">Nurse Mara and the medicine</text>
            <text data-k="pl2" x="420" y="548">have to reach the Deep Clinic.</text>
            <text data-k="pl3" x="420" y="580" fill="#edcd95">You have to help.</text>
          </g>
          <g data-k="clinic"><circle cx="1150" cy="888" r="9" fill="#0a1013" stroke="#7ec8b3" strokeWidth="2" /><circle data-k="clinicFill" cx="1150" cy="888" r="6" fill="#7ec8b3" opacity="0" /><text x="1150" y="864" textAnchor="middle" fill="#b4c4ba" fontSize="16">Deep Clinic</text></g>
          <g data-k="beacons" />
          <g data-k="pulse"><circle r="10" fill="none" stroke="#7ec8b3" strokeWidth="1.5" opacity=".5" /><circle r="5" fill="#7ec8b3" /></g>
          <g data-k="pod"><image href={podImg} x="-36" y="-14" width="72" height="27" /></g>
          {/* 3. captions hang off the thing they name on a hairline leader, clear of the shaft girders */}
          <g data-k="cap1" fontSize="20" fill="#e9e0c8"><line x1="876" y1="196" x2="972" y2="196" stroke="#e9e0c8" strokeOpacity=".4" strokeWidth="1.5" /><text x="980" y="203">Bolt a beacon to the track</text></g>
          <g data-k="cap2" fontSize="20" fill="#e9e0c8"><line x1="876" y1="545" x2="972" y2="545" stroke="#e9e0c8" strokeOpacity=".4" strokeWidth="1.5" /><text x="980" y="552">News hops beacon to beacon</text></g>
          <g data-k="cap3" fontSize="20" fill="#e9e0c8"><line x1="640" y1="632" x2="664" y2="632" stroke="#e9e0c8" strokeOpacity=".4" strokeWidth="1.5" /><text x="632" y="639" textAnchor="end">The pod reroutes itself. No tower</text></g>
        </svg>
      </div>
      <button type="button" className="pi-skip" data-k="skip">Skip<kbd>Any key</kbd></button>
    </div>
  );
}

