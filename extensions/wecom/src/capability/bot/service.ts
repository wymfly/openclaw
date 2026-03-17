import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { WecomAccountRuntime } from "../../app/account-runtime.js";
import type { ReqIdStore } from "../../enhanced/reqid-store.js";
import { startBotWebhookTransport } from "../../transport/bot-webhook/http-handler.js";
import { BotWsSdkAdapter } from "../../transport/bot-ws/sdk-adapter.js";
import type { WecomRuntimeEnv } from "../../types/runtime-context.js";

export class WecomBotCapabilityService {
  private wsAdapter?: BotWsSdkAdapter;
  private stopTransport?: () => void;

  constructor(
    private readonly runtime: WecomAccountRuntime,
    private readonly cfg: OpenClawConfig,
    private readonly runtimeEnv: WecomRuntimeEnv,
  ) {}

  start(): { transport: "bot-ws" | "bot-webhook"; descriptors: string[] } | undefined {
    const bot = this.runtime.account.bot;
    if (!bot?.configured) {
      return undefined;
    }

    if (bot.primaryTransport === "ws") {
      this.wsAdapter = new BotWsSdkAdapter(this.runtime, {
        info: this.runtimeEnv.log,
        warn: this.runtimeEnv.log,
        error: this.runtimeEnv.error,
      });
      this.wsAdapter.start();
      this.stopTransport = () => this.wsAdapter?.stop();
      return {
        transport: "bot-ws",
        descriptors: ["ws:primary"],
      };
    }

    const webhook = startBotWebhookTransport({
      account: bot,
      cfg: this.cfg,
      runtime: this.runtime,
      runtimeEnv: this.runtimeEnv,
    });
    this.stopTransport = webhook.stop;
    return {
      transport: "bot-webhook",
      descriptors: webhook.paths,
    };
  }

  /** [enhanced] Allow gateway-monitor to inject a reqId dedup store into the ws adapter. */
  injectReqIdStore(store: ReqIdStore): void {
    if (this.wsAdapter) {
      this.wsAdapter.reqIdStore = store;
    }
  }

  stop(): void {
    this.stopTransport?.();
    this.stopTransport = undefined;
    this.wsAdapter = undefined;
  }
}
