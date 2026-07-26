/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { KbdHint } from "./KbdHint";

describe("KbdHint", () => {
  const defaultShortcuts = [
    { keys: ["Space"], description: "Pause / resume" },
    { keys: ["Ctrl", "K"], description: "Command palette" },
  ];

  it("renders nothing when shortcuts array is empty", () => {
    const { container } = render(<KbdHint shortcuts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a wrapper with role=list and aria-label", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const list = screen.getByRole("list", { name: "Keyboard shortcuts" });
    expect(list).toBeInTheDocument();
  });

  it("renders each shortcut as a listitem", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("renders kbd elements for each key in a shortcut", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const kbdElements = screen.getAllByText((_, element) => {
      return element?.tagName.toLowerCase() === "kbd";
    });
    // Space (1 key) + Ctrl (1 key) + K (1 key) = 3 kbd elements
    expect(kbdElements).toHaveLength(3);
  });

  it("displays key labels correctly", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    expect(screen.getByText("Space")).toBeInTheDocument();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("displays description text for each shortcut", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    expect(screen.getByText("Pause / resume")).toBeInTheDocument();
    expect(screen.getByText("Command palette")).toBeInTheDocument();
  });

  it("renders a separator between multi-key shortcuts", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const separators = screen.getAllByText("+");
    // Only the Ctrl+K shortcut has a separator
    expect(separators).toHaveLength(1);
  });

  it("does not render separator for single-key shortcuts", () => {
    render(
      <KbdHint shortcuts={[{ keys: ["Space"], description: "Test" }]} />
    );
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("applies custom className to wrapper", () => {
    render(<KbdHint shortcuts={defaultShortcuts} className="custom-class" />);
    const list = screen.getByRole("list");
    expect(list).toHaveClass("kbd-hint");
    expect(list).toHaveClass("custom-class");
  });

  it("applies data-testid to wrapper", () => {
    render(
      <KbdHint shortcuts={defaultShortcuts} data-testid="my-kbd-hint" />
    );
    expect(screen.getByTestId("my-kbd-hint")).toBeInTheDocument();
  });

  it("marks key labels as aria-hidden", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const keysContainer = screen.getAllByRole("listitem")[0]
      .querySelector(".kbd-hint__keys");
    expect(keysContainer).toHaveAttribute("aria-hidden", "true");
  });

  it("applies kbd class to each key element", () => {
    render(<KbdHint shortcuts={defaultShortcuts} />);
    const kbdElements = document.querySelectorAll("kbd");
    kbdElements.forEach((kbd) => {
      expect(kbd).toHaveClass("kbd");
    });
  });

  it("handles many shortcuts without overflow", () => {
    const manyShortcuts = Array.from({ length: 8 }, (_, i) => ({
      keys: [`F${i + 1}`],
      description: `Action ${i + 1}`,
    }));
    render(<KbdHint shortcuts={manyShortcuts} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
  });

  it("handles complex multi-key shortcuts", () => {
    const complexShortcut = [
      { keys: ["Ctrl", "Shift", "K"], description: "Advanced action" },
    ];
    render(<KbdHint shortcuts={complexShortcut} />);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("Shift")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(screen.getByText("Advanced action")).toBeInTheDocument();
    // Two separators for 3 keys
    const separators = screen.getAllByText("+");
    expect(separators).toHaveLength(2);
  });
});
