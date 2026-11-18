import "./style.css";
import { DESCENT_LAYOUT } from "../../echo/descent";
import { installTheme } from "../theme";
import {
  beatAt,
  beatLevels,
  beatNames,
  beats,
  captureStops,
  createRun,
  describe,
  displayLocations,
  type System,
} from "./run";
import { createScene } from "./scene";

installTheme();
const el = (id: string) => document.getElementById(id)!;
const play = el("play") as HTMLButtonElement;
const step = el("step") as HTMLButtonElement;
const scene = createScene(el("scene") as HTMLCanvasElement);
const runs = { echo: createRun("echo"), tower: createRun("tower") };
const url = new URL(location.href);
const motion = matchMedia("(prefers-reduced-motion: reduce)");
let mode: System = url.searchParams.get("mode") === "tower" ? "tower" : "echo";
const end = runs[mode](0).obs.endTick;
const stops = captureStops(runs.echo);
function seekTick(beat: number) {
  return motion.matches ? stops[beat - 1].settled : stops[beat - 1].cue;
}
const requested = Number(url.searchParams.get("beat"));
let tick = Number.isInteger(requested) && requested >= 1 && requested <= beats.length ? seekTick(requested) : 0;
let playing = false;
let speed = 1;
let timer = 0;
const stepMs = 410;
document.body.classList.toggle("clean", url.searchParams.get("clean") === "1");

function bookmark(beat: number) {
  if (beat) url.searchParams.set("beat", String(beat));
  else url.searchParams.delete("beat");
  url.searchParams.set("mode", mode);
  // Browsers restrict changing a file: URL. The exported HTML still supports its controls.
  if (location.protocol !== "file:") history.replaceState(null, "", url);
}
for (const beat of beats) {
  const button = document.createElement("button");
  button.textContent = beatNames[beat.beat - 1];
  button.title = "Beat " + beat.beat + " · t+" + beat.tick + " · " + beat.rule;
  button.onclick = () => {
    playing = false;
    tick = seekTick(beat.beat);
    bookmark(beat.beat);
    refresh();
  };
  el("beats").append(button);
}
const markers = [...el("beats").querySelectorAll("button")];
const modes = [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")];
const speeds = [...document.querySelectorAll<HTMLButtonElement>("[data-speed]")];
const text = (id: string, value: string) => {
  if (el(id).textContent !== value) el(id).textContent = value;
};
function paint(smooth: boolean) {
  const frame = runs[mode](tick), obs = frame.obs;
  const active = beatAt(tick), level = beatLevels[active - 1] ?? 1;
  const [title, caption] = describe(frame, active);
  text("clock", "t+" + String(tick).padStart(2, "0"));
  text("level", "L" + level + " · " + DESCENT_LAYOUT.levels[level - 1].name.toUpperCase());
  text("headline", title);
  text("caption", caption);
  text("claim", String(obs.score.towerClaimed));
  text("actual", String(obs.score.realFlights));
  el("claim").classList.toggle("offline", !obs.towerUp);
  const stocked = frame.arrived.has("SUP-3");
  text(
    "ward",
    (frame.arrived.has("MED-1") ? "Nurse on duty" : "No care") + " · " +
      (stocked ? "Medicine delivered" : "Out of medicine"),
  );
  el("ward").classList.toggle("stocked", stocked);
  const log = el("events");
  log.replaceChildren(...frame.events.map((e) => {
    const li = document.createElement("li"),
      time = document.createElement("time"),
      message = document.createElement("span");
    time.textContent = "t+" + e.tick;
    message.textContent = displayLocations(e.text);
    li.append(time, message);
    return li;
  }));
  text(
    "manifest",
    obs.pods.map((p) =>
      p.label + ", " + p.status + " at " +
      (p.status === "arrived" || p.at < 0
        ? obs.cities.find((city) => city.id === (p.status === "arrived" ? p.dest : p.origin))!.name
        : displayLocations(p.path[p.at]))
    ).join(". "),
  );
  for (const [i, node] of [...el("rules").children].entries()) {
    node.classList.toggle("active", i + 1 === level);
    node.classList.toggle("past", active > 0 && i + 1 !== level && beatLevels.slice(0, active - 1).includes(i + 1));
  }
  for (const [i, marker] of markers.entries()) {
    if (i + 1 === active) marker.setAttribute("aria-current", "step");
    else marker.removeAttribute("aria-current");
  }
  for (const button of modes) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  for (const button of speeds) button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === speed));
  play.textContent = playing ? "Ⅱ Pause" : tick === end ? "↺ Replay" : "▶ Play";
  step.disabled = tick === end;
  const prior = runs[mode](Math.max(0, tick - 1));
  scene(frame, prior, level, smooth && !motion.matches ? stepMs / speed : 0);
}
function advance() {
  if (!motion.matches) return Math.min(end, tick + 1);
  return stops.map((s) => s.settled).find((t) => t > tick) ?? end;
}
function refresh(smooth = false) {
  clearTimeout(timer);
  if (tick >= end || document.hidden) playing = false;
  paint(smooth);
  if (playing) {
    const hold = stops.some((s) => s.cue === tick);
    const delay = motion.matches ? 2200 : stepMs + (hold ? 2000 : 0);
    timer = window.setTimeout(() => {
      tick = advance();
      refresh(true);
    }, delay / speed);
  }
}
function togglePlay() {
  if (tick === end) {
    tick = 0;
    bookmark(0);
  }
  playing = !playing;
  refresh();
}
function manual(direction: number) {
  playing = false;
  if (direction === 1) tick = advance();
  else if (motion.matches) tick = stops.map((s) => s.settled).filter((t) => t < tick).at(-1) ?? 0;
  else tick = Math.max(0, tick - 1);
  refresh();
}
function switchMode(next: System) {
  mode = next;
  bookmark(beatAt(tick));
  refresh();
}
play.onclick = togglePlay;
step.onclick = () => manual(1);
for (const button of modes) button.onclick = () => switchMode(button.dataset.mode as System);
for (const button of speeds) {
  button.onclick = () => {
    speed = Number(button.dataset.speed);
    refresh();
  };
}
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  // Native buttons and the game link keep their normal keyboard activation.
  if (event.key === " " && (event.target as HTMLElement).closest("button,a")) return;
  if (event.key === " ") togglePlay();
  else if (event.key === "ArrowRight") manual(1);
  else if (event.key === "ArrowLeft") manual(-1);
  else if (event.key.toLowerCase() === "e") switchMode("echo");
  else if (event.key.toLowerCase() === "t") switchMode("tower");
  else return;
  event.preventDefault();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    refresh();
  }
});
motion.addEventListener("change", () => {
  if (motion.matches && beatAt(tick)) tick = seekTick(beatAt(tick));
  refresh();
});
playing = url.searchParams.get("autoplay") === "1";
refresh();
