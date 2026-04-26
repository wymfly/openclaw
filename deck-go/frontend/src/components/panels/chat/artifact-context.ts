import { createContext } from "react";
import type { ArtifactInfo } from "./artifacts/detectArtifact";

export const ArtifactContext = createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
  onToggleArtifactPanel: () => void;
  artifactPanelOpen: boolean;
}>({
  onOpenArtifact: () => {},
  onToggleArtifactPanel: () => {},
  artifactPanelOpen: false,
});
