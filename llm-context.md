# Word Game Prototype Summary

## 1. Project Overview

This project is a web-based, single-player word game built with vanilla HTML, CSS, and JavaScript. The game challenges players to form words from a random set of letters to meet score targets across multiple rounds. It features a clean, developer-focused "Solarized" dark theme and includes a persistent power-up system that adds a layer of strategy to the gameplay.

## 2. Core Gameplay Mechanics

* **Rounds & Scoring:**
  * The game consists of 10 rounds with progressively higher score targets.
  * The score displayed at the top is the player's progress for the *current round* against the target (e.g., `120 / 150`).
  * Players start with 10 "plays" (word submissions) and gain 4 more after each successfully completed round.
  * The game ends if the player runs out of plays.

* **Letter & Word Rules:**
  * The game uses a standard English letter distribution and point system, similar to Scrabble.
  * Players have a 16-tile (4x4) grid of letters to draw from.
  * The answer area accommodates words up to 10 letters long.
  * Submitted words must be at least **4 letters long** to be valid.
  * Bonus points are awarded for letters placed in specific slots:
    * **+5 points:** Positions 5 through 8.
    * **+10 points:** Position 9.
    * **+20 points:** Position 10.

* **Player Interaction:**
  * **Drag & Drop:** Players can drag letters from the draw grid to any slot in the answer area. If a slot is occupied, the letters are swapped.
  * **Click to Place:** Clicking a letter in the draw grid automatically moves it to the first available answer slot.
  * **Click to Return:** Clicking a letter in the answer area returns it to the draw grid.

## 3. Power-ups & Special Tiles

* **Power-up Choice:** After completing each round (from round 2 onwards), the player is presented with a choice between two randomly selected power-ups.

* **Current Power-ups:**
  1. **Gain 2 Redraws:** Adds 2 to the limited count of hand redraws.
  2. **Add a Wildcard `*`:** Adds one permanent wildcard tile to the letter bag for all subsequent rounds.
  3. **+1 Point Boost:** Permanently increases the point value of one random tile in the letter bag.

* **Wildcard (`*`) Tile:**
  * Appears as a star icon (`<i class="iconoir-star-solid"></i>`).
  * Can be used to represent any letter from 'A' to 'Z'.
  * The validation logic checks all possible letter substitutions to find a valid word.
  * Scores 0 points.

## 4. UI & Visual Design

* **Theme:** The game uses a **Solarized Dark** color palette. The background and UI containers are dark (`base03`, `base02`), while the letter tiles are light (`base3`) to create contrast.

* **Icons:** All icons are from the **Iconoir** library for a clean, consistent look.
  * **Submit:** Green `iconoir-upload`.
  * **Shuffle:** Orange `iconoir-shuffle`.
  * **Redraw:** Cyan `iconoir-refresh`.
  * **Help:** Violet `iconoir-question-mark`.

* **Animations:**
  * **Shuffle:** Tiles visually and smoothly translate from their old positions to new ones.
  * **Feedback:** Submitted words flash green for valid and red for invalid.
  * **Bouncing:** New tiles "bounce" into place when they appear on the grid.
  * **Low Plays:** The plays counter "beats" like a heart when the count is 3 or less.

* **Layout:**
  * The UI is minimalist, with text labels removed in favor of icons and intuitive displays.
  * The 4x4 draw grid is a perfect, centered square (`aspect-square`).

## 5. Technical Structure (Current)

The entire project is self-contained within a **single HTML file**.

* **HTML (`<body>`):** Defines the semantic structure of the game, including containers for the top bar, letter grid, controls, and answer area, as well as modals for power-ups, help, and game-over states.

* **CSS (`<style>`):**
  * Defines the Solarized color palette using CSS variables.
  * Styles all elements, from the layout containers to the letter tiles and buttons.
  * Contains all `@keyframes` for animations (bouncing, flashing, beating heart).

* **JavaScript (`<script>`):**
  * Contains all game logic.
  * Manages the game state (scores, rounds, plays, power-ups).
  * Handles all DOM manipulation and event listeners (drag/drop, click).
  * Fetches and processes the word list for validation.