import { createRoot } from "react-dom/client";
import { installGlowCursor } from "../relay/cursor";
import { installTheme } from "../theme";
import { CutawayScreen } from "./CutawayScreen";

installTheme();
installGlowCursor();
createRoot(document.getElementById("root")!).render(<CutawayScreen />);
