import { ui, shuffleGridAnimation, showMenuModal } from "./ui.js";
import {
  startGame,
  handleRedraw,
  handleSubmitWord,
  checkAnswerLength,
} from "./game.js";
import * as cfg from "./config.js";
import { triggerHaptic } from "./haptic.js";

let draggedTile = null;
let touchDragTile = null;
let touchStartPos = { x: 0, y: 0 };
let isDragging = false;
const DRAG_THRESHOLD = 5; // Minimum distance in pixels to trigger a drag

export function addEventListeners() {
  ui.restartButton.addEventListener("click", () => {
    triggerHaptic();
    startGame();
  });
  ui.shuffleButton.addEventListener("click", () => {
    triggerHaptic();
    shuffleGridAnimation();
  });
  ui.redrawButton.addEventListener("click", () => {
    triggerHaptic();
    handleRedraw();
  });
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

  // Return tile to grid by clicking the ghost
  if (clickedTile.classList.contains("is-ghost")) {
    const originId = clickedTile.id;
    const tileInAnswer = ui.answerArea.querySelector(
      `[data-origin-id="${originId}"]`,
    );
    if (tileInAnswer) {
      animateTileReturn(tileInAnswer);
    }
    return;
  }

  // Move tile to answer area
  const emptySlot = Array.from(ui.answerArea.children).find(
    (s) =>
      !s.querySelector(".letter-tile") && !s.classList.contains("is-blocked"),
  );

  if (emptySlot) {
    const rect = clickedTile.getBoundingClientRect();
    const animatedClone = clickedTile.cloneNode(true);
    animatedClone.classList.add("is-animated-clone");
    document.body.appendChild(animatedClone);

    animatedClone.style.left = `${rect.left}px`;
    animatedClone.style.top = `${rect.top}px`;
    animatedClone.style.width = `${rect.width}px`;
    animatedClone.style.height = `${rect.height}px`;

    setTimeout(() => {
      const targetRect = emptySlot.getBoundingClientRect();
      animatedClone.style.left = `${targetRect.left}px`;
      animatedClone.style.top = `${targetRect.top}px`;
    }, 10);

    setTimeout(() => {
      placeTileInAnswer(clickedTile, emptySlot);
      animatedClone.remove();
    }, 210);
  }
}

function handleAnswerAreaClick(e) {
  const target = e.target;
  const tile = target.closest(".letter-tile");
  const slot = target.closest(".answer-slot");

  // Case 1: A tile was clicked -> return it to the grid with animation
  if (tile && tile.parentElement.classList.contains("answer-slot")) {
    triggerHaptic();
    animateTileReturn(tile);
    return;
  }

  // Case 2: An empty slot was clicked
  if (slot && !slot.querySelector(".letter-tile")) {
    const slotIndex = parseInt(slot.dataset.index, 10);
    const isLastSlot = slotIndex === cfg.ANSWER_SLOTS - 1;

    // Feature: Return all tiles if the last empty slot is clicked
    if (isLastSlot) {
      const allAnswerTiles = ui.answerArea.querySelectorAll(".letter-tile");
      if (allAnswerTiles.length > 0) {
        triggerHaptic();
        allAnswerTiles.forEach((t) => animateTileReturn(t));
      }
      return;
    }

    // Feature: Compact tiles to the left (with animation)
    const allSlots = Array.from(ui.answerArea.children);
    const moves = [];
    let nextEmptySlotIndex = slotIndex;

    for (let i = slotIndex + 1; i < allSlots.length; i++) {
      const tileToMove = allSlots[i].querySelector(".letter-tile");
      if (tileToMove) {
        moves.push({
          tile: tileToMove,
          targetSlot: allSlots[nextEmptySlotIndex],
        });
        nextEmptySlotIndex++;
      }
    }

    if (moves.length > 0) {
      triggerHaptic();
      moves.forEach((move) => {
        const { tile, targetSlot } = move;
        const startRect = tile.getBoundingClientRect();
        const targetRect = targetSlot.getBoundingClientRect();

        tile.classList.add("is-animated-clone");
        document.body.appendChild(tile);
        tile.style.left = `${startRect.left}px`;
        tile.style.top = `${startRect.top}px`;
        tile.style.width = `${startRect.width}px`;
        tile.style.height = `${startRect.height}px`;

        setTimeout(() => {
          tile.style.left = `${targetRect.left}px`;
          tile.style.top = `${targetRect.top}px`;
        }, 10);

        setTimeout(() => {
          // ** THE FIX IS HERE **
          // Reset inline styles before re-parenting the tile
          tile.classList.remove("is-animated-clone");
          tile.style.position = "";
          tile.style.left = "";
          tile.style.top = "";
          tile.style.width = "";
          tile.style.height = "";
          targetSlot.appendChild(tile);
        }, 210);
      });

      setTimeout(checkAnswerLength, 220);
    }
  }
}

