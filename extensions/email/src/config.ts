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

const EmailSmtpConfigSource = z
  .strictObject({
    host: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65_535).optional(),
    secure: z.boolean().optional(),
    startTls: z.boolean().optional(),
    user: z.string().min(1).optional(),
    password: buildOptionalSecretInputSchema(),
    from: z.string().min(1).optional(),
    authMethod: z.enum(["login", "plain"]).optional(),
    tls: EmailTlsConfigSource,
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
  smtp: EmailSmtpConfigSource,
  tls: EmailTlsConfigSource,
});

const EmailPluginConfigSource = z.strictObject({
  defaultAccountId: z.string().min(1).optional(),
  accounts: z.array(EmailAccountConfigSource).min(1),
  sendPolicy: z
    .strictObject({
      allowedReadRoots: z.array(z.string().min(1)).optional(),
    })
    .optional(),
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
      "accounts.smtp.password": {
        label: "SMTP Password",
        help: "Password or SecretRef used for SMTP AUTH. Falls back to the IMAP password when omitted.",
        sensitive: true,
      },
      "accounts.smtp.from": {
        label: "Default From Address",
        help: "Envelope/header sender address used by email_send when the tool call omits from.",
      },
      "sendPolicy.allowedReadRoots": {
        label: "Allowed Attachment Read Roots",
        help: "Absolute paths email_send attachments may be read from. Defaults to the current workspace root.",
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
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    startTls: boolean;
    user: string;
    password?: SecretInput;
    from: string;
    authMethod: "login" | "plain";
    tls: {
      rejectUnauthorized: boolean;
    };
  };
  tls: {
    rejectUnauthorized: boolean;
  };
};

export type ResolvedEmailAccountRuntimeConfig = ResolvedEmailAccountConfig & {
  password: string;
};

export type ResolvedEmailSmtpRuntimeConfig = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  user: string;
  password: string;
  from: string;
  authMethod: "login" | "plain";
  tls: {
    rejectUnauthorized: boolean;
  };
};

export type ResolvedEmailPluginConfig = {
  defaultAccountId: string;
  accounts: ResolvedEmailAccountConfig[];
  sendPolicy: {
    allowedReadRoots: string[];
  };
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
    sendPolicy: {
      allowedReadRoots: normalizeAllowedPaths(
        parsed.sendPolicy?.allowedReadRoots,
        resolveDefaultWorkspaceRoot(config),
      ),
    },
    downloadPolicy: {
      allowedWriteRoots: normalizeAllowedPaths(
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

export async function resolveEmailSmtpRuntimeConfig(params: {
  config: OpenClawConfig;
  pluginConfig: ResolvedEmailPluginConfig;
  accountId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ResolvedEmailSmtpRuntimeConfig> {
  const account = resolveEmailAccountConfig({
    pluginConfig: params.pluginConfig,
    accountId: params.accountId,
  });
  const smtp = account.smtp;
  if (!smtp) {
    throw new Error(
      `plugins.entries.email.config.accounts.${account.id}.smtp: SMTP is not configured`,
    );
  }
  const accountIndex = params.pluginConfig.accounts.findIndex((entry) => entry.id === account.id);
  const passwordPath = `plugins.entries.email.config.accounts[${accountIndex}].smtp.password`;
  const resolved = await resolveConfiguredSecretInputString({
    config: params.config,
    env: params.env ?? process.env,
    value: smtp.password ?? account.password,
    path: passwordPath,
  });
  if (!resolved.value) {
    throw new Error(`${passwordPath}: SMTP password is required`);
  }
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    startTls: smtp.startTls,
    user: smtp.user,
    password: resolved.value,
    from: smtp.from,
    authMethod: smtp.authMethod,
    tls: smtp.tls,
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

export function assertInputFileAllowed(inputPath: string, allowedReadRoots: string[]): string {
  const resolvedInputPath = path.resolve(inputPath);
  for (const root of allowedReadRoots) {
    if (isPathInsideRoot(resolvedInputPath, root)) {
      return resolvedInputPath;
    }
  }
  throw new Error(
    `attachment path "${resolvedInputPath}" is outside allowed roots: ${allowedReadRoots.join(", ")}`,
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
    smtp: normalizeSmtpConfig(account),
    tls: {
      rejectUnauthorized: account.tls?.rejectUnauthorized ?? true,
    },
  };
}

function normalizeSmtpConfig(account: EmailAccountConfig): ResolvedEmailAccountConfig["smtp"] {
  if (!account.smtp) {
    return undefined;
  }
  const secure = account.smtp.secure ?? false;
  const startTls = account.smtp.startTls ?? !secure;
  return {
    host: normalizeOptionalString(account.smtp.host) ?? normalizeOptionalString(account.host) ?? "",
    port: account.smtp.port ?? (secure ? 465 : startTls ? 587 : 25),
    secure,
    startTls,
    user: normalizeOptionalString(account.smtp.user) ?? normalizeOptionalString(account.user) ?? "",
    password: account.smtp.password ?? account.password,
    from: normalizeOptionalString(account.smtp.from) ?? normalizeOptionalString(account.user) ?? "",
    authMethod: account.smtp.authMethod ?? "login",
    tls: {
      rejectUnauthorized: account.smtp.tls?.rejectUnauthorized ?? true,
    },
  };
}

function normalizeAllowedPaths(roots: string[] | undefined, defaultRoot: string): string[] {
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
