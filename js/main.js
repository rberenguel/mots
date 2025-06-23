import { initHaptic } from "./haptic.js";
import { forceApplyPowerup, initializeGame, setLanguage } from "./game.js";
import { addEventListeners } from "./events.js";
import { initializeKeyboard } from "./keyboard.js"; // Add this line
import { props } from "./config.js";
import { ui } from "./ui.js";
import { get } from "../lib/idb-keyval.js";

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

document.addEventListener("DOMContentLoaded", async () => {
  initHaptic();
  const savedLang = await get("language");
  if (savedLang) {
    await setLanguage(savedLang);
  }

  // Set the radio button to reflect the current language
  const langSelector = document.querySelector(
    `input[name="language"][value="${savedLang || "en"}"]`,
  );
  if (langSelector) {
    langSelector.checked = true;
  }
  initializeGame();
  addEventListeners();
  initializeKeyboard();
  fetchSelfManifest();
  window.forcePowerup = forceApplyPowerup;
});
