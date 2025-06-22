import { ui, shuffleGridAnimation, showMenuModal } from "./ui.js";
import {
  startGame,
  handleRedraw,
  handleSubmitWord,
  checkAnswerLength,
} from "./game.js";
import { triggerHaptic } from "./haptic.js";

let draggedTile = null;
let touchDragTile = null;
let touchStartPos = { x: 0, y: 0 };
let isDragging = false;
const DRAG_THRESHOLD = 5; // Minimum distance in pixels to trigger a drag

export function addEventListeners() {
  ui.restartButton.addEventListener("click", startGame);
  ui.shuffleButton.addEventListener("click", shuffleGridAnimation);
  ui.redrawButton.addEventListener("click", handleRedraw);
  ui.submitWordButton.addEventListener("click", handleSubmitWord);
  addHelpModalListeners();
  addMenuModalListeners();
  addTileInteractionListeners();
}

function addHelpModalListeners() {
  ui.helpButton.addEventListener("click", () =>
    ui.helpModal.classList.add("visible"),
  );
  ui.closeHelpButton.addEventListener("click", () => {
    triggerHaptic();
    ui.helpModal.classList.remove("visible");
  });
  ui.helpModal.addEventListener("click", (e) => {
    if (e.target === ui.helpModal) {
      triggerHaptic();
      ui.helpModal.classList.remove("visible");
    }
  });
}

function addMenuModalListeners() {
  ui.menuButton.addEventListener("click", () => {
    triggerHaptic();
    showMenuModal();
  });
  ui.menuCloseButton.addEventListener("click", () => {
    triggerHaptic();
    ui.menuModal.classList.remove("visible");
  });
  ui.menuModal.addEventListener("click", (e) => {
    if (e.target === ui.menuModal) {
      triggerHaptic();
      ui.menuModal.classList.remove("visible");
    }
  });
  ui.menuRestartButton.addEventListener("click", () => {
    triggerHaptic();
    ui.menuModal.classList.remove("visible");
    startGame();
  });
}

function addTileInteractionListeners() {
  // Click/Tap to move
  ui.letterGrid.addEventListener("click", handleGridClick);
  ui.answerArea.addEventListener("click", handleAnswerAreaClick);

  // Mouse Drag and Drop
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragend", handleDragEnd);
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", handleDrop);

  // Touch Drag and Drop
  document.addEventListener("touchstart", handleTouchStart, { passive: false });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd);
}

function handleGridClick(e) {
  const clickedTile = e.target.closest(".letter-tile");
  if (!clickedTile || clickedTile.classList.contains("black-tile")) return;
  triggerHaptic();
  if (clickedTile.classList.contains("is-ghost")) {
    const originId = clickedTile.id;
    const tileInAnswer = ui.answerArea.querySelector(
      `[data-origin-id="${originId}"]`,
    );

    if (tileInAnswer) {
      tileInAnswer.remove();
      clickedTile.classList.remove("is-ghost");
      checkAnswerLength();
    }
  } else {
    const emptySlot = Array.from(ui.answerArea.children).find(
      (s) => !s.querySelector(".letter-tile"),
    );

    if (emptySlot) {
      placeTileInAnswer(clickedTile, emptySlot);
    }
  }
}

function handleAnswerAreaClick(e) {
  triggerHaptic();
  const tile = e.target.closest(".letter-tile");
  if (tile && tile.parentElement.classList.contains("answer-slot")) {
    const originTile = document.getElementById(tile.dataset.originId);
    if (originTile) originTile.classList.remove("is-ghost");
    tile.remove();
    checkAnswerLength();
  }
}

// --- Mouse D&D Handlers ---
function handleDragStart(e) {
  const tile = e.target.closest(".letter-tile");
  if (tile && !tile.classList.contains("is-ghost")) {
    draggedTile = tile;
    setTimeout(() => {
      tile.style.visibility = "hidden";
    }, 0);
  } else {
    e.preventDefault();
  }
}

function handleDragEnd() {
  if (draggedTile) {
    draggedTile.style.visibility = "visible";
    draggedTile = null;
  }
}

