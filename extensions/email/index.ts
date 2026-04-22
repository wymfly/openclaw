import {
  definePluginEntry,
  type AnyAgentTool,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";
import { emailPluginConfigSchema } from "./src/config.js";
import {
  createEmailDownloadAttachmentsTool,
  createEmailListTool,
  createEmailReadTool,
  createEmailSendTool,
} from "./src/tools.js";

export default definePluginEntry({
  id: "email",
  name: "Email",
  description: "Bundled IMAP/SMTP email tools for reading, downloading, and sending messages",
  configSchema: emailPluginConfigSchema,
  register(api: OpenClawPluginApi) {
    api.registerTool(createEmailListTool(api) as AnyAgentTool);
    api.registerTool(createEmailReadTool(api) as AnyAgentTool);
    api.registerTool(createEmailDownloadAttachmentsTool(api) as AnyAgentTool);
    api.registerTool(createEmailSendTool(api) as AnyAgentTool);
  },
});
