import { createRoot } from "react-dom/client";
import { installTheme } from "../theme";
import { CutawayScreen } from "./CutawayScreen";

installTheme();
createRoot(document.getElementById("root")!).render(<CutawayScreen />);
