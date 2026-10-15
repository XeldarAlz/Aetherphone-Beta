import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DiscordApiBaseUrl = process.env.DISCORD_API_BASE_URL ?? "https://discord.com/api/v10";
const UserAgent = "Aetherphone beta handoff (https://github.com/XeldarAlz/Aetherphone-Beta)";
const DiscordTimeoutMilliseconds = 20000;
const DriveTimeoutMilliseconds = 120000;
const RateLimitAttempts = 4;
const ForumChannelType = 15;
const ArchivedThreadPageLimit = 100;
const ArchivedThreadPageCap = 10;
const MessageHistoryLimit = 100;
const EmbedDescriptionLimit = 3900;
const MessageContentLimit = 1900;
const EmbedColor = 0x2dd4bf;
const FirstBuildItemLimit = 40;
const LaterBuildItemLimit = 12;
const SummaryLineLimit = 10;
const CommitLineLimit = 12;
const TestTextLimit = 600;
const ManifestUrl = "https://aetherphone.net/beta/repo.json";
const BotAuthors = new Set(["github-actions[bot]", "dependabot[bot]"]);
const SnowflakePattern = /\d{15,}/g;
const MentionTokenPattern = /<@&?\d+>/g;
const DriveLinkPattern = /https:\/\/(?:docs|drive)\.google\.com\/\S+/g;
const DashPattern = new RegExp(`\\s*[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]\\s*`, "g");
const ConventionalSubjectPattern = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;
const CreditPattern = /,\s*contributed by [^,]+$/i;
const VisibleCommitTypes = new Set(["feat", "fix", "perf"]);
const ChangelogDataPath = "src/Aetherphone/Core/Changelog/ChangelogData.cs";
const LocalizationPath = "src/Aetherphone/Core/Localization/L.cs";
const QuotedPattern = '"((?:[^"\\\\]|\\\\.)*)"';
const TagNames = Object.freeze({ testing: "testing", released: "released" });
const FallbackArea = "Other";
const SectionAreaAliases = Object.freeze({
    "phone": "Home and phone",
    "messaging": "ChocoChat",
    "chirper and aethergram": "Chirper",
    "chirper, aethergram and velvet": "Chirper",
    "aether coin": "Coins and badges",
    "halloween": "Seasonal events",
    "clock": "Utilities",
    "mogcast": "AetherStream",
});

function readConfig() {
    return {
        command: process.argv[2] ?? "",
        mode: (process.env.QA_MODE ?? "run").trim().toLowerCase(),
        ping: (process.env.QA_PING ?? "true").trim().toLowerCase() === "true",
        tag: (process.env.BUILD_TAG ?? "").trim(),
        betaDirectory: process.env.BETA_DIR ?? "beta",
        pluginDirectory: process.env.PLUGIN_DIR ?? "plugin",
        workDirectory: process.env.WORK_DIR ?? "qa",
        sourceRepository: process.env.SOURCE_REPOSITORY ?? "XeldarAlz/FFXIV-Aetherphone",
        betaRepository: process.env.GITHUB_REPOSITORY ?? "XeldarAlz/Aetherphone-Beta",
        discordToken: (process.env.DISCORD_BOT_TOKEN ?? "").trim(),
        forumChannelId: (process.env.DISCORD_BETA_FORUM_ID ?? "").trim(),
        testerRoleId: (process.env.DISCORD_TESTER_ROLE_ID ?? "").trim(),
        driveUrl: (process.env.QA_DRIVE_URL ?? "").trim(),
        driveSecret: (process.env.QA_DRIVE_SECRET ?? "").trim(),
    };
}

// The logs of this repository are public, so ids, mentions and Drive links never reach stdout.
function redact(text) {
    return String(text).replace(MentionTokenPattern, "@...").replace(SnowflakePattern, "<id>").replace(DriveLinkPattern, "<drive link>");
}

function log(message) {
    console.log(redact(message));
}

