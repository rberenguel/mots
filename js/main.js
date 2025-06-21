import { initHaptic } from "./haptic.js";
import { initializeGame } from "./game.js";
import { addEventListeners } from "./events.js";

document.addEventListener("DOMContentLoaded", () => {
  initHaptic();
  initializeGame();
  addEventListeners();
});
