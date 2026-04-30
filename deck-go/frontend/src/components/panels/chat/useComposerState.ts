import { useCallback, useState } from "react";

/**
 * Encapsulates the composer's transient draft state — input string, attached
 * files, in-flight send flag — and exposes stable setters. Send/abort/slash
 * logic stays in `MessageInput` since it depends on multiple stores +
 * navigation flows; this hook is intentionally pure plumbing.
 */
export interface ComposerState {
  /** Current draft text. */
  input: string;
  /** Set draft text. */
  setInput: (next: string) => void;
  /** Currently attached files. */
  files: File[];
  /** Append files (caller is responsible for size validation upstream). */
  addFiles: (next: File[]) => void;
  /** Remove a file by index. */
  removeFile: (index: number) => void;
  /** Replace the entire file list (e.g. clear after send). */
  setFiles: (next: File[]) => void;
  /** True while a send round-trip is in flight. */
  isSending: boolean;
  /** Update the in-flight flag. */
  setIsSending: (next: boolean) => void;
}

/**
 * @param controlledValue When provided, the input string is treated as
 * controlled by the caller and the hook's internal state is ignored.
 * @param onControlledChange Notified whenever `setInput` runs; useful for
 * controlled callers that derive the value from an external source.
 */
export function useComposerState(
  controlledValue?: string,
  onControlledChange?: (next: string) => void,
): ComposerState {
  const [draft, setDraft] = useState("");
  const [files, setFilesState] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  const input = controlledValue ?? draft;

  const setInput = useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setDraft(next);
      }
      onControlledChange?.(next);
    },
    [controlledValue, onControlledChange],
  );

  const addFiles = useCallback((next: File[]) => {
    if (next.length === 0) {
      return;
    }
    setFilesState((current) => [...current, ...next]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFilesState((current) => current.filter((_, item) => item !== index));
  }, []);

  const setFiles = useCallback((next: File[]) => {
    setFilesState(next);
  }, []);

  return {
    input,
    setInput,
    files,
    addFiles,
    removeFile,
    setFiles,
    isSending,
    setIsSending,
  };
}
