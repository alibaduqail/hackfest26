import { useEffect } from "react";
import { RelayBar, type RelayItem } from "../relay/Relay";
import { useEnterKey } from "./keys";
import type { TitleProps } from "./props";

/** The front door: the name and Relay nodes over the 2D Descent still (.j-title-bg, mounted by the parent). Nothing else. */
export function TitleScreen({ onBegin, onContinue, onTowerDown, onStrata, onFreePlay }: TitleProps) {
  useEnterKey(onContinue ?? onBegin);
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
        { key: "continue", label: "Continue", tone: "primary", nav: true, autoFocus: true, onSelect: onContinue },
        { key: "begin", label: "New journey", tone: "secondary", nav: true, onSelect: onBegin },
      ]
    : [{ key: "begin", label: "Begin", tone: "primary", nav: true, autoFocus: true, onSelect: onBegin }];
  const more: RelayItem[] = [];
  if (onTowerDown) more.push({ key: "tower", label: "Tower Down", tone: "quiet", nav: true, onSelect: onTowerDown });
  if (onStrata) more.push({ key: "strata", label: "Strata city", tone: "quiet", nav: true, onSelect: onStrata });
  if (onFreePlay) more.push({ key: "free", label: "Free play", tone: "quiet", nav: true, onSelect: onFreePlay });
  return (
    <div className="g-screen g-title j-title">
      <h1 aria-label="Echo"><span aria-hidden>ECHO</span><i aria-hidden>ECHO</i></h1>
      <RelayBar size="lg" label="Start" className="g-title-main" items={main} />
      {more.length > 0 && <RelayBar size="md" label="More" className="g-title-more" rest={null} items={more} />}
    </div>
  );
}
