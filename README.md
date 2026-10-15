# Aetherphone Beta

The testing channel for [Aetherphone](https://github.com/XeldarAlz/FFXIV-Aetherphone). Every build here comes
straight off the plugin's `dev` branch, so it carries work that has not reached the stable release yet.

This repository holds no source code. It is the Dalamud repository that serves the beta builds, plus the workflow
that produces them.

## Install

1. In game, open **Dalamud Settings** (`/xlsettings`), go to **Experimental**, and add this URL to
   **Custom Plugin Repositories**:

   ```
   https://aetherphone.net/beta/repo.json
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

## Version numbers

A beta carries the version it previews plus its build number in the last part: **1.3.1.3** is beta 3 of 1.3.1.0,
and **1.3.0.102** is beta 2 of 1.3.0.1. **Settings, About** spells it out as "1.3.1.0 beta 3". The number always goes
up, so Dalamud offers every new beta as an update.

## Reporting

Bugs and feedback belong in the main repository:
[FFXIV-Aetherphone issues](https://github.com/XeldarAlz/FFXIV-Aetherphone/issues). Please say which beta version you
are on (**Settings, About** shows it) so the report can be matched to a build.

## For maintainers

`beta-release.yml` builds a beta from a plugin ref, publishes it and records it in `builds.json`. It refuses to build
when the newest changelog entry has already shipped, because a beta always previews an unreleased version.

After every build, `qa-handoff.yml` hands it to the testers: it makes sure the version has a Drive folder with one QA
sheet (Tests and Feedback tabs, copied from a template by the Apps Script web app in `apps-script/`), adds test items
for what changed to the bottom of the Tests tab, and opens or replies to the version's post in the staff server's
beta forum. Claude Code writes the test items when `CLAUDE_CODE_OAUTH_TOKEN` is set; without it, or when it fails,
every new changelog bullet becomes one item. Run it by hand with mode `check` to test the connections, with a tag to
retry a build, or with mode `refresh` and the newest tag to redraw a post's first message without adding anything.

Secrets: `DISCORD_BOT_TOKEN`, `DISCORD_BETA_FORUM_ID`, `DISCORD_TESTER_ROLE_ID`, `QA_DRIVE_URL`, `QA_DRIVE_SECRET`
and optionally `CLAUDE_CODE_OAUTH_TOKEN`. The web app runs as the owner of the beta folder and reads the folder and
template ids and the shared secret from its script properties.

## Licence

The plugin itself is AGPL-3.0-or-later. See the
[main repository](https://github.com/XeldarAlz/FFXIV-Aetherphone/blob/master/LICENSE.md) for the licence and notices.
