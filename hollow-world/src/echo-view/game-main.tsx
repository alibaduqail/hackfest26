import { createRoot } from "react-dom/client";
import { installGlowCursor } from "./relay/cursor";
import { installTheme } from "./theme";
import { GameApp } from "./game/GameApp";

installTheme();
installGlowCursor();
createRoot(document.getElementById("root")!).render(<GameApp />);
