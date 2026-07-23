/**
 * @jest-environment jsdom
 */

import { render, fireEvent, act } from "@testing-library/react";
const { screen } = require("@testing-library/react") as any;
import "@testing-library/jest-dom";
import { WelcomeTour } from "./WelcomeTour";

const STORAGE_KEY = "streampay:welcome-tour-dismissed";

describe("WelcomeTour", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the tour when no dismissal flag is set", () => {
    render(<WelcomeTour />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Welcome to StreamPay")).toBeInTheDocument();
  });

  it("shows nothing when dismissal flag is set", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<WelcomeTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows step 1 of 3 on first render", () => {
    render(<WelcomeTour />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it('has a "Skip tour" button that dismisses the tour', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText("Skip tour"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it('has a "Next" button that advances to step 2', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first stream")
    ).toBeInTheDocument();
  });

  it('shows "Get started" on the last step', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Get started")).toBeInTheDocument();
  });

  it('dismisses and saves to localStorage when "Get started" is clicked', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Get started"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("renders the dialog with correct accessibility attributes", () => {
    render(<WelcomeTour />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "welcome-tour-title");
  });

  it("sets aria-live on step indicator", () => {
    render(<WelcomeTour />);
    expect(screen.getByText("Step 1 of 3")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("handles localStorage being unavailable gracefully", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    render(<WelcomeTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});