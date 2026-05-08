// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { CronPanel } from "./CronPanel";

const apiMocks = vi.hoisted(() => ({
  createCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
  fetchCronJobs: vi.fn(),
  fetchCronRuns: vi.fn(),
  fetchCronStatus: vi.fn(),
  runCronJob: vi.fn(),
  updateCronJob: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

const baseTime = Date.now();

function jobsPayload() {
  return {
    jobs: [
      {
        id: "job-a",
        name: "Nightly",
        schedule: { kind: "cron" as const, expr: "0 0 * * *" },
        payload: { kind: "systemEvent" as const, text: "nightly" },
        description: "Nightly sync",
        agentId: "main",
        sessionTarget: "main",
        wakeMode: "now",
        enabled: true,
        nextRunAtMs: baseTime + 60_000,
        createdAtMs: baseTime - 120_000,
        updatedAtMs: baseTime - 60_000,
      },
      {
        id: "job-b",
        name: "Frequent",
        schedule: { kind: "every" as const, everyMs: 60_000 },
        payload: { kind: "agentTurn" as const, message: "ping" },
        sessionTarget: "isolated",
        wakeMode: "now",
        enabled: false,
        nextRunAtMs: baseTime + 120_000,
      },
    ],
  };
}

function runsPayload(jobId: string) {
  return {
    entries: [
      {
        id: `${jobId}-run`,
        jobId,
        status: jobId === "job-a" ? ("ok" as const) : ("error" as const),
        ts: baseTime,
        durationMs: 333,
      },
    ],
  };
}

function renderCronPanel(locale: "en" | "zh" = "en") {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckIntlProvider, { locale }, createElement(CronPanel)),
    ),
  );
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

describe("CronPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchCronJobs.mockResolvedValue(jobsPayload());
    apiMocks.fetchCronStatus.mockResolvedValue({
      running: false,
      jobCount: 2,
      nextRunAtMs: baseTime + 60_000,
    });
    apiMocks.fetchCronRuns.mockImplementation((jobId: string) =>
      Promise.resolve(runsPayload(jobId)),
    );
    apiMocks.createCronJob.mockResolvedValue({
      ...jobsPayload().jobs[0],
      id: "job-c",
      name: "Daily review",
    });
    apiMocks.runCronJob.mockResolvedValue({ ok: true, action: "run" });
    apiMocks.deleteCronJob.mockResolvedValue({ ok: true, action: "delete" });
    apiMocks.updateCronJob.mockResolvedValue({ ...jobsPayload().jobs[1], name: "Frequent edited" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads cron status, inventory, filters, and selected detail", async () => {
    await act(async () => {
      renderCronPanel();
    });

    await waitFor(() => expect(apiMocks.fetchCronJobs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    expect(apiMocks.fetchCronJobs).toHaveBeenCalledWith({ includeDisabled: true });
    expect(apiMocks.fetchCronStatus).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchCronRuns).toHaveBeenCalledWith("job-a", { limit: 20, sortDir: "desc" });
    expect(container.textContent).toContain("Scheduled jobs");
    expect(container.textContent).toContain("Nightly");
    expect(container.textContent).toContain("Frequent");
    expect(container.textContent).toContain("Selected Job");
    expect(container.textContent).toContain("0 0 * * *");
    expect(container.querySelector(".cron-panel__topbar")).toBeTruthy();
    expect(container.querySelectorAll(".cron-panel__job-row").length).toBe(2);

    await act(async () => {
      fireEvent.change(container.querySelector(".cron-panel__search input") as HTMLInputElement, {
        target: { value: "nightly" },
      });
    });

    expect(container.querySelectorAll(".cron-panel__job-row").length).toBe(1);
    expect(container.textContent).toContain("Nightly");

    await act(async () => {
      buttonByText("History")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Run History");
    expect(container.textContent).toContain("OK");
  });

  it("creates and edits cron jobs through the builder dialog", async () => {
    await act(async () => {
      renderCronPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    await act(async () => {
      buttonByText("New Job")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const createDialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(createDialog.textContent).toContain("New scheduled job");
    const textInputs = Array.from(createDialog.querySelectorAll("input")).filter(
      (input): input is HTMLInputElement =>
        input instanceof HTMLInputElement && input.type !== "checkbox",
    );
    const selects = Array.from(createDialog.querySelectorAll("select"));
    const textareas = Array.from(createDialog.querySelectorAll("textarea"));

    await act(async () => {
      fireEvent.change(textInputs[0], { target: { value: "Daily review" } });
      fireEvent.change(textInputs[1], { target: { value: "0 8 * * *" } });
      fireEvent.change(selects[3], { target: { value: "agentTurn" } });
      fireEvent.change(textInputs[2], { target: { value: "reviewer" } });
      fireEvent.change(textareas[0], { target: { value: "brief me" } });
      fireEvent.change(textareas[1], { target: { value: "Daily review prompt" } });
    });

    expect(selects[1].value).toBe("isolated");

    await act(async () => {
      buttonByText("Create Job")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createCronJob).toHaveBeenCalledWith({
        name: "Daily review",
        schedule: { kind: "cron", expr: "0 8 * * *" },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "brief me" },
        description: "Daily review prompt",
        enabled: true,
        agentId: "reviewer",
      }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll(".cron-panel__job-row"))
        .find((row) => row.textContent?.includes("Frequent"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Edit Job")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const editDialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const editInputs = Array.from(editDialog.querySelectorAll("input")).filter(
      (input): input is HTMLInputElement =>
        input instanceof HTMLInputElement && input.type !== "checkbox",
    );
    const editSelects = Array.from(editDialog.querySelectorAll("select"));
    const editTextareas = Array.from(editDialog.querySelectorAll("textarea"));
    const enabledInput = editDialog.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(editInputs[0].value).toBe("Frequent");
    expect(editSelects[0].value).toBe("every");
    expect(editInputs[1].value).toBe("60000");
    expect(editTextareas[0].value).toBe("ping");
    expect(enabledInput.checked).toBe(false);

    await act(async () => {
      fireEvent.change(editInputs[0], { target: { value: "Frequent edited" } });
      fireEvent.change(editInputs[1], { target: { value: "120000" } });
      fireEvent.click(enabledInput);
    });
    await act(async () => {
      buttonByText("Save selected")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateCronJob).toHaveBeenCalledWith("job-b", {
        name: "Frequent edited",
        schedule: { kind: "every", everyMs: 120000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "ping" },
        description: "",
        enabled: true,
      }),
    );
  });

  it("runs, toggles, and deletes with in-app confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    await act(async () => {
      renderCronPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    await act(async () => {
      buttonByText("Run Now")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.runCronJob).toHaveBeenCalledWith("job-a", { mode: "force" }),
    );
    expect(container.textContent).toContain("Last cron action");

    await act(async () => {
      buttonByText("Disable")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.updateCronJob).toHaveBeenCalledWith("job-a", { enabled: false }),
    );

    await act(async () => {
      buttonByText("Delete Job")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Delete scheduled job?",
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    await act(async () => {
      buttonByText("Cancel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(apiMocks.deleteCronJob).not.toHaveBeenCalled();

    await act(async () => {
      buttonByText("Delete Job")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      const deleteButtons = Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent === "Delete Job",
      );
      deleteButtons.at(-1)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(apiMocks.deleteCronJob).toHaveBeenCalledWith("job-a"));
  });

  it("renders the cron shell in Chinese", async () => {
    await act(async () => {
      renderCronPanel("zh");
    });

    await waitFor(() => expect(container.textContent).toContain("定时任务"));
    expect(container.textContent).toContain("调度任务");
    expect(container.textContent).toContain("自动化 · Cron");
  });
});
