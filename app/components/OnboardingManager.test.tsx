/**
 * @jest-environment jsdom
 *
 * OnboardingManager — unit tests.
 *
 * Verifies that the component correctly reads from localStorage and shows /
 * hides the onboarding banner accordingly.
 */

import { act, fireEvent, render } from "@testing-library/react";
const { screen } = require("@testing-library/react") as any;
import OnboardingManager from "./OnboardingManager";

beforeEach(() => {
  localStorage.clear();
});

describe("OnboardingManager", () => {
  it("shows the onboarding banner for a first-time visitor", () => {
    render(<OnboardingManager />);
    expect(screen.getByTestId("onboarding-banner")).toBeInTheDocument();
  });

  it("does not render the banner when already dismissed", () => {
    localStorage.setItem("streampay_onboarding_dismissed", "true");
    render(<OnboardingManager />);
    expect(screen.queryByTestId("onboarding-banner")).toBeNull();
  });

  it("hides the banner and sets localStorage when the Dismiss button is clicked", () => {
    render(<OnboardingManager />);
    const btn = screen.getByRole("button", { name: /dismiss welcome message/i });

    act(() => {
      fireEvent.click(btn);
    });

    expect(screen.queryByTestId("onboarding-banner")).toBeNull();
    expect(localStorage.getItem("streampay_onboarding_dismissed")).toBe("true");
  });

  it("re-shows if localStorage is cleared between mounts", () => {
    // First render: dismisses
    const { unmount } = render(<OnboardingManager />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    });
    unmount();

    // Simulate clearing the flag (e.g. private browsing)
    localStorage.clear();

    // Second render: should be visible again
    render(<OnboardingManager />);
    expect(screen.getByTestId("onboarding-banner")).toBeInTheDocument();
  });
});
