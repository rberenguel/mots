# Testing Plan for Mots

This document outlines a plan for adding unit and integration tests to the Mots game using Mocha and Chai. The focus is on testing the core game logic, which is decoupled from the DOM, to ensure correctness and prevent regressions.

## 1. Test Environment Setup

- **Directory:** A `test/` directory will be created at the project root.
- **Test Runner:** A file named `test/test.html` will serve as the browser-based test runner. It will load:
  - Mocha CSS and JS
  - Chai JS
  - The game's JavaScript files (as ES6 modules).
  - The test spec files.
- **Test Specs:** Test files will be located in the `test/` directory, with a `*.test.js` naming convention.

## 2. Core Logic Testing: `js/searcher.js`

This file is the highest priority as it contains complex, pure logic that is critical to the game's functionality.

### 2.1. The `Trie` Class

The `Trie` data structure is fundamental for efficient word validation.

- **`Trie.insert(word)`**

  - **Test Case:** It should correctly add a new word to the trie.
  - **How:** Create a `Trie` instance, insert a word like "TEST", and internally inspect the `trie.root` children to ensure the path `T->E->S->T` exists and the final node has `isEndOfWord: true`.
  - **Test Case:** It should handle inserting multiple words, including words that are prefixes of others (e.g., "TEST" and "TESTER").
  - **How:** Insert "TEST" and "TESTER". Verify both paths exist and both final nodes are marked as end-of-word.

- **`Trie.search(word)`**
  - **Test Case:** It should return `true` for a word that exists in the trie.
  - **Test Case:** It should return `false` for a word that does not exist.
  - **Test Case:** It should return `false` for a prefix of an existing word that is not a word itself (e.g., search for "TES" when "TEST" is in the trie).
  - **Test Case:** It should handle empty strings and other edge cases gracefully.

### 2.2. Word Finding Algorithms

The functions `findLongestWord` and `findHighestScoringWord` depend on the DOM to get the available letters. This is a side effect that makes testing difficult.

**Proposed Refactoring:**

Modify the internal helper `findBestWord` to accept the list of available tiles as an argument, rather than querying the DOM.

```javascript
// From
function findBestWord(strategy) {
  const letterElements = document.querySelectorAll("#letter-grid .letter-tile");
  // ... logic to build tileCounts from DOM elements
  // ...
}

// To
function findBestWord(strategy, availableTiles) {
  // ... logic to build tileCounts from the availableTiles array
  // ...
}
```

This change decouples the search logic from the UI, allowing us to test it by simply passing an array of mock tile objects.

- **`findLongestWord(tiles)`**

  - **Test Case:** Given a set of tiles and a small dictionary, it finds the longest possible valid word.
  - **How:** Provide tiles like `['A', 'P', 'P', 'L', 'E']` and a dictionary containing "APPLE". Assert the result is "APPLE".
  - **Test Case:** It correctly utilizes a wildcard tile (`*`).
  - **How:** Provide tiles `['C', '*', 'T']` and a dictionary with "CAT". Assert the result is "CAT".
  - **Test Case:** It returns an empty string if no valid word of minimum length can be formed.
  - **How:** Provide tiles `['X', 'Y', 'Z']` and a dictionary without any valid combinations. Assert the result is `""`.
  - **Test Case:** It respects the `quUpgrade` power-up.
  - **How:** Activate the power-up, provide tiles `['Q', 'I', 'T']` and a dictionary with "QUIT". Assert the result is "QUIT".

- **`findHighestScoringWord(tiles)`**
  - **Test Case:** It finds the word with the highest score, which may not be the longest word.
  - **How:** Provide tiles where a shorter word has higher point values (e.g., `['J', 'A', 'B']` vs. `['A', 'T', 'E']`). Assert the higher-scoring word is returned.
  - **Test Case:** It correctly applies positional score multipliers.
  - **How:** Activate a positional multiplier (e.g., 3x on position 1), provide tiles, and assert the final score calculation is correct.
  - **Test Case:** It correctly adds points from bonus slots.
  - **How:** Mock the `cfg.bonusSlots` configuration and assert the final score includes the bonus points.

## 3. Game Logic Testing: `js/game.js`

This file manages the game state. We will focus on functions that can be tested without heavy mocking of the UI (`ui.js`).

- **`isWordValid(word)`**

  - **Dependencies:** This function relies on the global `wordList` Set.
  - **How to Test:** In the test setup, we will create a small, controlled `wordList` for predictable results.
  - **Test Cases:**
    1.  Returns `true` for a valid word in the `wordList`.
    2.  Returns `false` for an invalid word.
    3.  Correctly validates a word with a wildcard (`*`), finding a match in the `wordList` (e.g., "C\*T" becomes "CAT").
    4.  Returns `false` for a word with a wildcard that cannot be resolved to any valid word.
    5.  Handles language-specific rules like accent stripping (e.g., for French, `isWordValid("élève")` should work if the dictionary contains `eleve`).

- **`getAvailablePowerups()`**

  - **Dependencies:** Relies on global game state (`currentRound`, `playerPowerups`).
  - **How to Test:** Before each test, set the global state variables to simulate different scenarios.
  - **Test Cases:**
    1.  On round 1, it returns the default set of power-ups.
    2.  When `playerPowerups.autoRefill` is `true`, the "Auto-Refill Bag" option is no longer offered.
    3.  When `cfg.BLACK_TILES_PER_ROUND` indicates black tiles are in the bag, the "Remove Black Tile" option is offered.
    4.  When a language with affixes is selected (e.g., Spanish), affix-related power-ups are included in the list.

- **State Logic (`startGame`, `startNewRound`)**
  - **Challenge:** These functions are complex and have many UI-related side effects.
  - **How to Test:** We will not test them end-to-end. Instead, we will test specific, verifiable outcomes.
  - **Test Cases:**
    1.  `startGame()`: Assert that `totalScore`, `currentRound`, and `redrawsLeft` are reset to their initial values.
    2.  `startNewRound()`: Assert that `targetScore` is calculated correctly based on the `currentRound`.
    3.  `startNewRound()`: Assert that the `blockedAnswerSlots` array is populated correctly according to the round's configuration in `cfg.BLOCKED_SLOTS_PER_ROUND`.
