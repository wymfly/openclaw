// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        payload: { kind: "systemEvent" as const, type: "nightly" },
        description: "Nightly sync",
        agentId: "main",
        enabled: true,
        nextRunAtMs: baseTime + 60_000,
      },
      {
        id: "job-b",
        name: "Frequent",
        schedule: { kind: "every" as const, everyMs: 60_000 },
        payload: { kind: "agentTurn" as const, prompt: "ping" },
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
      },
    ],
  };
}

describe("CronPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

  it("loads cron status, inventory, and selected job runs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(CronPanel));
    });

    await waitFor(() => expect(apiMocks.fetchCronJobs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    expect(apiMocks.fetchCronJobs).toHaveBeenCalledWith({ includeDisabled: true });
    expect(apiMocks.fetchCronStatus).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchCronRuns).toHaveBeenCalledWith("job-a", { limit: 20, sortDir: "desc" });
    expect(container.textContent).toContain("running: no");
    expect(container.textContent).toContain("jobs: 2");
    expect(container.textContent).toContain("enabled1");
    expect(container.textContent).toContain("Nightly");
    expect(container.textContent).toContain("Frequent");
    expect(container.textContent).toContain("schedule: 0 0 * * * | enabled: yes");
    expect(container.textContent).toContain("schedule: every 60000ms | enabled: no");
    expect(container.textContent).toContain("job-a-run");
    expect(container.querySelector(".deck-ui-cron")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-cron-card").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-cron-surface").length).toBe(1);
    expect(container.querySelectorAll(".deck-ui-cron-input").length).toBe(9);
    expect(container.querySelectorAll(".deck-ui-cron-button").length).toBe(10);
    expect(container.querySelectorAll(".deck-ui-cron-row").length).toBe(2);
    expect(container.querySelector(".deck-ui-cron-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-cron-details")).toBeTruthy();

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Nightly");
  });

  it("runs and deletes the selected job while preserving preferred selection", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(CronPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Frequent"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchCronRuns).toHaveBeenCalledWith("job-b", {
        limit: 20,
        sortDir: "desc",
      }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Run now")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.runCronJob).toHaveBeenCalledWith("job-b", { mode: "force" }),
    );
    expect(container.textContent).toContain("Last cron action");

    const selectedAfterRun = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterRun?.textContent).toContain("Frequent");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteCronJob).toHaveBeenCalledWith("job-b"));
    expect(window.confirm).toHaveBeenCalledWith("Delete cron job job-b?");
  });

  it("does not delete a cron job when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(CronPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete cron job job-a?");
    expect(apiMocks.deleteCronJob).not.toHaveBeenCalled();
  });

  it("applies schedule templates to the cron draft", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(CronPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    const scheduleKindSelect = container.querySelector("select") as HTMLSelectElement;
    const scheduleInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="cron schedule value"]',
    );
    expect(scheduleKindSelect.value).toBe("cron");
    expect(scheduleInput?.value).toBe("0 9 * * *");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Hourly")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(scheduleKindSelect.value).toBe("cron");
    expect(scheduleInput?.value).toBe("0 * * * *");
  });

  it("creates cron jobs and saves selected job edits through the Gateway-backed facade", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(CronPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Cron ready"));

    const textInputs = Array.from(container.querySelectorAll("input"));
    const [nameInput, scheduleInput, agentIdInput] = textInputs.filter(
      (input) => input.type !== "checkbox",
    );
    const selects = Array.from(container.querySelectorAll("select"));
    const [, sessionTargetSelect, , payloadKindSelect] = selects;
    const [payloadTextarea, descriptionTextarea] = Array.from(
      container.querySelectorAll("textarea"),
    );

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Daily review" } });
      fireEvent.change(scheduleInput, { target: { value: "0 8 * * *" } });
      fireEvent.change(payloadKindSelect, { target: { value: "agentTurn" } });
      fireEvent.change(agentIdInput, { target: { value: "reviewer" } });
      fireEvent.change(payloadTextarea, { target: { value: "brief me" } });
      fireEvent.change(descriptionTextarea, { target: { value: "Daily review prompt" } });
    });

    expect(sessionTargetSelect.value).toBe("isolated");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create job")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Frequent"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Load selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const editTextInputs = Array.from(container.querySelectorAll("input")).filter(
      (input): input is HTMLInputElement =>
        input instanceof HTMLInputElement && input.type !== "checkbox",
    );
    const editSelects = Array.from(container.querySelectorAll("select"));
    const editTextareas = Array.from(container.querySelectorAll("textarea"));
    const enabledInput = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(editTextInputs[0].value).toBe("Frequent");
    expect(editSelects[0].value).toBe("every");
    expect(editTextInputs[1].value).toBe("60000");
    expect(editSelects[1].value).toBe("isolated");
    expect(editSelects[3].value).toBe("agentTurn");
    expect(editTextareas[0].value).toBe("ping");
    expect(enabledInput.checked).toBe(false);

    await act(async () => {
      fireEvent.change(editTextInputs[0], { target: { value: "Frequent edited" } });
      fireEvent.change(editTextInputs[1], { target: { value: "120000" } });
      fireEvent.change(editTextareas[0], { target: { value: "heartbeat" } });
      fireEvent.click(enabledInput);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateCronJob).toHaveBeenCalledWith("job-b", {
        name: "Frequent edited",
        schedule: { kind: "every", everyMs: 120000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "heartbeat" },
        description: "",
        enabled: true,
      }),
    );
  });
});
