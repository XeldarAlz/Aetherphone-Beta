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

- `area`: one of `areas`, exactly as written there (see "Choosing the area").
- `test`: the steps, then `Expect:` and the one result the tester should see (see "Writing a test").
- `needs`: anything from `needs` the test requires (a second player, gil, a housing venue). Empty when nothing
  special is needed.
- `source`: the changelog key (for example `changelog.r1310.4`) or the short commit hash the item comes from.

## Writing a test

Every test must be precise, understandable and true.

**True.** Before you write an item, find the code behind the change and read it. Every step must exist in the build
and every `Expect:` must be what this code actually does, not what the changelog wording suggests. Quote on-screen
text (button labels, titles, confirmation messages) only after you found it in
`src/Aetherphone/Core/Localization/L.cs` (the second string of each `new("key", "text")`), and quote it exactly.
When you could not confirm the exact text, describe it instead of quoting it.

**Precise.**
- Give the full path to the place being tested, with the names the phone shows: `Open Settings > General > Server info
  bar`, not "open the settings".
- Use concrete values where the change has them: `set Auto-advance posts to 3 seconds`, not "pick a time".
- State the starting condition when it matters: signed out, hosting a room, a folder with at least two apps.
- Exactly one `Expect:` per item, describing one observable result. A change with several behaviors becomes several
  items.
- The result must be something a tester can see or do. "Draws three times faster" is not visible; "scrolling stays
  smooth with no blank rows" is.

**Understandable.**
- Plain English for players, not developers. No words like render, frame, draw call, state, handler or callback.
- Short sentences. Steps first, then `Expect:`. At most three sentences before `Expect:`.
- The test must be doable in a normal play session. If it needs something special (another player, a job close to a
  level up, a fresh install), say how to get it or list it in `needs`. Never ask for anything only a developer can
  do.

Example: `Open Gamba, host a blackjack table and wait for a second player to sit down. Press Pause during a round.
Expect: the round stops for both players and a Resume button appears.`

## Choosing the area

Pick the app or part of the phone the tester opens to run the test, from `areas`:

- Direct messages, friend chats and phone calls are ChocoChat. In-game chat (tells, linkshells, free company, party)
  is Linkpearl.
- The Home Screen, folders, the dock and anything that belongs to the phone itself rather than one app is Home and
  phone.
- When one change touches several apps, write the item for one app where it is easy to see and use that app's area.
- Use Other only when no area fits at all.

## Which items to write

- When `firstBuildOfVersion` is true, cover every changelog bullet a player can see in this version: each such
  bullet needs at least one item whose `source` is its key. Skip only pure credits and wording with nothing to try.
- Otherwise write items only for what changed since the previous beta: bullets whose `change` is `new` or `changed`,
  and commits in `commitsSincePreviousBeta` that change what a player sees. A fix becomes an item that checks the
  bug is gone. Use `git show <hash>` to understand a commit before writing about it.
- Skip refactors, documentation, CI, tests, translations and performance work nobody can see.
- Never repeat something already covered in `existingTestItems`.
- Stay within `maxItems`. When there is more to cover than that, keep the items most likely to find a bug.

## Style

- No em dashes or en dashes; use commas, colons or parentheses.
- Use the names the phone shows: MogCast (not AetherStream), Activity (not MyCharacter), Gamba (not Casino).
- Do not mention code, files, classes or commit hashes in `test` or `summary`.

## Context

```json
{{CONTEXT}}
```