function warn(message) {
    console.log(`::warning::${redact(message)}`);
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function setOutput(name, value) {
    if (process.env.GITHUB_OUTPUT === undefined) {
        return;
    }
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function readJson(path, fallback) {
    if (!existsSync(path)) {
        return fallback;
    }
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function scrubText(text) {
    return String(text ?? "").replace(/\r/g, "").replace(DashPattern, ", ").trim();
}

function truncate(text, limit) {
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, limit - 3).trimEnd()}...`;
}

function capitalize(text) {
    return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

function unixSeconds(isoTimestamp) {
    const milliseconds = Date.parse(isoTimestamp);
    return Number.isNaN(milliseconds) ? Math.floor(Date.now() / 1000) : Math.floor(milliseconds / 1000);
}

function git(config, args) {
    return execFileSync("git", ["-C", config.pluginDirectory, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function showFile(config, sha, path) {
    try {
        return git(config, ["show", `${sha}:${path}`]);
    } catch {
        return null;
    }
}

function unescapeCSharp(raw) {
    try {
        return JSON.parse(`"${raw}"`);
    } catch {
        return raw.replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
    }
}

function classBody(source, className) {
    const match = new RegExp(`^    internal static class ${className}\\s*\\r?\\n    \\{([\\s\\S]*?)\\r?\\n    \\}`, "m").exec(source);
    return match === null ? "" : match[1];
}

function sourceText(body, memberName) {
    const match = new RegExp(`LocString\\s+${memberName}\\s*=\\s*new\\(\\s*${QuotedPattern}\\s*,\\s*${QuotedPattern}\\s*\\)`).exec(body);
    return match === null ? memberName : unescapeCSharp(match[2]);
}

function bulletsOf(body, memberName) {
    const match = new RegExp(`LocString\\[\\]\\s+${memberName}\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(body);
    if (match === null) {
        return [];
    }
    const bullets = [];
    for (const item of match[1].matchAll(new RegExp(`new\\(\\s*${QuotedPattern}\\s*,\\s*${QuotedPattern}\\s*\\)`, "g"))) {
        bullets.push({ key: item[1], text: unescapeCSharp(item[2]) });
    }
    return bullets;
}

function newestChangelog(config, sha) {
    const changelogData = showFile(config, sha, ChangelogDataPath);
    const localization = showFile(config, sha, LocalizationPath);
    if (changelogData === null || localization === null) {
        return null;
    }
    const entry = /new ChangelogEntry\(\s*"([^"]+)"\s*,\s*"[^"]*"\s*,\s*(?:L\.Changelog\.(\w+)\)|new ChangelogSection\[\]\s*\{([\s\S]*?)\}\))/.exec(changelogData);
    if (entry === null) {
        return null;
    }
    const classBodies = new Map();
    const bodyOf = className => {
        if (!classBodies.has(className)) {
            classBodies.set(className, classBody(localization, className));
        }
        return classBodies.get(className);
    };
    const sections = [];
    if (entry[2] !== undefined) {
        sections.push({ title: "", bullets: bulletsOf(bodyOf("Changelog"), entry[2]) });
    } else {
        for (const section of entry[3].matchAll(/new\(\s*L\.(\w+)\.(\w+)\s*,\s*L\.Changelog\.(\w+)\s*\)/g)) {
            sections.push({ title: sourceText(bodyOf(section[1]), section[2]), bullets: bulletsOf(bodyOf("Changelog"), section[3]) });
        }
    }
    return { version: entry[1], sections: sections.filter(section => section.bullets.length > 0) };
}

function markBulletChanges(current, previous) {
    const previousTexts = new Set();
    const previousByKey = new Map();
    for (const section of previous?.sections ?? []) {
        for (const bullet of section.bullets) {
            previousTexts.add(bullet.text);
            previousByKey.set(bullet.key, bullet.text);
        }
    }
    for (const section of current.sections) {
        for (const bullet of section.bullets) {
            if (previousTexts.has(bullet.text)) {
                bullet.change = "unchanged";
                continue;
            }
            bullet.change = previousByKey.has(bullet.key) ? "changed" : "new";
        }
    }
}

function commitsBetween(config, previousSha, sha) {
    if (previousSha.length === 0) {
        return [];
    }
    let history;
    try {
        history = git(config, ["log", "--no-merges", "--format=%h%x1f%an%x1f%s", `${previousSha}..${sha}`]);
    } catch {
        warn("The previous beta's commit is not in the plugin history; skipping the commit list.");
        return [];
    }
    const commits = [];
    for (const line of history.split("\n")) {
        const [hash, author, subject] = line.split("\x1f");
        if (subject === undefined || BotAuthors.has(author)) {
            continue;
        }
        commits.push({ hash, subject: scrubText(subject) });
    }
    return commits;
}

function shippedVersions(config) {
    const output = execFileSync("git", ["ls-remote", "--tags", `https://github.com/${config.sourceRepository}.git`, "refs/tags/v*"], { encoding: "utf8" });
    const versions = new Set();
    for (const line of output.split("\n")) {
        const match = /refs\/tags\/v([0-9.]+)$/.exec(line.trim());
        if (match !== null) {
            versions.add(match[1]);
        }
    }
    return versions;
}

