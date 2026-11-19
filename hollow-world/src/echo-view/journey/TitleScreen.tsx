import { RelayBar, type RelayItem } from "../relay/Relay";
import { useEnterKey } from "./keys";
import type { TitleProps } from "./props";

/** The front door: the name, Relay nodes, and the live Strata scene behind (the dimmed Backdrop is mounted by the parent). Nothing else. */
export function TitleScreen({ onBegin, onContinue, onTowerDown, onStrata, onFreePlay }: TitleProps) {
  useEnterKey(onContinue ?? onBegin);
  const main: RelayItem[] = onContinue
    ? [
        { key: "continue", label: "Continue", tone: "primary", nav: true, autoFocus: true, onSelect: onContinue },
        { key: "begin", label: "New journey", tone: "secondary", nav: true, onSelect: onBegin },
      ]
    : [{ key: "begin", label: "Begin", tone: "primary", nav: true, autoFocus: true, onSelect: onBegin }];
  const more: RelayItem[] = [];
  if (onTowerDown) more.push({ key: "tower", label: "Tower Down split", tone: "quiet", nav: true, onSelect: onTowerDown });
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
