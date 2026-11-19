// One legend for both maps: every glyph and colour the canvas draws, grouped. Static; reads nothing.
import { THEME } from "./theme";

const pod = (c: string) => <svg width="22" height="12" aria-hidden><rect x="2" y="3" width="18" height="6" rx="3" fill={c} /></svg>;
const ITEMS: { group: string; items: [glyph: React.ReactNode, label: string][] }[] = [
  {
    group: "Pods",
    items: [
      [pod(THEME.red), "medical"],
      [pod(THEME.good), "supply"],
      [pod("#a9b9b3"), "passenger"],
    ],
  },
  {
    group: "Network",
    items: [
      [<svg width="22" height="16" aria-hidden><path d="M11 14V6" stroke="#9fb3ab" strokeWidth="2" /><circle cx="11" cy="5" r="3.5" fill={THEME.amber} stroke="#fff4d6" /></svg>, "beacon"],
      [<svg width="22" height="12" aria-hidden><path d="M1 6H21" stroke="#728983" strokeWidth="1.6" strokeDasharray="3 3" /></svg>, "no beacon"],
      [<svg width="22" height="14" aria-hidden><circle cx="11" cy="7" r="6" fill="#0d161c" /><path d="M7.5 3.5l7 7M14.5 3.5l-7 7" stroke={THEME.red} strokeWidth="2" /></svg>, "sealed"],
      [<svg width="22" height="12" aria-hidden><path d="M1 6H21" stroke="#e0634f" strokeWidth="3" strokeOpacity=".7" /></svg>, "Mara reroute"],
    ],
  },
  {
    group: "Cities",
    items: [
      [<svg width="22" height="14" aria-hidden><circle cx="11" cy="7" r="5.5" fill="none" stroke={THEME.red} strokeWidth="1.4" /></svg>, "outbreak"],
      [<span className="echo-lg-s07">Sector 07</span>, "home sector"],
      [<svg width="22" height="14" aria-hidden><circle cx="11" cy="7" r="5" fill="none" stroke={THEME.ghost} strokeWidth="1.6" strokeDasharray="2 2" /></svg>, "forged pod"],
    ],
  },
];

export function Legend() {
  return (
    <div className="echo-legend" role="group" aria-label="Map legend">
      <span className="echo-lg-head">Legend</span>
      {ITEMS.map((g) => (
        <div className="echo-lg-group" key={g.group}>
          <span className="echo-lg-name">{g.group}</span>
          {g.items.map(([glyph, label]) => (
            <span className="echo-lg-item" key={label}>{glyph}{label}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
