// Per-element WCAG contrast of the text that sits directly on the backdrop.
// usage: node contrast.mjs <baseUrl> -> prints every checked element with its worst-case (brightest-pixel) contrast.
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";
const base = process.argv[2], port = 9900 + Math.floor(Math.random() * 90);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [`--remote-debugging-port=${port}`, "--headless=new", "--no-first-run", `--user-data-dir=/tmp/echo-contrast-prof${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); pend.get(d.id)?.(d); pend.delete(d.id); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: process.env.MOTION ? "no-preference" : "reduce" }] }); // default: one still frame, deterministic; MOTION=1 checks a drifting frame
await send("Page.enable");
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function decode(b) { let p = 8, w, h, ct, idat = []; while (p < b.length) { const len = b.readUInt32BE(p), ty = b.toString("ascii", p + 4, p + 8); if (ty === "IHDR") { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); ct = b[p + 17]; } if (ty === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; } const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(w * h * bpp); for (let y = 0; y < h; y++) { const ft = raw[y * (stride + 1)]; for (let x = 0; x < stride; x++) { const r = raw[y * (stride + 1) + 1 + x], a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, ul = y && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0; let v; if (ft === 0) v = r; else if (ft === 1) v = r + a; else if (ft === 2) v = r + up; else if (ft === 3) v = r + ((a + up) >> 1); else { const pp = a + up - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - ul); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul); } px[y * stride + x] = v & 255; } } return { w, h, bpp, px }; }
const SCREENS = [["title", "?screen=title"], ["missions", "?screen=missions"], ["prologue", "?screen=prologue"], ["epilogue", "?screen=epilogue"], ["briefing", "?screen=briefing&mission=tower-down"], ["debrief", "?screen=debrief&mission=tower-down&story=0"]];
const COLLECT = `(()=>{const out=[];const sel='.g-screen h1,.g-screen h2,.g-screen p,.g-screen span,.g-screen div,.g-screen small,.g-screen b,.g-screen li';const seen=new Set();for(const el of document.querySelectorAll(sel)){const own=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');if(!own)continue;if(el.closest('button,.g-card,.g-brief,.echo-end-grid,.g-broadcast,.g-sr'))continue;const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();if(b.width<2||b.height<2)continue;const cs=getComputedStyle(el);out.push({text:own.slice(0,34),x:b.left,y:b.top,w:b.width,h:b.height,color:cs.color,fs:parseFloat(cs.fontSize),fw:cs.fontWeight})}return out})()`;
let worst = 99, fails = 0;
for (const [name, q] of SCREENS) {
  await send("Page.navigate", { url: `${base}/${q}` }); await ev(`localStorage.setItem("echo-progress-v1", JSON.stringify({"tower-down":3,"dead-zones":2,"seen:prologue":1}))`); await send("Page.navigate", { url: `${base}/${q}` }); await sleep(4500 + (process.env.MOTION ? Math.floor(Math.random() * 6000) : 0));
  const els = await ev(COLLECT);
  await ev(`(()=>{const s=document.createElement('style');s.textContent='.g-screen *,.g-screen *::before{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}.g-gear,.g-title canvas{visibility:hidden}';document.head.append(s)})()`);
  await sleep(300);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const { w, h, bpp, px } = decode(Buffer.from(shot.result.data, "base64"));
  for (const e of els) {
    let max = 0; for (let y = Math.max(0, Math.floor(e.y)); y < Math.min(h, Math.ceil(e.y + e.h)); y++) for (let x = Math.max(0, Math.floor(e.x)); x < Math.min(w, Math.ceil(e.x + e.w)); x++) { const i = (y * w + x) * bpp; max = Math.max(max, lum(px[i], px[i + 1], px[i + 2])); }
    const m = e.color.match(/[\d.]+/g).map(Number), tl = lum(m[0], m[1], m[2]);
    const cr = (tl + 0.05) / (max + 0.05), large = e.fs >= 24 || (e.fs >= 18.66 && +e.fw >= 700), need = large ? 3 : 4.5;
    worst = Math.min(worst, cr / need * 4.5); if (cr < need) fails++;
    console.log(`${cr < need ? "FAIL" : "ok  "} ${name.padEnd(9)} ${cr.toFixed(1).padStart(5)} (need ${need}) bgL=${max.toFixed(3)} ${e.fs}px "${e.text}"`);
  }
}
console.log(fails ? `\n${fails} FAIL` : "\nall pass");
ws.close(); chrome.kill();
