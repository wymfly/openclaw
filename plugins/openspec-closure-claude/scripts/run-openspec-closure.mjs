#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsxLoader = require.resolve("tsx");
const wrapperPath = fileURLToPath(new URL("./openspec-closure.ts", import.meta.url));

const child = spawn(process.execPath, ["--import", tsxLoader, wrapperPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
