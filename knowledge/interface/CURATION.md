# Curation of the interface rules

`rules.json` is written in Relevo's own words from the guidelines of UI UX Pro Max (MIT licence, see `NOTICE`). Of its 119 guidelines, 84 became a rule, 8 were merged into a rule, and 27 were left out. Each row below is one guideline of the source, by its number, with the decision. A later review can re-check any of them from this record.

The criteria: the guideline applies to a page or a component built from an issue; it can be verified in a diff, in a render or by a person looking at a device; it is not a duplicate; it is not tied to one type of product.

| Source # | Source title | Decision | Rule or reason |
|---|---|---|---|
| 1 | Smooth Scroll | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 2 | Sticky Navigation | adopted | `sticky-nav-offset` |
| 3 | Active State | adopted | `active-nav-state` |
| 4 | Back Button | adopted | `back-behaviour` |
| 5 | Deep Linking | adopted | `deep-links` |
| 6 | Breadcrumbs | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 7 | Excessive Motion | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 8 | Duration Timing | adopted | `motion-timing` |
| 9 | Reduced Motion | adopted | `reduced-motion` |
| 10 | Loading States | merged | into `loading-indicators` |
| 11 | Hover vs Tap | adopted | `no-hover-only` |
| 12 | Continuous Animation | adopted | `no-decorative-loops` |
| 13 | Transform Performance | adopted | `cheap-animation` |
| 14 | Easing Functions | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 15 | Z-Index Management | adopted | `z-index-scale` |
| 16 | Overflow Hidden | adopted | `overflow-clipping` |
| 17 | Fixed Positioning | adopted | `fixed-elements` |
| 18 | Stacking Context | merged | into `z-index-scale` |
| 19 | Content Jumping | adopted | `stable-layout` |
| 20 | Viewport Units | adopted | `viewport-height-units` |
| 21 | Container Width | merged | into `line-length` |
| 22 | Touch Target Size | adopted | `target-size-touch` |
| 23 | Touch Spacing | adopted | `touch-spacing` |
| 24 | Gesture Conflicts | adopted | `gesture-conflicts` |
| 25 | Tap Delay | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 26 | Pull to Refresh | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 27 | Haptic Feedback | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 28 | Focus States | adopted | `focus-visible` |
| 29 | Hover States | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 30 | Active States | adopted | `pressed-state` |
| 31 | Disabled States | adopted | `disabled-state` |
| 32 | Loading Buttons | adopted | `no-double-submit` |
| 33 | Error Feedback | adopted | `error-feedback` |
| 34 | Success Feedback | adopted | `success-feedback` |
| 35 | Confirmation Dialogs | adopted | `confirm-destructive` |
| 36 | Color Contrast | adopted | `color-contrast` |
| 37 | Color Only | adopted | `not-color-alone` |
| 38 | Alt Text | adopted | `image-alt-text` |
| 39 | Heading Hierarchy | adopted | `heading-order` |
| 40 | ARIA Labels | adopted | `accessible-name` |
| 41 | Keyboard Navigation | adopted | `keyboard-operable` |
| 42 | Screen Reader | adopted | `semantic-structure` |
| 43 | Form Labels | adopted | `form-labels` |
| 44 | Error Messages | adopted | `errors-announced` |
| 45 | Skip Links | adopted | `skip-link` |
| 46 | Image Optimization | adopted | `image-optimisation` |
| 47 | Lazy Loading | adopted | `lazy-loading` |
| 48 | Code Splitting | adopted | `code-splitting` |
| 49 | Caching | left out | it cannot be verified in a diff, a render or by a person looking at a device. |
| 50 | Font Loading | merged | into `font-loading` |
| 51 | Third Party Scripts | adopted | `third-party-scripts` |
| 52 | Bundle Size | left out | it cannot be verified in a diff, a render or by a person looking at a device. |
| 53 | Render Blocking | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 54 | Input Labels | merged | into `form-labels` |
| 55 | Error Placement | adopted | `inline-field-error` |
| 56 | Inline Validation | adopted | `validate-on-blur` |
| 57 | Input Types | adopted | `input-types` |
| 58 | Autofill Support | adopted | `autofill-support` |
| 59 | Required Indicators | adopted | `required-indicator` |
| 60 | Password Visibility | adopted | `password-visibility` |
| 61 | Submit Feedback | adopted | `submit-feedback` |
| 62 | Input Affordance | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 63 | Mobile Keyboards | adopted | `mobile-keyboards` |
| 64 | Mobile First | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 65 | Breakpoint Testing | adopted | `breakpoint-testing` |
| 66 | Touch Friendly | adopted | `touch-friendly-layout` |
| 67 | Readable Font Size | adopted | `readable-text-size` |
| 68 | Viewport Meta | adopted | `viewport-meta` |
| 69 | Horizontal Scroll | adopted | `no-horizontal-scroll` |
| 70 | Image Scaling | adopted | `image-scaling` |
| 71 | Table Handling | adopted | `table-small-screens` |
| 72 | Line Height | adopted | `line-height` |
| 73 | Line Length | adopted | `line-length` |
| 74 | Font Size Scale | adopted | `type-scale` |
| 75 | Font Loading | adopted | `font-loading` |
| 76 | Contrast Readability | merged | into `color-contrast` |
| 77 | Heading Clarity | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 78 | Loading Indicators | adopted | `loading-indicators` |
| 79 | Empty States | adopted | `empty-states` |
| 80 | Error Recovery | adopted | `error-recovery` |
| 81 | Progress Indicators | adopted | `progress-indicators` |
| 82 | Toast Notifications | adopted | `toast-use` |
| 83 | Confirmation Messages | merged | into `success-feedback` |
| 84 | Truncation | adopted | `truncation-with-recovery` |
| 85 | Date Formatting | adopted | `date-format` |
| 86 | Number Formatting | adopted | `number-format` |
| 87 | Placeholder Content | adopted | `realistic-placeholders` |
| 88 | User Freedom | left out | it is tied to one type of product, so it does not apply to every project. |
| 89 | Autocomplete | adopted | `search-suggestions` |
| 90 | No Results | adopted | `no-results` |
| 91 | Bulk Actions | left out | it is tied to one type of product, so it does not apply to every project. |
| 92 | Disclaimer | left out | it is tied to one type of product, so it does not apply to every project. |
| 93 | Streaming | left out | it is tied to one type of product, so it does not apply to every project. |
| 94 | Gaze Hover | left out | it is tied to one type of product, so it does not apply to every project. |
| 95 | Depth Layering | left out | it is tied to one type of product, so it does not apply to every project. |
| 96 | Auto-Play Video | adopted | `autoplay-media` |
| 97 | Asset Weight | left out | it is tied to one type of product, so it does not apply to every project. |
| 98 | Feedback Loop | left out | it is tied to one type of product, so it does not apply to every project. |
| 99 | Motion Sensitivity | merged | into `reduced-motion` |
| 100 | Focus Not Obscured (Minimum) | adopted | `focus-not-obscured` |
| 101 | Focus Not Obscured (Enhanced) | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 102 | Focus Appearance | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 103 | Dragging Movements | adopted | `drag-alternative` |
| 104 | Target Size (Minimum) | adopted | `target-size-web` |
| 105 | Consistent Help | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 106 | Redundant Entry | left out | it is an enhanced-level criterion or of low value for a build from an issue. |
| 107 | Accessible Authentication (Minimum) | adopted | `accessible-authentication` |
| 108 | Auto-Rotating Content Controls | adopted | `rotating-content-control` |
| 109 | Focusable Error Summary | adopted | `error-summary` |
| 110 | Heading Line Balance | left out | it is about landing pages or visual style, not about a page or component built from an issue. |
| 111 | Long Token Wrapping | adopted | `long-token-wrapping` |
| 112 | Text Reflow and Spacing | adopted | `text-reflow` |
| 113 | Essential Text Truncation | adopted | `essential-text-complete` |
| 114 | Compact Label Semantics | adopted | `badge-vs-chip` |
| 115 | Chip Collection Reflow | adopted | `chip-collection-reflow` |
| 116 | Compact Label Overflow | adopted | `compact-label-overflow` |
| 117 | Compact Control Semantics | adopted | `compact-control-semantics` |
| 118 | Contextual Live Badge Updates | adopted | `live-badge-updates` |
| 119 | Cancellable State Transitions | adopted | `cancellable-transitions` |

