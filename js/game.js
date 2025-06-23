import * as cfg from "./config.js";
import * as ui from "./ui.js";
import { triggerHaptic } from "./haptic.js";

export let currentGameLanguage = "en"; // Default language

let gameTiles = []; // Holds the persistent state of letter tiles (A-Z) for the entire game.
let activePowerups = [];
let longestWord = { word: "", length: 0 };
let highestScore = { word: "", score: 0 };
let letterBag = [],
  wordList = new Set();
let totalScore = 0,
  roundScore = 0,
  targetScore = 0;
export let currentRound = 0,
  totalPlays = 0,
  redrawsLeft = 2,
  nextTileId = 0;

let playerPowerups = {
  wildcards: 0,
  blackTileModifier: 0,
  positionalMultiplier: null,
  autoRefill: false,
  quUpgrade: false,
  affixes: [],
};

let blockedAnswerSlots = [];

/**
 * Sets a seed word to appear on the next new game's grid.
 * Call this from the browser console, e.g., setSeedWord("MOTS")
 * @param {string} word The word to seed.
 */
export function setSeedWord(word = "") {
  cfg.props.seedWord = word.toUpperCase();
  if (cfg.props.seedWord) {
    console.log(
      `Seed word set to: ${cfg.props.seedWord}. Restart the game to see it.`,
    );
    startGame();
  } else {
    console.log("Seed word cleared.");
  }
}

// Expose the helper to the global scope for easy console access
window.setSeedWord = setSeedWord;

const stripVowelAccents = (str) => {
  let s = str;
  s = s.replace(/[áàâä]/g, "a");
  s = s.replace(/[éèêë]/g, "e");
  s = s.replace(/[íìîï]/g, "i");
  s = s.replace(/[óòôö]/g, "o");
  s = s.replace(/[úùûü]/g, "u");
  return s;
};

export function getGameStats() {
  return { activePowerups, longestWord, highestScore };
}

export async function setLanguage(lang) {
  if (cfg.letterDistributions[lang]) {
    currentGameLanguage = lang;
  }
}

export async function loadCurrentLanguage() {
  try {
    const dictionaryPath =
      currentGameLanguage === "en"
        ? "./dict/words.txt"
        : `./dict/words_${currentGameLanguage}.txt`;
    const response = await fetch(dictionaryPath);
    const text = await response.text();
    let words = text.split("\n");

    // For FR, ES, CA, strip accents from dictionary words. For DE, keep them to preserve umlauts.
    if (["fr", "es", "ca"].includes(currentGameLanguage)) {
      words = words.map(stripVowelAccents);
    }
    console.info(`Loaded word list for language ${currentGameLanguage}`);
    wordList = new Set(words.map((w) => w.trim().toLowerCase().normalize()));
    window.wordList = wordList;
  } catch (error) {
    console.error(
      "Failed to load word list for language:",
      currentGameLanguage,
      error,
    );
  }
}

export async function initializeGame() {
  loadCurrentLanguage();
  ui.createGridSlots(cfg.GRID_SIZE);
  ui.createAnswerSlots();
  startGame();
}

export function startGame() {
  totalScore = 0;
  currentRound = 0;
  totalPlays = 10;
  redrawsLeft = 2;
  activePowerups = [];
  longestWord = { word: "", length: 0 };
  highestScore = { word: "", score: 0 };
  loadCurrentLanguage();

  const distribution = cfg.letterDistributions[currentGameLanguage];
  gameTiles = [];
  for (const letter in distribution) {
    for (let i = 0; i < distribution[letter].c; i++) {
      gameTiles.push({
        letter,
        points: distribution[letter].p,
        isBoosted: false,
        isNerfed: false,
      });
    }
  }

  playerPowerups = {
    wildcards: 0,
    blackTileModifier: 0,
    positionalMultiplier: null,
    autoRefill: false,
    quUpgrade: false,
    affixes: [],
  };

  ui.ui.gameOverModal.classList.remove("visible");
  ui.updateMultiplierDisplay(playerPowerups.positionalMultiplier);
  ui.updateLanguageDisplay(currentGameLanguage); // Update language display
  const notice = document.getElementById("lang-change-notice");
  if (notice) notice.textContent = ""; // Clear language change notice

  createLetterBag();
  startNewRound();
}