function loadBuild(config) {
    const builds = readJson(join(config.betaDirectory, "builds.json"), []);
    const index = builds.findIndex(record => record.Tag === config.tag);
    if (index < 0) {
        throw new Error(`Tag ${config.tag} is not in builds.json; only builds made after the handoff landed can be handed off.`);
    }
    const record = builds[index];
    const previous = index > 0 ? builds[index - 1] : null;
    let newestOfVersion = true;
    for (let laterIndex = index + 1; laterIndex < builds.length; laterIndex++) {
        if (builds[laterIndex].ChangelogVersion === record.ChangelogVersion) {
            newestOfVersion = false;
        }
    }
    let previousOfVersion = null;
    for (let earlierIndex = index - 1; earlierIndex >= 0; earlierIndex--) {
        if (builds[earlierIndex].ChangelogVersion === record.ChangelogVersion) {
            previousOfVersion = builds[earlierIndex];
            break;
        }
    }
    return { record, previous, previousOfVersion, newestOfVersion };
}

async function driveRequest(config, action, payload) {
    const response = await fetch(config.driveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UserAgent },
        body: JSON.stringify({ ...payload, action, secret: config.driveSecret }),
        redirect: "follow",
        signal: AbortSignal.timeout(DriveTimeoutMilliseconds),
    });
    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch {
        throw new Error(`Drive ${action} answered ${response.status} with something that is not JSON (is the web app deployed for anyone?).`);
    }
    if (result.ok !== true) {
        throw new Error(`Drive ${action} failed: ${result.error ?? "no reason given"}`);
    }
    return result;
}

async function discordRequest(config, method, path, body) {
    for (let attempt = 0; attempt < RateLimitAttempts; attempt++) {
        const response = await fetch(`${DiscordApiBaseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bot ${config.discordToken}`,
                "Content-Type": "application/json",
                "User-Agent": UserAgent,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(DiscordTimeoutMilliseconds),
        });
        if (response.status === 429) {
            const payload = await response.json().catch(() => ({}));
            const retryAfterSeconds = Number(payload.retry_after ?? response.headers.get("retry-after") ?? 1);
            await sleep(retryAfterSeconds * 1000 + 250);
            continue;
        }
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`Discord ${method} ${path} failed with ${response.status}: ${text.slice(0, 300)}`);
        }
        return text.length === 0 ? null : JSON.parse(text);
    }
    throw new Error(`Discord ${method} ${path} stayed rate limited after ${RateLimitAttempts} attempts.`);
}

function hasDiscord(config) {
    return config.discordToken.length > 0 && config.forumChannelId.length > 0;
}

function hasDrive(config) {
    return config.driveUrl.length > 0 && config.driveSecret.length > 0;
}

async function loadForum(config) {
    const channel = await discordRequest(config, "GET", `/channels/${config.forumChannelId}`);
    if (channel.type !== ForumChannelType) {
        throw new Error("DISCORD_BETA_FORUM_ID does not point at a forum channel.");
    }
    const tagIds = {};
    for (const tag of channel.available_tags ?? []) {
        const name = tag.name.trim().toLowerCase();
        if (name === TagNames.testing) {
            tagIds.testing = tag.id;
        }
        if (name === TagNames.released) {
            tagIds.released = tag.id;
        }
    }
    if (tagIds.testing === undefined || tagIds.released === undefined) {
        warn("The beta forum is missing its Testing or Released tag; posts go out untagged until both exist.");
    }
    const bot = await discordRequest(config, "GET", "/users/@me");
    return { guildId: channel.guild_id, tagIds, botId: bot.id };
}

async function forumThreads(config, forum) {
    const threads = new Map();
    const active = await discordRequest(config, "GET", `/guilds/${forum.guildId}/threads/active`);
    for (const thread of active.threads ?? []) {
        if (thread.parent_id === config.forumChannelId) {
            threads.set(thread.id, thread);
        }
    }
    let before = "";
    for (let page = 0; page < ArchivedThreadPageCap; page++) {
        const query = before.length === 0 ? `?limit=${ArchivedThreadPageLimit}` : `?limit=${ArchivedThreadPageLimit}&before=${encodeURIComponent(before)}`;
        const archived = await discordRequest(config, "GET", `/channels/${config.forumChannelId}/threads/archived/public${query}`);
        const pageThreads = archived.threads ?? [];
        for (const thread of pageThreads) {
            threads.set(thread.id, thread);
        }
        if (!archived.has_more || pageThreads.length === 0) {
            break;
        }
        before = pageThreads[pageThreads.length - 1].thread_metadata?.archive_timestamp ?? "";
        if (before.length === 0) {
            break;
        }
    }
    return [...threads.values()];
}

function threadName(version) {
    return `Beta ${version}`;
}

function oldestThread(threads) {
    let oldest = null;
    for (const thread of threads) {
        if (oldest === null || BigInt(thread.id) < BigInt(oldest.id)) {
            oldest = thread;
        }
    }
    return oldest;
}

