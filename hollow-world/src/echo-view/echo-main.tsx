import { createRoot } from "react-dom/client";
import { installGlowCursor } from "./relay/cursor";
import { installTheme } from "./theme";
import { MissionScreen } from "./MissionScreen";

installTheme();
installGlowCursor();
createRoot(document.getElementById("root")!).render(<MissionScreen />);
