import {
  blockedAnswerSlots,
  currentGameLanguage,
  playerPowerups,
} from "./game.js";
import * as cfg from "./config.js";

function getTileInfoMap() {
  const tileInfo = {};
  const distribution = cfg.letterDistributions[currentGameLanguage];
  if (distribution) {
    for (const letter in distribution) {
      tileInfo[letter] = { points: distribution[letter].p };
    }
  }
  for (const lang in cfg.affixTiles) {
    cfg.affixTiles[lang].forEach((affix) => {
      tileInfo[affix.letters] = { points: affix.points };
    });
  }
  tileInfo["*"] = { points: 0 };
  return tileInfo;
}

export class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
  }
}

export class Trie {
  constructor() {
    this.root = new TrieNode();
  }
  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEndOfWord = true;
  }
  search(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        return false;
      }
      node = node.children[char];
    }
    return node != null && node.isEndOfWord;
  }
}

let dictionaryTrie = new Trie();

export function buildDictionaryTrie() {
  console.log("Building dictionary Trie from word list...");
  dictionaryTrie = new Trie(); // Reset the trie
  for (const word of wordList) {
    dictionaryTrie.insert(word);
  }
  console.log("Dictionary Trie built.");
}

function findBestWord(strategy) {
  const tileInfo = getTileInfoMap();
  const letterElements = document.querySelectorAll("#letter-grid .letter-tile");
  const tileCounts = {};
  letterElements.forEach((tile) => {
    const tileUpper = tile.dataset.letter;
    tileCounts[tileUpper] = (tileCounts[tileUpper] || 0) + 1;
  });

  let bestResult = strategy.initial;
  const maxTiles = cfg.ANSWER_SLOTS - blockedAnswerSlots.length;

  const findWordsRecursive = (
    node,
    path,
    tiles,
    baseScore,
    counts,
    tilesUsed,
  ) => {
    if (node.isEndOfWord && path.length >= cfg.MIN_WORD_LENGTH) {
      const result = strategy.evaluate(path, tiles, baseScore, tileInfo);
      if (strategy.isBetter(result, bestResult)) {
        bestResult = result;
      }
    }

    if (tilesUsed >= maxTiles) {
      return;
    }

    for (const tile in counts) {
      if (counts[tile] > 0) {
        counts[tile]--;
        const tileLower = tile.toLowerCase();
        if (tile === "*") {
          for (const char in node.children) {
            findWordsRecursive(
              node.children[char],
              path + char,
              tiles.concat(["*"]),
              baseScore,
              counts,
              tilesUsed + 1,
            );
          }
        } else {
          const tileLetters =
            playerPowerups.quUpgrade && tileLower === "q" ? "qu" : tileLower;
          let currentNode = node;
          let possible = true;
          for (const char of tileLetters) {
            if (currentNode.children[char]) {
              currentNode = currentNode.children[char];
            } else {
              possible = false;
              break;
            }
          }
          if (possible) {
            const newScore =
              baseScore + (tileInfo[tile] ? tileInfo[tile].points : 0);
            findWordsRecursive(
              currentNode,
              path + tileLetters,
              tiles.concat([tile]),
              newScore,
              counts,
              tilesUsed + 1,
            );
          }
        }
        counts[tile]++;
      }
    }
  };

  findWordsRecursive(dictionaryTrie.root, "", [], 0, tileCounts, 0);

  strategy.logResult(bestResult);
  return bestResult;
}

const longestWordStrategy = {
  initial: "",
  evaluate: (path, tiles, baseScore, tileInfo) => path,
  isBetter: (result, bestResult) => result.length > bestResult.length,
  logResult: (result) => {
    if (result) {
      console.log(`Longest word found that fits: ${result}`);
    } else {
      console.log(
        "No valid words could be formed from the current letters that fit in the answer area.",
      );
    }
  },
};

const highestScoreStrategy = {
  initial: { word: "", score: 0 },
  evaluate: (path, tiles, baseScore, tileInfo) => {
    let finalScore = baseScore;
    const wordLenInTiles = tiles.length;

    if (playerPowerups.positionalMultiplier) {
      const pos = playerPowerups.positionalMultiplier.position - 1;
      if (pos < wordLenInTiles) {
        const tileToBoost = tiles[pos];
        if (tileInfo[tileToBoost]) {
          finalScore +=
            (playerPowerups.positionalMultiplier.multiplier - 1) *
            tileInfo[tileToBoost].points;
        }
      }
    }

    for (let i = 0; i < wordLenInTiles; i++) {
      if (cfg.bonusSlots[i]) {
        finalScore += cfg.bonusSlots[i];
      }
    }
    return { word: path, score: finalScore };
  },
  isBetter: (result, bestResult) => result.score > bestResult.score,
  logResult: (result) => {
    if (result.word) {
      console.log(
        `Highest scoring word found: ${result.word} with ${result.score} points.`,
      );
    } else {
      console.log("No valid words could be formed.");
    }
  },
};

export function findLongestWord() {
  return findBestWord(longestWordStrategy);
}

export function findHighestScoringWord() {
  return findBestWord(highestScoreStrategy);
}