function buildMarker(betaVersion) {
    return `build ${betaVersion}`;
}

function footer(betaVersion) {
    return { text: `Aetherphone Beta · ${buildMarker(betaVersion)}` };
}

function sectionLines(sections, changes) {
    const blocks = [];
    for (const section of sections) {
        const bullets = section.bullets.filter(bullet => changes === null || changes.has(bullet.change));
        if (bullets.length === 0) {
            continue;
        }
        const lines = bullets.map(bullet => `• ${scrubText(bullet.text)}`);
        blocks.push(section.title.length === 0 ? lines.join("\n") : `**${scrubText(section.title)}**\n${lines.join("\n")}`);
    }
    return blocks;
}

function paginate(blocks, limit) {
    const pages = [];
    let current = "";
    for (const block of blocks) {
        const candidate = current.length === 0 ? block : `${current}\n\n${block}`;
        if (candidate.length <= limit) {
            current = candidate;
            continue;
        }
        if (current.length > 0) {
            pages.push(current);
        }
        current = truncate(block, limit);
    }
    if (current.length > 0) {
        pages.push(current);
    }
    return pages;
}

function commitLine(commit) {
    const match = ConventionalSubjectPattern.exec(commit.subject);
    if (match === null) {
        return `• ${capitalize(commit.subject)}`;
    }
    const scope = match[2] === undefined ? "" : `**${match[2]}** `;
    const prefix = match[1] === "fix" ? "Fixed: " : "";
    return `• ${scope}${prefix}${match[3]}`;
}

function visibleCommits(commits) {
    return commits.filter(commit => {
        const match = ConventionalSubjectPattern.exec(commit.subject);
        return match === null || VisibleCommitTypes.has(match[1]);
    });
}

function sheetSummaryLine(state) {
    const summary = state.sheet?.summary;
    if (summary === undefined) {
        return "";
    }
    const parts = [`${summary.items} items`, `${summary.notRun} not run`];
    if (Number(summary.noGo) > 0) {
        parts.push(`${summary.noGo} NO-GO`);
    }
    if (Number(summary.recheck) > 0) {
        parts.push(`${summary.recheck} to recheck`);
    }
    return parts.join(", ");
}

function starterEmbed(state) {
    const build = state.build;
    const lines = [
        `**Current build:** beta ${build.number} (\`${build.version}\`) from \`dev@${build.shortSha}\`, <t:${unixSeconds(build.builtAt)}:R>`,
    ];
    if (state.drive !== null) {
        lines.push("");
        const summary = sheetSummaryLine(state);
        lines.push(`**QA sheet:** [${state.drive.testingName}](${state.drive.testingUrl})${summary.length === 0 ? "" : ` · ${summary}`}`);
        lines.push(`**Folder:** [${state.drive.folderName}](${state.drive.folderUrl})`);
        lines.push("");
        lines.push("Run the tests in the **Tests** tab and mark your results there. Bugs and ideas outside a test go in the **Feedback** tab. Questions are welcome here.");
    }
    lines.push("");
    lines.push(`**Get it:** already on the beta? Dalamud offers the update on its own. New here? Add \`${ManifestUrl}\` under Dalamud Settings, Experimental, then install **Aetherphone Beta**. Settings, About shows which beta you are on.`);
    return {
        title: threadName(state.version),
        url: `https://github.com/${state.betaRepository}/releases/tag/${build.tag}`,
        description: lines.join("\n"),
        color: EmbedColor,
        footer: footer(build.version),
    };
}

function whatsNewLines(state) {
    const lines = [];
    const summary = state.claude?.summary ?? [];
    if (summary.length > 0) {
        for (const line of summary.slice(0, SummaryLineLimit)) {
            lines.push(`• ${scrubText(line)}`);
        }
        return lines;
    }
    for (const block of sectionLines(state.changelog.sections, new Set(["new", "changed"]))) {
        lines.push(block);
    }
    const commits = visibleCommits(state.commits);
    for (const commit of commits.slice(0, CommitLineLimit)) {
        lines.push(commitLine(commit));
    }
    if (commits.length > CommitLineLimit) {
        lines.push(`• and ${commits.length - CommitLineLimit} more`);
    }
    return lines;
}

function rowsLine(state) {
    const added = state.sheet?.added ?? [];
    if (state.drive === null) {
        return "";
    }
    if (added.length === 0) {
        return `**Testing sheet:** no new test items in this build. [Open it](${state.drive.testingUrl})`;
    }
    const range = added.length === 1 ? added[0] : `${added[0]} to ${added[added.length - 1]}`;
    return `**Testing sheet:** ${added.length} new test ${added.length === 1 ? "item" : "items"} (${range}). [Open it](${state.drive.testingUrl})`;
}

