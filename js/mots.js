import { initHaptic, triggerHaptic } from "./haptic.js";

document.addEventListener("DOMContentLoaded", () => {
  initHaptic()
  const letterDistribution = {
    A: { c: 9, p: 1 },
    B: { c: 2, p: 3 },
    C: { c: 2, p: 3 },
    D: { c: 4, p: 2 },
    E: { c: 12, p: 1 },
    F: { c: 2, p: 4 },
    G: { c: 3, p: 2 },
    H: { c: 2, p: 4 },
    I: { c: 9, p: 1 },
    J: { c: 1, p: 8 },
    K: { c: 1, p: 5 },
    L: { c: 4, p: 1 },
    M: { c: 2, p: 3 },
    N: { c: 6, p: 1 },
    O: { c: 8, p: 1 },
    P: { c: 2, p: 3 },
    Q: { c: 1, p: 10 },
    R: { c: 6, p: 1 },
    S: { c: 4, p: 1 },
    T: { c: 6, p: 1 },
    U: { c: 4, p: 1 },
    V: { c: 2, p: 4 },
    W: { c: 2, p: 4 },
    X: { c: 1, p: 8 },
    Y: { c: 2, p: 4 },
    Z: { c: 1, p: 10 },
  };
  const GRID_SIZE = 16,
    ANSWER_SLOTS = 10,
    TOTAL_ROUNDS = 10,
    MIN_WORD_LENGTH = 4;
  const bonusSlots = { 4: 5, 5: 5, 6: 5, 7: 5, 8: 10, 9: 20 };

  let letterBag = [],
    wordList = new Set();
  let totalScore = 0,
    roundScore = 0,
    targetScore = 0,
    currentRound = 0,
    totalPlays = 0,
    redrawsLeft = 2,
    nextTileId = 0;
  let draggedTile = null;
  let playerPowerups = { wildcards: 0, pointBoosts: [] };

  const ui = {
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
  };

  async function initializeGame() {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
      );
      wordList = new Set((await response.text()).split("\r\n"));
    } catch (error) {
      console.error("Failed to load word list:", error);
    }
    createGridSlots();
    createAnswerSlots();
    addEventListeners();
    startGame();
  }

  function startGame() {
    triggerHaptic();
    totalScore = 0;
    currentRound = 0;
    totalPlays = 10;
    redrawsLeft = 2;
    playerPowerups = { wildcards: 0, pointBoosts: [] };
    ui.gameOverModal.classList.remove("visible");
    startNewRound();
  }

  function startNewRound() {
    currentRound++;
    roundScore = 0;
    if (currentRound > 1) totalPlays += 4;
    updatePlays(0);

    targetScore =
      20 +
      (currentRound <= 6 ? currentRound * 10 : 60 + (currentRound - 6) * 20);
    ui.roundDisplay.textContent = `${currentRound}/${TOTAL_ROUNDS}`;
    ui.targetScoreDisplay.textContent = targetScore;
    ui.roundScoreDisplay.textContent = "0";
    checkAnswerLength();

    if (currentRound > 1 && currentRound <= TOTAL_ROUNDS) {
      presentPowerupChoice();
    } else {
      resetBoardForNewRound();
    }
  }

  function resetBoardForNewRound() {
    createLetterBag();
    document.querySelectorAll(".letter-tile").forEach((t) => t.remove());
    document.querySelectorAll(".grid-slot").forEach((s) => (s.innerHTML = ""));
    refillGrid();
  }

  function createGridSlots() {
    for (let i = 0; i < GRID_SIZE; i++)
      ui.letterGrid
        .appendChild(document.createElement("div"))
        .classList.add("grid-slot");
  }
  function createAnswerSlots() {
    for (let i = 0; i < ANSWER_SLOTS; i++) {
      const s = document.createElement("div");
      s.className = "answer-slot";
      s.dataset.index = i;
      if (bonusSlots[i])
        s.innerHTML = `<div class="bonus-text">+${bonusSlots[i]}</div>`;
      ui.answerArea.appendChild(s);
    }
  }

  function createLetterBag() {
    letterBag = [];
    for (const letter in letterDistribution)
      for (let i = 0; i < letterDistribution[letter].c; i++)
        letterBag.push({ letter, points: letterDistribution[letter].p });
    for (let i = 0; i < playerPowerups.wildcards; i++)
      letterBag.push({ letter: "*", points: 0 });
    playerPowerups.pointBoosts.forEach((boost) => {
      const tileIndex = Math.floor(Math.random() * letterBag.length);
      letterBag[tileIndex].points++;
    });
  }

  function updateRedrawBadge() {
    ui.redrawBadge.textContent = redrawsLeft;
    ui.redrawButton.disabled = redrawsLeft <= 0;
    ui.redrawBadge.style.display = redrawsLeft > 0 ? "flex" : "none";
  }
  function updatePlays(change) {
    totalPlays += change;
    ui.playsDisplay.textContent = totalPlays;
    ui.playsCounter.classList.toggle("is-low", totalPlays <= 3);
    if (totalPlays <= 0 && !ui.gameOverModal.classList.contains("visible"))
      gameOver();
  }

  function createLetterTile(letterObj) {
    const tile = document.createElement("div");
    tile.className = "letter-tile letter-tile-bounce";
    tile.id = "tile-" + nextTileId++;
    tile.dataset.letter = letterObj.letter;
    tile.dataset.points = letterObj.points;
    tile.draggable = true;
    tile.innerHTML =
      letterObj.letter === "*"
        ? `<i class="iconoir-star-solid text-2xl" style="color: var(--yellow)"></i>`
        : `<span>${letterObj.letter}</span><span class="letter-points">${letterObj.points}</span>`;
    tile.addEventListener("animationend", () =>
      tile.classList.remove("letter-tile-bounce")
    );
    return tile;
  }

  function refillGrid(count) {
    const emptySlots = Array.from(
      ui.letterGrid.querySelectorAll(".grid-slot:not(:has(.letter-tile))")
    );
    for (let i = 0; i < (count || emptySlots.length); i++) {
      if (letterBag.length === 0) createLetterBag();
      if (emptySlots[i])
        emptySlots[i].appendChild(
          createLetterTile(
            letterBag.splice(Math.floor(Math.random() * letterBag.length), 1)[0]
          )
        );
    }
    updateRedrawBadge();
  }

  function handleRedraw() {
    if (redrawsLeft <= 0) return;
     triggerHaptic();
    redrawsLeft--;
    document.querySelectorAll(".letter-tile").forEach((t) => {
      if (!t.classList.contains("is-ghost"))
        letterBag.push({
          letter: t.dataset.letter,
          points: parseInt(t.dataset.points, 10),
        });
      t.remove();
    });
    document.querySelectorAll(".grid-slot").forEach((s) => (s.innerHTML = ""));
    refillGrid();
    checkAnswerLength();
  }

  function shuffleGrid() {
     triggerHaptic();
    const tilesInGrid = Array.from(
      ui.letterGrid.querySelectorAll(".letter-tile:not(.is-ghost)")
    );
    if (tilesInGrid.length < 2) return;

    const startingPositions = new Map();
    tilesInGrid.forEach((tile) => {
      startingPositions.set(tile, tile.getBoundingClientRect());
    });

    const slotsWithTiles = tilesInGrid.map((t) => t.parentElement);
    for (let i = tilesInGrid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tilesInGrid[i], tilesInGrid[j]] = [tilesInGrid[j], tilesInGrid[i]];
    }

    slotsWithTiles.forEach((slot, index) => {
      slot.appendChild(tilesInGrid[index]);
    });

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
        { once: true }
      );
    });
  }

  function handleSubmitWord() {
    let word = "",
      basePoints = 0,
      bonusPoints = 0,
      placedTiles = [];
    ui.answerArea.querySelectorAll(".answer-slot").forEach((s) => {
      const t = s.querySelector(".letter-tile");
      if (t) {
        placedTiles.push(t);
        word += t.dataset.letter;
        basePoints += parseInt(t.dataset.points, 10);
        if (bonusSlots[s.dataset.index])
          bonusPoints += bonusSlots[s.dataset.index];
      }
    });
    if (word.length < MIN_WORD_LENGTH) return;
 triggerHaptic();
    updatePlays(-1);
    if (totalPlays < 0) {
      totalPlays = 0;
      return;
    }

    const isValid = isWordValid(word);
    if (isValid) {
      const wordScore = basePoints + bonusPoints;
      totalScore += wordScore;
      roundScore += wordScore;
      ui.roundScoreDisplay.textContent = roundScore;
      flashTiles(placedTiles, "green");
      setTimeout(() => {
        placedTiles.forEach((t) => {
          const o = document.getElementById(t.dataset.originId);
          if (o) o.remove();
          t.remove();
        });
        refillGrid(placedTiles.length);
        if (roundScore >= targetScore && currentRound < TOTAL_ROUNDS)
          startNewRound();
        else if (roundScore >= targetScore && currentRound >= TOTAL_ROUNDS)
          gameOver(true);
        checkAnswerLength();
      }, 700);
    } else {
      flashTiles(placedTiles, "red");
    }
  }

  function checkAnswerLength() {
    const wordLength = ui.answerArea.querySelectorAll(".letter-tile").length;
    ui.submitWordButton.disabled = wordLength < MIN_WORD_LENGTH;
  }

  function isWordValid(word) {
    if (!word.includes("*")) return wordList.has(word.toLowerCase());
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    for (let char of alphabet) {
      if (wordList.has(word.replace(/\*/g, char).toLowerCase())) return true;
    }
    return false;
  }

  function flashTiles(tiles, type) {
    tiles.forEach((t) => {
      t.classList.add(type === "green" ? "flash-green" : "flash-red");
      t.addEventListener(
        "animationend",
        () => t.classList.remove("flash-green", "flash-red"),
        { once: true }
      );
    });
  }

  function presentPowerupChoice() {
    const powerupList = [
      {
        id: "redraw",
        text: "Gain 2 Redraws",
        apply: () => {
          redrawsLeft += 2;
          updateRedrawBadge();
        },
      },
      {
        id: "wildcard",
        text: "Add a Wildcard (*) to the bag",
        apply: () => playerPowerups.wildcards++,
      },
      {
        id: "pointboost",
        text: "+1 to a random letter tile",
        apply: () => playerPowerups.pointBoosts.push(1),
      },
    ];
    let options = [...powerupList].sort(() => 0.5 - Math.random()).slice(0, 2);
    ui.powerupOptions.innerHTML = "";
    options.forEach((opt) => {
      const div = document.createElement("div");
      div.className = "powerup-choice";
      div.textContent = opt.text;
      div.onclick = () => {
        opt.apply();
        ui.powerupModal.classList.remove("visible");
        resetBoardForNewRound();
      };
      ui.powerupOptions.appendChild(div);
    });
    ui.powerupModal.classList.add("visible");
  }

  function gameOver(isWin = false) {
    ui.gameOverModal.classList.add("visible");
    ui.finalRound.textContent = currentRound;
    ui.finalScore.textContent = totalScore;
    if (isWin) ui.gameOverModal.querySelector("h2").textContent = "You Win!";
  }

  function addEventListeners() {
    ui.restartButton.addEventListener("click", startGame);
    ui.shuffleButton.addEventListener("click", shuffleGrid);
    ui.redrawButton.addEventListener("click", handleRedraw);
    ui.submitWordButton.addEventListener("click", handleSubmitWord);
    ui.helpButton.addEventListener("click", () =>
      ui.helpModal.classList.add("visible")
    );
    ui.closeHelpButton.addEventListener("click", () => {
       triggerHaptic();
    
      ui.helpModal.classList.remove("visible")}
    );
    ui.helpModal.addEventListener("click", (e) => {
       triggerHaptic();
      if (e.target === ui.helpModal) ui.helpModal.classList.remove("visible");
    });

    ui.letterGrid.addEventListener("click", (e) => {
       triggerHaptic();
      const t = e.target.closest(".letter-tile:not(.is-ghost)");
      if (!t) return;
      const s = Array.from(ui.answerArea.children).find(
        (n) => !n.querySelector(".letter-tile")
      );
      if (s) {
        t.classList.add("is-ghost");
        const n = t.cloneNode(true);
        n.classList.remove("is-ghost", "letter-tile-bounce");
        n.dataset.originId = t.id;
        n.draggable = false;
        s.appendChild(n);
      }
      checkAnswerLength();
    });
    ui.answerArea.addEventListener("click", (e) => {
       triggerHaptic();
      const t = e.target.closest(".letter-tile");
      if (t && t.parentElement.classList.contains("answer-slot")) {
        const o = document.getElementById(t.dataset.originId);
        if (o) o.classList.remove("is-ghost");
        t.remove();
      }
      checkAnswerLength();
    });

    document.addEventListener("dragstart", (e) => {
      const t = e.target.closest(".letter-tile");
      if (t && !t.classList.contains("is-ghost")) {
        draggedTile = t;
        setTimeout(() => {
          t.style.visibility = "hidden";
        }, 0);
      } else {
        e.preventDefault();
      }
    });

    document.addEventListener("dragend", (e) => {
      if (draggedTile) {
        draggedTile.style.visibility = "visible";
      }
      draggedTile = null;
    });
    document.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    document.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedTile) return;

      const s = e.target.closest(".answer-slot");
      if (!s) return;

      const t = s.querySelector(".letter-tile");
      if (t) {
        const o = document.getElementById(t.dataset.originId);
        if (o) o.classList.remove("is-ghost");
        t.remove();
      }

      draggedTile.classList.add("is-ghost");
      const n = draggedTile.cloneNode(true);
      n.classList.remove("is-ghost", "letter-tile-bounce");
      n.style.visibility = "visible";
      n.dataset.originId = draggedTile.id;
      n.draggable = false;
      s.appendChild(n);
      checkAnswerLength();
    });
  }
  initializeGame();
});
