#!/usr/bin/env bun

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bumps the extension version
 * @param {string} newVersion - New version (e.g., "1.1.0")
 */
function bumpVersion(newVersion) {
    const projectRoot = join(import.meta.dir, "..");

    try {
        const packagePath = join(projectRoot, "package.json");
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

        const metadataPath = join(projectRoot, "metadata.json");
        const metadataJson = JSON.parse(readFileSync(metadataPath, "utf8"));

        packageJson.version = newVersion;

        metadataJson["version-name"] = newVersion;

        const currentVersion = metadataJson.version || 0;
        metadataJson.version = currentVersion + 1;

        writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
        writeFileSync(
            metadataPath,
            `${JSON.stringify(metadataJson, null, 2)}\n`,
        );

        console.log(`✅ Version bumped successfully!`);
        console.log(`📦 package.json: ${newVersion}`);
        console.log(
            `🔧 metadata.json: version-name = ${newVersion}, version = ${metadataJson.version}`,
        );
    } catch (error) {
        console.error("❌ Error bumping version:", error.message);
        process.exit(1);
    }
}

/**
 * Creates a git release with commit, push, tag, and push tag
 * @param {string} newVersion - New version (e.g., "1.1.0")
 */
function createRelease(newVersion) {
    const projectRoot = join(import.meta.dir, "..");

    try {
        // Change to project directory
        process.chdir(projectRoot);

        // Check if we're in a git repository
        try {
            execSync("git rev-parse --git-dir", { stdio: "ignore" });
        } catch {
            console.error("❌ Not in a git repository");
            process.exit(1);
        }

        // Check if there are uncommitted changes
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        if (status.trim()) {
            console.error(
                "❌ There are uncommitted changes. Please commit or stash them first.",
            );
            console.error("Uncommitted files:");
            console.error(status);
            process.exit(1);
        }

        // Bump version first
        bumpVersion(newVersion);

        // Add version files
        console.log("📝 Adding version files to git...");
        execSync("git add package.json metadata.json", { stdio: "inherit" });

        // Commit with conventional commit message
        const commitMessage = `chore: bump version to ${newVersion}`;
        console.log(`💾 Committing: ${commitMessage}`);
        execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });

        // Push to remote
        console.log("🚀 Pushing to remote...");
        execSync("git push", { stdio: "inherit" });

        // Create and push tag
        const tagName = `v${newVersion}`;
        console.log(`🏷️  Creating tag: ${tagName}`);
        execSync(`git tag ${tagName}`, { stdio: "inherit" });

        console.log(`📤 Pushing tag: ${tagName}`);
        execSync(`git push origin ${tagName}`, { stdio: "inherit" });

        console.log(`🎉 Release ${newVersion} created successfully!`);
        console.log(`📋 Summary:`);
        console.log(`   • Version bumped to ${newVersion}`);
        console.log(`   • Changes committed and pushed`);
        console.log(`   • Tag ${tagName} created and pushed`);
    } catch (error) {
        console.error("❌ Error creating release:", error.message);
        process.exit(1);
    }
}

// Get command and version from command line arguments
const command = process.argv[2];
const newVersion = process.argv[3];

if (!command) {
    console.error("❌ Please provide a command");
    console.error("Usage:");
    console.error("  bun bump-version.js bump <version>  - Bump version only");
    console.error(
        "  bun bump-version.js release <version>  - Bump version and create git release",
    );
    console.error("Examples:");
    console.error("  bun bump-version.js bump 1.2.0");
    console.error("  bun bump-version.js release 1.2.0");
    process.exit(1);
}

if (!newVersion) {
    console.error("❌ Please provide a version number");
    process.exit(1);
}

// Validate version format (simple semver check)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error(
        "❌ Invalid version format. Please use semantic versioning (e.g., 1.2.0)",
    );
    process.exit(1);
}

// Execute command
switch (command) {
    case "bump":
        bumpVersion(newVersion);
        break;
    case "release":
        createRelease(newVersion);
        break;
    default:
        console.error(`❌ Unknown command: ${command}`);
        console.error("Available commands: bump, release");
        process.exit(1);
}