function buildEmbed(state) {
    const build = state.build;
    const previousNumber = state.previousOfVersion?.Build;
    const heading = previousNumber === undefined ? "**New since the last beta**" : `**New since beta ${previousNumber}**`;
    const whatsNew = whatsNewLines(state);
    const lines = [heading, whatsNew.length === 0 ? "• Nothing a tester would notice; internal changes only." : whatsNew.join("\n")];
    const rows = rowsLine(state);
    if (rows.length > 0) {
        lines.push("");
        lines.push(rows);
    }
    if (state.compareUrl.length > 0) {
        lines.push("");
        lines.push(`[Every change since the last beta](${state.compareUrl})`);
    }
    return {
        title: `Beta ${build.number} is up (${build.version})`,
        url: `https://github.com/${state.betaRepository}/releases/tag/${build.tag}`,
        description: truncate(lines.join("\n"), EmbedDescriptionLimit),
        color: EmbedColor,
        footer: footer(build.version),
        timestamp: build.builtAt,
    };
}

function mentionsFor(config, shouldPing) {
    if (!shouldPing || !config.ping || config.testerRoleId.length === 0) {
        return { prefix: "", allowed: { parse: [] } };
    }
    return { prefix: `<@&${config.testerRoleId}> `, allowed: { parse: [], roles: [config.testerRoleId] } };
}

async function postChangelogPages(config, threadId, state) {
    const pages = paginate(sectionLines(state.changelog.sections, null), EmbedDescriptionLimit);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const suffix = pages.length === 1 ? "" : ` (${pageIndex + 1} of ${pages.length})`;
        await discordRequest(config, "POST", `/channels/${threadId}/messages`, {
            embeds: [{ title: `What's in ${state.version}${suffix}`, description: pages[pageIndex], color: EmbedColor }],
            allowed_mentions: { parse: [] },
        });
        await sleep(500);
    }
}

async function threadHasBuild(config, threadId, betaVersion) {
    const marker = buildMarker(betaVersion);
    const messages = await discordRequest(config, "GET", `/channels/${threadId}/messages?limit=${MessageHistoryLimit}`);
    for (const message of messages ?? []) {
        for (const embed of message.embeds ?? []) {
            if ((embed.footer?.text ?? "").endsWith(marker)) {
                return true;
            }
        }
    }
    return false;
}

async function createVersionThread(config, forum, state) {
    const rowCount = state.sheet?.added?.length ?? 0;
    const mentions = mentionsFor(config, true);
    const items = rowCount === 0 ? "" : ` ${rowCount} test ${rowCount === 1 ? "item is" : "items are"} waiting in the Testing sheet.`;
    const content = truncate(`${mentions.prefix}**${threadName(state.version)}** is ready to test, starting with beta ${state.build.number} (\`${state.build.version}\`).${items}`, MessageContentLimit);
    const thread = await discordRequest(config, "POST", `/channels/${config.forumChannelId}/threads`, {
        name: threadName(state.version),
        applied_tags: forum.tagIds.testing === undefined ? [] : [forum.tagIds.testing],
        message: { content, embeds: [starterEmbed(state)], allowed_mentions: mentions.allowed },
    });
    await postChangelogPages(config, thread.id, state);
    return thread;
}

async function replyWithBuild(config, thread, state) {
    if (thread.thread_metadata?.archived === true) {
        await discordRequest(config, "PATCH", `/channels/${thread.id}`, { archived: false });
    }
    const rowCount = state.sheet?.added?.length ?? 0;
    const mentions = mentionsFor(config, rowCount > 0);
    const body = { embeds: [buildEmbed(state)], allowed_mentions: mentions.allowed };
    if (mentions.prefix.length > 0) {
        body.content = `${mentions.prefix}Beta ${state.build.number} of ${state.version} is up with ${rowCount} new test ${rowCount === 1 ? "item" : "items"}.`;
    }
    await discordRequest(config, "POST", `/channels/${thread.id}/messages`, body);
}

async function refreshStarter(config, thread, state) {
    await discordRequest(config, "PATCH", `/channels/${thread.id}/messages/${thread.id}`, { embeds: [starterEmbed(state)], allowed_mentions: { parse: [] } });
}

async function sweepReleased(config, forum, threads, currentVersion) {
    if (forum.tagIds.testing === undefined || forum.tagIds.released === undefined) {
        return;
    }
    const shipped = shippedVersions(config);
    for (const thread of threads) {
        const match = /^Beta (\d+(?:\.\d+){2,3})$/.exec(thread.name ?? "");
        if (match === null || match[1] === currentVersion || thread.owner_id !== forum.botId) {
            continue;
        }
        if (!(thread.applied_tags ?? []).includes(forum.tagIds.testing) || !shipped.has(match[1])) {
            continue;
        }
        if (thread.thread_metadata?.archived === true) {
            await discordRequest(config, "PATCH", `/channels/${thread.id}`, { archived: false });
        }
        await discordRequest(config, "PATCH", `/channels/${thread.id}`, { applied_tags: [forum.tagIds.released], archived: true });
        log(`Marked ${thread.name} as released.`);
    }
}

