/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LiveRegion } from "./LiveRegion";

describe("LiveRegion", () => {
  it("renders with default polite aria-live attributes", () => {
    render(<LiveRegion message="Status update" />);
    const region = screen.getByTestId("live-region");
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveTextContent("Status update");
  });

  it("renders with assertive politeness and alert role", () => {
    render(<LiveRegion message="Urgent alert" politeness="assertive" />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("role", "alert");
  });

  it("supports custom role override", () => {
    render(<LiveRegion message="Log entry" role="log" />);
    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("role", "log");
  });

  it("renders children when message prop is not supplied", () => {
    render(
      <LiveRegion>
        <span>Child content</span>
      </LiveRegion>
    );
    expect(screen.getByTestId("live-region")).toHaveTextContent("Child content");
  });

  it("applies sr-only class name for screen reader visibility", () => {
    render(<LiveRegion message="Hidden text" className="custom-live" />);
    const region = screen.getByTestId("live-region");
    expect(region.className).toContain("sr-only");
    expect(region.className).toContain("custom-live");
  });
});
