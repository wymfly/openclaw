import type { RegisteredCommand, CommandSource } from "./command-types";
import { SOURCE_PRIORITY } from "./command-types";
import type { SlashCommandDef } from "@/components/panels/chat/slash-commands";

const CATEGORY_ORDER = ["session", "model", "tools", "agents", "skills", "plugins", "more"];

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>();
  /** Displaced commands stored under "source:name" qualified keys. */
  private qualified = new Map<string, RegisteredCommand>();
  private version = 0;

  register(cmd: RegisteredCommand): void {
    const existing = this.commands.get(cmd.name);
    if (existing) {
      if (cmd.priority < existing.priority) {
        // New command wins — displace existing to qualified
        this.qualified.set(`${existing.source}:${existing.name}`, existing);
        this.commands.set(cmd.name, cmd);
      } else {
        // Existing wins — store new as qualified
        this.qualified.set(`${cmd.source}:${cmd.name}`, cmd);
      }
    } else {
      this.commands.set(cmd.name, cmd);
    }
    this.version++;
  }

  unregister(name: string): void {
    this.commands.delete(name);
    // Promote: find highest-priority displaced command with the same name
    let best: { key: string; cmd: RegisteredCommand } | null = null;
    for (const [key, cmd] of this.qualified) {
      if (key.endsWith(`:${name}`)) {
        if (!best || cmd.priority < best.cmd.priority) {
          best = { key, cmd };
        }
      }
    }
    if (best) {
      this.qualified.delete(best.key);
      this.commands.set(name, best.cmd);
    }
    this.version++;
  }

  unregisterBySource(source: CommandSource): void {
    const removedNames: string[] = [];
    for (const [name, cmd] of this.commands) {
      if (cmd.source === source) {
        this.commands.delete(name);
        removedNames.push(name);
      }
    }
    for (const key of this.qualified.keys()) {
      if (key.startsWith(`${source}:`)) {
        this.qualified.delete(key);
      }
    }
    // Promote displaced commands for each removed name
    for (const name of removedNames) {
      let best: { key: string; cmd: RegisteredCommand } | null = null;
      for (const [key, cmd] of this.qualified) {
        if (key.endsWith(`:${name}`)) {
          if (!best || cmd.priority < best.cmd.priority) {
            best = { key, cmd };
          }
        }
      }
      if (best) {
        this.qualified.delete(best.key);
        this.commands.set(name, best.cmd);
      }
    }
    this.version++;
  }

  get(name: string): RegisteredCommand | undefined {
    return this.commands.get(name) ?? this.qualified.get(name);
  }

  getAll(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  filter(query: string): RegisteredCommand[] {
    const lower = query.toLowerCase();
    const commands = lower
      ? this.getAll().filter((cmd) => cmd.name.startsWith(lower))
      : this.getAll();

    return commands.toSorted((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      const aCat = ai === -1 ? 999 : ai;
      const bCat = bi === -1 ? 999 : bi;
      if (aCat !== bCat) return aCat - bCat;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });
  }

  registerLocalCommands(defs: SlashCommandDef[]): void {
    for (const def of defs) {
      this.register({
        name: def.name,
        source: "local",
        execMode: "local",
        descriptionKey: def.descriptionKey,
        args: def.args,
        argOptions: def.argOptions,
        icon: def.icon,
        category: def.category,
        priority: SOURCE_PRIORITY.local,
      });
    }
  }

  getVersion(): number {
    return this.version;
  }
}

/** Module-level singleton. */
export const commandRegistry = new CommandRegistry();
