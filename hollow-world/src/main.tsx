import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  IncidentKind,
  RoomDef,
  Scenario,
  WorkerRequest,
  WorkerResponse,
  WorldState,
} from "./engine/types";
import { Router } from "./engine/routing";
import { validateSave, validateScenario } from "./engine/validation";
import { WorldRenderer, type Selection } from "./world/render";
import { download, loadLocal, saveLocal, type SaveFile } from "./persistence";
import "./style.css";
const districts = ["The Exchange", "The Works", "The Sump"];
const clock = (tick: number, start = 7) =>
  `${String(Math.floor((start + tick / 3600) % 24)).padStart(2, "0")}:${String(Math.floor(tick / 60) % 60).padStart(2, "0")}`;
const decimal = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });
function App() {
  const [scenario, setScenario] = useState<Scenario>();
  const [state, setState] = useState<WorldState>();
  const [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(60),
    [selection, setSelection] = useState<Selection | null>(null),
    [panel, setPanel] = useState<
      "explore" | "history" | "experiment" | "help" | null
    >(null),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(true),
    [following, setFollowing] = useState(false),
    [performanceStats, setPerformanceStats] = useState({
      tickMs: 0,
      achievedSpeed: 0,
    }),
    [reportView, setReportView] = useState(false),
    [filter, setFilter] = useState("all");
  const worker = useRef<Worker | null>(null),
    canvas = useRef<HTMLDivElement>(null),
    renderer = useRef<WorldRenderer | null>(null),
    stateRef = useRef<WorldState | undefined>(undefined),
    playingRef = useRef(true),
    upload = useRef<HTMLInputElement>(null),
    commandSequence = useRef(0);
  function send(message: WorkerRequest) {
    worker.current?.postMessage(message);
  }
  function select(s: Selection, focus = false) {
    setSelection(s);
    setPanel(null);
    renderer.current?.select(s);
    if (focus) {
      renderer.current?.focus(s.id);
      setFollowing(false);
    }
  }
  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const w = new Worker(new URL("./engine/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const m = event.data;
      if (m.type === "state") {
        stateRef.current = m.state;
        playingRef.current = m.playing;
        setState(m.state);
        setPlaying(m.playing);
        setSpeed(m.speed);
        setPerformanceStats({
          tickMs: m.tickMs,
          achievedSpeed: m.achievedSpeed,
        });
        setLoading(false);
      } else if (m.type === "error") {
        notify(m.message);
        setLoading(false);
      } else if (m.type === "receipt")
        notify(
          m.receipt.ok
            ? "Request accepted; scheduled for the next simulation tick."
            : (m.receipt.reason ?? "Request rejected"),
        );
    };
    w.onerror = () =>
      notify(
        "The simulation worker stopped. Export the current state before reloading.",
      );
    const abort = new AbortController();
    fetch("/scenario.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load scenario");
        return r.json();
      })
      .then((value) => {
        validateScenario(value);
        setScenario(value);
        w.postMessage({ type: "init", scenario: value });
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          notify(e.message);
          setLoading(false);
        }
      });
    return () => {
      abort.abort();
      w.terminate();
    };
  }, []);
  useEffect(() => {
    if (!scenario || !canvas.current) return;
    const view = new WorldRenderer(
      canvas.current,
      scenario,
      (s) => select(s),
      () => {
        setFollowing(false);
      },
    );
    renderer.current = view;
    view
      .init()
      .then(() => {
        if (stateRef.current) view.update(stateRef.current, playingRef.current);
      })
      .catch((e) =>
        notify(
          `Graphics could not start: ${e.message}. Your simulation remains available through Explore.`,
        ),
      );
    return () => {
      view.destroy();
      renderer.current = null;
    };
  }, [scenario]);
  useEffect(() => {
    stateRef.current = state;
    playingRef.current = playing;
    if (state && renderer.current?.app.renderer)
      renderer.current.update(state, playing);
  }, [state, playing]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        send({ type: "play", playing: !playingRef.current });
      } else if (e.key === "Escape") {
        setSelection(null);
        setPanel(null);
        renderer.current?.select({ kind: "room", id: "" });
      } else if (e.key === "+" || e.key === "=") renderer.current?.zoomBy(1.2);
      else if (e.key === "-") renderer.current?.zoomBy(1 / 1.2);
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        renderer.current?.pan(70, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        renderer.current?.pan(-70, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        renderer.current?.pan(0, 70);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        renderer.current?.pan(0, -70);
      }
    };
    const visibility = () => {
      if (document.hidden && playingRef.current) {
        send({ type: "play", playing: false });
        notify("Simulation paused while this tab was in the background.");
      }
    };
    window.addEventListener("keydown", handler);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  async function save() {
    if (scenario && state)
      try {
        await saveLocal({ format: "hollow-save-v1", scenario, state });
        notify(
          "World saved locally, including people, cargo and report history.",
        );
      } catch (e) {
        notify((e as Error).message);
      }
  }
  function restore(file: SaveFile) {
    if (file.format !== "hollow-save-v1")
      throw new Error("Unsupported save format");
    validateSave(file.scenario, file.state);
    setScenario(file.scenario);
    setSelection(null);
    setPanel(null);
    setFollowing(false);
    send({ type: "load", scenario: file.scenario, state: file.state });
    notify("Saved world restored, paused at the recorded time.");
  }
  async function importFile(file: File) {
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Import limit is 10 MB");
      const input = JSON.parse(await file.text());
      if (input.format === "hollow-save-v1") restore(input);
      else if (input.format === "hollow-replay-v1") {
        validateScenario(input.scenario);
        if (
          !Number.isSafeInteger(input.finalTick) ||
          input.finalTick < 0 ||
          input.finalTick > 604800
        )
          throw new Error("Replay limit is seven simulated days");
        setScenario(input.scenario);
        setSelection(null);
        setPanel(null);
        send({ type: "replay", replay: input });
        notify("Replaying the same authored events and operator decisions…");
      } else {
        validateScenario(input);
        setScenario(input);
        setSelection(null);
        setPanel(null);
        send({ type: "init", scenario: input });
        notify("Scenario validated and loaded.");
      }
    } catch (e) {
      notify(`Import rejected: ${(e as Error).message}`);
    }
  }
  function request(
    type:
      | "assignBackup"
      | "requestRepair"
      | "setDeviceEnabled"
      | "requestDelivery",
    targetId: string,
    value?: string | boolean,
  ) {
    if (!state) return;
    send({
      type: "command",
      command: {
        commandId: `manual-${state.runId}-${++commandSequence.current}`,
        actorId: "district-operator",
        expectedRunId: state.runId,
        requestedAtTick: state.tick,
        type,
        targetId,
        value,
      },
    });
  }
  function togglePanel(p: typeof panel) {
    setPanel(panel === p ? null : p);
    setSelection(null);
  }
  function incident(kind: IncidentKind) {
    send({ type: "incident", kind });
  }
  const selectedRoom =
    selection?.kind === "room"
      ? scenario?.rooms.find((r) => r.id === selection.id)
      : undefined;
  const selectedPerson =
    selection?.kind === "person"
      ? scenario?.residents.find((p) => p.id === selection.id)
      : undefined;
  const person = selectedPerson
    ? state?.people.find((p) => p.id === selectedPerson.id)
    : undefined;
  const household = selectedPerson
    ? scenario?.households.find((h) => h.id === selectedPerson.householdId)
    : undefined;
  const householdState = household
    ? state?.households.find((h) => h.id === household.id)
    : undefined;
  const room = selectedRoom
    ? state?.rooms.find((r) => r.id === selectedRoom.id)
    : undefined;
  const link =
    selection?.kind === "link"
      ? scenario?.links.find((l) => l.id === selection.id)
      : undefined;
  const linkDependents = useMemo(() => {
    if (!link || !scenario || !state) return [];
    const graph = new Router(scenario);
    const opened = {
        ...state,
        topology: 100000,
        closedLinks: state.closedLinks.filter((id) => id !== link.id),
      },
      closed = {
        ...opened,
        topology: 100001,
        closedLinks: [...opened.closedLinks, link.id],
      };
    return scenario.households.filter(
      (h) =>
        graph.route(h.homeId, h.depotId, opened, true) !== null &&
        graph.route(h.homeId, h.depotId, closed, true) === null,
    );
  }, [scenario, state?.topology, link?.id]);
  const dependents =
    selectedRoom && scenario
      ? scenario.households.filter(
          (h) =>
            h.homeId === selectedRoom.id ||
            h.depotId === selectedRoom.id ||
            (selectedRoom.kind === "fan" &&
              scenario.airZones.some(
                (zone) =>
                  zone.fanId === selectedRoom.id &&
                  zone.roomIds.includes(h.homeId),
              )) ||
            (selectedRoom.kind === "pump" &&
              scenario.rooms.some(
                (r) => r.id === h.homeId && r.district === 2 && r.floor >= 6,
              )),
        )
      : [];
  const occupants = selectedRoom
    ? (state?.people.filter((p) => p.roomId === selectedRoom.id && !p.edgeId) ??
      [])
    : [];
  const deficits =
    state?.households.reduce((n, h) => n + h.cutoffSeconds / 60, 0) ?? 0;
  const report = state?.reports.find(
    (r) => r.subjectId === (selectedRoom?.id ?? "d2-f5"),
  );
  const reportStatus = !report
    ? "UNKNOWN"
    : !state?.comms ||
        state.tick - report.sampledAtTick >
          (scenario?.settings.reportStaleAfter ?? 0)
      ? "STALE"
      : "FRESH";
  const connectedHomes =
    state?.households.filter((h) => !h.accessClosed).length ?? 0;
  const currentTemp = state
    ? state.rooms.reduce((n, r) => n + r.temperature, 0) / state.rooms.length
    : 0;
  return (
    <div className="shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            renderer.current?.recenter();
          }}
        >
          <span className="brand-mark">
            H<span>•</span>
          </span>
          <span>
            THE HOLLOW<small>A WORLD BELOW</small>
          </span>
        </a>
        <div className="world-indicator">
          <i /> LIVE WORLD <span>/</span> SECTOR 07 <b>AFTER THE DESCENT</b>
        </div>
        <nav aria-label="World tools">
          <button
            className={panel === "explore" ? "active" : ""}
            onClick={() => togglePanel("explore")}
          >
            ⌕ <span>Explore</span>
          </button>
          <button
            className={panel === "history" ? "active" : ""}
            onClick={() => togglePanel("history")}
          >
            ◷ <span>History</span>
            {state && state.events.length > 1 && <em>{state.events.length}</em>}
          </button>
          <button
            className={panel === "experiment" ? "active" : ""}
            onClick={() => togglePanel("experiment")}
          >
            ⚡ <span>Incidents</span>
          </button>
          <button
            aria-label="Help and saves"
            onClick={() => togglePanel("help")}
          >
            ⋯
          </button>
        </nav>
      </header>
      <main className="world-stage">
        <div ref={canvas} className="world-canvas" />
        <div className={`world-title ${selection || panel ? "compact" : ""}`}>
          <span className="eyebrow">
            A LIVING DISTRICT · FICTIONAL SIMULATION
          </span>
          <h1>There is life down here.</h1>
          <p>Follow a person. Find a story. Watch a city keep going.</p>
        </div>
        <div className="district-nav" aria-label="District navigation">
          {districts.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                renderer.current?.district(i);
                setFollowing(false);
              }}
            >
              <span>0{i + 1}</span>
              <strong>{d}</strong>
              <small>
                {
                  ["Civic & supply", "Industry & growing", "Homes & drainage"][
                    i
                  ]
                }
              </small>
              <b>↗</b>
            </button>
          ))}
        </div>
        <div className="world-stats">
          <span>
            <b>{state?.people.length ?? 180}</b> residents
          </span>
          <span>
            <b>{connectedHomes}/60</b> homes connected
          </span>
          <span>
            <b>{currentTemp.toFixed(1)}°</b> average temperature
          </span>
        </div>
        <div className="camera-controls">
          <button
            aria-label="Zoom in"
            onClick={() => renderer.current?.zoomBy(1.25)}
          >
            +
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => renderer.current?.zoomBy(0.8)}
          >
            −
          </button>
          <button
            aria-label="Recenter world"
            onClick={() => {
              renderer.current?.recenter();
              setFollowing(false);
            }}
          >
            ⌖
          </button>
        </div>
        {following && (
          <button
            className="following"
            onClick={() => {
              if (renderer.current) renderer.current.followId = null;
              setFollowing(false);
            }}
          >
            ◎ Following{" "}
            {scenario?.residents.find(
              (p) => p.id === renderer.current?.followId,
            )?.name ?? "the supply cart"}{" "}
            <span>×</span>
          </button>
        )}
        {state?.blackout && (
          <div className="incident-banner">
            <span>⚡</span>
            <div>
              <strong>LOWER FEEDER OFFLINE</strong>
              <small>Upper clinic remains lit. Watch the lower crossing.</small>
            </div>
            <button
              onClick={() => {
                select({ kind: "room", id: "d2-f5" }, true);
              }}
            >
              Locate ↗
            </button>
          </div>
        )}
        {loading && (
          <div className="loading">
            <span className="brand-mark">H</span>
            <h2>Opening the Hollow</h2>
            <p>Bringing the next shift to life…</p>
          </div>
        )}
        {(panel || selection) && (
          <aside className="drawer" aria-label="World inspector">
            <div className="drawer-top">
              <span className="eyebrow">
                {panel === "explore"
                  ? "DISTRICT DIRECTORY"
                  : panel === "history"
                    ? "WORLD HISTORY"
                    : panel === "experiment"
                      ? "SCENARIO AUTHOR"
                      : panel === "help"
                        ? "FIELD GUIDE"
                        : "LIVE WORLD · OBSERVER TRUTH"}
              </span>
              <button
                aria-label="Close inspector"
                onClick={() => {
                  setPanel(null);
                  setSelection(null);
                  renderer.current?.select({ kind: "room", id: "" });
                }}
              >
                ×
              </button>
            </div>
            {panel === "explore" && (
              <>
                <h2>Find your way.</h2>
                <p className="muted">
                  Every person has a home, a duty, and somewhere to be.
                </p>
                <input
                  autoFocus
                  aria-label="Search rooms and residents"
                  placeholder="Search a place, person, or duty…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="tabs">
                  {["all", "rooms", "people"].map((f) => (
                    <button
                      className={filter === f ? "selected" : ""}
                      key={f}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="directory">
                  {filter !== "people" &&
                    scenario?.rooms
                      .filter((r) =>
                        `${r.name} ${r.kind} ${districts[r.district]}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() =>
                            select({ kind: "room", id: r.id }, true)
                          }
                        >
                          <span className="entry-icon">▦</span>
                          <span>
                            <strong>{r.name}</strong>
                            <small>
                              {districts[r.district]} · Level {r.floor + 1}
                            </small>
                          </span>
                          <b>↗</b>
                        </button>
                      ))}
                  {filter !== "rooms" &&
                    scenario?.residents
                      .filter((p) =>
                        `${p.name} ${p.role}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            select({ kind: "person", id: p.id }, true)
                          }
                        >
                          <span
                            className="person-icon"
                            style={{
                              background: [
                                "#bca879",
                                "#91a78d",
                                "#81a4a7",
                                "#b18d78",
                              ][p.appearance % 4],
                            }}
                          >
                            ●
                          </span>
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.role} ·{" "}
                              {state?.people.find((s) => s.id === p.id)?.task}
                            </small>
                          </span>
                          <b>↗</b>
                        </button>
                      ))}
                </div>
              </>
            )}
            {panel === "history" && (
              <>
                <h2>The city remembers.</h2>
                <p className="muted">
                  Recorded events from this run. Select one to find where it
                  happened.
                </p>
                <div className="summary-row">
                  <span>
                    Supply delivered
                    <strong>{decimal(state?.cart.delivered ?? 0)} units</strong>
                  </span>
                  <span>
                    Depot isolation<strong>{decimal(deficits)} hh·min</strong>
                  </span>
                </div>
                <div className="event-list">
                  {state?.events
                    .slice()
                    .reverse()
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() =>
                          select({ kind: "room", id: e.subjectId }, true)
                        }
                      >
                        <time>{clock(e.tick, scenario?.startHour)}</time>
                        <span>
                          <small>{e.kind.toUpperCase()}</small>
                          {e.text}
                        </span>
                        <b>↗</b>
                      </button>
                    ))}
                </div>
                <h3>Household access intervals</h3>
                <p className="muted">
                  12 households × 5 closed minutes = 60 household-minutes.
                  Concurrent closures count each household once.
                </p>
                {state?.deficits.slice(-24).map((d, i) => (
                  <div className="deficit" key={i}>
                    <strong>
                      {
                        scenario?.households.find((h) => h.id === d.householdId)
                          ?.name
                      }
                    </strong>
                    <span>
                      {clock(d.start, scenario?.startHour)} →{" "}
                      {d.end === null
                        ? "ongoing"
                        : clock(d.end, scenario?.startHour)}{" "}
                      · {decimal(((d.end ?? state.tick) - d.start) / 60)} min
                    </span>
                    <small>Causes: {d.causes.join(", ")}</small>
                  </div>
                ))}
              </>
            )}
            {panel === "experiment" && (
              <>
                <h2>A fragile balance.</h2>
                <p className="muted">
                  Introduce a disruption into this living world. These are
                  scenario-author controls; residents and future controllers use
                  the constrained request channel.
                </p>
                <div className="incident-card">
                  <span>01 / POWER</span>
                  <h3>The lower feeder</h3>
                  <p>
                    The clinic stays lit. The lower lift, pump and fans depend
                    on scarce backup power.
                  </p>
                  <button
                    className="gold-button"
                    onClick={() =>
                      incident(state?.blackout ? "restore" : "blackout")
                    }
                  >
                    {state?.blackout
                      ? "Restore lower feeder"
                      : "Trigger a lower blackout"}{" "}
                    ↗
                  </button>
                </div>
                <div className="incident-card">
                  <span>02 / INFORMATION</span>
                  <h3>The Directorate network</h3>
                  <p>
                    Physical life continues. Readings retain their original
                    sample time when the network goes dark.
                  </p>
                  <button
                    onClick={() =>
                      incident(state?.comms ? "comms" : "reconnect")
                    }
                  >
                    {state?.comms
                      ? "Cut communications"
                      : "Restore communications"}{" "}
                    ↗
                  </button>
                </div>
                <div className="incident-card">
                  <span>03 / MOVEMENT</span>
                  <h3>The service checkpoint</h3>
                  <p>
                    Close a permitted shortcut and watch workers find a route or
                    wait.
                  </p>
                  <button
                    onClick={() =>
                      incident(state?.lockdown ? "unlock" : "lockdown")
                    }
                  >
                    {state?.lockdown
                      ? "Reopen checkpoint"
                      : "Seal the checkpoint"}{" "}
                    ↗
                  </button>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    send({ type: "reset" });
                    setSelection(null);
                    notify(
                      "World reset to the same initial conditions, paused.",
                    );
                  }}
                >
                  ↺ Reset the world
                </button>
              </>
            )}
            {panel === "help" && (
              <>
                <h2>Look a little closer.</h2>
                <p className="muted">
                  Drag the city to explore. Scroll or pinch to zoom. Click a
                  room or person; follow them to see where they go.
                </p>
                <div className="key-guide">
                  <span>Pan</span>
                  <kbd>← ↑ ↓ →</kbd>
                  <span>Pause / resume</span>
                  <kbd>Space</kbd>
                  <span>Zoom</span>
                  <kbd>+ / −</kbd>
                  <span>Close inspector</span>
                  <kbd>Esc</kbd>
                </div>
                <h3>Keep this world</h3>
                <div className="save-actions">
                  <button onClick={save}>Save locally</button>
                  <button
                    onClick={() =>
                      loadLocal()
                        .then(restore)
                        .catch((e) => notify(e.message))
                    }
                  >
                    Load local save
                  </button>
                  <button
                    onClick={() =>
                      scenario &&
                      state &&
                      download("hollow-world-save.json", {
                        format: "hollow-save-v1",
                        scenario,
                        state,
                      })
                    }
                  >
                    Export snapshot
                  </button>
                  <button onClick={() => upload.current?.click()}>
                    Import save / scenario / replay
                  </button>
                  <button
                    onClick={() =>
                      scenario &&
                      state &&
                      download("hollow-world-replay.json", {
                        format: "hollow-replay-v1",
                        scenario,
                        finalTick: state.tick,
                        actions: state.actions,
                        commands: state.commandLog,
                      })
                    }
                  >
                    Export deterministic replay
                  </button>
                  <button
                    onClick={() =>
                      scenario && download("hollow-scenario.json", scenario)
                    }
                  >
                    Export scenario
                  </button>
                  <button
                    onClick={() => {
                      send({ type: "reset" });
                      setSelection(null);
                      notify(
                        "World reset, paused at the same starting conditions.",
                      );
                    }}
                  >
                    Reset world
                  </button>
                </div>
                <h3>Under the surface</h3>
                <p className="muted">
                  {scenario?.rooms.length} rooms · {scenario?.residents.length}{" "}
                  residents · 60 households · 8 levels. All populations,
                  capacities, needs and exposure rules are fictional inputs.
                </p>
                <p className="muted">
                  One fixed simulation-second per tick. Rendering never advances
                  time. Offscreen districts keep running.
                </p>
                <p className="muted">
                  Engine: {performanceStats.tickMs.toFixed(2)} ms/tick ·
                  observed {performanceStats.achievedSpeed}× · renderer{" "}
                  {Math.round(renderer.current?.fps ?? 0)} FPS
                </p>
                <a href="/scenario.json" target="_blank" rel="noreferrer">
                  Open editable scenario ↗
                </a>
              </>
            )}
            {selectedRoom && room && (
              <>
                <span className="location-meta">
                  {districts[selectedRoom.district]} / LEVEL{" "}
                  {selectedRoom.floor + 1}
                </span>
                <h2>{selectedRoom.name}</h2>
                <p className="room-description">{describe(selectedRoom)}</p>
                <div className="status-pill">
                  <i className={room.powered ? "" : "off"} />
                  {room.reason}
                </div>
                <div className="inspector-grid">
                  <span>
                    Residents here<strong>{room.occupants}</strong>
                  </span>
                  <span>
                    Working staff<strong>{room.staff}</strong>
                  </span>
                  <span>
                    Temperature<strong>{room.temperature.toFixed(1)}°C</strong>
                  </span>
                  <span>
                    Air burden
                    <strong>
                      {room.air.toFixed(1)} <small>/ 100</small>
                    </strong>
                  </span>
                </div>
                <h3>Shared stores</h3>
                <div className="stocks">
                  {(["food", "water", "medicine", "parts"] as const).map(
                    (k) => (
                      <span key={k}>
                        {k}
                        <strong>
                          {decimal(room.stock[k])}
                          {k === "water" ? " L" : ""}
                        </strong>
                      </span>
                    ),
                  )}
                </div>
                {selectedRoom.kind === "farm" && (
                  <p className="muted">
                    Crop progress:{" "}
                    {Math.round(
                      (room.growth / (scenario?.settings.cropSeconds ?? 1)) *
                        100,
                    )}
                    % · harvested {room.output} food units.
                  </p>
                )}
                <h3>People in this room</h3>
                {occupants.length === 0 ? (
                  <p className="muted">
                    No one is currently here. People may be on the way.
                  </p>
                ) : (
                  <div className="people-list">
                    {occupants.slice(0, 20).map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          select({ kind: "person", id: p.id }, true)
                        }
                      >
                        <strong>
                          {scenario?.residents.find((d) => d.id === p.id)?.name}
                        </strong>
                        <small>
                          {p.taskState === "queued" ? "Waiting · " : ""}
                          {p.task} ↗
                        </small>
                      </button>
                    ))}
                  </div>
                )}
                <h3>Connections & dependencies</h3>
                <p className="muted">
                  Feeder level{" "}
                  {(selectedRoom.feederFloor ?? selectedRoom.floor) + 1} ·
                  demand {selectedRoom.demandW} W · {room.suppliedW} W supplied
                </p>
                {scenario?.links
                  .filter(
                    (l) => l.a === selectedRoom.id || l.b === selectedRoom.id,
                  )
                  .map((l) => (
                    <button
                      className="connection"
                      key={l.id}
                      onClick={() => select({ kind: "link", id: l.id })}
                    >
                      {
                        scenario.rooms.find(
                          (r) => r.id === (l.a === selectedRoom.id ? l.b : l.a),
                        )?.name
                      }
                      <small>
                        {state?.closedLinks.includes(l.id)
                          ? "FLOODED"
                          : l.kind.toUpperCase()}{" "}
                        ↗
                      </small>
                    </button>
                  ))}
                <h3>Households depending on this room</h3>
                {dependents.map((h) => {
                  const hs = state?.households.find((x) => x.id === h.id);
                  return (
                    <div className="deficit" key={h.id}>
                      <strong>{h.name}</strong>
                      <span>
                        {h.members.length} people ·{" "}
                        {hs?.accessClosed
                          ? "Depot route closed"
                          : "Depot route open"}
                      </span>
                      <small>
                        {decimal((hs?.cutoffSeconds ?? 0) / 60)} min access lost
                        · {decimal((hs?.coolingSeconds ?? 0) / 60)} min cooling
                        lost
                      </small>
                    </div>
                  );
                })}
                <button
                  className="text-button"
                  onClick={() => setReportView(!reportView)}
                >
                  {reportView ? "Hide" : "View"} controller report{" "}
                  {reportStatus === "STALE" ? "· STALE" : ""} ↓
                </button>
                {reportView && (
                  <div className="report">
                    <b>{reportStatus} · REPORTED INFORMATION</b>
                    <p>
                      {report
                        ? `Sample at ${clock(report.sampledAtTick, scenario?.startHour)}:${String(report.sampledAtTick % 60).padStart(2, "0")} · ${state!.tick - report.sampledAtTick}s old. Water ${report.waterM.toFixed(2)}m · ${report.temperature.toFixed(1)}°C · ${report.powered ? "powered" : "unpowered"}`
                        : "No sample delivered. Values are unknown."}
                    </p>
                  </div>
                )}
                {selectedRoom.kind === "pump" || selectedRoom.kind === "fan" ? (
                  <>
                    <h3>Operator request</h3>
                    <p className="muted">
                      Battery {decimal((state?.batteryMilliWh ?? 0) / 1000)} Wh
                      · {scenario?.settings.batteryMaxW} W maximum. Current
                      backup: {state?.backup}. Requests require communications.
                    </p>
                    <button
                      className="gold-button"
                      onClick={() =>
                        request(
                          "assignBackup",
                          selectedRoom.id,
                          selectedRoom.kind,
                        )
                      }
                    >
                      Request backup for {selectedRoom.kind}
                    </button>
                  </>
                ) : null}
                <button
                  className="text-button"
                  onClick={() =>
                    request("setDeviceEnabled", selectedRoom.id, !room.powered)
                  }
                >
                  Request {room.powered ? "device off" : "device on"}
                </button>
              </>
            )}
            {selectedPerson && person && (
              <>
                <span className="location-meta">
                  RESIDENT / {selectedPerson.role.toUpperCase()}
                </span>
                <h2>{selectedPerson.name}</h2>
                <div className="resident-portrait">
                  <span
                    style={{
                      background: ["#bda16f", "#87a087", "#81a0a5", "#ab8974"][
                        selectedPerson.appearance % 4
                      ],
                    }}
                  >
                    ●<i />
                  </span>
                  <div>
                    <b>{person.task}</b>
                    <small>{person.taskState.toUpperCase()}</small>
                  </div>
                </div>
                <p className="room-description">{person.reason}</p>
                <button
                  className="gold-button"
                  onClick={() => {
                    renderer.current?.focus(selectedPerson.id, true);
                    setFollowing(true);
                  }}
                >
                  ◎ Follow {selectedPerson.name.split(" ")[0]}
                </button>
                <h3>Today's route</h3>
                <div className="route-info">
                  <span>
                    Home
                    <strong>
                      {
                        scenario?.rooms.find(
                          (r) => r.id === selectedPerson.homeId,
                        )?.name
                      }
                    </strong>
                  </span>
                  <span>
                    Duty<strong>{selectedPerson.role}</strong>
                  </span>
                  <span>
                    Heading to
                    <strong>
                      {
                        scenario?.rooms.find((r) => r.id === person.destination)
                          ?.name
                      }
                    </strong>
                  </span>
                </div>
                <h3>Needs & exposure</h3>
                {[
                  ["Hunger", person.hunger],
                  ["Thirst", person.thirst],
                  ["Fatigue", person.fatigue],
                ].map(([name, value]) => (
                  <div className="need" key={name}>
                    <span>{name}</span>
                    <div>
                      <i style={{ width: `${value}%` }} />
                    </div>
                    <b>{Math.round(Number(value))}</b>
                  </div>
                ))}
                <p className="muted">
                  Heat exposure: {decimal(person.heatExposure / 60)} min ·
                  poor-air exposure: {decimal(person.airExposure / 60)} min.
                  These are fictional model indices.
                </p>
                <h3>{household?.name}</h3>
                <p className="muted">
                  {household?.members
                    .map(
                      (id) =>
                        scenario?.residents.find((p) => p.id === id)?.name,
                    )
                    .join(" · ")}
                </p>
                <div className="summary-row">
                  <span>
                    Food reserve
                    <strong>{decimal(householdState?.stock.food ?? 0)}</strong>
                  </span>
                  <span>
                    Water reserve
                    <strong>
                      {decimal(householdState?.stock.water ?? 0)} L
                    </strong>
                  </span>
                </div>
                <div className="report">
                  <b>
                    {householdState?.accessClosed
                      ? "DEPOT ACCESS LOST"
                      : "DEPOT ROUTE OPEN"}
                  </b>
                  <p>
                    {decimal((householdState?.cutoffSeconds ?? 0) / 60)}{" "}
                    household-minutes cut off ·{" "}
                    {decimal((householdState?.coolingSeconds ?? 0) / 60)}{" "}
                    minutes without cooling.
                  </p>
                </div>
                <h3>What this person knows</h3>
                <p className="muted">
                  {person.knownClosed.length
                    ? `Encountered blocked links: ${person.knownClosed.join(", ")}.`
                    : "No locally known blocked route."}{" "}
                  Remote information{" "}
                  {state?.comms
                    ? "can arrive through the network."
                    : "is unavailable during the communications cut."}
                </p>
              </>
            )}
            {selection?.kind === "cart" && state && (
              <>
                <span className="location-meta">SUPPLY RUN / ACTUAL CARGO</span>
                <h2>A lifeline on wheels.</h2>
                <p className="room-description">{state.cart.reason}</p>
                <div className="status-pill">
                  {state.cart.phase.toUpperCase()}
                </div>
                <button
                  className="gold-button"
                  onClick={() => {
                    renderer.current?.focus("cart", true);
                    setFollowing(true);
                  }}
                >
                  ◎ Follow the supply cart
                </button>
                <div className="inspector-grid">
                  <span>
                    Food on board
                    <strong>{decimal(state.cart.cargo.food)}</strong>
                  </span>
                  <span>
                    Medicine
                    <strong>{decimal(state.cart.cargo.medicine)}</strong>
                  </span>
                  <span>
                    Food delivered
                    <strong>{decimal(state.cart.delivered)}</strong>
                  </span>
                  <span>
                    Destination
                    <strong className="small-value">
                      {
                        scenario?.rooms.find(
                          (r) => r.id === state.cart.targetId,
                        )?.name
                      }
                    </strong>
                  </span>
                </div>
                <p className="muted">
                  Goods count as delivered only after unloading into household
                  stores. Flooding leaves the cargo on the cart.
                </p>
              </>
            )}
            {link && (
              <>
                <span className="location-meta">
                  CONNECTION / {link.kind.toUpperCase()}
                </span>
                <h2>
                  {link.kind === "sump"
                    ? "The lower crossing"
                    : "A way through"}
                </h2>
                <p className="room-description">
                  {scenario?.rooms.find((r) => r.id === link.a)?.name} ↔{" "}
                  {scenario?.rooms.find((r) => r.id === link.b)?.name}
                </p>
                <div className="status-pill">
                  {state?.closedLinks.includes(link.id)
                    ? "FLOODED · NO PASSAGE"
                    : link.kind === "checkpoint" && state?.lockdown
                      ? "SEALED BY DIRECTORATE"
                      : "PASSAGE OPEN"}
                </div>
                <p className="muted">
                  Travel: {link.seconds}s · simultaneous capacity:{" "}
                  {link.capacity}
                  {link.permit ? " · service permit required" : ""}.
                </p>
                {link.kind === "sump" && (
                  <>
                    <h3>Water against the markings</h3>
                    <div className="big-value">
                      {(
                        (state?.waterL ?? 0) /
                        (scenario!.settings.tunnelAreaM2 * 1000)
                      ).toFixed(2)}{" "}
                      <small>m</small>
                    </div>
                    <p className="muted">
                      Closes at {scenario?.settings.closeDepthM}m. Inflow{" "}
                      {scenario?.settings.seepLps} L/s; powered pump{" "}
                      {scenario?.settings.pumpLps} L/s.
                    </p>
                  </>
                )}
                <h3>Who depends on it?</h3>
                {linkDependents.map((h) => (
                  <div className="deficit" key={h.id}>
                    <strong>{h.name}</strong>
                    <span>{h.members.length} residents</span>
                  </div>
                ))}
              </>
            )}
          </aside>
        )}
        <div className="bottom-hint">
          <span>↔ DRAG TO EXPLORE</span>
          <span>⊕ SCROLL TO LOOK CLOSER</span>
          <span>◎ CLICK A PERSON TO FOLLOW</span>
        </div>
      </main>
      <footer className="timebar">
        <div className="clock">
          <span className="eyebrow">
            DISTRICT TIME · DAY {1 + Math.floor((state?.tick ?? 0) / 86400)}
          </span>
          <strong>
            {clock(state?.tick ?? 0, scenario?.startHour)}
            <small>:{String((state?.tick ?? 0) % 60).padStart(2, "0")}</small>
            <i>{playing ? "LIVE" : "PAUSED"}</i>
          </strong>
        </div>
        <div className="time-controls">
          <button
            className="play-button"
            onClick={() => send({ type: "play", playing: !playing })}
            aria-label={playing ? "Pause simulation" : "Play simulation"}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button onClick={() => send({ type: "step" })}>+1 min</button>
          <span className="separator" />
          {[1, 10, 60, 300].map((s) => (
            <button
              key={s}
              className={speed === s ? "selected" : ""}
              onClick={() => send({ type: "speed", speed: s })}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="bottom-state">
          <i className={state?.comms ? "" : "offline"} />
          {state?.comms ? "NETWORK CONNECTED" : "NETWORK SILENT"}
          <button
            onClick={() => {
              select({ kind: "cart", id: "cart" }, true);
            }}
          >
            ▣ Find the supply cart ↗
          </button>
        </div>
      </footer>
      <input
        className="hidden"
        ref={upload}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function describe(room: RoomDef) {
  const descriptions: Record<RoomDef["kind"], string> = {
    home: "Shared beds, stored meals, and lives carried on between shifts. Every resident belongs to a persistent household.",
    clinic:
      "Care depends on staff, medicine, powered equipment, and a route patients can actually reach.",
    depot:
      "Finite food, water, medicine and parts. Supplies leave these shelves as real cargo.",
    farm: "Communal beds under grow lamps. Harvests require water, power, and growers at work.",
    plant:
      "Aging geothermal machinery supplies a finite grid. Directorate allocations serve upper feeders first.",
    switchgear:
      "Feeder distribution connects the district to the geothermal grid.",
    recycler:
      "Reclaims water from a finite waste stock. Operators and powered treatment determine output.",
    tap: "Residents queue to collect actual water for shared household stores.",
    fan: "Air exchange and cooling keep surrounding homes livable. A stopped fan changes conditions gradually.",
    pump: "Seepage keeps entering the lower crossing. This pump needs power to remove it.",
    workshop:
      "Technicians, finite spare parts, and ordinary maintenance duties.",
    mess: "A communal place to pause, meet neighbors, and finish the day.",
    checkpoint:
      "The Directorate controls this route between levels. Access can depend on permits and orders.",
    relay:
      "The district network carries timestamped reports. A lost connection leaves old readings behind.",
    gate: "The surface has been closed for thirty years. Machine activity is visible; claims of safety remain unverified.",
  };
  return descriptions[room.kind];
}
createRoot(document.getElementById("root")!).render(<App />);
