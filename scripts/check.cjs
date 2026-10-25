const { readdirSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

for (const directory of ["js", "scripts", "__tests__"]) {
  for (const file of readdirSync(directory).filter(name => /\.(js|cjs)$/.test(name))) {
    const result = spawnSync(process.execPath, ["--check", `${directory}/${file}`], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log("JavaScript syntax checks passed.");
