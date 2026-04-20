import path from "node:path";
import { resolveConfiguredSecretInputString } from "openclaw/plugin-sdk/config-runtime";
import {
  buildPluginConfigSchema,
  type OpenClawConfig,
  type OpenClawPluginConfigSchema,
} from "openclaw/plugin-sdk/plugin-entry";
import { buildOptionalSecretInputSchema, type SecretInput } from "openclaw/plugin-sdk/secret-input";
import { isRecord, normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";
import { z } from "openclaw/plugin-sdk/zod";

const EmailTlsConfigSource = z
  .strictObject({
    rejectUnauthorized: z.boolean().optional(),
  })
  .optional();

const EmailAccountConfigSource = z.strictObject({
  id: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535).optional(),
  secure: z.boolean().optional(),
  user: z.string().min(1),
  password: buildOptionalSecretInputSchema(),
  mailbox: z.string().min(1).optional(),
  tls: EmailTlsConfigSource,
});

const EmailPluginConfigSource = z.strictObject({
  defaultAccountId: z.string().min(1).optional(),
  accounts: z.array(EmailAccountConfigSource).min(1),
  downloadPolicy: z
    .strictObject({
      allowedWriteRoots: z.array(z.string().min(1)).optional(),
    })
    .optional(),
});

export const emailPluginConfigSchema: OpenClawPluginConfigSchema = buildPluginConfigSchema(
  EmailPluginConfigSource,
  {
    uiHints: {
      defaultAccountId: {
        label: "Default Account ID",
        help: "Account id used when a tool call omits accountId.",
      },
      "accounts.password": {
        label: "IMAP Password",
        help: "Password or SecretRef used for IMAP LOGIN.",
        sensitive: true,
      },
      "downloadPolicy.allowedWriteRoots": {
        label: "Allowed Attachment Output Roots",
        help: "Absolute paths attachments may be written to. Defaults to the current workspace root.",
      },
    },
  },
);

type EmailAccountConfig = z.infer<typeof EmailAccountConfigSource>;

export type ResolvedEmailAccountConfig = {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: SecretInput;
  mailbox: string;
  tls: {
    rejectUnauthorized: boolean;
  };
};

export type ResolvedEmailAccountRuntimeConfig = ResolvedEmailAccountConfig & {
  password: string;
};

export type ResolvedEmailPluginConfig = {
  defaultAccountId: string;
  accounts: ResolvedEmailAccountConfig[];
  downloadPolicy: {
    allowedWriteRoots: string[];
  };
};

export function resolveEmailPluginConfig(
  pluginConfig: unknown,
  config?: OpenClawConfig,
): ResolvedEmailPluginConfig {
  const parsed = EmailPluginConfigSource.parse(pluginConfig);
  const accounts = parsed.accounts.map((account) => normalizeAccountConfig(account));
  const seen = new Set<string>();
  for (const account of accounts) {
    if (seen.has(account.id)) {
      throw new Error(
        `plugins.entries.email.config.accounts: duplicate account id "${account.id}"`,
      );
    }
    seen.add(account.id);
  }

  const defaultAccountId = normalizeOptionalString(parsed.defaultAccountId) ?? accounts[0]?.id;
  if (!defaultAccountId) {
    throw new Error("plugins.entries.email.config.defaultAccountId: no accounts configured");
  }
  if (!accounts.some((account) => account.id === defaultAccountId)) {
    throw new Error(
      `plugins.entries.email.config.defaultAccountId: unknown account "${defaultAccountId}"`,
    );
  }

  return {
    defaultAccountId,
    accounts,
    downloadPolicy: {
      allowedWriteRoots: normalizeAllowedWriteRoots(
        parsed.downloadPolicy?.allowedWriteRoots,
        resolveDefaultWorkspaceRoot(config),
      ),
    },
  };
}