function calculateAndDisplayBagStats() {
  const standardTilesTotal = gameTiles.length;

  const totalBlackTiles = Math.max(
    0,
    cfg.BLACK_TILES_PER_ROUND(currentRound) + playerPowerups.blackTileModifier,
  );
  const totalWildcards = playerPowerups.wildcards || 0;
  const totalBoosted = gameTiles.filter((t) => t.isBoosted).length;
  const totalNerfed = gameTiles.filter((t) => t.isNerfed).length;

  const totals = {
    total: standardTilesTotal + totalWildcards + totalBlackTiles,
    black: totalBlackTiles,
    wildcard: totalWildcards,
    boosted: totalBoosted,
    nerfed: totalNerfed,
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
    createLetterBag();
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
  createLetterBag(); // Rebuild the bag with all current rules.

  // Clear the board and refill from the newly created bag.
  document.querySelectorAll(".letter-tile").forEach((t) => t.remove());
  document.querySelectorAll(".grid-slot").forEach((s) => (s.innerHTML = ""));
  refillGrid();
}

function createLetterBag() {
  // Start with the persistent, potentially modified, letter tiles
  window.letterBag = letterBag;
  letterBag = [...gameTiles];

  // Add wildcards for this round
  for (let i = 0; i < playerPowerups.wildcards; i++) {
    letterBag.push({
      letter: "*",
      points: 0,
      isBoosted: false,
      isNerfed: false,
    });
  }

  for (const affix of playerPowerups.affixes) {
    letterBag.push({
      letter: affix.letters,
      points: affix.points,
      isAffix: true,
    });
  }

  // Add black tiles for this round
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
  const allEmptySlots = Array.from(
    ui.ui.letterGrid.querySelectorAll(".grid-slot:not(:has(.letter-tile))"),
  );
  let slotsToFill = allEmptySlots.slice(); // Create a mutable copy

  // --- NEW SEEDING LOGIC ---
  // Check for a seed word on the very first grid fill of a new game
  const isFirstFill =
    currentRound <= 1 && allEmptySlots.length === cfg.GRID_SIZE;

  if (cfg.props.seedWord && isFirstFill) {
    const seedLetters = cfg.props.seedWord.toUpperCase().split("");
    const filledSlots = new Set();

    for (const letter of seedLetters) {
      if (slotsToFill.length === 0) break;

      // Find the required letter in the bag
      const tileIndex = letterBag.findIndex((t) => t.letter === letter);

      if (tileIndex !== -1) {
        const tileData = letterBag.splice(tileIndex, 1)[0];
        const slot = slotsToFill.shift(); // Take the next available slot
        slot.appendChild(ui.createLetterTile(tileData, nextTileId++));
        filledSlots.add(slot);
      }
    }
    // Clear the seed word after using it once
    setSeedWord("");
    // Recalculate slots that still need to be filled
    slotsToFill = allEmptySlots.filter((s) => !filledSlots.has(s));
  }
  // --- END OF SEEDING LOGIC ---

  // Fill the remaining (or all) slots randomly
  const fillCount = count || slotsToFill.length;
  for (let i = 0; i < fillCount; i++) {
    if (slotsToFill[i]) {
      if (letterBag.length === 0) createLetterBag();
      const tileData = letterBag.splice(
        Math.floor(Math.random() * letterBag.length),
        1,
      )[0];
      const tileElement = ui.createLetterTile(tileData, nextTileId++);

      // If QU upgrade is active, update the new tile's appearance
      if (playerPowerups.quUpgrade && tileData.letter === "Q") {
        ui.updateQUTile(tileElement);
      }

      slotsToFill[i].appendChild(tileElement);
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
    // This part is tricky. The returned tile is a copy. We need to find the original.
    // For simplicity, we just push a representation back. The persistent state is in gameTiles.
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
      let letter = t.dataset.letter;

      // ** MODIFIED to handle QU upgrade **
      if (playerPowerups.quUpgrade && letter === "Q") {
        word += "QU";
      } else {
        word += letter;
      }

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

function calculateCurrentWordScore() {
  let basePoints = 0;
  let bonusPoints = 0;
  let wordPosition = 0;

  ui.ui.answerArea.querySelectorAll(".answer-slot").forEach((slot, index) => {
    const tile = slot.querySelector(".letter-tile");
    if (tile) {
      let tilePoints = parseInt(tile.dataset.points, 10);
      if (
        playerPowerups.positionalMultiplier &&
        wordPosition === playerPowerups.positionalMultiplier.position - 1
      ) {
        tilePoints *= playerPowerups.positionalMultiplier.multiplier;
      }
      basePoints += tilePoints;
      wordPosition++;

      if (cfg.bonusSlots[index]) {
        bonusPoints += cfg.bonusSlots[index];
      }
    }
  });
  return basePoints + bonusPoints;
}

export function checkAnswerLength() {
  const wordLength = Array.from(
    ui.ui.answerArea.querySelectorAll(".answer-slot"),
  ).filter(
    (s) =>
      !s.classList.contains("is-blocked") && s.querySelector(".letter-tile"),
  ).length;
  ui.ui.submitWordButton.disabled = wordLength < cfg.MIN_WORD_LENGTH;
  if (wordLength > 0) {
    const score = calculateCurrentWordScore();
    ui.updateCurrentWordScore(score);
  } else {
    ui.updateCurrentWordScore(0); // Clear score display when answer is empty
  }
}

function isWordValid(word) {
  // This helper function will recursively check all combinations
  console.info(`Validating ${word}`);
  const checkRecursive = (currentWord) => {
    const wildcardIndex = currentWord.indexOf("*");

    // Base case: No more wildcards, check the word against the list
    if (wildcardIndex === -1) {
      return wordList.has(currentWord.toLowerCase().normalize());
    }

    const alphabet = cfg.alphabets[currentGameLanguage];
    // Recursive step: Try every letter for the current wildcard
    for (const char of alphabet) {
      const newWord =
        currentWord.substring(0, wildcardIndex) +
        char +
        currentWord.substring(wildcardIndex + 1);

      // If any recursive path finds a valid word, return true immediately
      if (checkRecursive(newWord)) {
        return true;
      }
    }

    // If no letter combination for this wildcard worked, return false
    return false;
  };

  return checkRecursive(word);
}

function getAvailablePowerups() {
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
        createLetterBag();
      },
    },
    {
      id: "pointboost",
      text: "+1 to a random letter tile",
      shorttext: "Letter Point Boost",
      apply: () => {
        const tileIndex = Math.floor(Math.random() * gameTiles.length);
        const tile = gameTiles[tileIndex];
        tile.points++;
        tile.isBoosted = true;
      },
    },
    {
      id: "add_black_tile",
      text: "Add a black tile to the bag for +2 plays",
      shorttext: "+2 Plays (adds black tile)",
      apply: () => {
        playerPowerups.blackTileModifier++;
        updatePlays(2);
      },
    },
    {
      id: "point_nerf",
      text: "-1 to a random letter tile for +1 play",
      shorttext: "+1 Play (letter point nerf)",
      apply: () => {
        const eligibleTiles = gameTiles.filter((t) => t.points > 0);
        if (eligibleTiles.length > 0) {
          const tile =
            eligibleTiles[Math.floor(Math.random() * eligibleTiles.length)];
          tile.points--;
          tile.isNerfed = true;
        }
        updatePlays(1);
      },
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

  if (!playerPowerups.autoRefill) {
    powerupList.push({
      id: "auto_refill_bag",
      text: "Automatically refill bag after each round",
      shorttext: "Auto-Refill Bag",
      apply: () => {
        playerPowerups.autoRefill = true;
        createLetterBag();
      },
    });
  }

  const langAffixes = cfg.affixTiles[currentGameLanguage];
  if (langAffixes && langAffixes.length > 0) {
    for (let affix of langAffixes) {
      powerupList.push({
        id: `add_affix_${affix.letters.toLowerCase()}`,
        text: `Add a "${affix.letters}" tile to the bag`,
        shorttext: `+1 "${affix.letters}" Tile`,
        apply: () => {
          playerPowerups.affixes.push(affix);
          createLetterBag();
        },
      });
    }
  }

  if (!playerPowerups.quUpgrade) {
    powerupList.push({
      id: "qu_upgrade",
      text: "All 'Q' tiles now count as 'QU'",
      shorttext: "Q -> QU Upgrade",
      apply: () => {
        playerPowerups.quUpgrade = true;
        ui.updateVisibleQTiles();
      },
    });
  }

  // This power-up was missed in the previous implementation, adding it back
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

  return powerupList;
}

function choosePowerup() {
  const powerupList = getAvailablePowerups();
  ui.presentPowerupChoice(powerupList, (chosenOption) => {
    chosenOption.apply();
    activePowerups.push(chosenOption);
    resetBoardForNewRound();
  });
}

/**
 * Forces a power-up to be applied for testing purposes.
 * Call from the browser console, e.g., forcePowerup('qu_upgrade')
 * @param {string} powerupId The ID of the power-up to apply.
 */
export function forceApplyPowerup(powerupId) {
  const allPowerups = getAvailablePowerups();
  const powerup = allPowerups.find((p) => p.id === powerupId);

  if (powerup) {
    console.log(`Forcing power-up: ${powerup.text}`);
    powerup.apply();
    activePowerups.push(powerup);
    // Refresh stats display to reflect changes
    calculateAndDisplayBagStats();
    console.log("Power-up applied. Current state:", playerPowerups);
  } else {
    console.error(
      `Power-up with ID "${powerupId}" not found or not available.`,
    );
    console.log(
      "Available IDs:",
      allPowerups.map((p) => p.id),
    );
  }
}
