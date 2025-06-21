import * as cfg from "./config.js";
import * as ui from "./ui.js";
import { triggerHaptic } from "./haptic.js";

let letterBag = [],
  wordList = new Set();
let totalScore = 0,
  roundScore = 0,
  targetScore = 0;
let currentRound = 0,
  totalPlays = 0,
  redrawsLeft = 2,
  nextTileId = 0;

let playerPowerups = {
  wildcards: 0,
  pointBoosts: [],
  pointNerfs: [],
  blackTileModifier: 0,
  positionalMultiplier: null,
};

export async function initializeGame() {
  try {
    const response = await fetch("./dict/words.txt");
    wordList = new Set((await response.text()).split("\n"));
    window.wordList = wordList;
  } catch (error) {
    console.error("Failed to load word list:", error);
  }
  ui.createGridSlots(cfg.GRID_SIZE);
  ui.createAnswerSlots();
  startGame();
}

export function startGame() {
  triggerHaptic();
  totalScore = 0;
  currentRound = 0;
  totalPlays = 10;
  redrawsLeft = 2;
  playerPowerups = {
    wildcards: 0,
    pointBoosts: [],
    pointNerfs: [],
    blackTileModifier: 0,
    positionalMultiplier: null,
  };
  ui.ui.gameOverModal.classList.remove("visible");
  ui.updateMultiplierDisplay(null); // Clear any multiplier display
  startNewRound();
}

