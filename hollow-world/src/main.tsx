import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  IncidentKind,
  Scenario,
  WorkerRequest,
  WorkerResponse,
  WorldState,
  PersonDef,
  Report,
} from "./engine/types";
import { blocked, Router } from "./engine/routing";
import { validateSave, validateScenario } from "./engine/validation";
import { WorldRenderer, type Selection } from "./world/render";
import { download, loadLocal, saveLocal, type SaveFile } from "./persistence";
import {
  appearance,
  cssColor,
  cargoUnits,
  importantEvent,
  subjectRoom,
  roomStockItems,
} from "./world/presentation";
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
    [activeLevel, setActiveLevel] = useState<number | null>(null),
    [historyFilter, setHistoryFilter] = useState("important"),
    [lastRequest, setLastRequest] = useState<{
      id: string;
      target: string;
      type: string;
      message: string;
      ok?: boolean;
      tick?: number;
    }>(),
    [activeDistrict, setActiveDistrict] = useState<number | null>(1),
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
    if (renderer.current) {
      renderer.current.followId = null;
      renderer.current.setInspectorOpen(true);
    }
    setFollowing(false);
    if (scenario && stateRef.current) {
      const location =
        subjectRoom(scenario, stateRef.current, s.id) ??
        scenario.rooms.find(
          (r) => r.id === scenario.links.find((l) => l.id === s.id)?.a,
        );
      if (location) {
        setActiveDistrict(location.district);
        setActiveLevel(location.floor + 1);
      }
    }
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
        setLoading(false);
      } else if (m.type === "error") {
        notify(m.message);
        setLoading(false);
      } else if (m.type === "receipt") {
        setLastRequest((previous) =>
          previous?.id === m.receipt.commandId
            ? {
                ...previous,
                ok: m.receipt.ok,
                tick: m.receipt.scheduledTick,
                message: m.receipt.ok
                  ? "Queued for next tick."
                  : (m.receipt.reason ?? "Request rejected"),
              }
            : previous,
        );
        notify(
          m.receipt.ok
            ? "Queued for next tick."
            : (m.receipt.reason ?? "Request rejected"),
        );
      }
    };
    w.onerror = () => notify("Simulation stopped. Export before reloading.");
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
          `Graphics could not start: ${e.message}. Use Find to inspect the run.`,
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
    renderer.current?.setInspectorOpen(Boolean(panel || selection));
    if (following && state && scenario && renderer.current?.followId) {
      const location = subjectRoom(scenario, state, renderer.current.followId);
      if (location) {
        setActiveDistrict(location.district);
        setActiveLevel(location.floor + 1);
      }
    }
  }, [state, following, panel, selection?.id, scenario]);
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
        notify("Paused in background.");
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
        notify("Saved.");
      } catch (e) {
        notify((e as Error).message);
      }
  }
  function restore(file: SaveFile) {
    if (file.format !== "hollow-save-v1")
      throw new Error("Unsupported save format");
    validateSave(file.scenario, file.state);
    setScenario(file.scenario);
    setActiveDistrict(1);
    setActiveLevel(null);
    setSelection(null);
    setPanel(null);
    setFollowing(false);
    setLastRequest(undefined);
    send({ type: "load", scenario: file.scenario, state: file.state });
    notify("Loaded. Paused.");
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
        setActiveDistrict(1);
        setActiveLevel(null);
        setFollowing(false);
        setLastRequest(undefined);
        setSelection(null);
        setPanel(null);
        send({ type: "replay", replay: input });
        notify("Replaying…");
      } else {
        validateScenario(input);
        setScenario(input);
        setActiveDistrict(1);
        setActiveLevel(null);
        setFollowing(false);
        setLastRequest(undefined);
        setSelection(null);
        setPanel(null);
        send({ type: "init", scenario: input });
        notify("Scenario loaded.");
      }
    } catch (e) {
      notify(`Import rejected: ${(e as Error).message}`);
    }
  }
  function request(
    type:
      "assignBackup" | "requestRepair" | "setDeviceEnabled" | "requestDelivery",
    targetId: string,
    value?: string | boolean,
  ) {
    if (!state) return;
    const commandId = `manual-${state.runId}-${++commandSequence.current}`;
    setLastRequest({
      id: commandId,
      target: targetId,
      type,
      message: "Sending request…",
    });
    send({
      type: "command",
      command: {
        commandId,
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
    renderer.current?.select({ kind: "room", id: "" });
  }
  function incident(kind: IncidentKind) {
    send({ type: "incident", kind });
  }
  const selectedRoom =
    selection?.kind === "room"
      ? scenario?.rooms.find((r) => r.id === selection.id)
      : undefined;
  const pumpRoom = scenario?.rooms.find((r) => r.kind === "pump");
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
    (r) => r.subjectId === (selectedRoom?.id ?? pumpRoom?.id),
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
  const backupIssue =
    !state || !scenario || !selectedRoom
      ? "World is loading"
      : !state.comms
        ? "Command channel disconnected"
        : state.commands.length >= 100
          ? "Command queue full"
          : state.commands.some(
                (c) =>
                  c.type === "assignBackup" && c.targetId === selectedRoom.id,
              )
            ? "A backup request is pending"
            : state.batteryMilliWh <= 0
              ? "Battery empty"
              : selectedRoom.demandW > scenario.settings.batteryMaxW
                ? "Discharge power limit exceeded"
                : state.disabled.includes(selectedRoom.id)
                  ? "Enable this device before assigning backup"
                  : state.backupTarget === selectedRoom.id
                    ? "Backup is assigned to this machine"
                    : "";
  function selectEvent(id: string) {
    const kind =
      id === "cart"
        ? "cart"
        : scenario?.residents.some((p) => p.id === id)
          ? "person"
          : scenario?.links.some((l) => l.id === id)
            ? "link"
            : "room";
    select({ kind, id }, true);
  }

  function closeInspector() {
    setPanel(null);
    setSelection(null);
    renderer.current?.select({ kind: "room", id: "" });
  }
  function overview() {
    closeInspector();
    if (renderer.current) {
      renderer.current.followId = null;
      renderer.current.setInspectorOpen(false);
      renderer.current.recenter();
    }
    setFollowing(false);
    setActiveDistrict(null);
    setActiveLevel(null);
  }
  function follow(id: string) {
    const view = renderer.current;
    if (!view) return;
    if (view.followId === id) {
      view.followId = null;
      setFollowing(false);
    } else {
      view.focus(id, true);
      setFollowing(true);
    }
  }
  const followingName =
    scenario?.residents.find((p) => p.id === renderer.current?.followId)
      ?.name ?? "Cart";
  const stockItems =
    selectedRoom && room ? roomStockItems(selectedRoom.kind, room.stock) : [];
  const machine =
    selectedRoom &&
    (selectedRoom.kind === "pump" || selectedRoom.kind === "fan");
  const machineProblem = Boolean(
    machine &&
    room &&
    (!room.powered ||
      (selectedRoom?.kind === "pump" && state?.closedLinks.length)),
  );
  return (
    <main className="world-stage">
      <div ref={canvas} className="world-canvas" />
      <aside className="world-tools" aria-label="World controls">
        <nav className="tool-grid" aria-label="World tools">
          <button
            title="Find rooms and residents"
            aria-label="Explore"
            aria-pressed={panel === "explore"}
            onClick={() => togglePanel("explore")}
          >
            <span aria-hidden="true">⌕</span>
          </button>
          <button
            title="History"
            aria-label="History"
            aria-pressed={panel === "history"}
            onClick={() => togglePanel("history")}
          >
            <span aria-hidden="true">◷</span>
          </button>
          <button
            title="Incidents"
            aria-label="Incidents"
            aria-pressed={panel === "experiment"}
            onClick={() => togglePanel("experiment")}
          >
            <span aria-hidden="true">ϟ</span>
          </button>
          <button
            title="Help and saves"
            aria-label="Help and saves"
            aria-pressed={panel === "help"}
            onClick={() => togglePanel("help")}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          <button
            title="Find cart"
            aria-label="Find the supply cart"
            onClick={() => select({ kind: "cart", id: "cart" }, true)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 4h2l3 12h11l2-8H6M9 20h.01M18 20h.01" />
            </svg>
          </button>
          <button
            title="Overview"
            aria-label="Recenter world"
            onClick={overview}
          >
            <span aria-hidden="true">⌖</span>
          </button>
        </nav>
        <nav className="district-nav" aria-label="District navigation">
          {districts.map((d, i) => (
            <button
              key={d}
              aria-label={d}
              aria-pressed={activeDistrict === i}
              onClick={() => {
                closeInspector();
                if (renderer.current) {
                  renderer.current.followId = null;
                  renderer.current.setInspectorOpen(false);
                  renderer.current.district(i);
                }
                setActiveDistrict(i);
                setActiveLevel(null);
                setFollowing(false);
              }}
            >
              {d.replace("The ", "")}
              {activeDistrict === i && activeLevel && (
                <small>L{activeLevel}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="zoom-controls" aria-label="Camera controls">
          <button
            title="Zoom out (−)"
            aria-label="Zoom out"
            onClick={() => renderer.current?.zoomBy(0.8)}
          >
            −
          </button>
          <button
            title="Zoom in (+)"
            aria-label="Zoom in"
            onClick={() => renderer.current?.zoomBy(1.25)}
          >
            +
          </button>
        </div>
        {following && (
          <button
            className="follow-chip"
            title={"Stop following " + followingName}
            aria-label={"Stop following " + followingName}
            onClick={() => {
              if (renderer.current) renderer.current.followId = null;
              setFollowing(false);
            }}
          >
            <span aria-hidden="true">◎</span>
            <span>{followingName}</span>
            <span aria-hidden="true">×</span>
          </button>
        )}
        {state?.blackout && (
          <button
            className="incident-chip"
            disabled={!pumpRoom}
            title="Lower feeder offline · Open drainage"
            aria-label="Locate drainage outage"
            onClick={() =>
              pumpRoom && select({ kind: "room", id: pumpRoom.id }, true)
            }
          >
            <span aria-hidden="true">ϟ</span>
            {state.closedLinks.length
              ? state.households.length - connectedHomes + " homes isolated"
              : "Power outage"}
          </button>
        )}
        {state && !state.comms && (
          <span className="offline-status" role="status">
            Comms offline
          </span>
        )}
      </aside>

      <section className="playback" aria-label="Playback">
        <div className="clock-row">
          <time
            className="clock"
            title={
              "Day " +
              (1 + Math.floor((state?.tick ?? 0) / 86400)) +
              " · " +
              clock(state?.tick ?? 0, scenario?.startHour) +
              ":" +
              String((state?.tick ?? 0) % 60).padStart(2, "0") +
              " · " +
              (playing ? "Running" : "Paused")
            }
          >
            {(state?.tick ?? 0) >= 86400 && (
              <small>D{1 + Math.floor((state?.tick ?? 0) / 86400)} </small>
            )}
            {clock(state?.tick ?? 0, scenario?.startHour)}
          </time>
          <button
            title="Advance one minute"
            aria-label="Advance one minute"
            onClick={() => send({ type: "step" })}
          >
            +1m
          </button>
        </div>
        <div className="playback-dial">
          <button
            className="play-button"
            title={playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playing ? "Pause simulation" : "Play simulation"}
            onClick={() => send({ type: "play", playing: !playing })}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          {[1, 10, 60, 300].map((s, i) => (
            <button
              key={s}
              className="speed-button"
              data-slot={i}
              title={"Speed: " + s + "×"}
              aria-pressed={speed === s}
              onClick={() => send({ type: "speed", speed: s })}
            >
              {s}×
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div className="loading" role="status">
          Loading…
        </div>
      )}

      {(panel || selection) && (
        <aside
          key={panel ?? selection?.kind + ":" + selection?.id}
          className="drawer"
          aria-label="World inspector"
        >
          <button
            className="drawer-close"
            title="Close (Esc)"
            aria-label="Close inspector"
            onClick={closeInspector}
          >
            ×
          </button>

          {panel === "explore" && (
            <>
              <h2>Find</h2>
              <input
                autoFocus
                aria-label="Search rooms and residents"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="tabs">
                {["all", "rooms", "people"].map((f) => (
                  <button
                    key={f}
                    aria-pressed={filter === f}
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
                      (r.name + " " + r.kind + " " + districts[r.district])
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => select({ kind: "room", id: r.id }, true)}
                      >
                        <span className="entry-icon" aria-hidden="true">
                          ▦
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {districts[r.district].replace("The ", "")} · L
                            {r.floor + 1}
                          </small>
                        </span>
                      </button>
                    ))}
                {filter !== "rooms" &&
                  scenario?.residents
                    .filter((p) =>
                      (p.name + " " + p.role)
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
                        <ResidentPortrait person={p} />
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.role}</small>
                        </span>
                      </button>
                    ))}
              </div>
            </>
          )}

          {panel === "history" && (
            <>
              <h2>History</h2>
              <div className="tabs" aria-label="History filter">
                <button
                  aria-pressed={historyFilter === "important"}
                  onClick={() => setHistoryFilter("important")}
                >
                  Key events
                </button>
                <button
                  aria-pressed={historyFilter === "all"}
                  onClick={() => setHistoryFilter("all")}
                >
                  All ({state?.events.length ?? 0})
                </button>
              </div>
              <div className="summary-row">
                <span>
                  Food delivered
                  <strong>{decimal(state?.cart.delivered ?? 0)}</strong>
                </span>
                <span>
                  Access lost<strong>{decimal(deficits)} hh·min</strong>
                </span>
              </div>
              <div className="event-list">
                {state?.events
                  .filter((e) => historyFilter === "all" || importantEvent(e))
                  .slice()
                  .reverse()
                  .map((e) => (
                    <button key={e.id} onClick={() => selectEvent(e.subjectId)}>
                      <time>{clock(e.tick, scenario?.startHour)}</time>
                      <span>{e.text}</span>
                    </button>
                  ))}
              </div>
              {Boolean(state?.deficits.length) && (
                <details>
                  <summary>Access history ({state?.deficits.length})</summary>
                  {state?.deficits.slice(-24).map((d, i) => (
                    <div className="deficit" key={i}>
                      <strong>
                        {
                          scenario?.households.find(
                            (h) => h.id === d.householdId,
                          )?.name
                        }
                      </strong>
                      <span>
                        {clock(d.start, scenario?.startHour)}–
                        {d.end === null
                          ? "now"
                          : clock(d.end, scenario?.startHour)}{" "}
                        · {decimal(((d.end ?? state.tick) - d.start) / 60)} min
                      </span>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}

          {panel === "experiment" && (
            <>
              <h2>Incidents</h2>
              <div className="incident-row">
                <span>Lower power</span>
                <button
                  aria-label={
                    state?.blackout
                      ? "Restore lower feeder"
                      : "Trigger a lower blackout"
                  }
                  onClick={() =>
                    incident(state?.blackout ? "restore" : "blackout")
                  }
                >
                  {state?.blackout ? "Restore" : "Cut power"}
                </button>
              </div>
              <div className="incident-row">
                <span>Comms</span>
                <button
                  aria-label={
                    state?.comms
                      ? "Cut communications"
                      : "Restore communications"
                  }
                  onClick={() => incident(state?.comms ? "comms" : "reconnect")}
                >
                  {state?.comms ? "Disconnect" : "Reconnect"}
                </button>
              </div>
              <div className="incident-row">
                <span>Checkpoint</span>
                <button
                  aria-label={
                    state?.lockdown ? "Reopen checkpoint" : "Seal checkpoint"
                  }
                  onClick={() =>
                    incident(state?.lockdown ? "unlock" : "lockdown")
                  }
                >
                  {state?.lockdown ? "Open" : "Close"}
                </button>
              </div>
            </>
          )}

          {panel === "help" && (
            <>
              <h2>Help & saves</h2>
              <div className="key-guide">
                <span>Pan</span>
                <kbd>← ↑ ↓ →</kbd>
                <span>Play / pause</span>
                <kbd>Space</kbd>
                <span>Zoom</span>
                <kbd>+ / −</kbd>
                <span>Close</span>
                <kbd>Esc</kbd>
              </div>
              <div className="save-actions">
                <button onClick={save}>Save</button>
                <button
                  onClick={() =>
                    loadLocal()
                      .then(restore)
                      .catch((e) => notify(e.message))
                  }
                >
                  Load
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
                  Export save
                </button>
                <button
                  aria-label="Import save, scenario or replay"
                  onClick={() => upload.current?.click()}
                >
                  Import
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
                  Export replay
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
                    closeInspector();
                    if (renderer.current) renderer.current.followId = null;
                    setFollowing(false);
                    send({ type: "reset" });
                    notify("Reset. Paused.");
                  }}
                >
                  Reset world
                </button>
              </div>
              <details>
                <summary>Settlement</summary>
                <p>
                  {state?.people.length ?? 0} people ·{" "}
                  {scenario?.rooms.length ?? 0} rooms ·{" "}
                  {new Set(scenario?.rooms.map((r) => r.floor)).size} levels
                </p>
                <p>
                  {connectedHomes}/{state?.households.length ?? 0} homes
                  connected
                </p>
                <a href="/scenario.json" target="_blank" rel="noreferrer">
                  Scenario
                </a>
              </details>
            </>
          )}

          {selectedRoom && room && state && scenario && (
            <>
              <span className="location-meta">
                {districts[selectedRoom.district].replace("The ", "")} · L
                {selectedRoom.floor + 1}
              </span>
              <h2>{selectedRoom.name}</h2>
              {machine && (
                <details
                  className={
                    "machine-controls" + (machineProblem ? " has-problem" : "")
                  }
                  open={machineProblem || undefined}
                >
                  <summary>
                    {machineProblem
                      ? selectedRoom.kind === "pump"
                        ? state.closedLinks.length
                          ? "Crossing flooded"
                          : "Pump offline"
                        : "Fan offline"
                      : "Power & backup"}
                  </summary>
                  {machineProblem && (
                    <p className="live-reading">
                      Live ·{" "}
                      {selectedRoom.kind === "pump"
                        ? (
                            state.waterL /
                            (scenario.settings.tunnelAreaM2 * 1000)
                          ).toFixed(2) +
                          " m / " +
                          scenario.settings.closeDepthM +
                          " m limit · " +
                          connectedHomes +
                          "/" +
                          state.households.length +
                          " connected"
                        : room.temperature.toFixed(1) +
                          "°C · Air " +
                          room.air.toFixed(1) +
                          "/100"}
                    </p>
                  )}
                  <button
                    className="gold-button"
                    aria-label={"Request " + selectedRoom.kind + " backup"}
                    disabled={Boolean(backupIssue)}
                    onClick={() =>
                      request(
                        "assignBackup",
                        selectedRoom.id,
                        selectedRoom.kind,
                      )
                    }
                  >
                    {state.backupTarget === selectedRoom.id
                      ? "Backup assigned"
                      : "Assign backup"}
                  </button>
                  <p
                    className="action-prerequisite"
                    title="Device draw / output limit · battery energy"
                  >
                    {selectedRoom.demandW}/{scenario.settings.batteryMaxW} W ·{" "}
                    {decimal(state.batteryMilliWh / 1000)} Wh
                  </p>
                  {state.backupTarget !== selectedRoom.id && (
                    <p className="action-prerequisite">
                      Replaces {state.backup} backup
                    </p>
                  )}
                  {backupIssue &&
                    backupIssue !== "Backup is assigned to this machine" && (
                      <p className="command-feedback">{backupIssue}</p>
                    )}
                  {lastRequest?.target === selectedRoom.id && (
                    <p className="command-feedback" role="status">
                      {lastRequest.ok &&
                      lastRequest.tick &&
                      state.tick >= lastRequest.tick &&
                      !state.commands.some(
                        (c) => c.commandId === lastRequest.id,
                      )
                        ? "Applied " +
                          clock(lastRequest.tick, scenario.startHour) +
                          ":" +
                          String(lastRequest.tick % 60).padStart(2, "0") +
                          (lastRequest.type === "assignBackup"
                            ? " · Backup assigned."
                            : ".")
                        : lastRequest.message +
                          (lastRequest.ok && !playing ? " +1m to apply." : "")}
                    </p>
                  )}
                </details>
              )}
              <div className="room-metrics">
                <span className={room.powered ? "" : "warning"}>
                  {room.powered ? "Powered" : room.reason}
                </span>
                <span>{room.occupants} people</span>
                <span>{room.staff} staff</span>
                {!(machineProblem && selectedRoom.kind === "fan") && (
                  <>
                    <span title="Temperature">
                      {room.temperature.toFixed(1)}°C
                    </span>
                    <span title="Air burden">
                      Air {room.air.toFixed(1)}/100
                    </span>
                  </>
                )}
              </div>
              {selectedRoom.kind === "pump" && !machineProblem && (
                <p className="compact-reading">
                  Live ·{" "}
                  {(
                    state.waterL /
                    (scenario.settings.tunnelAreaM2 * 1000)
                  ).toFixed(2)}{" "}
                  m water · {connectedHomes}/{state.households.length} connected
                </p>
              )}
              {stockItems.length > 0 && (
                <div className="stocks">
                  {stockItems.map((item) => (
                    <span key={item}>
                      {item}
                      <strong>
                        {decimal(room.stock[item])}
                        {item === "water" ? " L" : ""}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
              {selectedRoom.kind === "farm" && (
                <p className="compact-reading">
                  Crop{" "}
                  {Math.round(
                    (room.growth / scenario.settings.cropSeconds) * 100,
                  )}
                  % · {decimal(room.output)} harvested
                </p>
              )}
              {occupants.length > 0 && (
                <>
                  <h3>People</h3>
                  <div className="people-list">
                    {occupants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          select({ kind: "person", id: p.id }, true)
                        }
                      >
                        <strong>
                          {scenario.residents.find((d) => d.id === p.id)?.name}
                        </strong>
                        <small>
                          {p.taskState === "queued"
                            ? "Waiting · "
                            : p.taskState === "blocked"
                              ? "Blocked · "
                              : ""}
                          {p.task}
                        </small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <details>
                <summary>Connections</summary>
                <p>
                  {room.suppliedW}/{selectedRoom.demandW} W · Feeder L
                  {(selectedRoom.feederFloor ?? selectedRoom.floor) + 1}
                </p>
                {scenario.links
                  .filter(
                    (l) => l.a === selectedRoom.id || l.b === selectedRoom.id,
                  )
                  .map((l) => (
                    <button
                      className="connection"
                      key={l.id}
                      onClick={() => select({ kind: "link", id: l.id })}
                    >
                      <span>
                        {
                          scenario.rooms.find(
                            (r) =>
                              r.id === (l.a === selectedRoom.id ? l.b : l.a),
                          )?.name
                        }
                      </span>
                      <small>{blocked(l, state) || l.kind}</small>
                    </button>
                  ))}
              </details>
              {dependents.length > 0 && (
                <details>
                  <summary>Households ({dependents.length})</summary>
                  {dependents.map((h) => {
                    const hs = state.households.find((x) => x.id === h.id);
                    return (
                      <div className="deficit" key={h.id}>
                        <strong>{h.name}</strong>
                        <span>
                          {h.members.length} people ·{" "}
                          {hs?.accessClosed ? "Route closed" : "Route open"}
                        </span>
                        <small>
                          {decimal((hs?.cutoffSeconds ?? 0) / 60)} min access
                          lost · {decimal((hs?.coolingSeconds ?? 0) / 60)} min
                          cooling lost
                        </small>
                      </div>
                    );
                  })}
                </details>
              )}
              <details>
                <summary>
                  Controller report · {reportStatus.toLowerCase()}
                </summary>
                <ControllerReport
                  status={reportStatus}
                  report={report}
                  tick={state.tick}
                  startHour={scenario.startHour}
                />
              </details>
              <details>
                <summary>Device</summary>
                <button
                  className="text-button"
                  disabled={!state.comms}
                  title={!state.comms ? "Command channel disconnected" : ""}
                  onClick={() =>
                    request(
                      "setDeviceEnabled",
                      selectedRoom.id,
                      state.disabled.includes(selectedRoom.id),
                    )
                  }
                >
                  {state.disabled.includes(selectedRoom.id)
                    ? "Enable device"
                    : "Disable device"}
                </button>
              </details>
            </>
          )}

          {selectedPerson && person && (
            <>
              <span className="location-meta">{selectedPerson.role}</span>
              <h2>{selectedPerson.name}</h2>
              <div className="resident-portrait">
                <ResidentPortrait person={selectedPerson} />
                <div>
                  <b>{person.task}</b>
                  {person.taskState !== "active" && (
                    <small>{person.taskState}</small>
                  )}
                </div>
              </div>
              {(person.taskState === "blocked" ||
                person.taskState === "queued") && (
                <p className="command-feedback">{person.reason}</p>
              )}
              <button
                className="gold-button"
                aria-label={"Follow " + selectedPerson.name}
                aria-pressed={
                  following && renderer.current?.followId === selectedPerson.id
                }
                onClick={() => follow(selectedPerson.id)}
              >
                {following && renderer.current?.followId === selectedPerson.id
                  ? "Stop following"
                  : "Follow"}
              </button>
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
                  To
                  <strong>
                    {
                      scenario?.rooms.find((r) => r.id === person.destination)
                        ?.name
                    }
                  </strong>
                </span>
              </div>
              <h3>Needs</h3>
              {[
                ["Hunger", person.hunger],
                ["Thirst", person.thirst],
                ["Fatigue", person.fatigue],
              ].map(([name, value]) => (
                <div className="need" key={name}>
                  <span>{name}</span>
                  <meter
                    min={0}
                    max={100}
                    value={Number(value)}
                    aria-label={String(name)}
                  />
                  <b>{Math.round(Number(value))}</b>
                </div>
              ))}
              <details>
                <summary>Household & exposure</summary>
                <p>{household?.name}</p>
                <p>
                  {household?.members
                    .map(
                      (id) =>
                        scenario?.residents.find((p) => p.id === id)?.name,
                    )
                    .join(" · ")}
                </p>
                <div className="stocks">
                  <span>
                    Food
                    <strong>{decimal(householdState?.stock.food ?? 0)}</strong>
                  </span>
                  <span>
                    Water
                    <strong>
                      {decimal(householdState?.stock.water ?? 0)} L
                    </strong>
                  </span>
                </div>
                <p>
                  {householdState?.accessClosed
                    ? "Depot route closed"
                    : "Depot route open"}
                </p>
                <p>
                  {decimal((householdState?.cutoffSeconds ?? 0) / 60)} min
                  access lost ·{" "}
                  {decimal((householdState?.coolingSeconds ?? 0) / 60)} min
                  cooling lost
                </p>
                <p>
                  Heat {decimal(person.heatExposure / 60)} min · Poor air{" "}
                  {decimal(person.airExposure / 60)} min
                </p>
              </details>
              <details>
                <summary>Known routes ({person.knownClosed.length})</summary>
                <p>
                  {person.knownClosed.length
                    ? person.knownClosed.join(", ")
                    : "No known closures"}
                </p>
              </details>
            </>
          )}

          {selection?.kind === "cart" && state && (
            <>
              <h2>Supply cart</h2>
              <div className="status-pill">
                {state.cart.phase === "waiting"
                  ? "Blocked"
                  : state.cart.phase === "traveling"
                    ? cargoUnits(state.cart.cargo) > 0
                      ? "Loaded"
                      : "Empty return"
                    : state.cart.phase === "loading"
                      ? "Loading"
                      : "Unloading"}
              </div>
              {state.cart.phase === "waiting" && (
                <p className="command-feedback">{state.cart.reason}</p>
              )}
              <button
                className="gold-button"
                aria-label="Follow the supply cart"
                aria-pressed={
                  following && renderer.current?.followId === "cart"
                }
                onClick={() => follow("cart")}
              >
                {following && renderer.current?.followId === "cart"
                  ? "Stop following"
                  : "Follow"}
              </button>
              <div className="inspector-grid">
                <span>
                  Food<strong>{decimal(state.cart.cargo.food)}</strong>
                </span>
                <span>
                  Medicine<strong>{decimal(state.cart.cargo.medicine)}</strong>
                </span>
                {(["water", "parts", "waste"] as const)
                  .filter((item) => state.cart.cargo[item] > 0)
                  .map((item) => (
                    <span key={item}>
                      {item}
                      <strong>{decimal(state.cart.cargo[item])}</strong>
                    </span>
                  ))}
                <span>
                  Delivered<strong>{decimal(state.cart.delivered)}</strong>
                </span>
                <span>
                  To
                  <strong className="small-value">
                    {
                      scenario?.rooms.find((r) => r.id === state.cart.targetId)
                        ?.name
                    }
                  </strong>
                </span>
              </div>
              {(state.cart.phase === "loading" ||
                state.cart.phase === "unloading") && (
                <p className="compact-reading">
                  {state.cart.until > state.tick
                    ? "Transfer in " + (state.cart.until - state.tick) + "s"
                    : "Transfer pending"}
                </p>
              )}
            </>
          )}

          {link && state && scenario && (
            <>
              <span className="location-meta">{link.kind}</span>
              <h2>
                {link.kind === "sump"
                  ? "Lower crossing"
                  : link.kind === "lift"
                    ? "Lift"
                    : "Connection"}
              </h2>
              <p>
                {scenario.rooms.find((r) => r.id === link.a)?.name} ↔{" "}
                {scenario.rooms.find((r) => r.id === link.b)?.name}
              </p>
              <div className="status-pill">
                {blocked(link, state) || "Open"}
              </div>
              <p className="compact-reading">
                {link.seconds}s · Capacity {link.capacity}
                {link.permit ? " · Permit required" : ""}
              </p>
              {link.kind === "lift" && (
                <p>
                  {state.people.filter((p) => p.edgeId === link.id).length}/
                  {link.capacity} crossing
                </p>
              )}
              {link.kind === "sump" && (
                <>
                  <div className="big-value">
                    {(
                      state.waterL /
                      (scenario.settings.tunnelAreaM2 * 1000)
                    ).toFixed(2)}{" "}
                    <small>m</small>
                  </div>
                  <p>
                    Closes {scenario.settings.closeDepthM} m · In{" "}
                    {scenario.settings.seepLps} L/s · Pump{" "}
                    {scenario.settings.pumpLps} L/s
                  </p>
                </>
              )}
              {linkDependents.length > 0 && (
                <details>
                  <summary>Households ({linkDependents.length})</summary>
                  {linkDependents.map((h) => (
                    <div className="deficit" key={h.id}>
                      <strong>{h.name}</strong>
                      <span>{h.members.length} people</span>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
        </aside>
      )}
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
    </main>
  );
}
function ControllerReport({
  status,
  report,
  tick,
  startHour,
}: {
  status: string;
  report: Report | undefined;
  tick: number;
  startHour: number;
}) {
  return (
    <div
      className="report"
      aria-label={"Controller report: " + status.toLowerCase()}
    >
      {report ? (
        <>
          <p>
            {clock(report.sampledAtTick, startHour)}:
            {String(report.sampledAtTick % 60).padStart(2, "0")} ·{" "}
            {tick - report.sampledAtTick}s old
          </p>
          <p>
            {report.waterM.toFixed(2)} m water · {report.temperature.toFixed(1)}
            °C · Air {report.air.toFixed(1)}/100 ·{" "}
            {report.powered ? "Powered" : "Unpowered"}
          </p>
        </>
      ) : (
        <p>No sample</p>
      )}
    </div>
  );
}
function ResidentPortrait({ person }: { person: PersonDef }) {
  const a = appearance(person),
    skin = cssColor(a.skin),
    hair = cssColor(a.hair),
    shirt = cssColor(a.shirt);
  return (
    <svg
      className="person-portrait"
      viewBox="0 0 80 90"
      role="img"
      aria-label={`${person.name}, ${person.role}`}
    >
      <rect width="80" height="90" rx="4" fill="#273b43" />
      <path
        d={`M${21 - a.width / 2} 90 L23 57 Q40 48 57 57 L${59 + a.width / 2} 90Z`}
        fill={shirt}
      />
      <rect x="34" y="42" width="12" height="16" fill={skin} />
      <ellipse cx="40" cy="32" rx="16" ry="21" fill={skin} />
      <path
        d="M24 33 Q19 10 38 9 Q60 8 57 27 L50 22 L28 23 L28 39Z"
        fill={hair}
      />
      {a.hairStyle === 1 && <circle cx="23" cy="26" r="7" fill={hair} />}
      {a.hairStyle === 2 && (
        <path d="M23 20 L20 52 L31 48 L28 24Z" fill={hair} />
      )}
      <circle cx="35" cy="32" r="1.6" fill="#253239" />
      <circle cx="47" cy="32" r="1.6" fill="#253239" />
      <path
        d="M39 35 L38 41 L42 41 M36 46 Q41 49 46 45"
        fill="none"
        stroke="#775b48"
        strokeWidth="1.6"
      />
      {a.technical && (
        <>
          <path d="M20 22 Q20 4 40 4 Q60 4 60 22Z" fill="#bda16b" />
          <path d="M17 22 H63" stroke="#d3b87c" strokeWidth="5" />
        </>
      )}
      {(a.grower || a.technical) && (
        <>
          <path d="M31 55 H49 L55 90 H25Z" fill={cssColor(a.apron)} />
          <path
            d="M29 55 L32 70 M51 55 L48 70"
            stroke="#c2b89a"
            strokeWidth="3"
          />
        </>
      )}
      {a.medical && (
        <>
          <path
            d="M28 54 L40 72 L51 54 M40 72 V90"
            fill="none"
            stroke="#7a9993"
            strokeWidth="2"
          />
          <path d="M25 56 L56 79" stroke="#4a777a" strokeWidth="3" />
          <rect x="46" y="72" width="18" height="15" rx="2" fill="#507c7d" />
          <path d="M55 75 V84 M51 79.5 H59" stroke="#e5e6cc" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
