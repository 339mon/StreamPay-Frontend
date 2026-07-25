/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { LiveRegion } from "./LiveRegion";

describe("LiveRegion", () => {
  it("renders with default props", () => {
    render(<LiveRegion message="Test message" />);
    const region = screen.getByText("Test message");
    
    expect(region).toBeInTheDocument();
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
  });

  it("applies assertive politeness correctly", () => {
    render(<LiveRegion message="Error message" politeness="assertive" />);
    const region = screen.getByText("Error message");
    
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("applies custom class name and role correctly", () => {
    render(
      <LiveRegion 
        message="Alert message" 
        className="custom-class" 
        role="alert" 
      />
    );
    const region = screen.getByText("Alert message");
    
    expect(region).toHaveClass("custom-class");
    expect(region).toHaveAttribute("role", "alert");
  });
});
