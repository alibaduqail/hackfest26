// Dev-only: renders a scripted cue sequence offline (OfflineAudioContext posing as AudioContext) and draws a matching frame
// for any timestamp. ?v=old uses the code copied from origin/21-descent-live (./old), ?v=new the current src.
// Driven by ../sound-render.mjs; not part of the shipped app.
const which = new URLSearchParams(location.search).get("v") === "old" ? "old" : "new";
const SR = 44100;
let DUR = 34.5;
type Item = { t: number; label: string; seg: "game" | "descent"; run: (api: Api) => void };
interface Api { play(n: string, i?: number): void; s: Record<string, (...a: number[]) => void> }
const G = (label: string, n: string, i = 0): [string, "game", (a: Api) => void] => [label, "game", (a) => a.play(n, i)];
const D = (label: string, fn: string, ...args: number[]): [string, "descent", (a: Api) => void] => [label, "descent", (a) => a.s[fn](...args)];
const script: [number, [string, "game" | "descent", (a: Api) => void]][] = [
  [0.5, G("start", "start")], [2.3, G("place", "place")], [3.5, G("place", "place")], [4.7, G("place", "place")],
  [5.9, G("invalid", "empty")], [7.1, G("run start", "start")], [9.1, G("yield", "yield")], [10.3, G("tower down", "down")],
  [12.0, G("seal", "seal")], [13.8, G("success chime", "chime")], [15.8, G("star 1", "star", 0)], [17.0, G("star 2", "star", 1)], [18.2, G("star 3", "star", 2)],
  [20.2, D("place beacon", "playPlaceThunk")], [21.6, D("news hop", "playHopBlip")], [22.0, D("news hop", "playHopBlip")], [22.4, D("news hop", "playHopBlip")],
  [24.0, D("credential reject", "playRejectBuzz")], [25.6, D("flood seal", "playFloodSplash")], [27.6, D("arrival chime", "playArrivalChime")],
  [29.6, D("star 1", "playStarDing", 0)], [30.8, D("star 2", "playStarDing", 1)], [32.0, D("star 3", "playStarDing", 2)],
];
const items: Item[] = script.map(([t, [label, seg, run]]) => ({ t, label, seg, run }));
const DRIPS = [3.9, 10.9, 18.7, 26.6];

let env: number[] = []; // dB per 20 ms of the rendered audio
const $ = (id: string) => document.getElementById(id)!;
$("ttl").firstChild!.textContent = which === "old" ? "Before" : "After";
$("sub").textContent = which === "old" ? "origin/21-descent-live: single oscillators, arcade chimes" : "muffled physical cues, cave reverb, variation, quiet ambience";

