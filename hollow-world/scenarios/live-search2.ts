// Calibration of the Descent II flood candidates (npx tsx scenarios/live-search2.ts). Not used by tests or the game.
import { DESCENT_LIVE_CANDIDATES_2 as C, descentLive2, descentLiveCandidateIndex2 } from "../src/echo/descent2";
import { search } from "./live-search-lib";

search("Descent II", C, (a) => descentLive2(a), descentLiveCandidateIndex2);