function startNewRound() {
  currentRound++;
  roundScore = 0;
  if (currentRound > 1) totalPlays += 4;
  updatePlays(0);

  targetScore =
    20 + (currentRound <= 6 ? currentRound * 10 : 60 + (currentRound - 6) * 20);
  ui.ui.roundDisplay.textContent = `${currentRound}/${cfg.TOTAL_ROUNDS}`;
  ui.ui.targetScoreDisplay.textContent = targetScore;
  ui.ui.roundScoreDisplay.textContent = "0";

  ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier); // Add this line

  checkAnswerLength();

  if (currentRound > 1 && currentRound <= cfg.TOTAL_ROUNDS) {
    choosePowerup();
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

// Replace the existing createLetterBag function
function createLetterBag() {
  letterBag = [];
  for (const letter in cfg.letterDistribution)
    for (let i = 0; i < cfg.letterDistribution[letter].c; i++)
      letterBag.push({
        letter,
        points: cfg.letterDistribution[letter].p,
        isBoosted: false,
        isNerfed: false,
      });

  for (let i = 0; i < playerPowerups.wildcards; i++)
    letterBag.push({
      letter: "*",
      points: 0,
      isBoosted: false,
      isNerfed: false,
    });

  // Apply boosts
  playerPowerups.pointBoosts.forEach(() => {
    const tileIndex = Math.floor(Math.random() * letterBag.length);
    if (letterBag[tileIndex].letter !== "*") {
      letterBag[tileIndex].points++;
      letterBag[tileIndex].isBoosted = true;
    }
  });

  // Apply nerfs
  playerPowerups.pointNerfs.forEach(() => {
    const tileIndex = Math.floor(Math.random() * letterBag.length);
    const tile = letterBag[tileIndex];
    if (tile.letter !== "*" && tile.points > 0) {
      tile.points--;
      tile.isNerfed = true;
    }
  });

  let blackTileCount =
    (cfg.BLACK_TILES_PER_ROUND[currentRound] || 0) +
    playerPowerups.blackTileModifier;
  if (blackTileCount < 0) blackTileCount = 0;

  for (let i = 0; i < blackTileCount; i++) {
    letterBag.push({ letter: "BLACK", points: 0, isBlackTile: true });
  }
}

function updatePlays(change) {
  totalPlays += change;
  ui.updatePlaysDisplay(totalPlays);
  if (totalPlays <= 0 && !ui.ui.gameOverModal.classList.contains("visible")) {
    ui.showGameOverModal(false, currentRound, totalScore);
  }
}

function refillGrid(count) {
  const emptySlots = Array.from(
    ui.ui.letterGrid.querySelectorAll(".grid-slot:not(:has(.letter-tile))"),
  );
  for (let i = 0; i < (count || emptySlots.length); i++) {
    if (letterBag.length === 0) createLetterBag();
    if (emptySlots[i]) {
      const letter = letterBag.splice(
        Math.floor(Math.random() * letterBag.length),
        1,
      )[0];
      emptySlots[i].appendChild(ui.createLetterTile(letter, nextTileId++));
    }
  }
  ui.updateRedrawBadge(redrawsLeft);
}

export function handleRedraw() {
  if (redrawsLeft <= 0) return;
  triggerHaptic();
  redrawsLeft--;

  // Remove all tiles from the letter grid. These tiles are
  // discarded and not returned to the letter bag.
  document
    .querySelectorAll("#letter-grid .letter-tile")
    .forEach((t) => t.remove());

  // Refill the grid with completely new tiles from the bag.
  refillGrid();
  checkAnswerLength();
}

// Replace the existing handleSubmitWord function
export function handleSubmitWord() {
  let word = "",
    basePoints = 0,
    bonusPoints = 0,
    placedTiles = [];
  let wordPosition = 0; // Tracks the position of a letter within the submitted word

  ui.ui.answerArea.querySelectorAll(".answer-slot").forEach((s) => {
    const t = s.querySelector(".letter-tile");
    if (t) {
      placedTiles.push(t);
      word += t.dataset.letter;

      let tilePoints = parseInt(t.dataset.points, 10);
      // Apply positional multiplier if active
      if (
        playerPowerups.positionalMultiplier &&
        wordPosition === playerPowerups.positionalMultiplier.position - 1
      ) {
        tilePoints *= playerPowerups.positionalMultiplier.multiplier;
      }
      basePoints += tilePoints;
      wordPosition++;

      if (cfg.bonusSlots[s.dataset.index])
        bonusPoints += cfg.bonusSlots[s.dataset.index];
    }
  });

  if (word.length < cfg.MIN_WORD_LENGTH) return;
  triggerHaptic();
  updatePlays(-1);
  if (totalPlays < 0) {
    totalPlays = 0;
    return;
  }

  if (isWordValid(word)) {
    const wordScore = basePoints + bonusPoints;
    totalScore += wordScore;
    roundScore += wordScore;
    ui.ui.roundScoreDisplay.textContent = roundScore;
    ui.flashTiles(placedTiles, "green");
    setTimeout(() => {
      placedTiles.forEach((t) => {
        const o = document.getElementById(t.dataset.originId);
        if (o) o.remove();
        t.remove();
      });
      refillGrid(placedTiles.length);
      if (roundScore >= targetScore && currentRound < cfg.TOTAL_ROUNDS)
        startNewRound();
      else if (roundScore >= targetScore && currentRound >= cfg.TOTAL_ROUNDS)
        ui.showGameOverModal(true, currentRound, totalScore);
      checkAnswerLength();
    }, 700);
  } else {
    ui.flashTiles(placedTiles, "red");
  }
}

export function checkAnswerLength() {
  const wordLength = ui.ui.answerArea.querySelectorAll(".letter-tile").length;
  ui.ui.submitWordButton.disabled = wordLength < cfg.MIN_WORD_LENGTH;
}

function isWordValid(word) {
  console.log(`Checking ${word}`);
  if (!word.includes("*")) return wordList.has(word.toLowerCase());
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  for (let char of alphabet) {
    if (wordList.has(word.replace(/\*/g, char).toLowerCase())) return true;
  }
  return false;
}

// Replace the existing choosePowerup function
function choosePowerup() {
  const powerupList = [
    {
      id: "redraw",
      text: "Gain 2 Redraws",
      apply: () => {
        redrawsLeft += 2;
        ui.updateRedrawBadge(redrawsLeft);
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

  const upcomingBlackTiles =
    (cfg.BLACK_TILES_PER_ROUND[currentRound] || 0) +
    playerPowerups.blackTileModifier;
  if (upcomingBlackTiles > 0) {
    powerupList.push({
      id: "remove_black_tile",
      text: "Remove a black tile from the bag (permanent)",
      apply: () => {
        playerPowerups.blackTileModifier--;
      },
    });
  }

  powerupList.push({
    id: "add_black_tile",
    text: "Add a black tile to the bag for +2 plays",
    apply: () => {
      playerPowerups.blackTileModifier++;
      updatePlays(2);
    },
  });
  powerupList.push({
    id: "point_nerf",
    text: "-1 to a random letter tile for +1 play",
    apply: () => {
      playerPowerups.pointNerfs.push(1);
      updatePlays(1);
    },
  });
  if (!playerPowerups.positionalMultiplier) {
    powerupList.push({
      id: "positional_multiplier",
      text: "3x score on a random letter position (1-5)",
      apply: () => {
        const N = Math.floor(Math.random() * 5) + 1;
        playerPowerups.positionalMultiplier = { position: N, multiplier: 3 };
        ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);
      },
    });
  }

  ui.presentPowerupChoice(powerupList, (chosenOption) => {
    chosenOption.apply();
    resetBoardForNewRound();
  });
}
