# Mots

Got inspired by [Boggle](https://en.wikipedia.org/wiki/Boggle), [Mark Brown's](https://gamemakerstoolkit.com/) fantastic game, [Word Play](https://store.steampowered.com/app/3586660/Word_Play/), threw together a mash-up with Scrabble's point system, and common English letter frequencies.

`Mots` is designed to be a quick game you can pick up, play for 5 minutes, and put down—ideal for short daily pauses. Or for binging, but I tried to keep it a light game where you don't need to plan much ahead.

I highly recommend you wishlist and buy Mark's game on Steam once available; it's good stuff!

Gemini did a lot of the heavy lifting here at the beginning.

The following languages are currently supported (the quality of the word dictionaries varies among them):

- English
- German
- French
- Spanish
- Catalan
- Italian

## How to Play

The core gameplay loop is simple but challenging:

- The game consists of infinite rounds, each requiring more points to pass than the last. How far can you go?
- The letter bag starts with some black, unusable tiles, and more are added with each round. For now, they eventually stop. For now.
- You begin with 10 plays (word submissions) and gain 4 extra plays after every round.
- Submitted words must be at least 4 letters long.
- After successfully completing a round, you get to choose one of two power-ups to help you in the subsequent rounds.
- Sometimes the last positions of the answer section will not be usable. Life is hard, this game eventually is too.
- Tapping on the last answer tile (if no letter is present) removes all letters from the answer row.
- If there are scattered letters with spaces in the answer, tapping on any empty space in-between compacts the spaces.
- If you are curious about what you missed on the last board, open the menu after you submit your word.

I plan on adding a couple more modifiers, but this will not change much more.

> INFO
> This is initially designed for mobile (in particular, _my_ mobile phone). If you see any rendering artifacts, let me know.
> It seems to work well on desktop, I recommend using Chrome just in case since it is where I test it.

## Controls

The game can be controlled via mouse/touch or with the following keyboard shortcuts:

| Key(s)                  | Action                                          |
| :---------------------- | :---------------------------------------------- |
| `A`-`Z`                 | Type a letter to place it in the answer area.   |
| `Backspace`             | Remove the last letter from your answer.        |
| `Enter`                 | Submit the current word for scoring.            |
| `Tab`                   | Shuffle the letters on the grid.                |
| `Ctrl`+`R` or `Cmd`+`R` | Redraw your hand with new letters from the bag. |
