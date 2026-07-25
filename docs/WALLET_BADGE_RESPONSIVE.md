# WalletBadge Responsive Breakpoint Audit Specifications (v7)

**Issue:** #1072 Add responsive breakpoint audit for WalletBadge (v7)  
**Campaign:** GrantFox FWC26 Campaign (Stellar Wave)  
**Status:** Completed & Verified  

---

## Overview

The `WalletBadge` component provides real-time display of Stellar wallet connection state, address, network details, and balance with ARIA live region announcements. This document details the responsive breakpoint audit and CSS token mappings introduced in v7.

---

## Breakpoint Table & Responsive Layout Specifications

| Breakpoint | Width Range | Padding / Gap | Label Max Width | Network Tag | Provider Prefix | WCAG Touch Target |
|------------|-------------|---------------|-----------------|-------------|-----------------|-------------------|
| `mobile` | < 480px (`< 29.9375rem`) | `0.35rem` / `0.35rem` | `120px` | Hidden (`display: none`) | Hidden (`display: none`) | Min 44px height |
| `phablet / tablet` | 480px - 1023px (`30rem` - `63.9375rem`) | `0.4rem` / `0.5rem` | `200px` | Visible | Visible | Min 44px height |
| `desktop / wide` | 1024px+ (`>= 64rem`) | `0.45rem` / `0.6rem` | `300px` | Visible | Visible | Min 44px height |

---

## Key Responsive Features

1. **Header & Navigation Safety (< 480px):**
   - On narrow mobile screens, secondary elements (`.wallet-badge__network` tag and provider prefix) are hidden to prevent overflow in constrained top headers and mobile navigation bars.
   - Main wallet address text is truncated gracefully using `text-overflow: ellipsis`.

2. **WCAG 2.1 AA Accessibility:**
   - **Touch Target Size:** Interactive containers and disconnect buttons enforce a minimum touch target size of 44px × 44px (`min-height: 44px`, `min-width: 44px`).
   - **Keyboard Navigation:** Full support for `Enter` and `Space` key actions with high-contrast focus rings (`:focus-visible`).
   - **Live Region:** Accessible screen-reader announcements via `LiveRegion` component.

3. **Design System Token Mapping:**
   - Background: `var(--panel, #1f2937)`
   - Border: `var(--border, #374151)`
   - Text Foreground: `var(--foreground, #f9fafb)`
   - Secondary Text: `var(--muted-light, #9ca3af)`
   - Focus Ring: `var(--accent, #22c55e)`
   - Status Dot Indicators:
     - `connected`: `var(--accent, #10b981)`
     - `connecting` / `disconnecting`: `var(--system-warning-border, #f59e0b)`
     - `error`: `var(--system-error-border, #ef4444)`
     - `disconnected`: `var(--muted, #9ca3af)`

4. **Motion Preferences:**
   - Background and status transitions respect `@media (prefers-reduced-motion: reduce)` by disabling transitions.

---

## API Compatibility

All existing `WalletBadgeProps` remain unchanged for 100% backward compatibility:

```typescript
export interface WalletBadgeProps {
  state?: WalletState;
  address?: string | null;
  providerName?: string;
  network?: string;
  balance?: string;
  errorMessage?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onClick?: () => void;
  politeness?: "polite" | "assertive";
  announcement?: string;
  className?: string;
}
```

---

## Verification

- **Unit & Integration Tests:** `app/WalletBadge.test.tsx`
- **Lint Verification:** `npm run lint`