## Why each core rule is core

A core rule is blocking and matters to every screen of a stack that has an interface. They are given to every agent that builds or reviews, whatever the change says.

- `focus-visible`: a keyboard user cannot use a screen whose focus is hidden.
- `color-contrast`: every screen has text on a background.
- `not-color-alone`: every screen has states that must not rely on colour.
- `image-alt-text`: any screen can show an image that carries meaning.
- `accessible-name`: every screen has icon-only controls.
- `keyboard-operable`: every web screen has controls.
- `form-labels`: any screen may take input.
- `errors-announced`: any screen can show an error.
- `target-size-web`: every web screen has pointer targets.
- `text-reflow`: every web screen has text that must survive zoom and narrow widths.
- `readable-text-size`: every screen has body text.
- `no-horizontal-scroll`: every web page must fit a phone.
- `submit-feedback`: any screen that sends data must say what happened.
- `no-double-submit`: any async action can be sent twice.
- `error-feedback`: any screen can fail.
- `loading-indicators`: any screen can wait for data.
- `target-size-touch`: every mobile screen has touch targets.

Empty states are not core: the source rates them medium, so the rule is advisory and the core set holds blocking rules only.

## Accessibility criteria cited by the rules

**Not yet verified.** The W3C text could not be read from the session that wrote these rules (the host `www.w3.org` is outside its allowed network domains), so none of the criteria below has been checked against the standard and `accessibility_checked` in `rules.json` is empty. Task 1.8 of the change stays open until each row is checked and the date is recorded.

| Criterion | Cited by | Checked against the W3C text |
|---|---|---|
| WCAG 1.1.1 | `image-alt-text` | not yet |
| WCAG 1.3.1 | `heading-order` | not yet |
| WCAG 1.4.1 | `not-color-alone` | not yet |
| WCAG 1.4.3 | `color-contrast` | not yet |
| WCAG 1.4.4 | `text-reflow` | not yet |
| WCAG 2.1.1 | `keyboard-operable` | not yet |
| WCAG 2.2.2 | `rotating-content-control` | not yet |
| WCAG 2.4.1 | `skip-link` | not yet |
| WCAG 2.4.11 | `focus-not-obscured` | not yet |
| WCAG 2.5.7 | `drag-alternative` | not yet |
| WCAG 2.5.8 | `target-size-web` | not yet |
| WCAG 3.3.1 | `error-summary` | not yet |
| WCAG 3.3.2 | `form-labels` | not yet |
| WCAG 3.3.8 | `accessible-authentication` | not yet |
| WCAG 4.1.2 | `accessible-name` | not yet |
| WCAG 4.1.3 | `errors-announced` | not yet |
