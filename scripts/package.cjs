const { mkdirSync, readFileSync, rmSync, copyFileSync, cpSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { version } = require("../manifest.json");

const root = resolve(__dirname, "..");
const stage = resolve(root, "dist", "extension");
const archive = resolve(root, "dist", `tab-count-${version}.zip`);
const files = ["manifest.json", "popup.html", "options.html", "privacy.html", "styles.css"];

// Explicit allowlist: no repository history, tests, store docs, or local files.
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const file of files) copyFileSync(resolve(root, file), resolve(stage, file));
for (const directory of ["js", "images"]) cpSync(resolve(root, directory), resolve(stage, directory), { recursive: true });
rmSync(archive, { force: true });
const zip = spawnSync("zip", ["-q", "-r", archive, ...files, "js", "images"], { cwd: stage, stdio: "inherit" });
if (zip.status !== 0) process.exit(zip.status || 1);
const { createHash } = require("node:crypto");
console.log(`Package: ${archive}`);
console.log(`SHA-256: ${createHash("sha256").update(readFileSync(archive)).digest("hex")}`);
