import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

// Only publish the actual site files so local plans, scripts, and raw assets stay private.
const publishEntries = ["index.html", ".nojekyll", "assets", "src"];
const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const entry of publishEntries) {
    const sourcePath = path.join(rootDir, entry);

    if (!existsSync(sourcePath)) {
      continue;
    }

    const destinationPath = path.join(distDir, entry);
    await cp(sourcePath, destinationPath, { recursive: true });
  }

  console.log(`Build complete: ${distDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
