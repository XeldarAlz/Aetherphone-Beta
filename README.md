# Aetherphone Beta

The testing channel for [Aetherphone](https://github.com/XeldarAlz/FFXIV-Aetherphone). Every build here comes
straight off the plugin's `dev` branch, so it carries work that has not reached the stable release yet.

This repository holds no source code. It is the Dalamud repository that serves the beta builds, plus the workflow
that produces them.

## Install

1. In game, open **Dalamud Settings** (`/xlsettings`), go to **Experimental**, and add this URL to
   **Custom Plugin Repositories**:

   ```
   https://raw.githubusercontent.com/XeldarAlz/Aetherphone-Beta/main/repo.json
   ```

2. Save, then open the **Plugin Installer** and install **Aetherphone Beta**.

It installs next to the stable plugin instead of replacing it. Both can stay enabled at the same time.

| | Stable | Beta |
| --- | --- | --- |
| Plugin name | Aetherphone | Aetherphone Beta |
| Command | `/phone` | `/phonebeta` |
| Settings and data | its own | its own |
| Aethernet server | live | test server by default |

Because the two builds keep separate settings, the beta starts as a fresh phone: wallpaper, apps and preferences do
not carry over.

## The test server

Beta builds sign in to the Aethernet **test server**, which has its own accounts, messages and posts. Your stable
account is untouched, and nothing you post while testing reaches the live community.

To point a beta build at the live server instead, open **Settings, About** and turn **Test server** off. Switching
signs you out, so you sign in again on the other side.

## Reporting

Bugs and feedback belong in the main repository:
[FFXIV-Aetherphone issues](https://github.com/XeldarAlz/FFXIV-Aetherphone/issues). Please say which beta version you
are on (**Settings, About** shows it) so the report can be matched to a build.

## Publishing a build

Beta releases are cut by hand, so the channel only moves when `dev` is worth testing.

- From the **Actions** tab: run **Release Aetherphone Beta**, optionally with a branch, tag or commit other than
  `dev`.
- From a terminal: `gh workflow run beta-release.yml --repo XeldarAlz/Aetherphone-Beta -f ref=dev`

The workflow checks out the plugin source at that ref, builds it on the beta channel, publishes a prerelease with
`latest.zip`, and updates `repo.json` here so installed betas see the update. Version numbers are
`<stable major.minor.build>.<workflow run number>`, which keeps every beta strictly newer than the one before it.

Optional secrets: `BETA_WEBHOOK_URL` (Discord announcement) and `HUB_REPO_PAT` (only needed if `main` becomes a
protected branch). The announcement step is skipped when the webhook is not set.

## Licence

The plugin itself is AGPL-3.0-or-later. See the
[main repository](https://github.com/XeldarAlz/FFXIV-Aetherphone/blob/master/LICENSE.md) for the licence and notices.
