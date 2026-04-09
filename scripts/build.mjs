import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

// Only publish the actual site files so local plans, scripts, and raw assets stay private.
const publishEntries = ["index.html", ".nojekyll", "assets", "src"];
const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // WeChat / search-engine verifications are often plain txt files placed at the
  // project root, so ship every root-level .txt file to the Pages root as well.
  const rootTextEntries = (await readdir(rootDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
    .map((entry) => entry.name);
  const entriesToPublish = [...publishEntries, ...rootTextEntries];

  for (const entry of entriesToPublish) {
    const sourcePath = path.join(rootDir, entry);

    if (!existsSync(sourcePath)) {
      continue;
    }

    const destinationPath = path.join(distDir, entry);
    await copyEntry(sourcePath, destinationPath);
  }

  console.log(`Build complete: ${distDir}`);
}

async function copyEntry(sourcePath, destinationPath) {
  const sourceStats = await stat(sourcePath);
  const isDirectory = sourceStats.isDirectory();

  if (isDirectory) {
    await mkdir(destinationPath, { recursive: true });

    const childEntries = await readdir(sourcePath, { withFileTypes: true });

    for (const childEntry of childEntries) {
      await copyEntry(
        path.join(sourcePath, childEntry.name),
        path.join(destinationPath, childEntry.name)
      );
    }

    return;
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
