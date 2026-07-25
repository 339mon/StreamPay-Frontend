/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description correctly", () => {
    render(<EmptyState title="No items found" description="Try adjusting your filters" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders an illustration if provided", () => {
    const illustration = <span data-testid="test-illustration">Illustration</span>;
    render(<EmptyState title="Test" description="Desc" illustration={illustration} />);
    expect(screen.getByTestId("test-illustration")).toBeInTheDocument();
  });

  it("renders a CTA button and handles click", () => {
    const handleCtaClick = jest.fn();
    render(
      <EmptyState
        title="Test"
        description="Desc"
        ctaText="Click Me"
        onCtaClick={handleCtaClick}
      />
    );
    const button = screen.getByRole("button", { name: "Click Me" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleCtaClick).toHaveBeenCalledTimes(1);
  });

  it("does not render CTA button if text or handler is missing", () => {
    render(<EmptyState title="Test" description="Desc" ctaText="Click Me" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
