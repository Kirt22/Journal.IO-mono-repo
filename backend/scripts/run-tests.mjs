import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const distRoot = resolve(process.cwd(), "dist");

const collectTestFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(absolutePath);
      }

      return entry.name.endsWith(".test.js") ? [absolutePath] : [];
    }),
  );

  return files.flat();
};

let testFiles = [];

try {
  testFiles = await collectTestFiles(distRoot);
} catch (error) {
  console.error("Unable to read compiled backend test files.", error);
  process.exit(1);
}

if (testFiles.length === 0) {
  console.error("No compiled backend test files were found in dist.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
