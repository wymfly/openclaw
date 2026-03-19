"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { AddModelSelect } from "./AddModelSelect";
import { ModelCard } from "./ModelCard";
import { PrimaryModelCard } from "./PrimaryModelCard";

interface FallbackChainProps {
  type: "text" | "image";
  primary: string | null;
  fallbacks: string[];
  models: Model[];
  auth: AuthOverviewEntry[];
  onUpdate: (primary: string, fallbacks: string[]) => Promise<boolean>;
}

/** Resolve a model ref like "openai/gpt-4o" to a Model object. */
function findModel(models: Model[], ref: string): Model | undefined {
  const [provider, ...rest] = ref.split("/");
  const modelId = rest.join("/");
  return models.find((m) => m.provider === provider && m.id === modelId);
}

/** Find auth entry for a given model ref. */
function findAuth(auth: AuthOverviewEntry[], ref: string): AuthOverviewEntry | undefined {
  const provider = ref.split("/")[0];
  return auth.find((a) => a.provider === provider);
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Main fallback chain container with drag-and-drop reordering.
 * Renders: PrimaryModelCard -> arrow connectors -> sortable ModelCards -> AddModelSelect
 * Auto-saves changes with 500ms debounce.
 */
export function FallbackChain({
  type,
  primary,
  fallbacks,
  models,
  auth,
  onUpdate,
}: FallbackChainProps) {
  const t = useTranslations("models");

  // Local state that tracks the fallbacks for optimistic UI
  const [localFallbacks, setLocalFallbacks] = useState(fallbacks);
  const [localPrimary, setLocalPrimary] = useState(primary);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when props change (e.g. after fetch)
  useEffect(() => {
    setLocalFallbacks(fallbacks);
  }, [fallbacks]);
  useEffect(() => {
    setLocalPrimary(primary);
  }, [primary]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Debounced save
  const debouncedSave = useCallback(
    (nextPrimary: string, nextFallbacks: string[]) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      setSaveState("saving");

      debounceTimer.current = setTimeout(async () => {
        try {
          const ok = await onUpdate(nextPrimary, nextFallbacks);
          if (ok) {
            setSaveState("saved");
            // Clear "saved" indicator after 2s
            if (savedTimer.current) {
              clearTimeout(savedTimer.current);
            }
            savedTimer.current = setTimeout(() => setSaveState("idle"), 2000);
          } else {
            // Revert on failure
            setSaveState("error");
            setLocalFallbacks(fallbacks);
            setLocalPrimary(primary);
            if (savedTimer.current) {
              clearTimeout(savedTimer.current);
            }
            savedTimer.current = setTimeout(() => setSaveState("idle"), 3000);
          }
        } catch {
          setSaveState("error");
          setLocalFallbacks(fallbacks);
          setLocalPrimary(primary);
          if (savedTimer.current) {
            clearTimeout(savedTimer.current);
          }
          savedTimer.current = setTimeout(() => setSaveState("idle"), 3000);
        }
      }, 500);
    },
    [onUpdate, fallbacks, primary],
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    };
  }, []);

  // Drag end handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      setLocalFallbacks((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }
        const next = arrayMove(prev, oldIndex, newIndex);

        if (localPrimary) {
          debouncedSave(localPrimary, next);
        }
        return next;
      });
    },
    [localPrimary, debouncedSave],
  );

  // Change primary model
  const handleChangePrimary = useCallback(
    (newRef: string) => {
      setLocalPrimary(newRef);
      debouncedSave(newRef, localFallbacks);
    },
    [localFallbacks, debouncedSave],
  );

  // Add a fallback model
  const handleAdd = useCallback(
    (ref: string) => {
      const next = [...localFallbacks, ref];
      setLocalFallbacks(next);
      if (localPrimary) {
        debouncedSave(localPrimary, next);
      }
    },
    [localFallbacks, localPrimary, debouncedSave],
  );

  // Remove a fallback model
  const handleRemove = useCallback(
    (ref: string) => {
      const next = localFallbacks.filter((f) => f !== ref);
      setLocalFallbacks(next);
      if (localPrimary) {
        debouncedSave(localPrimary, next);
      }
    },
    [localFallbacks, localPrimary, debouncedSave],
  );

  // All model refs in the chain (for exclude logic)
  const excludeRefs = useMemo(
    () => [localPrimary, ...localFallbacks].filter(Boolean) as string[],
    [localPrimary, localFallbacks],
  );

  const primaryModel = localPrimary ? findModel(models, localPrimary) : undefined;
  const primaryAuth = localPrimary ? findAuth(auth, localPrimary) : undefined;

  return (
    <div className="space-y-2">
      {/* Section header with save status */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {type === "text" ? t("fallbacks.textModels") : t("fallbacks.imageModels")}
        </h3>
        <SaveIndicator state={saveState} />
      </div>

      {/* No primary selected */}
      {!localPrimary ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-8 text-center">
          <ShieldAlert size={24} className="text-muted-foreground/50" />
          <p className="max-w-xs text-xs text-muted-foreground">
            {type === "image" ? t("fallbacks.emptyImage") : t("fallbacks.noPrimary")}
          </p>
          <AddModelSelect
            models={models}
            auth={auth}
            excludeRefs={excludeRefs}
            onAdd={(ref) => {
              setLocalPrimary(ref);
              debouncedSave(ref, localFallbacks);
            }}
          />
        </div>
      ) : (
        <div className="space-y-0">
          {/* Primary model card */}
          <PrimaryModelCard
            modelRef={localPrimary}
            model={primaryModel}
            auth={primaryAuth}
            models={models}
            onChangePrimary={handleChangePrimary}
          />

          {/* Arrow connector: primary -> fallbacks */}
          <div className="flex items-center justify-center py-1">
            <ChevronDown className="text-muted-foreground/50" size={16} />
            <span className="ml-1 text-xs text-muted-foreground/50">
              {t("fallbacks.failsOver")}
            </span>
          </div>

          {/* Sortable fallback cards */}
          {localFallbacks.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={localFallbacks} strategy={verticalListSortingStrategy}>
                <div className="space-y-0">
                  {localFallbacks.map((ref, idx) => (
                    <div key={ref}>
                      <ModelCard
                        id={ref}
                        model={findModel(models, ref)}
                        auth={findAuth(auth, ref)}
                        onRemove={() => handleRemove(ref)}
                      />
                      {/* Arrow between fallback cards */}
                      {idx < localFallbacks.length - 1 && (
                        <div className="flex items-center justify-center py-1">
                          <ChevronDown className="text-muted-foreground/30" size={14} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              {t("fallbacks.empty")}
            </div>
          )}

          {/* Add fallback button */}
          <div className="pt-2">
            <AddModelSelect
              models={models}
              auth={auth}
              excludeRefs={excludeRefs}
              onAdd={handleAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Save state indicator: spinner / check / error. */
function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("models");

  if (state === "idle") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {state === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">{t("fallbacks.saving")}</span>
        </>
      )}
      {state === "saved" && (
        <>
          <Check size={12} className="text-green-500" />
          <span className="text-green-500">{t("fallbacks.saved")}</span>
        </>
      )}
      {state === "error" && <span className="text-red-400">{t("fallbacks.saveFailed")}</span>}
    </div>
  );
}
