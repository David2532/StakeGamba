# Golden Goal Rush Generated Book Samples

This MVP does not overwrite `apps/lines/src/stories/data/*_books.ts`.

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
   - `library/books/bonus_books.jsonl`

3. Copy one book object into a temporary additive Storybook fixture only if needed.
   Do not replace or delete the existing mock book files.

Expected event types are:

- `reveal`
- `winInfo`
- `setWin`
- `setTotalWin`
- `freeSpinTrigger`
- `updateFreeSpin`
- `freeSpinEnd`
- `finalWin`
