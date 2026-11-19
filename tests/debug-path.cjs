const { resolve, relative, isAbsolute, dirname } = require("node:path");
const { existsSync, realpathSync, lstatSync } = require("node:fs");

const dbPath = "data/council.db";
const baseDir = process.cwd();
console.log("baseDir:", baseDir);

// Step 1: resolvePathWithSymlinkValidation
let normalizedPath = dbPath;
if (!isAbsolute(dbPath)) {
  normalizedPath = resolve(baseDir, dbPath);
}
console.log("After resolve:", normalizedPath);

const regex = /[/\\]/g;
const parts = normalizedPath.split(regex).filter(Boolean);
console.log("parts:", parts);

let resolvedPath = "";
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  resolvedPath = resolvedPath ? resolve(resolvedPath, part) : part;
  console.log("  loop", i, "part:", part, "resolvedPath:", resolvedPath);
}
console.log("resolvedPath:", resolvedPath);