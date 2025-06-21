import { ui, shuffleGridAnimation } from "./ui.js";
import { startGame, handleRedraw, handleSubmitWord, checkAnswerLength } from "./game.js";
import { triggerHaptic } from "./haptic.js";

let draggedTile = null;
let touchDragTile = null;
let touchStartPos = { x: 0, y: 0 };


export function addEventListeners() {
  ui.restartButton.addEventListener("click", startGame);
  ui.shuffleButton.addEventListener("click", shuffleGridAnimation);
  ui.redrawButton.addEventListener("click", handleRedraw);
  ui.submitWordButton.addEventListener("click", handleSubmitWord);
  addHelpModalListeners();
  addTileInteractionListeners();
}

function addHelpModalListeners() {
    ui.helpButton.addEventListener("click", () => ui.helpModal.classList.add("visible"));
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

// --- Click/Tap Handlers ---
function handleGridClick(e) {
    triggerHaptic();
    const tile = e.target.closest(".letter-tile:not(.is-ghost)");
    if (!tile) return;
    const emptySlot = Array.from(ui.answerArea.children).find((s) => !s.hasChildNodes() || s.querySelector('.bonus-text'));
    if (emptySlot) {
        placeTileInAnswer(tile, emptySlot);
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
        setTimeout(() => { tile.style.visibility = "hidden"; }, 0);
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


// --- Touch D&D Handlers ---
function handleTouchStart(e) {
    const tile = e.target.closest(".letter-tile:not(.is-ghost)");
    if (tile && ui.letterGrid.contains(tile)) {
        e.preventDefault();
        draggedTile = tile;
        touchDragTile = tile.cloneNode(true);
        touchDragTile.classList.add('is-dragging');
        document.body.appendChild(touchDragTile);
        const touch = e.touches[0];
        moveElement(touch.clientX, touch.clientY);
        draggedTile.style.opacity = '0.3';
    }
}

function handleTouchMove(e) {
    if (draggedTile && touchDragTile) {
        e.preventDefault();
        const touch = e.touches[0];
        moveElement(touch.clientX, touch.clientY);
    }
}

function handleTouchEnd(e) {
    if (draggedTile && touchDragTile) {
        const touch = e.changedTouches[0];
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        const answerSlot = dropTarget ? dropTarget.closest(".answer-slot") : null;
        if (answerSlot) {
            placeTileInAnswer(draggedTile, answerSlot);
        }
        document.body.removeChild(touchDragTile);
        draggedTile.style.opacity = '1';
        draggedTile = null;
        touchDragTile = null;
    }
}

// --- Common Functions ---
function placeTileInAnswer(tile, answerSlot) {
    // If the slot already has a tile, return it to the grid
    const existingTile = answerSlot.querySelector('.letter-tile');
    if(existingTile) {
        const origin = document.getElementById(existingTile.dataset.originId);
        if(origin) origin.classList.remove('is-ghost');
        existingTile.remove();
    }
    
    tile.classList.add("is-ghost");
    const newTile = tile.cloneNode(true);
    newTile.classList.remove("is-ghost", "letter-tile-bounce");
    newTile.style.visibility = "visible";
    newTile.style.opacity = '1';
    newTile.dataset.originId = tile.id;
    newTile.draggable = false; // The copy in the answer area shouldn't be draggable
    answerSlot.appendChild(newTile);
    checkAnswerLength();
}

function moveElement(x, y) {
    if (!touchDragTile) return;
    touchDragTile.style.left = `${x - touchDragTile.offsetWidth / 2}px`;
    touchDragTile.style.top = `${y - touchDragTile.offsetHeight / 2}px`;
}