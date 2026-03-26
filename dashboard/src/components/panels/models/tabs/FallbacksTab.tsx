"use client";

import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModelsStore } from "@/stores/models";
import { FallbackChain } from "../fallbacks/FallbackChain";

/**
 * Fallbacks tab — two fallback chain editors:
 *   1. Text models (primary + fallbacks)
 *   2. Image models (primary + fallbacks)
 *
 * Drag-and-drop reordering with auto-save.
 */
export function FallbacksTab() {
  const {
    usableModels: models,
    authOverview,
    primaryModel,
    fallbacks,
    imagePrimaryModel,
    imageFallbacks,
    fetchFallbacks,
    fetchUsableModels,
    fetchAuthOverview,
    updateFallbacks,
    updateImageFallbacks,
  } = useModelsStore();

  useEffect(() => {
    void fetchFallbacks();
    void fetchUsableModels();
    void fetchAuthOverview();
  }, [fetchFallbacks, fetchUsableModels, fetchAuthOverview]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-8 max-w-2xl">
        {/* Text model fallback chain */}
        <FallbackChain
          type="text"
          primary={primaryModel}
          fallbacks={fallbacks}
          models={models}
          auth={authOverview}
          onUpdate={(p, f) => updateFallbacks(p, f)}
        />

        {/* Image model fallback chain */}
        <div className="border-t border-border pt-6">
          <FallbackChain
            type="image"
            primary={imagePrimaryModel}
            fallbacks={imageFallbacks}
            models={models}
            auth={authOverview}
            onUpdate={(p, f) => updateImageFallbacks(p, f)}
          />
        </div>
      </div>
    </ScrollArea>
  );
}
