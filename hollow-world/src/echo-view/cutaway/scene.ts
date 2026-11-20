import { FONT_MONO, FONT_SANS, THEME as T } from "../theme";
import type { Pod } from "../../echo/types";
import { podName } from "./live/names";
import { along, type Frame, neighbors, podPose, type Point, type Track, tracks } from "./run";
import { frameProgress } from "./motion";
import med from "./art/med-1.webp";
import freight from "./art/supply.webp";
import passenger from "./art/pax-1.webp";
import forged from "./art/ghost-1.webp";
import mara from "./art/mara.png";
import loader from "./art/loader.png";
import technician from "./art/technician.png";
import attendant from "./art/attendant.png";
import maraPod from "../characters/art/mara-sprite-32x48.png";

const W = 1672, H = 941;
const floors = [.07, .247, .419, .61, .789, 1];
const spriteUrls = { med, freight, passenger, forged, mara, loader, technician, attendant, maraPod };
type Sprite = keyof typeof spriteUrls;
type Box = { x: number; y: number; w: number; h: number };
export function lamp(track: Track): Point {
  const [x, y] = along(track, .5);
  return [x * W, (y - (track.shaft === "track" && track.order >= 6 ? .08 : .037)) * H];
}
function visible(pod: Pod, tick: number) {
  if (pod.status === "scheduled") return pod.nurse || pod.cargo === "medicine";
  // Short-haul freight unloads at the relay; the two clinic berths stay in view.
  return !(pod.dest === "relay" && pod.arriveTick !== null && tick > pod.arriveTick + 1);
}
function color(p: Pod, rejected: boolean) {
  if (rejected) return T.ghostText;
  return p.priority === "medical" ? T.good : p.priority === "supply" ? T.amberHi : T.blueText;
}
function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function createScene(canvas: HTMLCanvasElement, backdrop: HTMLCanvasElement, trimUrl?: string) {
  const lamps = new Map([...tracks].map(([id, track]) => [id, lamp(track)])); // tracks differ per Descent level (layouts.ts), so read them per scene
  const images = new Map<Sprite, HTMLImageElement>();
  const ground = backdrop.getContext("2d")!;
  const live = canvas.getContext("2d")!;
  let redraw = () => {};
  const trim = trimUrl ? new Image() : null;
  if (trim && trimUrl) {
    trim.onload = () => redraw();
    trim.src = trimUrl;
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    for (const [node, ctx] of [[backdrop, ground], [canvas, live]] as const) {
      node.width = Math.round(width * devicePixelRatio);
      node.height = Math.round(height * devicePixelRatio);
      ctx.setTransform(node.width / W, 0, 0, node.height / H, 0, 0);
    }
    redraw();
  });
  resize.observe(canvas);
  for (const [key, url] of Object.entries(spriteUrls)) {
    const img = new Image();
    img.onload = () => redraw();
    img.src = url;
    images.set(key as Sprite, img);
  }

  function line(c: CanvasRenderingContext2D, x: number, y: number, ex: number, ey: number, paint: string, width = 2) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(ex, ey);
    c.strokeStyle = paint;
    c.lineWidth = width;
    c.stroke();
  }
  function circle(c: CanvasRenderingContext2D, x: number, y: number, radius: number, paint: string, ring = false) {
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    if (ring) {
      c.strokeStyle = paint;
      c.lineWidth = 2.5;
      c.stroke();
    } else {
      c.fillStyle = paint;
      c.fill();
    }
  }
  function drawSprite(
    c: CanvasRenderingContext2D,
    key: Sprite,
    x: number,
    y: number,
    width: number,
    height: number,
    flip = false,
  ) {
    const img = images.get(key)!;
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    if (img.complete && img.naturalWidth) c.drawImage(img, -width / 2, -height, width, height);
    else {
      c.fillStyle = T.amber;
      c.fillRect(-width / 2, -height, width, height);
    }
    c.restore();
  }
  /** Mara (head and shoulders of her sprite) behind the MED-1 pod's rear window. Static: it only moves with the pod. */
  function maraInPod(c: CanvasRenderingContext2D, x: number, y: number, flip: boolean) {
    const img = images.get("maraPod")!;
    if (!img.complete || !img.naturalWidth) return;
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.beginPath();
    c.rect(1, -35, 36, 14); // the window pane, in pod-local px (pod is drawn 112x41, centred, bottom at y)
    c.clip();
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 4, 0, 24, 26, 10, -36, 18, 19);
    c.fillStyle = "#2b6b6a33"; // glass tint over her
    c.fillRect(1, -35, 36, 14);
    c.restore();
  }
  function crate(x: number, y: number, medical = false) {
    const w = 50, h = 34;
    ground.fillStyle = "#463927";
    ground.fillRect(x - 2, y - h - 2, w + 4, h + 4);
    ground.fillStyle = "#a08a64";
    ground.fillRect(x, y - h, w, h);
    ground.strokeStyle = "#554a39";
    ground.lineWidth = 3;
    ground.strokeRect(x + 3, y - h + 3, w - 6, h - 6);
    line(ground, x + 10, y - h, x + 10, y, "#c2b294", 4);
    line(ground, x + w - 10, y - h, x + w - 10, y, "#c2b294", 4);
    if (medical) {
      ground.fillStyle = "#3e5b51";
      ground.fillRect(x + 17, y - 25, 17, 16);
      ground.fillStyle = "#b8c4aa";
      ground.fillRect(x + 24, y - 23, 4, 12);
      ground.fillRect(x + 20, y - 19, 12, 4);
    }
  }
  const font = "650 19px " + FONT_SANS;
  function tag(c: CanvasRenderingContext2D, box: Box, label: string, ink: string) {
    c.fillStyle = "#10191ef5";
    c.fillRect(box.x, box.y, box.w, box.h);
    c.strokeStyle = ink + "99";
    c.lineWidth = 1.5;
    c.strokeRect(box.x, box.y, box.w, box.h);
    c.font = font;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = ink;
    c.fillText(label, box.x + box.w / 2, box.y + box.h / 2);
  }
  let anim = 0;
  function show(frame: Frame, previous: Frame, level: number, duration: number, hiddenChips?: ReadonlySet<string>) {
    cancelAnimationFrame(anim);
    function render(duration: number) {
      cancelAnimationFrame(anim);
      const { obs, arrived, rejected } = frame;
      const echo = obs.mode === "echo";
      const nurse = arrived.has("MED-1"), delivered = arrived.has("SUP-3");
      const supply = obs.pods.find((p) => p.cargo === "medicine")!;
      const medical = obs.pods.find((p) => p.nurse)!;
      const pax = obs.pods.find((p) => p.id === "PAX-1");
      const fixed: Box[] = [];
      const signs: { box: Box; copy: string; ink: string }[] = [];
      ground.clearRect(0, 0, W, H);
      function fixedTag(copy: string, x: number, y: number, ink: string) {
        ground.font = font;
        const w = Math.ceil(ground.measureText(copy).width) + 18;
        const box = { x: x * W - w / 2, y: y * H - 14, w, h: 28 };
        signs.push({ box, copy, ink });
        fixed.push(box);
      }
      for (let i = 0; i < 5; i++) {
        const top = floors[i] * H, bottom = floors[i + 1] * H;
        if (i + 1 !== level) {
          ground.fillStyle = "#0d161c3f";
          ground.fillRect(0, top, W, bottom - top);
        }
        ground.fillStyle = i + 1 === level ? T.amber : "#10191eee";
        const badge = { x: 18, y: (top + bottom) / 2 - 17, w: 55, h: 34 };
        fixed.push(badge);
        ground.fillRect(badge.x, badge.y, badge.w, badge.h);
        ground.fillStyle = i + 1 === level ? T.ink : T.head;
        ground.font = "650 20px " + FONT_MONO;
        ground.textAlign = "center";
        ground.textBaseline = "middle";
        ground.fillText("L" + (i + 1), 45, (top + bottom) / 2);
      }
      if (!obs.towerUp) {
        ground.fillStyle = "#09131c2e";
        ground.fillRect(0, .07 * H, W, .177 * H);
      }
      fixedTag(obs.towerUp ? "Tower: on" : "Tower: off", .359, .147, obs.towerUp ? T.good : T.redText);
      // The medicine bay is always visible. SUP-3 takes the marked crate when it enters the rail.
      const bayX = .268 * W, bayY = .225 * H;
      ground.fillStyle = T.amberDim;
      ground.fillRect(bayX - 4, bayY + 1, 58, 4);
      if (supply.at < 0) crate(bayX, bayY, true);
      if (delivered) {
        crate(.645 * W, .943 * H);
        crate(.677 * W, .943 * H);
        crate(.66 * W, .906 * H, true);
      }
      ground.imageSmoothingEnabled = false;
      drawSprite(ground, "loader", .249 * W, .228 * H, 43, 64);
      drawSprite(ground, "technician", .207 * W, .407 * H, 43, 64);
      drawSprite(ground, "attendant", .96 * W, .949 * H, 43, 64);
      if (nurse) {
        const x = .878 * W, y = .875 * H, glow = ground.createRadialGradient(x, y, 2, x, y, 105);
        glow.addColorStop(0, T.good + "a0");
        glow.addColorStop(1, T.good + "00");
        ground.fillStyle = glow;
        ground.fillRect(x - 105, y - 105, 210, 210);
        circle(ground, x, y, 5, T.head);
        drawSprite(ground, "mara", .752 * W, .948 * H, 43, 64);
      }
      ground.imageSmoothingEnabled = true;
      if (level === 5 || delivered) {
        fixedTag(
          delivered ? "MEDICINE DELIVERED" : nurse ? "NURSE ON DUTY" : "OUT OF MEDICINE",
          .69,
          .846,
          delivered || nurse ? T.good : T.redText,
        );
      }
      for (const sector of obs.sectors) {
        const tr = tracks.get(sector.id)!;
        const bypass = medical.rerouted && tr.shaft === "bypass" && medical.path.includes(sector.id);
        line(
          ground,
          tr.a[0] * W,
          tr.a[1] * H,
          tr.b[0] * W,
          tr.b[1] * H,
          bypass ? T.good + "bb" : T.amber + "4a",
          bypass ? 4 : 2,
        );
        if (tr.shaft === "track" && tr.order >= 6) {
          const x = tr.b[0] * W, y = tr.a[1] * H, w = (tr.a[0] - tr.b[0]) * W;
          const holder = obs.pods.find((p) => p.id === sector.holder);
          const edge = holder ? color(holder, rejected.has(holder.id)) : "#a8b0a39a";
          ground.fillStyle = holder ? edge + "20" : "#0d161c18";
          ground.fillRect(x + 2, y - 44, w - 4, 49);
          ground.strokeStyle = edge;
          ground.lineWidth = holder ? 3 : 1.5;
          ground.strokeRect(x + 2, y - 44, w - 4, 49);
          for (const end of [x, x + w]) line(ground, end, y - 5, end, y + 14, T.head, 3);
        }
        if (sector.beacon === false) continue;
        const [x, y] = lamps.get(sector.id)!;
        line(ground, x, y, x, y + 22, T.stage, 8);
        line(ground, x, y, x, y + 22, echo ? T.amberDim : T.dim, 4);
        line(ground, x - 8, y + 22, x + 8, y + 22, T.btn2, 4);
        circle(ground, x, y, 7, T.stage);
        circle(ground, x, y, 4.5, echo ? T.amberDim : T.line);
      }
      for (const event of rejected.values()) {
        const [x, y] = lamps.get(event.sectorId!)!;
        fixedTag("✕", x / W, (y - 20) / H, T.redText);
      }
      for (const gate of obs.sectors.filter((s) => s.sealed)) {
        const tr = tracks.get(gate.id)!, x = tr.b[0] * W, y = tr.b[1] * H;
        ground.fillStyle = T.redBg;
        ground.fillRect(x - 16, y - 24, 148, 24);
        for (let i = 0; i < 7; i++) line(ground, x - 14 + i * 20, y - 2, x + i * 20, y - 22, T.red, 6);
        line(ground, x - 16, y, x + 132, y, T.red, 4);
        fixedTag("SEALED · MAIN SHAFT", tr.b[0] - .07, tr.b[1] - .065, T.redText); // level 1: (.665, .70)
      }
      if (level === 4 && medical.rerouted) fixedTag("DRY BYPASS", .25, .746, T.good);
      if (
        echo && pax && pax.status === "waiting" && pax.at < 0 && obs.log.some((e) => e.kind === "yield" && e.podId === pax.id)
      ) {
        const holder = obs.sectors.find((s) => s.id === "trunk0")?.holder;
        fixedTag(holder ? (obs.pods.find((p) => p.id === holder) ? podName(obs.pods.find((p) => p.id === holder)!) : holder) + " goes first" : "Passengers wait", .82, .624, T.redText);
      }
      for (const sign of signs) tag(ground, sign.box, sign.copy, sign.ink);
      const pods = obs.pods.filter((p) => visible(p, obs.tick)).map((p) => {
        const old = previous.obs.pods.find((o) => o.id === p.id)!;
        const [x, y] = podPose(p), [px, py] = podPose(old);
        const fake = rejected.has(p.id), held = p.status === "holding" || p.status === "waiting";
        const ship: Sprite = p.ghost ? "forged" : p.nurse ? "med" : p.cargo ? "freight" : "passenger";
        const track = tracks.get(p.path[p.at]);
        const facesLeft = !!track && p.status !== "arrived" && track.b[0] < track.a[0];
        let label = podName(p);
        if (p.ghost && fake) label = "Fake medical pod";
        return {
          id: p.id,
          x: x * W,
          y: y * H,
          px: px * W,
          py: py * H,
          ship,
          held,
          fake,
          facesLeft,
          label,
          ink: color(p, fake),
          box: { x: 0, y: 0, w: 0, h: 0 },
        };
      });
      // Reserve the display and sprite bounds first, then fit chips near their own pod.
      const blocked = [...fixed, ...pods.map((p) => ({ x: p.x - 60, y: p.y - 47, w: 120, h: 48 }))];
      ground.font = font;
      for (const p of pods) {
        if (hiddenChips?.has(p.id)) continue;
        const w = Math.ceil(ground.measureText(p.label).width) + 18;
        const h = 28;
        search: for (const dy of [-65, -98, -131, 27, 60, -164]) {
          for (const dx of [0, -85, 85, -170, 170, -300, 300]) {
            const x = Math.max(7, Math.min(W - w - 7, p.x - w / 2 + dx)),
              y = Math.max(4, Math.min(H - h - 4, p.y + dy - h));
            const box = { x, y, w, h };
            if (blocked.some((b) => overlaps(box, b))) continue;
            p.box = box;
            blocked.push({ x: x - 3, y: y - 2, w: w + 6, h: h + 4 });
            break search;
          }
        }
      }
      const messages = obs.log.filter((e) =>
        e.tick === obs.tick - 1 && (e.kind === "announce" || e.kind === "seal-heard")
      );
      const start = performance.now();
      const sealedNow = obs.log.some((e) => e.kind === "seal" && e.tick === obs.tick - 1);
      const liftSection = obs.sectors.find((s) => s.id === "ramp2");
      const liftPod = pods.find((p) => p.id === liftSection?.holder);
      function draw(now: number) {
        const t = frameProgress(now, start, duration);
        live.clearRect(0, 0, W, H);
        // Keep moving leader lines behind every fixed sign even between simulation ticks.
        for (const p of pods) {
          if (!p.box.w) continue;
          const x = p.px + (p.x - p.px) * t, y = p.py + (p.y - p.py) * t;
          line(live, p.box.x + p.box.w / 2, p.box.y + p.box.h, x, y - 40, p.ink + "90", 1.5);
        }
        for (const box of fixed) live.clearRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
        if (liftPod) {
          const y = liftPod.py + (liftPod.y - liftPod.py) * t;
          const x = .513 * W;
          if (trim) {
            line(live, x-9, .077*H, x-9, y-48, "#140f0a", 4);
            line(live, x+9, .077*H, x+9, y-48, "#93836a", 2);
            live.fillStyle = "#192328d9";
            live.fillRect(x-58,y-48,116,48);
            line(live,x-58,y-48,x+58,y-48,T.amberDim,5);
            circle(live,x+42,y-38,4,T.amberHi);
          }
          line(live, x - 58, y + 2, x + 58, y + 2, T.amberDim, 5);
          line(live, x - 58, y - 52, x - 58, y + 2, T.amberDim, 3);
          line(live, x + 58, y - 52, x + 58, y + 2, T.amberDim, 3);
        }
        if (sealedNow) {
          for (let i = 0; i < 5; i++) {
            circle(
              live,
              .603 * W + (i - 2) * 11 * t,
              .765 * H - (15 + i % 2 * 10) * Math.sin(t * Math.PI),
              3,
              T.blueText,
            );
          }
        }
        for (const p of pods) {
          const x = p.px + (p.x - p.px) * t, y = p.py + (p.y - p.py) * t;
          drawSprite(live, p.ship, x, y, 112, 41, p.facesLeft);
          if (p.ship === "med") maraInPod(live, x, y, p.facesLeft); // characters: Mara rides MED-1
          if (p.fake) {
            const crossX = x + (p.facesLeft ? 34 : -34);
            line(live, crossX - 8, y - 12, crossX + 8, y - 26, T.red, 3);
          }
          if (p.held) {
            live.fillStyle = T.red;
            live.fillRect(x - 52, y - 13, 3, 9);
            live.fillRect(x - 46, y - 13, 3, 9);
          }
          for (const msg of messages) {
            if (msg.podId === p.id) {
              circle(live, x + 32, y - 27, 8 + 10 * t, msg.kind === "seal-heard" ? T.red : T.amberHi, true);
            }
          }
        }
        if (trim?.complete && trim.naturalWidth) live.drawImage(trim, 0, 0, W, H);
        for (const p of pods) if (p.box.w) tag(live, p.box, p.label, p.ink);
        if (t < 1) anim = requestAnimationFrame(draw);
      }
      draw(start);
    }
    redraw = () => render(0);
    render(duration);
  }
  return {
    show,
    dispose() {
      resize.disconnect();
      cancelAnimationFrame(anim);
      for (const image of images.values()) image.onload = null;
      if (trim) trim.onload = null;
      redraw = () => {};
    },
  };
}
