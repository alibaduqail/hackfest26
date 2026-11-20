import type { MouseEventHandler } from "react";
import { RelayBar } from "../relay/Relay";

// Title: the word, two nodes, two quieter nodes. Nothing else. The dimmed Strata backdrop is mounted by GameApp.
export function Title({ onBegin, onMissions, onDescent }: { onBegin: () => void; onMissions: () => void; onDescent: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <div className="g-screen g-title">
      <h1 aria-label="Echo"><span aria-hidden>ECHO</span><i aria-hidden>ECHO</i></h1>
      <RelayBar size="lg" label="Start" className="g-title-main" items={[
        { key: "begin", label: "Begin", tone: "primary", nav: true, autoFocus: true, onSelect: onBegin },
        { key: "missions", label: "Missions", tone: "secondary", nav: true, onSelect: onMissions },
      ]} />
      <RelayBar size="md" label="More" className="g-title-more" rest={null} items={[
        { key: "descent", label: "Play the Descent", tone: "quiet", nav: true, href: "?screen=descent-live", onSelect: (e) => onDescent(e as never) },
        { key: "how", label: "See how Echo works", tone: "quiet", nav: true, href: "?screen=descent", onSelect: (e) => onDescent(e as never) },
      ]} />
    </div>
  );
}
