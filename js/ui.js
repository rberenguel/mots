import { ANSWER_SLOTS, bonusSlots } from "./config.js";
import { triggerHaptic } from "./haptic.js";

export const ui = {
  letterGrid: document.getElementById("letter-grid"),
  answerArea: document.getElementById("answer-area"),
  shuffleButton: document.getElementById("shuffle-button"),
  redrawButton: document.getElementById("redraw-button"),
  redrawBadge: document.getElementById("redraw-badge"),
  submitWordButton: document.getElementById("submit-word-button"),
  helpButton: document.getElementById("help-button"),
  roundScoreDisplay: document.getElementById("round-score-display"),
  roundDisplay: document.getElementById("round-display"),
  playsDisplay: document.getElementById("plays-display"),
  playsCounter: document.getElementById("plays-counter"),
  targetScoreDisplay: document.getElementById("target-score-display"),
  powerupModal: document.getElementById("powerup-modal"),
  powerupOptions: document.getElementById("powerup-options"),
  gameOverModal: document.getElementById("game-over-modal"),
  finalRound: document.getElementById("final-round"),
  finalScore: document.getElementById("final-score"),
  restartButton: document.getElementById("restart-button"),
  helpModal: document.getElementById("help-modal"),
  closeHelpButton: document.getElementById("close-help-button"),
  bagTotalDisplay: document.getElementById("bag-total-display"),
  bagBlackDisplay: document.getElementById("bag-black-display"),
  bagWildcardDisplay: document.getElementById("bag-wildcard-display"),
  bagBoostedDisplay: document.getElementById("bag-boosted-display"),
  bagNerfedDisplay: document.getElementById("bag-nerfed-display"),
};

export function updateBagStatsDisplay(stats) {
  ui.bagTotalDisplay.textContent = stats.total;
  ui.bagBlackDisplay.textContent = stats.black;
  ui.bagWildcardDisplay.textContent = stats.wildcard;
  ui.bagBoostedDisplay.textContent = stats.boosted;
  ui.bagNerfedDisplay.textContent = stats.nerfed;
}

export function createGridSlots(size) {
  for (let i = 0; i < size; i++)
    ui.letterGrid
      .appendChild(document.createElement("div"))
      .classList.add("grid-slot");
}

export function createAnswerSlots() {
  for (let i = 0; i < ANSWER_SLOTS; i++) {
    const s = document.createElement("div");
    s.className = "answer-slot";
    s.dataset.index = i;
    if (bonusSlots[i])
      s.innerHTML = `<div class="bonus-text">+${bonusSlots[i]}</div>`;
    ui.answerArea.appendChild(s);
  }
}

export function updateMultiplierDisplay(multiplier) {
  document.querySelectorAll(".multiplier-text").forEach((el) => el.remove());

  if (multiplier) {
    const slotIndex = multiplier.position - 1; // Convert to 0-based index
    const targetSlot = ui.answerArea.querySelector(
      `.answer-slot[data-index='${slotIndex}']`,
    );
    if (targetSlot) {
      const multiplierEl = document.createElement("div");
      multiplierEl.className = "multiplier-text";
      multiplierEl.textContent = `x${multiplier.multiplier}`;
      targetSlot.appendChild(multiplierEl);
    }
  }
}

// Replace the existing createLetterTile function
export function createLetterTile(letterObj, nextId) {
  const tile = document.createElement("div");
  tile.className = "letter-tile letter-tile-bounce";
  tile.id = "tile-" + nextId;

  if (letterObj.isBlackTile) {
    tile.classList.add("black-tile");
    tile.draggable = false;
  } else {
    tile.dataset.letter = letterObj.letter;
    tile.dataset.points = letterObj.points;
    tile.draggable = true;

    let pointsClasses = "letter-points";
    if (letterObj.isBoosted) pointsClasses += " boosted";
    if (letterObj.isNerfed) pointsClasses += " nerfed";

    const pointsHTML = `<span class="${pointsClasses}">${letterObj.points}</span>`;

    tile.innerHTML =
      letterObj.letter === "*"
        ? `<i class="iconoir-star-solid text-2xl" style="color: var(--yellow)"></i>`
        : `<span>${letterObj.letter}</span>${pointsHTML}`;
  }

  tile.addEventListener("animationend", () =>
    tile.classList.remove("letter-tile-bounce"),
  );
  return tile;
}

export function updateRedrawBadge(count) {
  ui.redrawBadge.textContent = count;
  ui.redrawButton.disabled = count <= 0;
  ui.redrawBadge.style.display = count > 0 ? "flex" : "none";
}

export function updatePlaysDisplay(count) {
  ui.playsDisplay.textContent = count;
  ui.playsCounter.classList.toggle("is-low", count <= 3);
}

export function flashTiles(tiles, type) {
  const isExitAnimation = type === "green";
  const className = isExitAnimation ? "flash-green" : "shake-and-flash-red";

  tiles.forEach((t) => {
    t.classList.add(className);

    if (!isExitAnimation) {
      t.addEventListener(
        "animationend",
        () => {
          t.classList.remove(className);
        },
        { once: true },
      );
    }
  });
}

export function presentPowerupChoice(powerupList, onChoose) {
  let options = [...powerupList].sort(() => 0.5 - Math.random()).slice(0, 2);
  ui.powerupOptions.innerHTML = "";
  options.forEach((opt) => {
    const div = document.createElement("div");
    div.className = "powerup-choice";
    div.textContent = opt.text;
    div.onclick = () => {
      onChoose(opt);
      ui.powerupModal.classList.remove("visible");
    };
    ui.powerupOptions.appendChild(div);
  });
  ui.powerupModal.classList.add("visible");
}

export function showGameOverModal(isWin, round, score) {
  ui.gameOverModal.classList.add("visible");
  ui.finalRound.textContent = round;
  ui.finalScore.textContent = score;
  if (isWin) ui.gameOverModal.querySelector("h2").textContent = "You Win!";
}

export function shuffleGridAnimation() {
  triggerHaptic();
  const tilesInGrid = Array.from(
    ui.letterGrid.querySelectorAll(".letter-tile:not(.is-ghost)"),
  );
  if (tilesInGrid.length < 2) return;

  const startingPositions = new Map();
  tilesInGrid.forEach((tile) =>
    startingPositions.set(tile, tile.getBoundingClientRect()),
  );

  const slotsWithTiles = tilesInGrid.map((t) => t.parentElement);
  for (let i = tilesInGrid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tilesInGrid[i], tilesInGrid[j]] = [tilesInGrid[j], tilesInGrid[i]];
  }

  slotsWithTiles.forEach((slot, index) => slot.appendChild(tilesInGrid[index]));

  tilesInGrid.forEach((tile) => {
    const newPos = tile.getBoundingClientRect();
    const oldPos = startingPositions.get(tile);
    const deltaX = oldPos.left - newPos.left;
    const deltaY = oldPos.top - newPos.top;

    tile.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    tile.style.transition = "transform 0s";
  });

  requestAnimationFrame(() => {
    tilesInGrid.forEach((tile) => {
      tile.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
      tile.style.transform = "";
    });
  });

  tilesInGrid.forEach((tile) => {
    tile.addEventListener(
      "transitionend",
      () => {
        tile.style.transition = "";
      },
      { once: true },
    );
  });
}
