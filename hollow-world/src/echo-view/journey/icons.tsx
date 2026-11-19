// Small line icons for the supply bar, drawn to the Strata lamp-and-ink look. currentColor, decorative.
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** A beacon: a lamp with its glow ring and a post. */
export const BeaconIcon = () => (
  <svg {...base}><circle cx="12" cy="9" r="3" fill="currentColor" fillOpacity=".35" /><path d="M5.5 9a6.5 6.5 0 0 1 13 0M8 18h8M12 12v6M7 21h10" /></svg>
);
export const ClockIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>
);
/** A dose: a capsule. */
export const DoseIcon = () => (
  <svg {...base}><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="M10.2 7.4l3.6 5.2" /></svg>
);
export const TentIcon = () => (
  <svg {...base} width={16} height={16}><path d="M3 20L12 4l9 16zM12 20v-6" /></svg>
);
