/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreamProgress } from "./StreamProgress";

// ── matchMedia mock ─────────────────────────────────────────────────────────

/** Installs a matchMedia mock that reports the given reduced-motion preference. */
function mockMatchMedia(prefersReduced: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? prefersReduced : false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// ── Existing: reduced-motion tests ──────────────────────────────────────────

describe("StreamProgress reduced-motion fallback", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("animates the fill when reduced motion is not requested", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);

    const bar = screen.getByRole("progressbar");
    expect(bar.parentElement).toHaveClass("stream-progress--animated");
    expect(bar.parentElement).toHaveAttribute("data-reduced-motion", "false");

    const fill = bar.querySelector(".stream-progress__fill") as HTMLElement;
    expect(fill.style.transition).toBe("width 400ms ease");
  });

  it("renders a static fill when reduced motion is requested", () => {
    mockMatchMedia(true);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);

    const bar = screen.getByRole("progressbar");
    expect(bar.parentElement).toHaveClass("stream-progress--static");
    expect(bar.parentElement).toHaveAttribute("data-reduced-motion", "true");

    const fill = bar.querySelector(".stream-progress__fill") as HTMLElement;
    expect(fill.style.transition).toBe("none");
    // The fill is still positioned to reflect progress — only the motion is removed.
    expect(fill.style.width).toBe("50%");
  });

  it("preserves the accessible progress value regardless of motion preference", () => {
    mockMatchMedia(true);
    render(<StreamProgress status="active" accruedAmount={25} totalAmount={100} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });
});

// ── Color-blind safe patterns ───────────────────────────────────────────────

describe("StreamProgress color-blind safe patterns", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it.each([
    ["active", "cb-pattern--active"],
    ["paused", "cb-pattern--paused"],
    ["draft", "cb-pattern--draft"],
    ["ended", "cb-pattern--ended"],
    ["withdrawn", "cb-pattern--ended"],
    ["cancelled", "cb-pattern--cancelled"],
  ] as const)("applies the %s fill texture class", (status, patternClass) => {
    mockMatchMedia(false);
    const { container } = render(
      <StreamProgress status={status} accruedAmount={50} totalAmount={100} />
    );

    const fill = container.querySelector(".stream-progress__fill");
    expect(fill).toHaveClass("cb-pattern");
    expect(fill).toHaveClass(patternClass);
  });
});

// ── Keyboard focus ──────────────────────────────────────────────────────────

describe("StreamProgress keyboard focus", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("is reachable via keyboard tab order", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("tabIndex", "0");
  });

  it("receives real DOM focus and carries the shared focus-visible class hook", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);

    const bar = screen.getByRole("progressbar");
    bar.focus();

    expect(bar).toHaveFocus();
    expect(bar).toHaveClass("stream-progress__track");
  });
});

// ── Progressbar role tests ──────────────────────────────────────────────────

describe("StreamProgress progressbar semantics", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("has correct aria attributes for active stream", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={25} totalAmount={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "25% accrued");
  });

  it("shows 'Not started' for draft status", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="draft" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuetext", "Not started");
  });

  it("shows 'Completed' for ended status", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="ended" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "Completed");
  });
});

// ── Spacing/typography design tokens (FWC26 Stellar Wave) ───────────────────

describe("StreamProgress spacing/typography design tokens", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "globals.css"), "utf8");

  /** Returns the declaration block body for a top-level CSS selector. */
  function ruleBody(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  }

  it("defines the spacing scale tokens referenced across the app", () => {
    for (const token of ["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-8"]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("defines the typography scale tokens referenced across the app", () => {
    for (const token of ["--text-xs", "--text-sm", "--text-base", "--text-lg", "--text-xl", "--text-2xl", "--text-4xl"]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("defines the font-weight tokens referenced across the app", () => {
    for (const token of ["--font-medium", "--font-semibold", "--font-bold"]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("pins the track/label gap to a spacing token instead of a hardcoded rem value", () => {
    const rule = ruleBody(".stream-progress");
    expect(rule).toContain("gap: var(--space-2)");
  });

  it("pins the meta row gap to a spacing token", () => {
    const rule = ruleBody(".stream-progress__meta");
    expect(rule).toContain("gap: var(--space-4)");
  });

  it("pins the percentage label's typography to design tokens", () => {
    const rule = ruleBody(".stream-progress__label");
    expect(rule).toContain("font-size: var(--text-sm)");
    expect(rule).toContain("font-weight: var(--font-semibold)");
  });

  it("pins the remaining-balance font-size to a typography token", () => {
    const rule = ruleBody(".stream-progress__remaining");
    expect(rule).toContain("font-size: var(--text-xs)");
  });
});

// ── Aria-live announcements ─────────────────────────────────────────────────

describe("StreamProgress aria-live announcements", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("renders a LiveRegion with data-testid stream-progress-live", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);
    expect(screen.getByTestId("stream-progress-live")).toBeInTheDocument();
  });

  it("has empty announcement on initial render (no false positive)", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);
    const region = screen.getByTestId("stream-progress-live");
    expect(region).toHaveTextContent("");
  });

  it("announces 'Stream paused' when status changes to paused", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="paused" accruedAmount={50} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream paused");
  });

  it("announces 'Stream completed' when status changes to ended", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="ended" accruedAmount={100} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream completed");
  });

  it("announces 'Stream withdrawn' when status changes to withdrawn", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="withdrawn" accruedAmount={50} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream withdrawn");
  });

  it("announces 'Stream cancelled' when status changes to cancelled", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="cancelled" accruedAmount={50} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream cancelled");
  });

  it("announces 'Stream resumed' when status changes from paused to active", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="paused" accruedAmount={50} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream resumed");
  });

  it("announces progress milestone when percent changes by >= 10", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={20} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="active" accruedAmount={50} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("Stream progress: 50% accrued");
  });

  it("does not announce for small percent changes (< 10%)", () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <StreamProgress status="active" accruedAmount={20} totalAmount={100} />,
    );
    rerender(
      <StreamProgress status="active" accruedAmount={25} totalAmount={100} />,
    );
    expect(screen.getByTestId("stream-progress-live")).toHaveTextContent("");
  });

  it("live region uses polite politeness by default", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={50} totalAmount={100} />);
    const region = screen.getByTestId("stream-progress-live");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
  });
});

// ── Empty state tests ───────────────────────────────────────────────────────

describe("StreamProgress empty state", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("renders empty state when status is empty", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="empty" />);

    expect(screen.getByText("Stream Progress")).toBeInTheDocument();
    expect(screen.getByText("No active stream found")).toBeInTheDocument();
    expect(
      screen.getByText(
        "There is no stream progress to track. Start a stream to see live accumulation."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a stream" })).toBeInTheDocument();
  });

  it("renders empty state when isEmpty prop is true", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" isEmpty={true} />);

    expect(screen.getByText("Stream Progress")).toBeInTheDocument();
    expect(screen.getByText("No active stream found")).toBeInTheDocument();
  });

  it("renders empty state with custom copy and handles action click", () => {
    mockMatchMedia(false);
    const onAction = jest.fn();
    render(
      <StreamProgress
        status="empty"
        emptyEyebrow="My Custom Eyebrow"
        emptyTitle="My Custom Title"
        emptyDescription="My Custom Description"
        emptyActionLabel="My Custom Action"
        onEmptyAction={onAction}
      />
    );

    expect(screen.getByText("My Custom Eyebrow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Custom Title" })).toBeInTheDocument();
    expect(screen.getByText("My Custom Description")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "My Custom Action" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
