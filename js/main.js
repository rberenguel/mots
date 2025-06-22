import { initHaptic } from "./haptic.js";
import { initializeGame } from "./game.js";
import { addEventListeners } from "./events.js";
import { initializeKeyboard } from "./keyboard.js"; // Add this line

document.addEventListener("DOMContentLoaded", () => {
  initHaptic();
  initializeGame();
  addEventListeners();
  initializeKeyboard();
});
