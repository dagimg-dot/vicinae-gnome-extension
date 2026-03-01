#!/usr/bin/env node

/**
 * Add a new contributor to AboutPage.ts
 * - Gets contributors from git log
 * - Reads current CREDITS, dedupes by title
 * - Finds newest git contributor not yet in list (title + subtitle from commits)
 * - Only prompts for GitHub handle
 * - Appends to bottom of list
 *
 * Usage: node scripts/update-contrib.js
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline";

const SCRIPT_DIR = join(import.meta.dirname);
const PROJECT_ROOT = join(SCRIPT_DIR, "..");
const ABOUT_PAGE_PATH = join(PROJECT_ROOT, "src/prefs/AboutPage.ts");

function question(rl, prompt) {
    return new Promise((resolve) => rl.question(prompt, resolve));
}

function getGitContributors() {
    const out = execSync('git log --pretty=format:"%an" --no-merges', {
        encoding: "utf8",
        cwd: PROJECT_ROOT,
    });
    const seen = new Set();
    const order = [];
    for (const name of out.split("\n")) {
        const n = name.trim();
        if (n && !seen.has(n)) {
            seen.add(n);
            order.push(n);
        }
    }
    return order; // most recent first
}

function getContributorRole(title) {
    if (/Dagim|dagimg/i.test(title)) return "Original Author";
    return "Contributor";
}

function parseCredits(content) {
    const credits = [];
    const blockRegex =
        /\{\s*title:\s*"([^"]*)",\s*subtitle:\s*"([^"]*)",(?:\s*github:\s*"([^"]*)",?)?\s*\}/g;
    for (
        let m = blockRegex.exec(content);
        m !== null;
        m = blockRegex.exec(content)
    ) {
        credits.push({
            title: m[1],
            subtitle: m[2],
            github: m[3] ?? "",
        });
    }
    return credits;
}

function dedupeByTitle(credits) {
    const seen = new Set();
    return credits.filter((c) => {
        if (seen.has(c.title)) return false;
        seen.add(c.title);
        return true;
    });
}

function formatCreditsArray(credits) {
    const entries = credits.map(
        (c) =>
            `    {
        title: "${c.title}",
        subtitle: "${c.subtitle}",
        github: "${c.github}",
    }`,
    );
    return `export const CREDITS: Credit[] = [\n${entries.join(",\n")}\n];`;
}

async function main() {
    const content = readFileSync(ABOUT_PAGE_PATH, "utf8");

    // Parse existing credits, dedupe by title
    let credits = parseCredits(content);
    credits = dedupeByTitle(credits);

    const existingTitles = new Set(credits.map((c) => c.title));
    const gitContributors = getGitContributors();

    // Find newest git contributor not yet in credits
    const newContributor = gitContributors.find(
        (name) => !existingTitles.has(name),
    );
    if (!newContributor) {
        console.error("❌ All git contributors are already in the list.");
        process.exit(1);
    }

    const title = newContributor.trim();
    const subtitle = getContributorRole(title);

    console.log(`Adding: ${title} (${subtitle})`);
    console.log("Current list:", credits.map((c) => c.title).join(", "));
    console.log("");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const github = (await question(rl, "Enter GitHub handle: ")).trim();
    rl.close();

    if (!github) {
        console.error("❌ GitHub handle cannot be empty.");
        process.exit(1);
    }

    // Append new contributor to the bottom
    credits.push({ title, subtitle, github });

    // Replace CREDITS array in file
    const newCreditsBlock = formatCreditsArray(credits);
    const newContent = content.replace(
        /export const CREDITS: Credit\[\] = \[\s*[\s\S]*?^\];/m,
        newCreditsBlock,
    );

    writeFileSync(ABOUT_PAGE_PATH, newContent);
    console.log("");
    console.log("✅ Successfully updated AboutPage.ts");
    console.log("");
    console.log("Current contributors:");
    for (const c of credits) {
        console.log(`  - ${c.title} (${c.subtitle}) @${c.github}`);
    }
    console.log("");
    console.log("✅ Update complete! 🎉");
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
