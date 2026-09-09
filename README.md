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
| Setup wizard and tutorials | shown once | skipped |

Because the two builds keep separate settings, the beta starts as a fresh phone: wallpaper, apps and preferences do
not carry over. It skips the first run setup wizard and the in app tutorials and drops you straight on the home
screen, since a tester reinstalls often. Tutorials can be turned back on under **Settings, Tutorials** if you want
to review one.

## The test server

Beta builds sign in to the Aethernet **test server**, which has its own accounts, messages and posts. Your stable
account is untouched, and nothing you post while testing reaches the live community.

To point a beta build at the live server instead, open **Settings, About** and turn **Test server** off. Switching
signs you out, so you sign in again on the other side.

## Reporting

Bugs and feedback belong in the main repository:
[FFXIV-Aetherphone issues](https://github.com/XeldarAlz/FFXIV-Aetherphone/issues). Please say which beta version you
are on (**Settings, About** shows it) so the report can be matched to a build.

## Licence

The plugin itself is AGPL-3.0-or-later. See the
[main repository](https://github.com/XeldarAlz/FFXIV-Aetherphone/blob/master/LICENSE.md) for the licence and notices.
