#!/usr/bin/env node

import * as esbuild from "esbuild";

esbuild.build({
    entryPoints: ["src/**/*.ts"],
    outdir: "dist/",
    platform: "neutral",
    format: "esm",
    bundle: true,
    splitting: false,
    sourcemap: false,
    minify: false,
    tsconfig: "tsconfig.json",
    mainFields: ["module", "main"],
    conditions: ["module", "import", "default"],
    // Keep GJS/GI imports external so esbuild doesn't try to bundle or resolve them
    external: [
        "gi://*",
        "resource://*",
        "resource:///org/gnome/shell/*",
        "resource:///org/gnome/Shell/Extensions/*",
    ],
});