function animateTileReturn(tileInAnswer) {
  const originTile = document.getElementById(tileInAnswer.dataset.originId);
  if (!originTile) {
    tileInAnswer.remove();
    checkAnswerLength();
    return;
  }

  const startRect = tileInAnswer.getBoundingClientRect();
  const targetRect = originTile.getBoundingClientRect();

  tileInAnswer.classList.add("is-animated-clone");
  document.body.appendChild(tileInAnswer);
  tileInAnswer.style.left = `${startRect.left}px`;
  tileInAnswer.style.top = `${startRect.top}px`;
  tileInAnswer.style.width = `${startRect.width}px`;
  tileInAnswer.style.height = `${startRect.height}px`;

  originTile.style.opacity = "0";

  setTimeout(() => {
    tileInAnswer.style.left = `${targetRect.left}px`;
    tileInAnswer.style.top = `${targetRect.top}px`;
  }, 10);

  setTimeout(() => {
    tileInAnswer.remove();
    originTile.classList.remove("is-ghost");
    originTile.style.opacity = "1";
    checkAnswerLength();
  }, 210);
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
  if (answerSlot && !answerSlot.classList.contains("is-blocked")) {
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

  if (
    !isDragging &&
    (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
  ) {
    isDragging = true;
    e.preventDefault();
    triggerHaptic();

    const rect = draggedTile.getBoundingClientRect();
    touchDragTile = draggedTile.cloneNode(true);
    touchDragTile.classList.add("is-touch-dragging");
    touchDragTile.style.width = `${rect.width}px`;
    touchDragTile.style.height = `${rect.height}px`;
    document.body.appendChild(touchDragTile);
    moveElement(
      touch.clientX + rect.width / 2,
      touch.clientY + rect.height / 2,
    );
    draggedTile.style.opacity = "0.3";
  }

  if (isDragging) {
    e.preventDefault();
    moveElement(touch.clientX, touch.clientY);
  }
}

function handleTouchEnd(e) {
  if (draggedTile && isDragging) {
    triggerHaptic();
    if (touchDragTile) {
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(
        touch.clientX,
        touch.clientY,
      );
      const answerSlot = dropTarget ? dropTarget.closest(".answer-slot") : null;

      if (answerSlot && !answerSlot.classList.contains("is-blocked")) {
        placeTileInAnswer(draggedTile, answerSlot);
      } else {
        draggedTile.style.opacity = "1";
      }

      document.body.removeChild(touchDragTile);
    }
  } else if (draggedTile) {
    draggedTile.style.opacity = "1";
  }

  draggedTile = null;
  touchDragTile = null;
  isDragging = false;
}

function placeTileInAnswer(tile, answerSlot) {
  if (answerSlot.classList.contains("is-blocked")) {
    console.warn("Attempted to place tile in a blocked answer slot.");
    return;
  }
  const existingTile = answerSlot.querySelector(".letter-tile");
  if (existingTile) {
    const originTile = document.getElementById(existingTile.dataset.originId);
    if (originTile) {
      originTile.classList.remove("is-ghost");
      originTile.style.opacity = "1";
    }
    existingTile.remove();
  }

  tile.classList.add("is-ghost");
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
  touchDragTile.style.left = `${x - touchDragTile.offsetWidth / 2}px`;
  touchDragTile.style.top = `${y - touchDragTile.offsetHeight / 2}px`;
}