async function handoffDiscord(config, state) {
    const forum = await loadForum(config);
    const threads = await forumThreads(config, forum);
    const name = threadName(state.version);
    const named = threads.filter(thread => thread.name === name);
    const ours = named.filter(thread => thread.owner_id === forum.botId);
    if (named.length > ours.length) {
        warn(`A post named "${name}" exists that the bot did not create; the bot keeps its own post. Delete the other one to avoid two posts.`);
    }
    const thread = oldestThread(ours);
    if (config.mode === "refresh") {
        if (thread === null) {
            throw new Error(`There is no ${name} post to refresh.`);
        }
        await refreshStarter(config, thread, state);
        log(`Refreshed the first message of ${name}.`);
        return;
    }
    if (thread === null) {
        await createVersionThread(config, forum, state);
        log(`Created the forum post ${name}.`);
    } else if (state.firstBuild) {
        log(`${name} already exists and opened with this version's first beta; not posting again.`);
    } else if (await threadHasBuild(config, thread.id, state.build.version)) {
        log(`${name} already announces ${state.build.version}; not posting again.`);
    } else {
        await replyWithBuild(config, thread, state);
        log(`Replied in ${name} with beta ${state.build.number}.`);
    }
    if (thread !== null && state.newestOfVersion) {
        await refreshStarter(config, thread, state);
    }
    await sweepReleased(config, forum, threads, state.version);
}

function areaForSection(title, areas) {
    const wanted = title.trim().toLowerCase();
    const byName = new Map(areas.map(area => [area.toLowerCase(), area]));
    if (byName.has(wanted)) {
        return byName.get(wanted);
    }
    const alias = SectionAreaAliases[wanted];
    if (alias !== undefined && byName.has(alias.toLowerCase())) {
        return byName.get(alias.toLowerCase());
    }
    for (const area of areas) {
        if (wanted.startsWith(area.toLowerCase())) {
            return area;
        }
    }
    return areas.includes(FallbackArea) ? FallbackArea : areas[0];
}

function fallbackItems(state) {
    const items = [];
    const changes = state.firstBuild ? null : new Set(["new", "changed"]);
    for (const section of state.changelog.sections) {
        const area = areaForSection(section.title, state.drive.areas.map(area => area.name));
        for (const bullet of section.bullets) {
            if (changes !== null && !changes.has(bullet.change)) {
                continue;
            }
            const text = scrubText(bullet.text).replace(CreditPattern, "").replace(/\.$/, "");
            items.push({ area, test: `Try the change: ${text}. Expect: it works as described.`, needs: [] });
        }
    }
    return items;
}

