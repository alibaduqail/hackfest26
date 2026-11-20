import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { RelayBar, type RelayItem } from "../relay/Relay";
import { beginTransition } from "./beginTransition";
import { useEnterKey } from "./keys";
import type { TitleProps } from "./props";
import { shouldPlayPremise } from "./premiseFlag";
import { useParallax } from "./useParallax";

// Loaded on demand: first visit only, and it keeps the png/webp art out of the module graph for the server-side screen tests.
const PremiseIntro = lazy(() => import("./PremiseIntro").then((m) => ({ default: m.PremiseIntro })));

/** The front door: the name and Relay nodes over the 2D Descent still (.j-title-bg: the far parallax layer; the wordmark is the mid layer; the Relay nodes stay still). Nothing else. */
export function TitleScreen({ onBegin, onContinue, onTowerDown, onStrata, onFreePlay }: TitleProps) {
  // Begin / Continue / New journey leave through the sonar burst + fade to black (beginTransition); repeat activations while it plays are ignored.
  const leave = (go: () => void, from?: Element | null) => beginTransition(from ?? document.querySelector(".g-title-main .rl-node[data-tone=primary] .rl-dot"), go);
  const dotOf = (e?: { currentTarget: EventTarget | null }) => (e?.currentTarget instanceof Element ? e.currentTarget.querySelector(".rl-dot") : null);
  useEnterKey(() => leave(onContinue ?? onBegin));
  // First visit only: the premise plays over the backdrop, then the title fades in underneath. "hold" = playing, "reveal" = title fading in.
  const [intro, setIntro] = useState<"hold" | "reveal" | "off">(() => (shouldPlayPremise() ? "hold" : "off"));
  const bg = useRef<HTMLDivElement>(null), mark = useRef<HTMLHeadingElement>(null);
  useParallax(bg, mark);
  // If focus has fallen to the page (a click on the backdrop, a late autofocus), an arrow key would do nothing and the next Enter would hit the
  // screen-level Continue. Pull the arrow into the start bar first, so "ArrowRight, Enter" always means the node the player moved to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
      const nodes = document.querySelectorAll<HTMLElement>(".g-title-main .rl-node:not([disabled])");
      const to = e.key === "ArrowRight" ? nodes[nodes.length - 1] : nodes[0];
      if (!to) return;
      e.preventDefault();
      to.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const main: RelayItem[] = onContinue
    ? [
        { key: "continue", label: "Continue", tone: "primary", autoFocus: true, onSelect: (e) => leave(onContinue, dotOf(e)) },
        { key: "begin", label: "New journey", tone: "secondary", onSelect: (e) => leave(onBegin, dotOf(e)) },
      ]
    : [{ key: "begin", label: "Begin", tone: "primary", autoFocus: true, onSelect: (e) => leave(onBegin, dotOf(e)) }];
  const more: RelayItem[] = [];
  if (onTowerDown) more.push({ key: "tower", label: "Tower Down", tone: "quiet", nav: true, onSelect: onTowerDown });
  if (onStrata) more.push({ key: "strata", label: "The city Echo keeps alive", tone: "quiet", nav: true, onSelect: onStrata });
  if (onFreePlay) more.push({ key: "free", label: "Descent", tone: "quiet", nav: true, onSelect: onFreePlay });
  return (
    <>
    <div className="j-title-bg" ref={bg} aria-hidden="true" />
    {intro !== "off" && <Suspense fallback={null}><PremiseIntro onTitle={() => setIntro((i) => (i === "hold" ? "reveal" : i))} onDone={() => setIntro("off")} /></Suspense>}
    <div className={"g-screen g-title j-title" + (intro === "hold" ? " pi-hold" : intro === "reveal" ? " pi-reveal" : "")}>
      <h1 ref={mark} aria-label="Echo"><span aria-hidden>ECHO</span><i aria-hidden>ECHO</i></h1>
      <RelayBar size="lg" label="Start" className="g-title-main" items={main} />
      {more.length > 0 && <RelayBar size="md" label="More" className="g-title-more" rest={null} items={more} />}
    </div>
    </>
  );
}
