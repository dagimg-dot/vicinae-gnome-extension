#!/usr/bin/env node

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import * as esbuild from "esbuild";
import { esbuildPreserveWhitespacePlugin } from "esbuild-preserve-whitespace";

const projectRoot = join(fileURLToPath(import.meta.url), "..", "..");
config({ path: join(projectRoot, ".env") });
const envSuffix = process.env.ENV ? `-${process.env.ENV}` : "";

esbuild.build({
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
