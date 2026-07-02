# Golden Goal Rush Generated Book Samples

This package does not overwrite frontend story fixtures.

To inspect generated books manually:

1. Generate debug or publish books:

   ```powershell
   cd math/games/golden_goal_rush
   python run.py debug --spins 3 --seed 1
   python run.py publish --spins 10 --bonus-spins 3 --seed 1
   ```

2. Open the generated JSONL:

   - `library/books/debug_base_books.jsonl`
   - `library/books/base_books.jsonl`
   - `library/books/hunt_books.jsonl`
   - `library/books/rainbow_books.jsonl`
   - `library/books/bonus_tier1_books.jsonl`
   - `library/books/bonus_books.jsonl`

3. Copy one book object into a temporary additive Storybook fixture only if needed.
   Do not replace or delete the existing mock book files.

Expected event types are:

- `reveal`
- `winInfo`
- `setWin`
- `setTotalWin`
- `tumbleBoard`
- `goldenReveal`
- `goldenAward`
- `goldenClear`
- `freeSpinTrigger`
- `updateFreeSpin`
- `freeSpinEnd`
- `finalWin`