function normalizedTest(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function validClaudeItems(state) {
    const items = state.claude?.items;
    if (!Array.isArray(items)) {
        return null;
    }
    const areas = new Set(state.drive.areas.map(area => area.name));
    const needs = new Set(state.drive.needs);
    const valid = [];
    for (const item of items) {
        const test = scrubText(item?.test);
        if (!areas.has(item?.area) || !/Expect:/i.test(test) || test.length > TestTextLimit) {
            warn("Dropped a generated test item that did not pass validation.");
            continue;
        }
        valid.push({ area: item.area, test, needs: (item.needs ?? []).filter(need => needs.has(need)) });
    }
    return valid;
}

function assignIds(items, state) {
    const prefixes = new Map(state.drive.areas.map(area => [area.name, area.prefix]));
    const highest = new Map();
    for (const row of state.drive.rows) {
        const match = /^([A-Z]+)-(\d+)$/.exec(String(row.id ?? "").trim());
        if (match !== null) {
            highest.set(match[1], Math.max(highest.get(match[1]) ?? 0, Number(match[2])));
        }
    }
    const existing = new Set(state.drive.rows.map(row => normalizedTest(String(row.test ?? ""))));
    const rows = [];
    for (const item of items) {
        const key = normalizedTest(item.test);
        if (existing.has(key)) {
            continue;
        }
        existing.add(key);
        const prefix = prefixes.get(item.area) ?? "OTH";
        const next = (highest.get(prefix) ?? 0) + 1;
        highest.set(prefix, next);
        rows.push({ id: `${prefix}-${String(next).padStart(3, "0")}`, area: item.area, test: item.test, needs: item.needs.join(", "), build: state.build.version });
    }
    return rows;
}

function claudePrompt(config, state) {
    const template = readFileSync(join(config.betaDirectory, ".github", "qa", "prompt.md"), "utf8");
    const context = {
        version: state.version,
        betaBuild: state.build.number,
        betaVersion: state.build.version,
        firstBuildOfVersion: state.firstBuild,
        maxItems: state.firstBuild ? FirstBuildItemLimit : LaterBuildItemLimit,
        changelog: state.changelog.sections.map(section => ({
            section: section.title,
            bullets: section.bullets.map(bullet => ({ key: bullet.key, change: bullet.change, text: bullet.text })),
        })),
        commitsSincePreviousBeta: state.commits,
        previousBetaCommit: state.previous?.Sha ?? "",
        builtCommit: state.build.sha,
        existingTestItems: (state.drive?.rows ?? []).map(row => ({ id: row.id, area: row.area, test: row.test })),
        areas: (state.drive?.areas ?? [{ name: FallbackArea }]).map(area => area.name),
        needs: state.drive?.needs ?? [],
    };
    return template.replace("{{CONTEXT}}", JSON.stringify(context, null, 2));
}

function claudeSchema(state) {
    const areas = (state.drive?.areas ?? [{ name: FallbackArea }]).map(area => area.name);
    const needs = state.drive?.needs ?? [];
    return {
        type: "object",
        properties: {
            summary: { type: "array", items: { type: "string" }, maxItems: SummaryLineLimit },
            items: {
                type: "array",
                maxItems: state.firstBuild ? FirstBuildItemLimit : LaterBuildItemLimit,
                items: {
                    type: "object",
                    properties: {
                        area: { type: "string", enum: areas },
                        test: { type: "string" },
                        needs: needs.length === 0 ? { type: "array", maxItems: 0, items: { type: "string" } } : { type: "array", items: { type: "string", enum: needs } },
                        source: { type: "string" },
                    },
                    required: ["area", "test", "needs", "source"],
                    additionalProperties: false,
                },
            },
        },
        required: ["summary", "items"],
        additionalProperties: false,
    };
}

async function resolveCommand(config) {
    const { record } = loadBuild(config);
    setOutput("sha", record.Sha);
    log(`Handing off ${record.Tag}: beta ${record.Build} of ${record.ChangelogVersion} from ${record.Sha.slice(0, 9)}.`);
}

async function prepareCommand(config) {
    const { record, previous, previousOfVersion, newestOfVersion } = loadBuild(config);
    const changelog = newestChangelog(config, record.Sha);
    if (changelog === null || changelog.version !== record.ChangelogVersion) {
        throw new Error(`The built commit's newest changelog entry is not ${record.ChangelogVersion}.`);
    }
    const previousChangelog = previous === null ? null : newestChangelog(config, previous.Sha);
    markBulletChanges(changelog, previousChangelog);
    const previousSha = previous?.Sha ?? "";
    const state = {
        version: record.ChangelogVersion,
        betaRepository: config.betaRepository,
        build: {
            number: record.Build,
            version: record.Version,
            tag: record.Tag,
            sha: record.Sha,
            shortSha: record.Sha.slice(0, 9),
            builtAt: record.BuiltAt,
        },
        previous,
        previousOfVersion,
        newestOfVersion,
        firstBuild: previousOfVersion === null,
        changelog,
        commits: commitsBetween(config, previousSha, record.Sha),
        compareUrl: previousSha.length === 0 ? "" : `https://github.com/${config.sourceRepository}/compare/${previousSha}...${record.Sha}`,
        drive: null,
        sheet: null,
        claude: null,
    };
    if (hasDrive(config) && config.mode !== "dry-run") {
        const drive = await driveRequest(config, "ensureVersion", { version: state.version, build: record.Version, started: record.BuiltAt });
        state.drive = {
            folderName: drive.folderName,
            folderUrl: drive.folderUrl,
            testingName: drive.testingName,
            testingUrl: drive.testingUrl,
            areas: drive.areas,
            needs: drive.needs,
            rows: drive.rows,
        };
        log(`Drive: ${drive.created ? "created" : "found"} the ${state.version} folder with ${drive.rows.length} existing test items.`);
    } else if (!hasDrive(config)) {
        warn("QA_DRIVE_URL or QA_DRIVE_SECRET is not set; the handoff skips the sheets.");
    }
    mkdirSync(config.workDirectory, { recursive: true });
    writeJson(join(config.workDirectory, "state.json"), state);
    writeFileSync(join(config.workDirectory, "prompt.md"), claudePrompt(config, state));
    writeJson(join(config.workDirectory, "schema.json"), claudeSchema(state));
    const counts = { new: 0, changed: 0, unchanged: 0 };
    for (const section of changelog.sections) {
        for (const bullet of section.bullets) {
            counts[bullet.change] += 1;
        }
    }
    log(`Changelog ${state.version}: ${counts.new} new, ${counts.changed} changed, ${counts.unchanged} unchanged bullets; ${state.commits.length} commits since the last beta; ${state.firstBuild ? "first build of this version" : `follows beta ${previousOfVersion.Build}`}.`);
}

function loadClaude(config) {
    const path = join(config.workDirectory, "claude.json");
    if (!existsSync(path)) {
        return null;
    }
    try {
        const result = JSON.parse(readFileSync(path, "utf8"));
        if (result.is_error === true || result.structured_output === undefined) {
            warn(`Claude did not return test items (${result.subtype ?? "no result"}); using the changelog bullets instead.`);
            return null;
        }
        return result.structured_output;
    } catch {
        warn("Claude's output could not be read; using the changelog bullets instead.");
        return null;
    }
}

function itemsToAdd(config, state) {
    if (config.mode === "refresh") {
        return { list: [], source: "a refresh adds none" };
    }
    const generated = validClaudeItems(state);
    if (generated === null) {
        return { list: fallbackItems(state), source: "from the changelog bullets" };
    }
    return { list: generated, source: "written by Claude" };
}

async function publishCommand(config) {
    const state = readJson(join(config.workDirectory, "state.json"), null);
    if (state === null) {
        throw new Error("No state.json; run prepare first.");
    }
    if (config.mode === "refresh" && !state.newestOfVersion) {
        throw new Error(`Refresh with the newest beta of ${state.version}; an older one would show a stale build.`);
    }
    state.claude = loadClaude(config);
    if (state.drive !== null) {
        const items = itemsToAdd(config, state);
        const limit = state.firstBuild ? FirstBuildItemLimit : LaterBuildItemLimit;
        const rows = assignIds(items.list.slice(0, limit), state);
        log(`Test items: ${rows.length} to add (${items.source}).`);
        if (config.mode === "dry-run") {
            state.sheet = { added: rows.map(row => row.id), summary: undefined };
        } else {
            const sheet = await driveRequest(config, "appendTasks", { version: state.version, build: state.build.version, current: state.newestOfVersion, rows });
            state.sheet = { added: sheet.added, summary: sheet.summary };
            log(`Drive: added ${sheet.added.length} rows, skipped ${sheet.skipped.length} that already existed.`);
        }
    }
    if (!hasDiscord(config)) {
        warn("DISCORD_BOT_TOKEN or DISCORD_BETA_FORUM_ID is not set; skipping the forum post.");
        return;
    }
    if (config.mode === "dry-run") {
        log(`Dry run: would post to ${threadName(state.version)}.`);
        log(JSON.stringify({ starter: starterEmbed(state), reply: buildEmbed(state) }, null, 2));
        return;
    }
    await handoffDiscord(config, state);
}

async function checkCommand(config) {
    let failures = 0;
    if (hasDiscord(config)) {
        try {
            const forum = await loadForum(config);
            log(`Discord: bot ok, forum ok, tags ${forum.tagIds.testing !== undefined && forum.tagIds.released !== undefined ? "ok" : "missing"}.`);
            if (config.testerRoleId.length > 0) {
                const roles = await discordRequest(config, "GET", `/guilds/${forum.guildId}/roles`);
                const found = (roles ?? []).some(role => role.id === config.testerRoleId);
                log(`Discord: tester role ${found ? "ok" : "not found"}.`);
                failures += found ? 0 : 1;
            }
        } catch (error) {
            failures += 1;
            warn(`Discord check failed: ${error.message}`);
        }
    } else {
        warn("Discord is not configured.");
    }
    if (hasDrive(config)) {
        try {
            const drive = await driveRequest(config, "ping", {});
            log(`Drive: web app ok, beta folder ok, template ok (${drive.testingTemplate}).`);
        } catch (error) {
            failures += 1;
            warn(`Drive check failed: ${error.message}`);
        }
    } else {
        warn("Drive is not configured.");
    }
    if (failures > 0) {
        process.exitCode = 1;
    }
}

const Commands = Object.freeze({ check: checkCommand, resolve: resolveCommand, prepare: prepareCommand, publish: publishCommand });

async function main() {
    const config = readConfig();
    const command = Commands[config.command];
    if (command === undefined) {
        throw new Error(`Unknown command "${config.command}"; use check, resolve, prepare or publish.`);
    }
    if (config.command !== "check" && config.tag.length === 0) {
        throw new Error("BUILD_TAG is not set.");
    }
    await command(config);
}

main().catch(error => {
    console.log(`::error::${redact(error.message)}`);
    process.exitCode = 1;
});
