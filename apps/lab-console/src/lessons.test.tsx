import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scenarios } from "./content/scenarios.js";
import { ResponsePanel } from "./components/ResponsePanel.js";
import { XssPreview } from "./components/XssPreview.js";
import { initialExperimentState } from "./lib/experiment-reducer.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("complete security lessons", () => {
  it("defines four beginner-first five-step scenarios", () => {
    expect(Object.keys(scenarios)).toEqual(["sql", "xss", "idor", "csrf"]);
    for (const scenario of Object.values(scenarios)) {
      expect(scenario.steps).toHaveLength(5);
      expect(scenario.whatHappens.length).toBeGreaterThan(20);
      expect(scenario.whyItWorks.length).toBeGreaterThan(20);
    }
    expect(scenarios.csrf.whyItWorks).toContain("CORS не является CSRF-защитой");
  });

  it("renders a blocked exercise as successful protection", () => {
    render(<ResponsePanel state={{ ...initialExperimentState, status: "complete", result: {
      traceId: "trace", outcome: "blocked", status: 403, body: {}
    } }} />);
    expect(screen.getByText("Защита сработала")).toBeTruthy();
  });

  it("acknowledges only the fixed XSS browser message", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/render?")
      ? new Response("<p>preview</p>", { status: 200 })
      : Response.json({ acknowledged: true }));
    vi.stubGlobal("fetch", fetch);
    const traceId = "00000000-0000-4000-8000-000000000001";
    render(<XssPreview traceId={traceId} />);
    window.dispatchEvent(new MessageEvent("message", { data: { type: "lab-xss", traceId } }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/xss/exercise/browser-event", expect.objectContaining({ method: "POST" })));
  });
});
