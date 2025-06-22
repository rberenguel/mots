import * as cfg from "./config.js";
import * as ui from "./ui.js";
import { triggerHaptic } from "./haptic.js";

let activePowerups = [];
let longestWord = { word: "", length: 0 };
let highestScore = { word: "", score: 0 };
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
  autoRefill: false,
};

let blockedAnswerSlots = [];

export function getGameStats() {
  return { activePowerups, longestWord, highestScore };
}

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
  totalScore = 0;
  currentRound = 0;
  totalPlays = 10;
  redrawsLeft = 2;
  // Reset stats for new game
  activePowerups = [];
  longestWord = { word: "", length: 0 };
  highestScore = { word: "", score: 0 };

  playerPowerups = {
    wildcards: 0,
    pointBoosts: [],
    pointNerfs: [],
    blackTileModifier: 0,
    positionalMultiplier: { position: 3, multiplier: 3 },
  };
  ui.ui.gameOverModal.classList.remove("visible");
  ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);
  createLetterBag();
  startNewRound();
}

function calculateAndDisplayBagStats() {
  let totalBag = 0;
  for (const letter in cfg.letterDistribution) {
    for (let i = 0; i < cfg.letterDistribution[letter].c; i++) {
      totalBag++;
    }
  }
  const totals = {
    total: totalBag,
    black:
      playerPowerups.blackTileModifier +
      cfg.BLACK_TILES_PER_ROUND(currentRound),
    wildcard: playerPowerups.wildcards || 0,
    boosted: playerPowerups.boosted || 0,
    nerfed: playerPowerups.nerfed || 0,
  };
  const stats = {
    total: letterBag.length,
    black: letterBag.filter((t) => t.isBlackTile).length,
    wildcard: letterBag.filter((t) => t.letter === "*").length,
    boosted: letterBag.filter((t) => t.isBoosted && !t.isNerfed).length,
    nerfed: letterBag.filter((t) => t.isNerfed).length,
  };
  ui.updateBagStatsDisplay(totals, stats);
}

function startNewRound() {
  currentRound++;
  roundScore = 0;
  if (currentRound > 1) totalPlays += 4;
  updatePlays(0);

  if (playerPowerups.autoRefill && currentRound > 1) {
    const specialTiles = letterBag.filter(
      (t) => t.isBlackTile || t.letter === "*" || t.isBoosted || t.isNerfed,
    );
    createLetterBag(); // Resets to standard letters
    letterBag.push(...specialTiles);
  }

  blockedAnswerSlots = [];
  const blockedConfig = cfg.BLOCKED_SLOTS_PER_ROUND[currentRound];
  if (blockedConfig) {
    const numBlockedSlots =
      Math.floor(Math.random() * (blockedConfig.max - blockedConfig.min + 1)) +
      blockedConfig.min;
    const allSlotIndices = Array.from(
      { length: cfg.ANSWER_SLOTS },
      (_, i) => i,
    );

    for (let i = 0; i < numBlockedSlots; i++) {
      blockedAnswerSlots.push(allSlotIndices.length - i);
    }
  }
  // This needs to be called after `blockedAnswerSlots` is populated
  ui.updateBlockedSlotsDisplay(blockedAnswerSlots);

  targetScore =
    20 + (currentRound <= 6 ? currentRound * 10 : 60 + (currentRound - 6) * 20);
  ui.ui.roundDisplay.textContent = `${currentRound}/${cfg.TOTAL_ROUNDS}`;
  ui.ui.targetScoreDisplay.textContent = targetScore;
  ui.ui.roundScoreDisplay.textContent = "0";

  ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);

  checkAnswerLength();
  calculateAndDisplayBagStats();

  if (currentRound > 1 && currentRound <= cfg.TOTAL_ROUNDS) {
    choosePowerup();
  } else {
    resetBoardForNewRound();
  }
}

