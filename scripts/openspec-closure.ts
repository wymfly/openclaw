#!/usr/bin/env -S node --import tsx

import { Command } from "commander";

import { checkClosure } from "./lib/openspec-closure/checker.js";
import {
  loadClosureConfig,
  resolvePlanFiles,
  resolveVerificationPath,
} from "./lib/openspec-closure/config.js";
import { collectPlanCoverage } from "./lib/openspec-closure/plan-coverage.js";
import { formatClosureReport } from "./lib/openspec-closure/report.js";
import { collectScenarioInventory } from "./lib/openspec-closure/spec-inventory.js";
import {
  createVerificationArtifact,
  readVerificationArtifact,
  writeVerificationArtifact,
} from "./lib/openspec-closure/verification-artifact.js";

type CommonOptions = {
  change: string;
  config?: string;
  root?: string;
};

async function loadContext(options: CommonOptions) {
  const rootDir = options.root ?? process.cwd();
  const config = await loadClosureConfig({
    configPath: options.config,
    rootDir,
  });
  const changeDir = `${rootDir}/openspec/changes/${options.change}`;
  const inventory = await collectScenarioInventory(changeDir);
  const planPaths = await resolvePlanFiles({
    rootDir,
    planGlobs: config.planGlobs,
  });
  const coverage = await collectPlanCoverage(planPaths);
  const verificationPath = resolveVerificationPath({
    changeName: options.change,
    rootDir,
    verificationFileName: config.verificationFileName,
  });

  return {
    changeDir,
    config,
    coverage,
    inventory,
    rootDir,
    verificationPath,
  };
}

async function tryReadVerificationArtifact(filePath: string) {
  try {
    return await readVerificationArtifact(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

const program = new Command();

program.name("openspec-closure").description("Portable closure companion for OpenSpec + superpowers projects");

program
  .command("init")
  .requiredOption("--change <name>", "OpenSpec change name")
  .option("--config <path>", "Project closure config path")
  .option("--root <path>", "Project root", process.cwd())
  .action(async (options: CommonOptions) => {
    const context = await loadContext(options);
    const artifact = createVerificationArtifact({
      changeName: options.change,
      inventory: context.inventory,
    });
    const coverageByScenarioId = new Map(
      context.coverage.map((entry) => [entry.scenarioId, entry.taskTitle]),
    );
    for (const scenario of artifact.scenarios) {
      scenario.ownerTask = coverageByScenarioId.get(scenario.scenarioId);
    }
    await writeVerificationArtifact(context.verificationPath, artifact);
    process.stdout.write(`${context.verificationPath}\n`);
  });

program
  .command("check")
  .requiredOption("--change <name>", "OpenSpec change name")
  .option("--config <path>", "Project closure config path")
  .option("--root <path>", "Project root", process.cwd())
  .option("--format <format>", "Output format: text or json", "text")
  .action(async (options: CommonOptions & { format: string }) => {
    const context = await loadContext(options);
    const verification = await tryReadVerificationArtifact(context.verificationPath);
    const result = checkClosure({
      blockingStatuses: context.config.blockingStatuses,
      changeName: options.change,
      coverage: context.coverage,
      inventory: context.inventory,
      verification,
    });

    if (options.format === "json") {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(formatClosureReport(result));
    }

    if (!result.archiveReady) {
      process.exitCode = 1;
    }
  });

program
  .command("report")
  .requiredOption("--change <name>", "OpenSpec change name")
  .option("--config <path>", "Project closure config path")
  .option("--root <path>", "Project root", process.cwd())
  .action(async (options: CommonOptions) => {
    const context = await loadContext(options);
    const verification = await tryReadVerificationArtifact(context.verificationPath);
    const result = checkClosure({
      blockingStatuses: context.config.blockingStatuses,
      changeName: options.change,
      coverage: context.coverage,
      inventory: context.inventory,
      verification,
    });
    process.stdout.write(formatClosureReport(result));
  });

void program.parseAsync(process.argv);