export async function resolveEmailAccountRuntimeConfig(params: {
  config: OpenClawConfig;
  pluginConfig: ResolvedEmailPluginConfig;
  accountId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ResolvedEmailAccountRuntimeConfig> {
  const account = resolveEmailAccountConfig({
    pluginConfig: params.pluginConfig,
    accountId: params.accountId,
  });
  const accountIndex = params.pluginConfig.accounts.findIndex((entry) => entry.id === account.id);
  const passwordPath = `plugins.entries.email.config.accounts[${accountIndex}].password`;
  const resolved = await resolveConfiguredSecretInputString({
    config: params.config,
    env: params.env ?? process.env,
    value: account.password,
    path: passwordPath,
  });
  if (!resolved.value) {
    throw new Error(`${passwordPath}: IMAP password is required`);
  }
  return {
    ...account,
    password: resolved.value,
  };
}

export function resolveEmailAccountConfig(params: {
  pluginConfig: ResolvedEmailPluginConfig;
  accountId?: string;
}): ResolvedEmailAccountConfig {
  const wantedId =
    normalizeOptionalString(params.accountId) ?? params.pluginConfig.defaultAccountId;
  const account = params.pluginConfig.accounts.find((entry) => entry.id === wantedId);
  if (!account) {
    throw new Error(`plugins.entries.email.config.accounts: unknown account "${wantedId}"`);
  }
  return account;
}

export function assertOutputDirAllowed(outputDir: string, allowedWriteRoots: string[]): string {
  const resolvedOutputDir = path.resolve(outputDir);
  for (const root of allowedWriteRoots) {
    if (isPathInsideRoot(resolvedOutputDir, root)) {
      return resolvedOutputDir;
    }
  }
  throw new Error(
    `outputDir "${resolvedOutputDir}" is outside allowed roots: ${allowedWriteRoots.join(", ")}`,
  );
}

export function sanitizeAttachmentFilename(
  filename: string | undefined,
  fallbackBase: string,
): string {
  const candidate = normalizeOptionalString(filename) ?? fallbackBase;
  const basename = path.basename(candidate.replace(/\\/g, "/"));
  const sanitized = Array.from(basename)
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? "_" : char;
    })
    .join("")
    .trim();
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return fallbackBase;
  }
  return sanitized;
}

function normalizeAccountConfig(account: EmailAccountConfig): ResolvedEmailAccountConfig {
  const id = normalizeOptionalString(account.id);
  const host = normalizeOptionalString(account.host);
  const user = normalizeOptionalString(account.user);
  if (!id || !host || !user) {
    throw new Error("plugins.entries.email.config.accounts: id, host, and user are required");
  }
  const secure = account.secure ?? true;
  return {
    id,
    host,
    port: account.port ?? (secure ? 993 : 143),
    secure,
    user,
    password: account.password,
    mailbox: normalizeOptionalString(account.mailbox) ?? "INBOX",
    tls: {
      rejectUnauthorized: account.tls?.rejectUnauthorized ?? true,
    },
  };
}

function normalizeAllowedWriteRoots(roots: string[] | undefined, defaultRoot: string): string[] {
  const normalized = (roots ?? [])
    .map((root) => normalizeOptionalString(root))
    .filter((root): root is string => Boolean(root))
    .map((root) => path.resolve(root));
  if (normalized.length > 0) {
    return [...new Set(normalized)].toSorted();
  }
  return [path.resolve(defaultRoot)];
}

function resolveDefaultWorkspaceRoot(config?: OpenClawConfig): string {
  const defaults = isRecord(config?.agents?.defaults) ? config?.agents?.defaults : undefined;
  const workspaceValue = defaults?.workspace;
  return typeof workspaceValue === "string"
    ? (normalizeOptionalString(workspaceValue) ?? process.cwd())
    : process.cwd();
}

function isPathInsideRoot(candidate: string, root: string): boolean {
  const resolvedRoot = path.resolve(root);
  if (candidate === resolvedRoot) {
    return true;
  }
  const relative = path.relative(resolvedRoot, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
