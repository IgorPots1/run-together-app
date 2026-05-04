---
name: playwright-webkit-smoke
description: Runs Playwright MCP smoke verification with WebKit after frontend, layout, form, map, auth, or mobile UI changes. Use for UI verification only, without changing code, and report mobile WebKit risks clearly.
---

# Playwright WebKit Smoke

## Instructions

- Verification only unless explicitly asked to fix.
- Do not change code during smoke test.
- Use Playwright MCP and prefer a real WebKit session for UI verification.
- Use a mobile viewport around `390x844` before checking layout and interactions.
- When possible, verify actual `browserTypeName` is `webkit`. If direct confirmation is not available, state that and report the strongest evidence you have.
- Confirm the page loads successfully.
- Confirm the primary UI is visible.
- Confirm primary CTA/buttons are visible and usable.
- Confirm form inputs are visible and usable when present.
- Check for no obvious console errors.
- Check for no obvious horizontal overflow.
- Check for no obvious bottom or safe-area blocking.
- Report mobile and WebKit layout risks, even if the smoke test passes.

## Run Together Checks

- Run creation form
- Run list cards
- Join button flow
- Auth/login surfaces
- Map container behavior
- Address suggestions/autocomplete overlay
- Mobile keyboard behavior around inputs
- Compact mobile card layout

## Suggested MCP Flow

- Resize early with `browser_resize`.
- Navigate with `browser_navigate`, then wait for visible content with `browser_wait_for`.
- Use `browser_snapshot` to inspect visibility, structure, and bounding boxes.
- Use `browser_click`, `browser_type`, and related interactions to confirm controls are usable.
- Use `browser_console_messages` to catch obvious errors and warnings.
- Use `browser_evaluate` for targeted overflow or viewport checks.
- Use `browser_run_code_unsafe` only when needed to confirm Playwright/browser internals such as actual browser type.

## Reporting

Always report:

- Browser used
- Viewport
- Pages or surfaces checked
- Console errors or warnings
- Horizontal overflow findings
- Bottom/safe-area blocking findings
- Mobile/WebKit layout risks

## Manual QA Reminder

Real iPhone/PWA manual QA is still required for keyboard, safe-area, standalone PWA, bottom nav, maps/autocomplete, geolocation prompts, and scroll physics.
