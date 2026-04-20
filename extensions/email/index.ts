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
} from "./src/tools.js";

export default definePluginEntry({
  id: "email",
  name: "Email",
  description: "Bundled IMAP email tools for listing messages and downloading attachments",
  configSchema: emailPluginConfigSchema,
  register(api: OpenClawPluginApi) {
    api.registerTool(createEmailListTool(api) as AnyAgentTool);
    api.registerTool(createEmailReadTool(api) as AnyAgentTool);
    api.registerTool(createEmailDownloadAttachmentsTool(api) as AnyAgentTool);
  },
});
