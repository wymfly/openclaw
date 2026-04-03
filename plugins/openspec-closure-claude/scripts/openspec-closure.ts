#!/usr/bin/env -S node --import tsx

import { runClosureCommandLine } from "../../../packages/openspec-closure-core/src/program.js";

void runClosureCommandLine(process.argv);
