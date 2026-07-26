/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { KbdHint } from "./KbdHint";

describe("KbdHint component", () => {
  it("renders single key correctly", () => {
    render(<KbdHint keys="C" />);
    const kbd = screen.getByText("C");
    expect(kbd).toBeInTheDocument();
    expect(kbd.tagName.toLowerCase()).toBe("kbd");
  });

  it("renders array of keys separated by +", () => {
    render(<KbdHint keys={["Ctrl", "C"]} testId="kbd-array" />);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByTestId("kbd-array")).toHaveAttribute(
      "aria-label",
      "Keyboard shortcut: Ctrl+C"
    );
  });

  it("splits string with + into key list", () => {
    render(<KbdHint keys="Cmd+Shift+P" testId="kbd-split" />);
    expect(screen.getByText("Cmd")).toBeInTheDocument();
    expect(screen.getByText("Shift")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByTestId("kbd-split")).toHaveAttribute(
      "aria-label",
      "Keyboard shortcut: Cmd+Shift+P"
    );
  });

  it("uses custom aria-label when provided", () => {
    render(<KbdHint keys="M" ariaLabel="Toggle privacy mask shortcut" testId="custom-label" />);
    expect(screen.getByTestId("custom-label")).toHaveAttribute(
      "aria-label",
      "Toggle privacy mask shortcut"
    );
  });

  it("applies variant and size props", () => {
    const { rerender } = render(<KbdHint keys="X" variant="outline" size="md" testId="var-test" />);
    expect(screen.getByTestId("var-test")).toBeInTheDocument();

    rerender(<KbdHint keys="X" variant="subtle" size="sm" testId="var-test" />);
    expect(screen.getByTestId("var-test")).toBeInTheDocument();
  });

  it("forwards className and style props", () => {
    render(
      <KbdHint
        keys="C"
        className="custom-kbd-class"
        style={{ marginTop: "4px" }}
        testId="styled-kbd"
      />
    );
    const wrapper = screen.getByTestId("styled-kbd");
    expect(wrapper).toHaveClass("custom-kbd-class");
  });
});
