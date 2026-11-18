// The game shell: title -> missions -> briefing -> prepare -> run -> debrief. Esc goes back one screen.
// Prologue: once, before Mission 1 (remembered in progress). Epilogue: after the last mission's debrief.
// QA deep links: ?screen=missions|prologue|epilogue|briefing|prepare|run|debrief&mission=<id>; &story=0 turns the in-run story beats off;
// &t=N (run) starts at tick N; &budget=N turns any mission into an empty
// beacon-placement mission (for screenshots before the engine lane's budget missions land).
import { lazy, Suspense, useEffect, useState, type MouseEvent } from "react";
import { createEngine } from "../../echo/engine";
import type { Mission } from "../../echo/types";
import { MissionScreen } from "../MissionScreen";
import { byId, CAMPAIGN, EPILOGUE, PROLOGUE, starsFor, storyFor, type CampaignMission } from "./campaign";
import { Backdrop } from "./Backdrop";
import { Briefing, Interlude } from "./Briefing";
import { Debrief, type RunResult } from "./Debrief";
import { MissionSelect } from "./MissionSelect";
import { Prepare } from "./Prepare";
import { hasSeen, isUnlocked, loadProgress, markSeen, saveStars, type Progress } from "./progress";
import { SoundToggle } from "./SoundToggle";
import { Title } from "./Title";
import "./game.css";

const Descent = lazy(() => import("../cutaway/CutawayScreen").then(m => ({ default: m.CutawayScreen })));

type Screen = "descent" | "title" | "missions" | "prologue" | "epilogue" | "briefing" | "prepare" | "run" | "debrief";
interface State { screen: Screen; cm?: CampaignMission; base?: Mission; placed?: Mission; result?: RunResult; run: number; then?: string } // then: mission to brief after the prologue

const hasBudget = (m?: Mission) => typeof m?.beaconBudget === "number";

function build(cm: CampaignMission): Mission {
  const m = cm.build!();
  const q = new URLSearchParams(location.search);
  if (!q.has("budget")) return m;
  return { ...m, beaconBudget: Number(q.get("budget")), world: { ...m.world, sectors: m.world.sectors.map((s) => ({ ...s, beacon: false })) } };
}

/** Plays a mission to the end without drawing (the ?screen=debrief deep link). */
function runToEnd(m: Mission): RunResult {
  const [tower, echo, normal] = (["tower", "echo", "normal"] as const).map((mode) => {
    const e = createEngine(m, mode);
    e.step(m.endTick);
    return e.observe();
  });
  return { tower, echo, normal };
}

function initial(): State {
  const q = new URLSearchParams(location.search);
  const screen = q.get("screen") as Screen | null;
  if (screen === "descent") return { screen, run: 0 };
  const cm = byId(q.get("mission")) ?? CAMPAIGN[0];
  if (screen === "missions" || screen === "prologue" || screen === "epilogue") return { screen, run: 0 };
  if (!screen || screen === "title" || !cm.build) return { screen: "title", run: 0 };
  const base = build(cm);
  if (screen === "debrief") return { screen, cm, base, placed: base, result: runToEnd(base), run: 0 };
  if (screen === "prepare" && !hasBudget(base)) return { screen: "run", cm, base, placed: base, run: 0 };
  return { screen, cm, base, placed: base, run: 0 };
}

// The Strata scene sits behind every screen except the map screens (prepare, run).
const withBackdrop = (screen: Screen) => screen !== "run";

