/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreamRow, type StreamRowData } from "./StreamRow";
import type { StreamStatus } from "@/app/types/openapi";

const ALL_STATUSES: readonly StreamStatus[] = [
  "active",
  "draft",
  "paused",
  "ended",
  "withdrawn",
  "cancelled",
] as const;

function makeMockStream(status: StreamStatus): StreamRowData {
  const nextByStatus: Record<StreamStatus, string> = {
    active: "Pause",
    draft: "Start",
    paused: "Resume",
    ended: "Settle",
    withdrawn: "Details",
    cancelled: "Details",
  };
  return {
    id: `stream-${status}`,
    nextAction: nextByStatus[status],
    rate: "100 XLM / month",
    recipient: `Recipient ${status}`,
    schedule: "Pays every month",
    status,
    accruedAmount: 500,
    totalAmount: 1000,
  };
}

const baseStream: StreamRowData = makeMockStream("active");

describe("StreamRow", () => {
  it("renders correctly and contains the recipient and action button", () => {
    render(<StreamRow stream={baseStream} />);
    expect(screen.getByText("Recipient active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("applies a consistent visible focus ring style when the action button is focused", () => {
    render(<StreamRow stream={baseStream} />);
    const actionButton = screen.getByRole("button", { name: "Pause" });

    // Initial state: not focused, should not have the custom outline styles
    expect(actionButton).not.toHaveStyle({ outline: "2px solid var(--accent)" });

    // Focus the button
    act(() => {
      actionButton.focus();
      fireEvent.focus(actionButton);
    });
    expect(actionButton).toHaveFocus();

    // Verify it applies the correct design-token outline style for visual consistency
    expect(actionButton).toHaveStyle({
      outline: "2px solid var(--accent)",
      outlineOffset: "2px",
    });

    // Blur the button
    act(() => {
      actionButton.blur();
      fireEvent.blur(actionButton);
    });
    expect(actionButton).not.toHaveFocus();
    expect(actionButton).not.toHaveStyle({ outline: "2px solid var(--accent)" });
  });

  describe("color-blind safe pattern overlay (v7)", () => {
    it.each(ALL_STATUSES)("renders the decorative pattern overlay div for status=%s", (status) => {
      const { container } = render(<StreamRow stream={makeMockStream(status)} />);
      const pattern = container.querySelector(".stream-row__pattern");

      expect(pattern).not.toBeNull();
      // Decorative only — must be hidden from assistive tech
      expect(pattern).toHaveAttribute("aria-hidden", "true");
    });

    it.each(ALL_STATUSES)(
      "applies the stream-row--%s BEM modifier so the pattern CSS selector activates",
      (status) => {
        const { container } = render(<StreamRow stream={makeMockStream(status)} />);
        const article = container.querySelector("article.stream-row");

        expect(article).toHaveClass(`stream-row--${status}`);
        expect(article).toHaveAttribute("data-status", status);
      }
    );

    it("applies the stream-row__pattern child element (texture fill) for active", () => {
      const { container } = render(<StreamRow stream={makeMockStream("active")} />);
      const pattern = container.querySelector(".stream-row__pattern");
      expect(pattern?.classList.contains("stream-row__pattern")).toBe(true);
    });

    it("renders StatusBadge inside the row with pattern classes applied internally", () => {
      const { container } = render(<StreamRow stream={makeMockStream("active")} />);
      const badge = container.querySelector(".status-badge");
      expect(badge).not.toBeNull();
      // StatusBadge now auto-applies cb-pattern classes (see StatusBadge tests)
      expect(badge).toHaveClass("cb-pattern");
      expect(badge).toHaveClass("cb-pattern--active");
    });

    it("renders withdrawn with the same terminal pattern class as ended", () => {
      const { container } = render(<StreamRow stream={makeMockStream("withdrawn")} />);
      const badge = container.querySelector(".status-badge");
      expect(badge).toHaveClass("cb-pattern--ended");
    });

    it("renders cancelled with its distinct reverse-diagonal pattern", () => {
      const { container } = render(<StreamRow stream={makeMockStream("cancelled")} />);
      const badge = container.querySelector(".status-badge");
      expect(badge).toHaveClass("cb-pattern--cancelled");
    });
  });

  describe("data-status attribute (pattern selector & e2e hook)", () => {
    it.each(ALL_STATUSES)("sets data-status=%s on the <article> element", (status) => {
      const { container } = render(<StreamRow stream={makeMockStream(status)} />);
      const article = container.querySelector("article.stream-row");
      expect(article?.getAttribute("data-status")).toBe(status);
    });
  });

  describe("compact density variant", () => {
    it("applies stream-row--compact modifier when density=compact", () => {
      const { container } = render(
        <StreamRow stream={makeMockStream("paused")} density="compact" />
      );
      const article = container.querySelector("article.stream-row");
      expect(article).toHaveClass("stream-row--compact");
      // Pattern overlay still renders in compact mode
      expect(container.querySelector(".stream-row__pattern")).not.toBeNull();
    });
  });

  describe("tabular-nums font variant formatting (FWC26 Stellar Wave)", () => {
    it("applies tabular-nums class to the Rate numeric display element", () => {
      const { container } = render(<StreamRow stream={baseStream} />);
      const rateDd = container.querySelector("dd.tabular-nums");
      expect(rateDd).not.toBeNull();
      expect(rateDd).toHaveTextContent(baseStream.rate);
    });

    it("applies tabular-nums class to the Burn-down container when amounts are present", () => {
      const { container } = render(<StreamRow stream={baseStream} />);
      const burndownDd = container.querySelector(".stream-row__burndown");
      expect(burndownDd).not.toBeNull();
      expect(burndownDd).toHaveClass("tabular-nums");
    });

    it("applies tabular-nums class to the remaining stream progress label", () => {
      const { container } = render(<StreamRow stream={baseStream} />);
      const remainingSpan = container.querySelector(".stream-progress__remaining");
      expect(remainingSpan).not.toBeNull();
      expect(remainingSpan).toHaveClass("tabular-nums");
    });
  });
});