function resetBoardForNewRound() {
  // Calculate how many black tiles are already in the bag.
  const currentBlackTiles = letterBag.filter((t) => t.isBlackTile).length;
  // Get the target number of black tiles for the current round from the config.
  const targetBlackTiles = cfg.BLACK_TILES_PER_ROUND(currentRound);
  // Only add the difference to reach the target.
  const blackTilesToAdd = Math.max(0, targetBlackTiles - currentBlackTiles);

  for (let i = 0; i < blackTilesToAdd; i++) {
    letterBag.push({ letter: "BLACK", points: 0, isBlackTile: true });
  }

  // Clear the board and refill from the bag.
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
    cfg.BLACK_TILES_PER_ROUND(currentRound) + playerPowerups.blackTileModifier;
  if (blackTileCount < 0) blackTileCount = 0;

  for (let i = 0; i < blackTileCount; i++) {
    letterBag.push({ letter: "BLACK", points: 0, isBlackTile: true });
  }
  calculateAndDisplayBagStats();
}

function updatePlays(change) {
  totalPlays += change;
  ui.updatePlaysDisplay(totalPlays);
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
  calculateAndDisplayBagStats();
}

export function handleRedraw() {
  if (redrawsLeft <= 0) return;
  redrawsLeft--;

  // Return letters from the answer area to the bag
  document.querySelectorAll("#answer-area .letter-tile").forEach((tile) => {
    const pointsSpan = tile.querySelector(".letter-points");
    letterBag.push({
      letter: tile.dataset.letter,
      points: parseInt(tile.dataset.points, 10),
      isBoosted: pointsSpan ? pointsSpan.classList.contains("boosted") : false,
      isNerfed: pointsSpan ? pointsSpan.classList.contains("nerfed") : false,
    });
    tile.remove();
  });

  // Discard letters remaining on the grid
  document
    .querySelectorAll("#letter-grid .letter-tile")
    .forEach((t) => t.remove());

  // Refill the grid with new tiles from the bag
  refillGrid();
  checkAnswerLength();
}

