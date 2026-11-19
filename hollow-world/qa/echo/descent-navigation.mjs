// Run against the dev server or the built app. CHROME_BIN may point to a local Chromium executable.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";

test(
  "enter Descent from the title, seek, return and navigate forward in the same game",
  { timeout: 45000 },
  async () => {
    const base = new URL(process.argv[2] ?? "http://127.0.0.1:4174/");
    const profile = await mkdtemp(join(tmpdir(), "echo-descent-nav-"));
    const binary = process.env.CHROME_BIN ??
      (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "chromium");
    const browser = spawn(binary, [
      "--headless=new",
      "--remote-debugging-port=0",
      "--no-first-run",
      "--user-data-dir=" + profile,
      "about:blank",
    ], { stdio: "ignore" });
    let socket;
    try {
      await once(browser, "spawn");
      let port;
      for (let i = 0; i < 80 && !port; i++) {
        try {
          port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        } catch {
          await sleep(100);
        }
      }
      assert.ok(port, "Chrome started its debugging endpoint");
      const pages = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
      socket = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
      await once(socket, "open");
      let id = 0;
      function call(method, params = {}) {
        const request = ++id;
        return new Promise((resolve, reject) => {
          function handle(event) {
            const msg = JSON.parse(event.data);
            if (msg.id !== request) return;
            socket.removeEventListener("message", handle);
            if (msg.error) reject(Error(msg.error.message));
            else resolve(msg.result);
          }
          socket.addEventListener("message", handle);
          socket.send(JSON.stringify({ id: request, method, params }));
        });
      }
      await call("Page.enable");
      const loaded = new Promise((resolve) => {
        function listen(event) {
          if (JSON.parse(event.data).method !== "Page.loadEventFired") return;
          socket.removeEventListener("message", listen);
          resolve();
        }
        socket.addEventListener("message", listen);
      });
      await call("Page.navigate", { url: base.href });
      await loaded;
      const result = await call("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
        expression: "(" + exercise.toString() + ")()",
      });
      assert.ok(!result.exceptionDetails, result.result.description);
      assert.equal(result.result.value, "returned to title");
    } finally {
      socket?.close();
      if (browser.pid && browser.exitCode === null && !browser.signalCode) {
        const exited = once(browser, "exit");
        browser.kill();
        await exited;
      }
      await rm(profile, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

async function exercise() {
  async function find(selector) {
    for (let i = 0; i < 160; i++) {
      const node = document.querySelector(selector);
      if (node) return node;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error("Missing " + selector);
  }
  function check(value, message) {
    if (!value) throw Error(message);
  }
  const titleLink = await find('.g-title a[href="?screen=descent"]');
  const root = document.querySelector("#root"), originalTitle = document.title;
  const initialStyle = getComputedStyle(titleLink).padding;
  titleLink.click();
  await find(".descent #scene");
  check(!document.querySelector(".g-backdrop"), "The game backdrop still runs under the cutaway");
  check(new URL(location.href).searchParams.get("screen") === "descent", "Missing game route");
  (await find("#beats button:last-child")).click();
  await find("#ward.stocked");
  (await find('[data-mode="tower"]')).click();
  await find("#ward:not(.stocked)");
  check(document.querySelector("#ward").textContent.includes("Out of medicine"), "Tower clinic received a delivery");
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const returned = await find(".g-title a");
  check(
    root === document.querySelector("#root") && document.title === originalTitle,
    "Returning remounted the game document",
  );
  check(getComputedStyle(returned).padding === initialStyle, "Descent styles leaked into the title");
  history.forward();
  await find(".descent [data-mode='tower'][aria-pressed='true']");
  document.querySelector(".descent .brand").click();
  await find(".g-title");
  check(!document.querySelector(".descent"), "The cutaway stayed mounted after exit");
  return "returned to title";
}
