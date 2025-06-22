import { initHaptic } from "./haptic.js";
import { initializeGame } from "./game.js";
import { addEventListeners } from "./events.js";
import { initializeKeyboard } from "./keyboard.js"; // Add this line
import { props } from "./config.js";
import { ui } from "./ui.js";

async function fetchSelfManifest() {
  try {
    const response = await fetch("./manifest.json"); // Assumes style.css is in the same directory as index.html
    if (response.ok) {
      let loadedManifest = await response.text();
      let version = JSON.parse(loadedManifest).version;
      props.version = version;
      ui.menuModal.querySelector("#version").innerHTML = ui.menuModal
        .querySelector("#version")
        .innerHTML.replace("{{version}}", version);
      console.log("Version fetched.");
    } else {
      console.warn("Failed to fetch manifest", response.statusText);
    }
  } catch (error) {
    console.error("Error fetching manifest: ", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHaptic();
  initializeGame();
  addEventListeners();
  initializeKeyboard();
  fetchSelfManifest();
});
