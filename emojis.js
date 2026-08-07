/* Emoji pool for Evie's addition game.
   Plain global array — loaded with <script src>, no fetch, no JSON.

   Curation rules, since these get rendered ten-at-a-time at large sizes:
   - one clear subject, readable at a glance and instantly countable
   - no ZWJ sequences or skin-tone modifiers (they render inconsistently)
   - nothing visually busy, ambiguous, or unsettling when repeated in a row
   Symbols whose default presentation is text (☀ ❤) carry an explicit
   variation selector so they render as emoji everywhere. */

var EMOJIS = [
  /* fruit + food */
  "🍎", "🍌", "🍓", "🍊", "🍐", "🍋", "🍑", "🍒",
  "🥕", "🍄", "🍪", "🧁", "🍩", "🥚", "🍕",

  /* animals */
  "🐱", "🐶", "🐷", "🐸", "🐝", "🦆", "🐟", "🐢",
  "🐰", "🐻", "🦋", "🐨", "🐼", "🐥", "🐧", "🐮",

  /* toys + things that go */
  "🧸", "🎈", "🎁", "⚽", "🏀", "🚗", "🚌", "🚂",
  "🚀", "⛵",

  /* sky + garden */
  "⭐", "🌙", "🌻", "🌷", "☀️", "❤️", "🍀"
];
