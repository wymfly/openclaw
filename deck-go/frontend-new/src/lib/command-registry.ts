import type { SlashCommandDef } from "@/components/panels/chat/slash-commands";
import type { CommandSource, CommandVisibilityContext, RegisteredCommand } from "./command-types";
import { SOURCE_PRIORITY } from "./command-types";

function getQualifiedKey(source: CommandSource, name: string): string {
  return `${source}:${name}`;
}

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>();

  /** Stores lower-priority commands displaced by higher-priority ones. Key: "source:name". */
  private qualified = new Map<string, RegisteredCommand>();

  private listeners = new Set<() => void>();

  private version = 0;

  register(cmd: RegisteredCommand): void {
    const cmdKey = getQualifiedKey(cmd.source, cmd.name);
    this.qualified.delete(cmdKey);

    const existing = this.commands.get(cmd.name);
    if (!existing) {
      this.commands.set(cmd.name, cmd);
      this.version++;
      this.notify();
      return;
    }

    if (existing.source === cmd.source) {
      this.commands.set(cmd.name, cmd);
      this.version++;
      this.notify();
      return;
    }

    if (cmd.priority < existing.priority) {
      this.qualified.set(getQualifiedKey(existing.source, existing.name), existing);
      this.commands.set(cmd.name, cmd);
    } else {
      this.qualified.set(cmdKey, cmd);
    }

    this.version++;
    this.notify();
  }

  unregister(name: string): void {
    const removed = this.commands.get(name);
    if (!removed) {
      return;
    }

    this.commands.delete(name);

    let best: RegisteredCommand | undefined;
    let bestKey: string | undefined;

    for (const [key, cmd] of this.qualified) {
      if (cmd.name !== name) {
        continue;
      }
      if (!best || cmd.priority < best.priority) {
        best = cmd;
        bestKey = key;
      }
    }

    if (best && bestKey) {
      this.qualified.delete(bestKey);
      this.commands.set(name, best);
    }

    this.version++;
    this.notify();
  }

  unregisterBySource(source: CommandSource): void {
    let mutated = false;

    for (const [name, cmd] of this.commands) {
      if (cmd.source !== source) {
        continue;
      }
      this.commands.delete(name);
      mutated = true;
    }

    for (const [key, cmd] of this.qualified) {
      if (cmd.source !== source) {
        continue;
      }
      this.qualified.delete(key);
      mutated = true;
    }

    const candidateNames = new Set<string>();
    for (const cmd of this.qualified.values()) {
      candidateNames.add(cmd.name);
    }

    for (const name of candidateNames) {
      if (this.commands.has(name)) {
        continue;
      }

      let best: RegisteredCommand | undefined;
      let bestKey: string | undefined;

      for (const [key, candidate] of this.qualified) {
        if (candidate.name !== name) {
          continue;
        }
        if (!best || candidate.priority < best.priority) {
          best = candidate;
          bestKey = key;
        }
      }

      if (best && bestKey) {
        this.qualified.delete(bestKey);
        this.commands.set(name, best);
        mutated = true;
      }
    }

    if (!mutated) {
      return;
    }

    this.version++;
    this.notify();
  }

  get(name: string): RegisteredCommand | undefined {
    if (name.includes(":")) {
      const qualified = this.qualified.get(name);
      if (qualified) {
        return qualified;
      }

      const separator = name.indexOf(":");
      const source = name.slice(0, separator);
      const unqualifiedName = name.slice(separator + 1);
      const active = this.commands.get(unqualifiedName);
      if (active?.source === source) {
        return active;
      }
      return undefined;
    }
    return this.commands.get(name);
  }

  getAll(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  filter(prefix: string, ctx?: CommandVisibilityContext): RegisteredCommand[] {
    const lower = prefix.toLowerCase();
    const results: RegisteredCommand[] = [];

    for (const cmd of this.commands.values()) {
      if (lower && !cmd.name.toLowerCase().startsWith(lower)) {
        continue;
      }
      if (ctx && cmd.visibleIf && !cmd.visibleIf(ctx)) {
        continue;
      }
      results.push(cmd);
    }

    return [...results].toSorted((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  }

  registerLocalCommands(defs: SlashCommandDef[]): void {
    for (const def of defs) {
      this.register({
        name: def.name,
        source: "local",
        execMode: "local",
        description: def.descriptionKey,
        args: def.args,
        argOptions: def.argOptions,
        category: def.category,
        priority: SOURCE_PRIORITY.local,
        icon: def.icon,
        descriptionKey: def.descriptionKey,
      });
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const commandRegistry = new CommandRegistry();
