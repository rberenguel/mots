import { ui, shuffleGridAnimation } from "./ui.js";
import {
  checkAnswerLength,
  handleSubmitWord,
  handleRedraw,
  getGameStats,
} from "./game.js";

const pendingAnimations = new Map();

/**
 * Initializes keyboard event listeners for the game.
 */
export function initializeKeyboard() {
  document.addEventListener("keydown", handleKeyDown);
}

/**
 * Main handler for all keydown events.
 * @param {KeyboardEvent} e The keyboard event.
 */
function handleKeyDown(e) {
  if (document.querySelector(".modal-overlay.visible")) {
    return;
  }

  // Redraw shortcut (Ctrl+R or Cmd+R)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (!ui.redrawButton.disabled) {
      handleRedraw();
    }
    return;
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    handleBackspace();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (!ui.submitWordButton.disabled) {
      const sent = handleSubmitWord();
      if (sent) {
        let missedText = "";
        const stats = getGameStats();
        if (stats.lastMissedLongestWord.word)
          missedText += stats.lastMissedLongestWord.word
            ? `<p><span class="missed">missed:</span> <span class="missed-word">${stats.lastMissedLongestWord.word.toUpperCase()} (${
                stats.lastMissedLongestWord.length
              })</span></p>`
            : "";
        if (stats.lastMissedHighestScoreWord.word)
          missedText += stats.lastMissedHighestScoreWord.word
            ? `<p><p><span class="missed">missed:</span>  <span class="missed-word">${stats.lastMissedHighestScoreWord.word.toUpperCase()} (${
                stats.lastMissedHighestScoreWord.score
              } pts)</span></p>`
            : "";
        ui.missedText.innerHTML = missedText;
        setTimeout(() => {
          ui.missedText.style.opacity = "1";
        }, 2);

        // Set the fade-out to begin after the text has been visible for a bit
        setTimeout(() => {
          ui.missedText.style.opacity = 0;
        }, 5000);
      }
    }
  } else if (e.key === "Tab") {
    e.preventDefault();
    shuffleGridAnimation();
  } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
    e.preventDefault();
    handleLetterPress(e.key.toUpperCase());
  }
}

/**
 * Handles the Backspace key, removing the last logical tile.
 */
function handleBackspace() {
  const answerSlots = Array.from(ui.answerArea.children);
  let lastTileIndex = -1;

  // Find the last slot that has a tile OR is pending one.
  for (let i = answerSlots.length - 1; i >= 0; i--) {
    if (
      answerSlots[i].querySelector(".letter-tile") ||
      answerSlots[i].classList.contains("pending-tile")
    ) {
      lastTileIndex = i;
      break;
    }
  }

  if (lastTileIndex === -1) return;

  const slotToRemoveFrom = answerSlots[lastTileIndex];
  const tileInSlot = slotToRemoveFrom.querySelector(".letter-tile");

  if (slotToRemoveFrom.classList.contains("pending-tile")) {
    // A tile is animating TO this slot. Cancel it gracefully.
    const animatedTile = pendingAnimations.get(slotToRemoveFrom);
    if (animatedTile) {
      // Un-ghost the original tile on the grid immediately.
      const originTile = document.getElementById(animatedTile.dataset.originId);
      if (originTile) {
        originTile.classList.remove("is-ghost");
      }

      // Hide the animating tile and signal cancellation by removing it
      // from the tracking map. The existing 'transitionend' event listener
      // on the tile will handle the final DOM removal.
      animatedTile.style.display = "none";
      pendingAnimations.delete(slotToRemoveFrom);
    }
    slotToRemoveFrom.classList.remove("pending-tile");
    checkAnswerLength();
  } else if (tileInSlot) {
    // A tile is already in this slot. Animate it back to the grid.
    const originTile = document.getElementById(tileInSlot.dataset.originId);
    if (originTile) {
      animateTileReturn(tileInSlot, originTile, () => {
        originTile.classList.remove("is-ghost");
        checkAnswerLength();
      });
    }
  }
}
/**
 * Handles a letter key press, starting an animation or shaking the grid.
 * @param {string} letter The uppercase letter that was pressed.
 */