export function handleSubmitWord() {
  let word = "",
    basePoints = 0,
    bonusPoints = 0,
    placedTiles = [];
  let wordPosition = 0;

  ui.ui.answerArea.querySelectorAll(".answer-slot").forEach((s) => {
    const t = s.querySelector(".letter-tile");
    if (t) {
      placedTiles.push(t);
      word += t.dataset.letter;

      let tilePoints = parseInt(t.dataset.points, 10);
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

  if (isWordValid(word)) {
    updatePlays(-1);
    const wordScore = basePoints + bonusPoints;
    totalScore += wordScore;
    roundScore += wordScore;
    ui.ui.roundScoreDisplay.textContent = roundScore;
    ui.flashTiles(placedTiles, "green");

    // Update game stats
    if (word.length > longestWord.length) {
      longestWord = { word, length: word.length };
    }
    if (wordScore > highestScore.score) {
      highestScore = { word, score: wordScore };
    }

    setTimeout(() => {
      placedTiles.forEach((t) => {
        const o = document.getElementById(t.dataset.originId);
        if (o) o.remove();
        t.remove();
      });
      refillGrid(placedTiles.length);

      if (currentRound >= 0) {
        const blockedConfig = cfg.BLOCKED_SLOTS_PER_ROUND[currentRound];
        if (blockedConfig) {
          const numBlockedSlots =
            Math.floor(
              Math.random() * (blockedConfig.max - blockedConfig.min + 1),
            ) + blockedConfig.min;
          const allSlotIndices = Array.from(
            { length: cfg.ANSWER_SLOTS },
            (_, i) => i,
          );

          blockedAnswerSlots = []; // Clear previous
          // Randomly select indices to block
          for (let i = 0; i < numBlockedSlots; i++) {
            blockedAnswerSlots.push(allSlotIndices.length - i);
          }
        }
      }
      ui.updateBlockedSlotsDisplay(blockedAnswerSlots);
      ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);

      const roundComplete = roundScore >= targetScore;
      if (roundComplete && currentRound < cfg.TOTAL_ROUNDS) {
        startNewRound();
      } else if (roundComplete && currentRound >= cfg.TOTAL_ROUNDS) {
        ui.showGameOverModal(true, currentRound, totalScore);
      } else if (totalPlays <= 0) {
        ui.showGameOverModal(false, currentRound, totalScore);
      }

      checkAnswerLength();
    }, 1000);
  } else {
    ui.flashTiles(placedTiles, "red");
    if (totalPlays <= 0) {
      ui.showGameOverModal(false, currentRound, totalScore);
    }
  }
}

export function checkAnswerLength() {
  // Only count tiles in unblocked slots
  const wordLength = Array.from(
    ui.ui.answerArea.querySelectorAll(".answer-slot"),
  ).filter(
    (s) =>
      !s.classList.contains("is-blocked") && s.querySelector(".letter-tile"),
  ).length;
  ui.ui.submitWordButton.disabled = wordLength < cfg.MIN_WORD_LENGTH;
}

function isWordValid(word) {
  if (!word.includes("*")) return wordList.has(word.toLowerCase());
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  for (let char of alphabet) {
    if (wordList.has(word.replace(/\*/g, char).toLowerCase())) return true;
  }
  return false;
}

function choosePowerup() {
  const powerupList = [
    {
      id: "redraw",
      text: "Gain 2 Redraws",
      shorttext: "+2 Redraws",
      apply: () => {
        redrawsLeft += 2;
        ui.updateRedrawBadge(redrawsLeft);
      },
    },
    {
      id: "wildcard",
      text: "Add a Wildcard (*) to the bag and shuffle the bag",
      shorttext: "+1 Wildcard",
      apply: () => {
        playerPowerups.wildcards++;
        const specialTiles = letterBag.filter(
          (t) => t.isBlackTile || t.letter === "*" || t.isBoosted || t.isNerfed,
        );
        createLetterBag();
        letterBag.push(...specialTiles);
      },
    },
    {
      id: "pointboost",
      text: "+1 to a random letter tile",
      shorttext: "Letter Point Boost",
      apply: () => playerPowerups.pointBoosts.push(1),
    },
  ];

  const upcomingBlackTiles =
    cfg.BLACK_TILES_PER_ROUND(currentRound) + playerPowerups.blackTileModifier;
  if (upcomingBlackTiles > 0) {
    powerupList.push({
      id: "remove_black_tile",
      text: "Remove a black tile from the bag (permanent)",
      shorttext: "Remove Black Tile",
      apply: () => {
        playerPowerups.blackTileModifier--;
      },
    });
  }

  powerupList.push({
    id: "add_black_tile",
    text: "Add a black tile to the bag for +2 plays",
    shorttext: "+2 Plays (adds black tile)",
    apply: () => {
      playerPowerups.blackTileModifier++;
      updatePlays(2);
    },
  });
  powerupList.push({
    id: "point_nerf",
    text: "-1 to a random letter tile for +1 play",
    shorttext: "+1 Play (letter point nerf)",
    apply: () => {
      playerPowerups.pointNerfs.push(1);
      updatePlays(1);
    },
  });
  if (!playerPowerups.autoRefill) {
    powerupList.push({
      id: "auto_refill_bag",
      text: "Automatically refill bag after each round",
      shorttext: "Auto-Refill Bag",
      apply: () => {
        playerPowerups.autoRefill = true;
        const specialTiles = letterBag.filter(
          (t) => t.isBlackTile || t.letter === "*" || t.isBoosted || t.isNerfed,
        );
        createLetterBag();
        letterBag.push(...specialTiles);
      },
    });
  }
  if (!playerPowerups.positionalMultiplier) {
    powerupList.push({
      id: "positional_multiplier",
      text: "3x score on a random letter position (1-5)",
      shorttext: "3x Positional Score",
      apply: () => {
        const N = Math.floor(Math.random() * 5);
        playerPowerups.positionalMultiplier = { position: N, multiplier: 3 };
        ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);
      },
    });
  }

  ui.presentPowerupChoice(powerupList, (chosenOption) => {
    chosenOption.apply();
    activePowerups.push(chosenOption);
    resetBoardForNewRound();
  });
}
