#!/usr/bin/env node

import * as esbuild from "esbuild";

esbuild.build({
    entryPoints: ["src/**/*.ts"],
    outdir: "dist/",
    platform: "neutral",
    format: "esm",
    bundle: false,
    splitting: false,
    sourcemap: false,
    minify: false,
    tsconfig: "tsconfig.json",
    mainFields: ["module", "main"],
    conditions: ["module", "import", "default"],
});
