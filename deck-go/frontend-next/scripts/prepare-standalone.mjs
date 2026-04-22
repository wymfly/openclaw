import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone", "deck-go", "frontend-next");
const staticSource = path.join(projectRoot, ".next", "static");
const staticDest = path.join(standaloneRoot, ".next", "static");
const publicSource = path.join(projectRoot, "public");
const publicDest = path.join(standaloneRoot, "public");

function copyDirIfPresent(source, dest) {
  if (!fs.existsSync(source)) {
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(source, dest, { recursive: true });
}

if (!fs.existsSync(standaloneRoot)) {
  throw new Error(`standalone output missing at ${standaloneRoot}`);
}

copyDirIfPresent(staticSource, staticDest);
copyDirIfPresent(publicSource, publicDest);
