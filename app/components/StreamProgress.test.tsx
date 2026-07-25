/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
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

// ── Tabular numerals (FWC26 Stellar Wave) ───────────────────────────────────

describe("StreamProgress tabular-nums formatting", () => {
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia;
  });

  it("applies tabular-nums to the percentage label so digit widths stay fixed", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={25} totalAmount={100} />);
    expect(screen.getByText("25% accrued")).toHaveClass("tabular-nums");
  });

  it("applies tabular-nums to the label for non-numeric statuses too", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="draft" />);
    expect(screen.getByText("Not started")).toHaveClass("tabular-nums");
  });

  it("applies tabular-nums to the remaining-balance amount", () => {
    mockMatchMedia(false);
    render(<StreamProgress status="active" accruedAmount={30} totalAmount={100} />);
    expect(screen.getByText("70 remaining")).toHaveClass("tabular-nums");
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
