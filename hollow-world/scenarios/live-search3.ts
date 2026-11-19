// Calibration of the Descent III flood candidates (npx tsx scenarios/live-search3.ts). Not used by tests or the game.
import { DESCENT_LIVE_CANDIDATES_3 as C, descentLive3, descentLiveCandidateIndex3 } from "../src/echo/descent3";
import { search } from "./live-search-lib";

search("Descent III", C, (a) => descentLive3(a), descentLiveCandidateIndex3);