function handleDrop(e) {
  e.preventDefault();
  if (!draggedTile) return;
  const answerSlot = e.target.closest(".answer-slot");
  if (answerSlot) {
    placeTileInAnswer(draggedTile, answerSlot);
  }
}

function handleTouchStart(e) {
  const tile = e.target.closest(".letter-tile:not(.is-ghost)");
  if (
    tile &&
    !tile.classList.contains("black-tile") &&
    ui.letterGrid.contains(tile)
  ) {
    draggedTile = tile;
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    isDragging = false;
  }
}

function handleTouchMove(e) {
  if (!draggedTile) return;

  const touch = e.touches[0];
  const dx = touch.clientX - touchStartPos.x;
  const dy = touch.clientY - touchStartPos.y;

  // Only start dragging if the finger has moved beyond a certain threshold
  if (
    !isDragging &&
    (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
  ) {
    isDragging = true;
    e.preventDefault(); // Prevent page scrolling
    triggerHaptic();

    // Get the exact size of the tile before we mess with it
    const rect = draggedTile.getBoundingClientRect();

    // Clone the tile to create a draggable copy
    touchDragTile = draggedTile.cloneNode(true);
    touchDragTile.classList.add("is-touch-dragging");

    // Set the clone's size explicitly so it doesn't expand to fill the body
    touchDragTile.style.width = `${rect.width}px`;
    touchDragTile.style.height = `${rect.height}px`;

    document.body.appendChild(touchDragTile);

    // Position the clone under the finger
    moveElement(
      touch.clientX + rect.width / 2,
      touch.clientY + rect.height / 2,
    );

    // Make the original tile in the grid a "ghost"
    draggedTile.style.opacity = "0.3";
  }

  if (isDragging) {
    e.preventDefault();
    moveElement(touch.clientX, touch.clientY);
  }
}

function handleTouchEnd(e) {
  if (draggedTile && isDragging) {
    if (touchDragTile) {
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(
        touch.clientX,
        touch.clientY,
      );
      const answerSlot = dropTarget ? dropTarget.closest(".answer-slot") : null;

      if (answerSlot) {
        // placeTileInAnswer now correctly handles making the original tile a ghost
        placeTileInAnswer(draggedTile, answerSlot);
      } else {
        // If not dropped on a valid slot, restore the original tile's appearance
        draggedTile.style.opacity = "1";
      }

      document.body.removeChild(touchDragTile);
    }
  } else if (draggedTile) {
    // This handles the case of a tap without a drag
    draggedTile.style.opacity = "1";
  }

  // Reset all state variables
  draggedTile = null;
  touchDragTile = null;
  isDragging = false;
}

function placeTileInAnswer(tile, answerSlot) {
  const existingTile = answerSlot.querySelector(".letter-tile");
  if (existingTile) {
    const originTile = document.getElementById(existingTile.dataset.originId);
    if (originTile) {
      originTile.classList.remove("is-ghost");
      // Ensure opacity is reset when a tile is returned to the grid
      originTile.style.opacity = "1";
    }
    existingTile.remove();
  }

  // The original tile in the grid becomes a permanent ghost for this turn
  tile.classList.add("is-ghost");
  // Let the .is-ghost class handle the opacity, remove inline style
  tile.style.opacity = "";

  const newTile = tile.cloneNode(true);
  newTile.classList.remove(
    "is-ghost",
    "letter-tile-bounce",
    "is-touch-dragging",
  );
  newTile.style.visibility = "visible";
  newTile.style.opacity = "1";
  newTile.dataset.originId = tile.id;
  newTile.draggable = false;
  answerSlot.appendChild(newTile);
  checkAnswerLength();
}

function moveElement(x, y) {
  if (!touchDragTile) return;
  // Center the tile on the touch point
  touchDragTile.style.left = `${x - touchDragTile.offsetWidth / 2}px`;
  touchDragTile.style.top = `${y - touchDragTile.offsetHeight / 2}px`;
}
