# Evie Math

A simple browser-based addition game. Two groups of the same emoji are shown
alongside the sum in big numerals and spoken aloud, and the answer is typed on
the keyboard, to help with early counting and number recognition.

## Running it

No build step required. Just open `index.html` in a browser, or serve the folder
locally:

```
python3 -m http.server
```

Then visit `http://localhost:8000`.

Click the big button once to begin — browsers only allow sound and speech after
a tap or click, so the game needs that first gesture before it can talk.

## How to play

Type the answer on the number keys and press <kbd>Enter</kbd>. Only the digits,
<kbd>Backspace</kbd> and <kbd>Enter</kbd> do anything; every other key is
ignored. A wrong answer keeps the same sum on screen for another go.

Both addends are drawn flat at random from 0 to 10, so sums run 0 through 20 and
`10 + 10` comes up as often as anything else. There is no difficulty curve. The
pair, the emoji and the numeral face never repeat two problems running.

Each sum is set in one of three faces picked at random — a rounded display face,
a monospace coding face, and the handwriting script taught in Australian schools
— so the same digit is met in more than one shape.

## Files

- `index.html` — page structure
- `style.css` — styling
- `game.js` — game logic
- `emojis.js` — emoji pool
- `OFL.txt` — license for the three embedded fonts