function wav(l: Float32Array, r: Float32Array): string {
  const n = l.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (const [k, ch] of [[0, l], [1, r]] as const) v.setInt16(44 + i * 4 + k * 2, Math.max(-1, Math.min(1, ch[i])) * 32767, true);
  let s = ""; const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

type Ev = { t: number; fn: string; args: unknown[] }; // one __sfxLog entry, t in seconds on the video timeline
(window as any).renderAudio = async (replay?: Ev[], dur?: number): Promise<string> => {
  if (dur) DUR = dur;
  let vt = 0;
  const insts: OfflineAudioContext[] = []; // the old code keeps one context per module
  class Demo extends OfflineAudioContext {
    constructor() { super(2, Math.floor(SR * DUR), SR); insts.push(this); }
    get currentTime() { return vt; }
    get state() { return "running" as AudioContextState; }
    resume() { return Promise.resolve(); }
  }
  const realNow = performance.now.bind(performance);
  (globalThis as any).AudioContext = Demo;
  performance.now = () => vt * 1000;
  const audio = which === "old" ? await import("./old/game/audio") : await import("../../src/echo-view/game/audio");
  const sfx: any = which === "old" ? await import("./old/cutaway/live/sfx") : await import("../../src/echo-view/cutaway/live/sfx");
  const kit: any = which === "new" ? await import("../../src/echo-view/game/soundkit") : null;
  audio.setMuted(false); // creates the offline context through the real unlock()
  if (which === "old") sfx.unlock(); // old sfx.ts owns a second context
  if (which === "new" && !replay) audio.ambience(true);
  if (kit) { await kit.samplesReady(); console.log("samples decoded:", kit.samplesLoaded()); }
  const api: Api = { play: (n, i) => audio.play(n as any, i), s: { playPlaceThunk: () => sfx.playPlaceThunk(vt * 1000), playHopBlip: () => sfx.playHopBlip(vt * 1000), playRejectBuzz: () => sfx.playRejectBuzz(vt * 1000), playFloodSplash: () => sfx.playFloodSplash(vt * 1000), playArrivalChime: () => sfx.playArrivalChime(vt * 1000), playStarDing: (i: number) => sfx.playStarDing(i, vt * 1000) } };
  const fromLog = (e: Ev) => ({ t: e.t, f: () => {
    if (e.fn === "play") api.play(e.args[0] as string, e.args[1] as number);
    else if (e.fn === "ambience") { if (kit) audio.ambience(e.args[0] as boolean); }
    else if (e.fn === "drip") { if (kit) kit.drip(e.t); }
    else api.s[e.fn](...(e.args as number[]));
  } });
  const events = replay ? replay.map(fromLog) : [...items.map((it) => ({ t: it.t, f: () => it.run(api) })), ...(kit ? DRIPS.map((t) => ({ t, f: () => kit.drip(t) })) : [])].sort((a, b) => a.t - b.t);
  for (const e of events) { vt = e.t; e.f(); }
  vt = 0;
  const bufs = await Promise.all(insts.map((c) => c.startRendering()));
  performance.now = realNow;
  if (which === "new") audio.ambience(false);
  const mix = (ch: number) => { const o = new Float32Array(bufs[0].length); for (const bf of bufs) { const d = bf.getChannelData(ch); for (let i = 0; i < o.length; i++) o[i] += d[i]; } return o; };
  const l = mix(0), r = mix(1);
  env = [];
  const step = Math.floor(SR * 0.02);
  for (let i = 0; i + step <= l.length; i += step) { let s = 0; for (let j = i; j < i + step; j++) s += l[j] * l[j]; env.push(20 * Math.log10(Math.sqrt(s / step) + 1e-6)); }
  return wav(l, r);
};
(window as any).setT = (t: number) => {
  const cur = [...items].reverse().find((it) => it.t <= t);
  const age = cur ? t - cur.t : 99;
  $("clock").textContent = t.toFixed(1).padStart(4, "0") + " s";
  $("cue").textContent = cur && age < 1.15 ? cur.label : "";
  $("cue").style.opacity = cur && age < 1.15 ? String(Math.max(0.25, 1 - age / 1.3)) : "0";
  $("seg").textContent = !cur ? "" : cur.seg === "game" ? "Free-play cues · game/audio.ts" : "Descent leg cues · live/sfx.ts";
  $("src").textContent = which === "new" && (DRIPS.some((d) => t >= d && t < d + 0.6)) ? "(distant drip)" : "";
  $("chips").innerHTML = items.map((it) => `<span class="chip ${it === cur && age < 0.9 ? "now" : it.t < t ? "done" : ""}">${it.label}</span>`).join("");
  const c = $("wave") as HTMLCanvasElement, g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = "#2a2d33"; g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  const px = (s: number) => (s / DUR) * c.width;
  g.fillStyle = "#e0a94a";
  env.forEach((db, i) => { const h = Math.max(1, ((db + 66) / 60) * (c.height - 8)); if (i * 0.02 <= t) g.fillRect(px(i * 0.02), c.height - 4 - h, Math.max(1, px(0.02)), h); else { g.fillStyle = "#3a3d44"; g.fillRect(px(i * 0.02), c.height - 4 - h, Math.max(1, px(0.02)), h); g.fillStyle = "#e0a94a"; } });
  g.fillStyle = "#e8e4da"; g.fillRect(px(t), 0, 2, c.height);
};
(window as any).setT(0);
