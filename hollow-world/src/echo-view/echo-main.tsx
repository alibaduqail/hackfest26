import { createRoot } from "react-dom/client";
import { installTheme } from "./theme";
import { MissionScreen } from "./MissionScreen";

installTheme();
createRoot(document.getElementById("root")!).render(<MissionScreen />);
