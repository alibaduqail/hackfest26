import { createRoot } from "react-dom/client";
import { installTheme } from "./theme";
import { GameApp } from "./game/GameApp";

installTheme();
createRoot(document.getElementById("root")!).render(<GameApp />);