export function GameApp() {
  const [st, setSt] = useState<State>(initial);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const go = (patch: Partial<State>) => setSt((s) => ({ ...s, ...patch }));

  function openDescent(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState({fromEchoTitle: true}, "", e.currentTarget.href);
    go({screen: "descent"});
  }
  function leaveDescent() {
    if (history.state?.fromEchoTitle) {
      history.back();
      return;
    }
    const url = new URL(location.href);
    for (const key of ["screen", "beat", "mode", "clean", "autoplay"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
    go({screen: "title"});
  }
  useEffect(() => {
    function navigate() {
      const entering = new URLSearchParams(location.search).get("screen") === "descent";
      // The title can be reached from a campaign deep link without changing that URL.
      if (entering || st.screen === "descent") setSt(s => ({ ...s, screen: entering ? "descent" : "title" }));
    }
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, [st.screen]);

  const ids = CAMPAIGN.map((m) => m.id);
  const pick = (id: string, prologue = true) => {
    if (prologue && id === ids[0] && PROLOGUE.length && !hasSeen(progress, "prologue")) return go({ screen: "prologue", then: id });
    const cm = byId(id)!;
    const base = build(cm);
    go({ screen: "briefing", cm, base, placed: base, result: undefined });
  };
  const nextPlayable = (p: Progress) => CAMPAIGN.find((m, i) => m.build && isUnlocked(ids, i, p) && !p[m.id]);
  const afterBriefing = () => (hasBudget(st.base) ? go({ screen: "prepare" }) : go({ screen: "run", placed: st.base, run: st.run + 1 }));
  const back = (): Screen | null => {
    switch (st.screen) {
      case "missions": return "title";
      case "prologue": return st.then ? "title" : "missions";
      case "epilogue": return "missions";
      case "briefing": return "missions";
      case "prepare": return "briefing";
      case "run": return hasBudget(st.base) ? "prepare" : "briefing";
      case "debrief": return "missions";
      default: return null;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (st.screen === "descent") { leaveDescent(); return; }
      const to = back();
      if (to) go({ screen: to });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  if (st.screen === "descent") return (
    <Suspense fallback={<p role="status">Loading the cutaway…</p>}>
      <Descent onExit={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        leaveDescent();
      }} />
    </Suspense>
  );
  return <>{withBackdrop(st.screen) && <Backdrop deep={st.screen === "prepare"} />}{screenFor()}<SoundToggle /></>;

  function screenFor() {
  const { cm } = st;
  switch (st.screen) {
    case "title":
      return <Title onDescent={openDescent} onBegin={() => { const m = nextPlayable(progress); m ? pick(m.id) : go({ screen: "missions" }); }} onMissions={() => go({ screen: "missions" })} />;
    case "missions":
      return <MissionSelect progress={progress} onPick={pick} onBack={() => go({ screen: "title" })} onStory={(s) => go({ screen: s, then: undefined })} />;
    case "prologue":
      return (
        <Interlude kicker="Echo" title="Prologue" paras={PROLOGUE} onDone={() => {
          setProgress(markSeen("prologue"));
          if (st.then) pick(st.then, false); else go({ screen: "missions" });
        }} />
      );
    case "epilogue":
      return <Interlude kicker="Echo" title="Epilogue" paras={EPILOGUE} onDone={() => { setProgress(markSeen("epilogue")); go({ screen: "missions" }); }} />;
    case "briefing":
      return <Briefing cm={cm!} best={progress[cm!.id] ?? 0} hasBudget={hasBudget(st.base)} onNext={afterBriefing} onBack={() => go({ screen: "missions" })} />;
    case "prepare":
      return <Prepare cm={cm!} mission={st.placed ?? st.base!} onBack={() => go({ screen: "briefing" })} onBegin={(m) => go({ screen: "run", placed: m, run: st.run + 1 })} />;
    case "run":
      return (
        <div className="g-run">
          <MissionScreen
            key={st.run}
            mission={st.placed ?? st.base!}
            allowDispatch={cm!.allowDispatch}
            speed={cm!.defaultSpeed}
            story={new URLSearchParams(location.search).get("story") === "0" ? undefined : storyFor(cm!)}
            onExit={() => go({ screen: back()! })}
            onEnd={(tower, echo, normal) => {
              setProgress(saveStars(cm!.id, starsFor(cm!, echo, normal)));
              go({ screen: "debrief", result: { tower, echo, normal } });
            }}
          />
        </div>
      );
    case "debrief": {
      const i = CAMPAIGN.indexOf(cm!);
      const next = CAMPAIGN[i + 1];
      const canNext = next && next.build && isUnlocked(ids, i + 1, progress);
      const finale = !next && EPILOGUE.length > 0 && (progress[cm!.id] ?? 0) >= 1; // the last mission, won
      return (
        <Debrief
          cm={cm!} result={st.result!}
          onMissions={() => go({ screen: "missions" })}
          onRetry={() => (hasBudget(st.base) ? go({ screen: "prepare" }) : go({ screen: "run", run: st.run + 1 }))}
          onNext={canNext ? () => pick(next.id) : finale ? () => go({ screen: "epilogue" }) : undefined}
          nextLabel={finale ? "Epilogue" : undefined}
        />
      );
    }
  }
  }
}