function handleLetterPress(letter) {
  const answerSlots = Array.from(ui.answerArea.children);
  // Only find target slots that are not blocked
  const targetSlot = answerSlots.find(
    (s) =>
      !s.querySelector(".letter-tile") &&
      !s.classList.contains("pending-tile") &&
      !s.classList.contains("is-blocked"), // New condition
  );

  const sourceTile = findAvailableTile(letter);

  if (!sourceTile) {
    if (!ui.letterGrid.classList.contains("shake-grid")) {
      ui.letterGrid.classList.add("shake-grid");
      ui.letterGrid.addEventListener(
        "animationend",
        () => ui.letterGrid.classList.remove("shake-grid"),
        { once: true },
      );
    }
    return;
  }

  if (!targetSlot) return; // No available non-blocked slot

  targetSlot.classList.add("pending-tile");
  sourceTile.classList.add("is-ghost");

  animateTileMovement(sourceTile, targetSlot, () => {
    const newTile = sourceTile.cloneNode(true);
    newTile.classList.remove("is-ghost", "letter-tile-bounce");

    // **DEFENSIVE FIX**: Explicitly clear any inline size styles to prevent
    // rendering bugs during rapid keyboard input.
    newTile.style.width = "";
    newTile.style.height = "";

    newTile.style.visibility = "visible";
    newTile.dataset.originId = sourceTile.id;
    newTile.draggable = false;
    targetSlot.appendChild(newTile);
    targetSlot.classList.remove("pending-tile");
    checkAnswerLength();
  });
}

/**
 * Finds the first available (non-ghost) tile in the grid for a given letter.
 * @param {string} letter The letter to find.
 * @returns {HTMLElement|undefined}
 */
function findAvailableTile(letter) {
  return Array.from(ui.letterGrid.querySelectorAll(".letter-tile")).find(
    (t) => !t.classList.contains("is-ghost") && t.dataset.letter === letter,
  );
}

/**
 * Animates a tile, tracking it to allow for cancellation.
 * @param {HTMLElement} sourceTile The starting tile.
 * @param {HTMLElement} targetSlot The destination slot.
 * @param {Function} callback Function to run on successful completion.
 */
function animateTileMovement(sourceTile, targetSlot, callback) {
  const sourceRect = sourceTile.getBoundingClientRect();
  const targetRect = targetSlot.getBoundingClientRect();
  const animatedTile = sourceTile.cloneNode(true);

  animatedTile.dataset.originId = sourceTile.id; // Keep track of original tile
  animatedTile.classList.remove("is-ghost");
  animatedTile.classList.add("is-keyboard-moving");
  animatedTile.style.position = "fixed";
  animatedTile.style.left = `${sourceRect.left}px`;
  animatedTile.style.top = `${sourceRect.top}px`;
  animatedTile.style.width = `${sourceRect.width}px`;
  animatedTile.style.height = `${sourceRect.height}px`;
  animatedTile.style.transition = "transform 0.25s ease-in-out";

  document.body.appendChild(animatedTile);
  pendingAnimations.set(targetSlot, animatedTile);
  animatedTile.offsetHeight;
  requestAnimationFrame(() => {
    animatedTile.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
  });

  animatedTile.addEventListener(
    "transitionend",
    () => {
      if (pendingAnimations.get(targetSlot) === animatedTile) {
        pendingAnimations.delete(targetSlot);
        callback();
      }
      animatedTile.remove();
    },
    { once: true },
  );
}

/**
 * Animates a tile from the answer area back to the grid.
 * @param {HTMLElement} sourceTile The tile in the answer area.
 * @param {HTMLElement} targetTile The destination tile in the grid.
 * @param {Function} callback Function to run after animation.
 */
function animateTileReturn(sourceTile, targetTile, callback) {
  const sourceRect = sourceTile.getBoundingClientRect();
  const targetRect = targetTile.getBoundingClientRect();
  const animatedTile = sourceTile.cloneNode(true);

  animatedTile.classList.add("is-keyboard-moving");
  animatedTile.style.position = "fixed";
  animatedTile.style.left = `${sourceRect.left}px`;
  animatedTile.style.top = `${sourceRect.top}px`;
  animatedTile.style.width = `${sourceRect.width}px`;
  animatedTile.style.height = `${sourceRect.height}px`;
  animatedTile.style.transition = "transform 0.25s ease-in-out";

  sourceTile.remove();
  document.body.appendChild(animatedTile);
  animatedTile.offsetHeight; // Also requires a reflow!
  requestAnimationFrame(() => {
    animatedTile.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
  });

  animatedTile.addEventListener(
    "transitionend",
    () => {
      animatedTile.remove();
      callback();
    },
    { once: true },
  );
}
