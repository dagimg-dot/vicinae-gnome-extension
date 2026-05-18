#!/usr/bin/env node

import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import * as esbuild from "esbuild";
import { esbuildPreserveWhitespacePlugin } from "esbuild-preserve-whitespace"; // I made this plugin btw ☝️🤓 https://github.com/dagimg-dot/esbuild-preserve-whitespace

const projectRoot = join(fileURLToPath(import.meta.url), "..", "..");
config({ path: join(projectRoot, ".env") });
const envSuffix = process.env.ENV ? `-${process.env.ENV}` : "";

function removeTypeOnlyFiles(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            removeTypeOnlyFiles(fullPath);
        } else if (entry.name.endsWith(".js")) {
            const content = readFileSync(fullPath, "utf-8");
            const stripped = content
                .replace(/^export\s+\*\s+from\s+["'][^"']*["']\s*;?\s*/gm, "")
                .replace(/^export\s*\{\s*\}\s*;?\s*/gm, "")
                .trim();
            if (!stripped) {
                rmSync(fullPath);
            }
        }
    }
}

await esbuild.build({
    entryPoints: ["src/**/*.ts"],
    outdir: "dist/",
    platform: "neutral",
    format: "esm",
    bundle: false,
    splitting: false,
    sourcemap: false,
    minify: false,
    legalComments: "inline",
    tsconfig: "tsconfig.json",
    mainFields: ["module", "main"],
    conditions: ["module", "import", "default"],
    define: {
        __VICINAE_ENV_SUFFIX__: JSON.stringify(envSuffix),
    },
    plugins: [esbuildPreserveWhitespacePlugin()],
});

removeTypeOnlyFiles(join(projectRoot, "dist"));
