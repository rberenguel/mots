import * as cfg from "./config.js";
import * as ui from "./ui.js";
import { triggerHaptic } from "./haptic.js";

let letterBag = [], wordList = new Set();
let totalScore = 0, roundScore = 0, targetScore = 0;
let currentRound = 0, totalPlays = 0, redrawsLeft = 2, nextTileId = 0;
let playerPowerups = { wildcards: 0, pointBoosts: [] };

export async function initializeGame() {
  try {
    const response = await fetch("dict/words.txt");
    wordList = new Set((await response.text()).split("\r\n"));
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
  playerPowerups = { wildcards: 0, pointBoosts: [] };
  ui.ui.gameOverModal.classList.remove("visible");
  startNewRound();
}

function startNewRound() {
  currentRound++;
  roundScore = 0;
  if (currentRound > 1) totalPlays += 4;
  updatePlays(0);

  targetScore = 20 + (currentRound <= 6 ? currentRound * 10 : 60 + (currentRound - 6) * 20);
  ui.ui.roundDisplay.textContent = `${currentRound}/${cfg.TOTAL_ROUNDS}`;
  ui.ui.targetScoreDisplay.textContent = targetScore;
  ui.ui.roundScoreDisplay.textContent = "0";
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

function createLetterBag() {
  letterBag = [];
  for (const letter in cfg.letterDistribution)
    for (let i = 0; i < cfg.letterDistribution[letter].c; i++)
      letterBag.push({ letter, points: cfg.letterDistribution[letter].p });
  for (let i = 0; i < playerPowerups.wildcards; i++)
    letterBag.push({ letter: "*", points: 0 });
  playerPowerups.pointBoosts.forEach(() => {
    const tileIndex = Math.floor(Math.random() * letterBag.length);
    letterBag[tileIndex].points++;
  });
}

function updatePlays(change) {
  totalPlays += change;
  ui.updatePlaysDisplay(totalPlays);
  if (totalPlays <= 0 && !ui.ui.gameOverModal.classList.contains("visible")) {
    ui.showGameOverModal(false, currentRound, totalScore);
  }
}

function refillGrid(count) {
  const emptySlots = Array.from(ui.ui.letterGrid.querySelectorAll(".grid-slot:not(:has(.letter-tile))"));
  for (let i = 0; i < (count || emptySlots.length); i++) {
    if (letterBag.length === 0) createLetterBag();
    if (emptySlots[i]) {
        const letter = letterBag.splice(Math.floor(Math.random() * letterBag.length), 1)[0]
        emptySlots[i].appendChild(ui.createLetterTile(letter, nextTileId++));
    }
  }
  ui.updateRedrawBadge(redrawsLeft);
}

export function handleRedraw() {
  if (redrawsLeft <= 0) return;
  triggerHaptic();
  redrawsLeft--;
  document.querySelectorAll(".letter-tile").forEach((t) => {
    if (!t.classList.contains("is-ghost"))
      letterBag.push({ letter: t.dataset.letter, points: parseInt(t.dataset.points, 10) });
    t.remove();
  });
  document.querySelectorAll(".grid-slot").forEach((s) => (s.innerHTML = ""));
  refillGrid();
  checkAnswerLength();
}

export function handleSubmitWord() {
  let word = "", basePoints = 0, bonusPoints = 0, placedTiles = [];
  ui.ui.answerArea.querySelectorAll(".answer-slot").forEach((s) => {
    const t = s.querySelector(".letter-tile");
    if (t) {
      placedTiles.push(t);
      word += t.dataset.letter;
      basePoints += parseInt(t.dataset.points, 10);
      if (cfg.bonusSlots[s.dataset.index]) bonusPoints += cfg.bonusSlots[s.dataset.index];
    }
  });

  if (word.length < cfg.MIN_WORD_LENGTH) return;
  triggerHaptic();
  updatePlays(-1);
  if (totalPlays < 0) { totalPlays = 0; return; }

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
      if (roundScore >= targetScore && currentRound < cfg.TOTAL_ROUNDS) startNewRound();
      else if (roundScore >= targetScore && currentRound >= cfg.TOTAL_ROUNDS) ui.showGameOverModal(true, currentRound, totalScore);
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
  if (!word.includes("*")) return wordList.has(word.toLowerCase());
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  for (let char of alphabet) {
    if (wordList.has(word.replace(/\*/g, char).toLowerCase())) return true;
  }
  return false;
}

function choosePowerup() {
  const powerupList = [
    { id: "redraw", text: "Gain 2 Redraws", apply: () => { redrawsLeft += 2; ui.updateRedrawBadge(redrawsLeft); }},
    { id: "wildcard", text: "Add a Wildcard (*) to the bag", apply: () => playerPowerups.wildcards++ },
    { id: "pointboost", text: "+1 to a random letter tile", apply: () => playerPowerups.pointBoosts.push(1) },
  ];
  ui.presentPowerupChoice(powerupList, (chosenOption) => {
      chosenOption.apply();
      resetBoardForNewRound();
  });
}