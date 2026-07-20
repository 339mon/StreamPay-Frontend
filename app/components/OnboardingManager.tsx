"use client";

import { useEffect, useState } from "react";

const ONBOARDING_KEY = "streampay_onboarding_dismissed";

/**
 * OnboardingManager — isolated client component that reads `localStorage`
 * and surfaces the onboarding prompt when a first-time visitor is detected.
 *
 * Extracted from `app/page.tsx` (issue #85) so the parent page can remain
 * a React Server Component. This component is intentionally lightweight:
 * it only manages a visibility flag and renders no markup until the
 * `localStorage` read confirms onboarding has not been dismissed.
 */
export default function OnboardingManager() {
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY);
    if (!dismissed) {
      setOnboardingVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setOnboardingVisible(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
  };

  if (!onboardingVisible) return null;

  return (
    <aside
      className="onboarding-banner"
      role="note"
      aria-label="Welcome to StreamPay"
      data-testid="onboarding-banner"
    >
      <p className="onboarding-banner__message">
        Welcome to StreamPay — create and manage real-time payment streams on
        Stellar.
      </p>
      <button
        type="button"
        className="onboarding-banner__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss welcome message"
      >
        Dismiss
      </button>
    </aside>
  );
}
