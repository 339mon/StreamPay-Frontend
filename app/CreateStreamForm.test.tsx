/**
 * @jest-environment jsdom
 *
 * CreateStreamForm tests.
 * Covers all three GrantFox FWC26 tasks:
 *   - kbd-v7   : keyboard shortcut hints and key bindings
 *   - skel-v7  : themed skeleton loader
 *   - ariallive-v7 : aria-live SR announcements
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CreateStreamForm } from "./CreateStreamForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvedSubmit() {
  return jest.fn().mockResolvedValue(undefined);
}

function rejectedSubmit(message = "Network error") {
  return jest.fn().mockRejectedValue(new Error(message));
}

// ─────────────────────────────────────────────────────────────────────────────
// kbd-v7 — Keyboard shortcut hints
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateStreamForm — kbd-v7 (keyboard shortcut hints)", () => {
  it("renders KbdHint on the Cancel button showing Esc", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const wrapper = screen.getByRole("button", { name: /cancel/i }).closest("button");
    // The <kbd> element for Esc should be present inside the cancel button
    const kbd = wrapper?.querySelector("kbd");
    expect(kbd).not.toBeNull();
    expect(kbd?.textContent).toBe("Esc");
  });

  it("renders KbdHint on the Submit button showing Ctrl and ↵", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const submitBtn = screen.getByRole("button", { name: /create stream/i });
    const kbds = submitBtn.querySelectorAll("kbd");
    const texts = Array.from(kbds).map((k) => k.textContent);
    expect(texts).toContain("Ctrl");
    expect(texts).toContain("↵");
  });

  it("renders KbdHint hint for recipient field (Alt+R)", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    // The hint wrapper near the Recipient label should contain Alt and R kbds
    const recipientGroup = screen
      .getByLabelText(/recipient address/i)
      .closest("div") as HTMLElement;
    const kbds = Array.from(
      recipientGroup.parentElement?.querySelectorAll("kbd") ?? []
    );
    const texts = kbds.map((k) => k.textContent);
    expect(texts).toContain("Alt");
    expect(texts).toContain("R");
  });

  it("renders KbdHint hint for amount field (Alt+A)", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const amountGroup = screen
      .getByLabelText(/amount/i)
      .closest("div") as HTMLElement;
    const kbds = Array.from(
      amountGroup.parentElement?.querySelectorAll("kbd") ?? []
    );
    const texts = kbds.map((k) => k.textContent);
    expect(texts).toContain("Alt");
    expect(texts).toContain("A");
  });

  it("focuses the recipient input when Alt+R is pressed", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const recipientInput = screen.getByLabelText(/recipient address/i);
    fireEvent.keyDown(document, { key: "r", altKey: true });
    expect(document.activeElement).toBe(recipientInput);
  });

  it("focuses the amount input when Alt+A is pressed", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.keyDown(document, { key: "a", altKey: true });
    expect(document.activeElement).toBe(amountInput);
  });

  it("kbd hints on action buttons are aria-hidden so screen readers skip them", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const submitBtn = screen.getByRole("button", { name: /create stream/i });
    // KbdHint wrapper inside the button
    const kbdHint = submitBtn.querySelector("[data-testid='kbd-hint']");
    expect(kbdHint).toHaveAttribute("aria-hidden", "true");
  });

  it("kbd hints on field labels are aria-hidden", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const hints = document.querySelectorAll("[data-testid='kbd-hint']");
    hints.forEach((hint) => {
      expect(hint).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = jest.fn();
    render(<CreateStreamForm onSubmit={resolvedSubmit()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// skel-v7 — Themed skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateStreamForm — skel-v7 (themed skeleton loader)", () => {
  it("renders skeleton when isLoading=true", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    expect(screen.getByTestId("create-stream-skeleton")).toBeInTheDocument();
  });

  it("does not render the form when isLoading=true", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/recipient address/i)).not.toBeInTheDocument();
  });

  it("sets aria-busy=true on the loading container", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    const loader = screen.getByTestId("create-stream-form-loading");
    expect(loader).toHaveAttribute("aria-busy", "true");
  });

  it("skeleton is aria-hidden to avoid polluting the AT tree", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    const skeleton = screen.getByTestId("create-stream-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });

  it("skeleton contains multiple .skeleton elements", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    const skeletonEls = document.querySelectorAll(".skeleton");
    expect(skeletonEls.length).toBeGreaterThanOrEqual(4);
  });

  it("renders the form when isLoading=false (default)", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    expect(screen.queryByTestId("create-stream-skeleton")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
  });

  it("transitions from skeleton to form when isLoading changes to false", () => {
    const { rerender } = render(
      <CreateStreamForm onSubmit={resolvedSubmit()} isLoading />
    );
    expect(screen.getByTestId("create-stream-skeleton")).toBeInTheDocument();

    rerender(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading={false} />);
    expect(screen.queryByTestId("create-stream-skeleton")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ariallive-v7 — Aria-live SR announcements
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateStreamForm — ariallive-v7 (aria-live SR announcements)", () => {
  it("renders a live region in the form", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const region = screen.getByTestId("create-stream-live");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live");
  });

  it("live region starts empty", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveTextContent("");
  });

  it("announces 'Creating stream…' while submitting", async () => {
    // Slow submit so we can catch the interim announcement
    let resolveSubmit!: () => void;
    const pendingSubmit = jest.fn(
      () => new Promise<void>((res) => { resolveSubmit = res; })
    );

    render(<CreateStreamForm onSubmit={pendingSubmit} />);

    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "GABC1234" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "50" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveTextContent(/creating stream/i);

    // Resolve to clean up
    await act(async () => { resolveSubmit(); });
  });

  it("announces success after a successful submit", async () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);

    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "GABC1234" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "50" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    const region = screen.getByTestId("create-stream-live");
    await waitFor(() => {
      expect(region).toHaveTextContent(/stream created successfully/i);
    });
  });

  it("announces error message after a failed submit", async () => {
    render(<CreateStreamForm onSubmit={rejectedSubmit("Stellar node unreachable")} />);

    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "GABC1234" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "50" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    const region = screen.getByTestId("create-stream-live");
    await waitFor(() => {
      expect(region).toHaveTextContent(/stellar node unreachable/i);
    });
  });

  it("announces cancellation when Cancel is clicked", () => {
    const onCancel = jest.fn();
    render(<CreateStreamForm onSubmit={resolvedSubmit()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveTextContent(/cancelled/i);
  });

  it("loading skeleton also includes a live region announcing loading state", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} isLoading />);
    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveTextContent(/loading/i);
  });

  it("live region has role=status", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const region = screen.getByRole("status");
    expect(region).toBeInTheDocument();
  });

  it("live region uses polite politeness by default", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("live region is visually hidden (.sr-only)", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    const region = screen.getByTestId("create-stream-live");
    expect(region).toHaveClass("sr-only");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// General form behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateStreamForm — general behaviour", () => {
  it("renders recipient, amount, and token fields", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} />);
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/token/i)).toBeInTheDocument();
  });

  it("calls onSubmit with form values on submit", async () => {
    const onSubmit = resolvedSubmit();
    render(<CreateStreamForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "GABC1234" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "75" },
    });
    fireEvent.change(screen.getByLabelText(/token/i), {
      target: { value: "USDC" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        recipient: "GABC1234",
        amount: "75",
        token: "USDC",
      });
    });
  });

  it("disables the submit button while submitting", async () => {
    let resolveSubmit!: () => void;
    const pendingSubmit = jest.fn(
      () => new Promise<void>((res) => { resolveSubmit = res; })
    );

    render(<CreateStreamForm onSubmit={pendingSubmit} />);

    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "GABC" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "10" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create stream/i }));
    });

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    // Resolve to clean up
    await act(async () => { resolveSubmit(); });
  });

  it("applies custom className to the wrapper", () => {
    render(<CreateStreamForm onSubmit={resolvedSubmit()} className="my-form" />);
    expect(screen.getByTestId("create-stream-form-wrapper")).toHaveClass("my-form");
  });
});
