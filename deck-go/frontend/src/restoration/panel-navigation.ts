import type { RestoredPanelId } from "./panel-registry";
import type { RestorationUIState } from "./types";

export function navigateToPanel(
  ui: Pick<RestorationUIState, "setActivePanel">,
  panel: RestoredPanelId,
) {
  ui.setActivePanel(panel);
}

export function navigateToAgent(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("agents");
}

export function navigateToRouting(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("routing");
}

export function navigateToChannel(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("channels");
}

export function navigateToPlugin(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("plugins");
}

export function navigateToSession(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("sessions");
}

export function navigateToSubagents(ui: Pick<RestorationUIState, "setActivePanel">) {
  ui.setActivePanel("subagents");
}
