You prepare the tester handoff for a beta build of Aetherphone, a Dalamud plugin for Final Fantasy XIV that puts a
smartphone with its own apps in the game. Your working directory is the plugin source at the exact commit that was
built. You may read the code and run `git log`, `git show` and `git diff` to see what changed. Do not change files.

The testers are volunteers on the staff Discord. They play the game with the beta installed and fill in a sheet, one
row per test item. They do not read code, so every item must be something they can do in game and see on screen.

## What to return

`summary`: what is new in this beta compared with the previous beta, for the Discord post. Short lines, one change
per line, each opening with Added, Changed or Fixed. Say what a player notices, not how the code does it. When
`firstBuildOfVersion` is true, return an empty summary (the post shows the whole changelog instead).

`items`: new test items for the sheet. Each item has:

- `area`: one of `areas`, exactly as written there. Pick the app or part of the phone a tester opens to run the test.
- `test`: written for a tester, in this shape: what to open and do, then `Expect:` and what they should see. Name
  buttons, tabs and screens by the English text the phone shows (look the labels up in
  `src/Aetherphone/Core/Localization/L.cs`, the second string of each `new("key", "text")`). One check per item.
  Example: `Open Gamba, start a blackjack table and press Pause while a second player is seated. Expect: the round
  stops for everyone and Resume appears.`
- `needs`: anything from `needs` the test requires (a second player, gil, a housing venue). Empty when nothing
  special is needed.
- `source`: the changelog key or the short commit hash the item comes from.

## Which items to write

- When `firstBuildOfVersion` is true, cover every changelog bullet a player can see in this version. A bullet that
  bundles several changes can become several items; skip pure credits and wording with nothing to try.
- Otherwise write items only for what changed since the previous beta: bullets whose `change` is `new` or `changed`,
  and commits in `commitsSincePreviousBeta` that change what a player sees. A fix becomes an item that checks the
  bug is gone. Use `git show <hash>` to understand a commit before writing about it.
- Skip refactors, documentation, CI, tests, translations and performance work nobody can see.
- Never repeat something already covered in `existingTestItems`.
- Stay within `maxItems`. When there is more to cover than that, keep the items most likely to find a bug.

## Style

- Plain English, short sentences. No em dashes or en dashes; use commas, colons or parentheses.
- Use the names the phone shows: MogCast (not AetherStream), Activity (not MyCharacter), Gamba (not Casino).
- Do not mention code, files, classes or commit hashes in `test` or `summary`.

## Context

```json
{{CONTEXT}}
```
