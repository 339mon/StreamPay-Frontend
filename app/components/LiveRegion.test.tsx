/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { LiveRegion } from "./LiveRegion";

describe("LiveRegion", () => {
  it("renders the message inside a polite status region by default", () => {
    render(<LiveRegion message="Saved." />);

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Saved.");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });

  it("renders an assertive alert region when politeness is 'assertive'", () => {
    render(<LiveRegion message="Failed." politeness="assertive" />);

    const region = screen.getByRole("alert");
    expect(region).toHaveTextContent("Failed.");
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("is visually hidden but present in the accessibility tree", () => {
    render(<LiveRegion message="Hidden visually." />);

    expect(screen.getByRole("status")).toHaveClass("sr-only");
  });

  it("renders an empty region without announcing anything when message is empty", () => {
    render(<LiveRegion message="" />);

    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("forwards an additional className alongside sr-only", () => {
    render(<LiveRegion message="x" className="custom-class" />);

    const region = screen.getByRole("status");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveClass("custom-class");
  });
});
