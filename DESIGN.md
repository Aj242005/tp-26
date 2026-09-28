---
name: Prooflane — Evidence Console
description: A precise, premium technical workspace for configuration assurance.
colors:
  canvas: "#0d1017"
  surface: "#141923"
  raised: "#1b2230"
  text: "#ecf0f7"
  muted: "#a5b0c3"
  border: "#2c3545"
  primary: "#4466df"
  link: "#9ab5ff"
  success: "#85d8b0"
  warning: "#efc479"
  danger: "#ff9b9b"
typography:
  body:
    fontFamily: "Geist Variable, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: 1.65
  title:
    fontFamily: "Geist Variable, Segoe UI, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    letterSpacing: "-0.03em"
rounded:
  control: "8px"
  panel: "14px"
spacing:
  compact: "8px"
  control: "12px"
  group: "24px"
  section: "32px"
---

## Overview

The user requests a premium, technically expressive interface, and explicitly asked for richer interaction throughout the workspace. The Evidence Console is a debugger workbench with a floating instrument dock, a selectable audit/control spectrum, and source-adjacent evidence panes. Dark separated surfaces support long investigations, with an equivalent light theme for bright rooms. Operate mode: expression makes the evidence easier to explore.

## Colors

Dark graphite is the default; cool neutral layers distinguish navigation, working panels and inset source code. Blue denotes action and selection. Severity has both text and a semantic color. Light mode keeps the same structure with pale cool surfaces and darker text. Never suggest a service is healthy, connected or compliant from decoration: configured AI and reported job states use actual API fields.

## Typography

Geist carries headings, prose, navigation and forms. Geist Mono is reserved for identifiers, configuration, numerical measurements and keyboard shortcuts. Use tabular numbers. Body and evidence prose stay 14px or larger; metadata stays at least 12px. Page headings are 34px desktop / 29px mobile, with fixed sizing.

## Layout

Desktop uses a 226px dock inset 12px from the window and a 74px context bar. Focus mode collapses navigation to 70px and gives the workspace more room; the choice persists. The overview's compact counters navigate to their respective sections. Below them, an audit browser selects a real assessment and a tactile control spectrum previews/pins findings. Each control leads directly to its finding; the prominent Explore in 3D action opens that assessment's spatial trail. Assessment history follows the workbench.

Selecting a finding keeps rule, observed/expected values and source lines adjacent. Mobile uses a compact header and horizontal navigation, a horizontally scrollable audit selector and a five-column control grid on narrow phones. Wide tables stay in labelled local scrollers; the document never scrolls horizontally.

## Elevation & Depth

Tonal layers and fine borders carry interface structure. Only the command dialog and transient toast cast CSS shadows. The audit trail is a deliberate spatial exception: seven procedural objects sit on a matte board, with directional lighting, soft physical shadows, and crisp HTML labels. No neon halos, decorative glass, fabricated trends or ambient motion.

## Shapes

Controls use 7–8px radii, major panels 14–16px. Small status labels have compact 5px corners. Dense registers use separators. Source views remain rectilinear with a clear file/status header.

## Components

Navigation groups destinations into auditing, knowledge and workspace areas. Its active marker follows the current destination. The command dialog opens with Ctrl/Cmd+K, filters real destinations, supports arrows/Enter/Escape and restores focus. Theme, focus mode and interface-motion preferences persist locally. Loading uses stable skeletons. Buttons, fields, filters, badges, warnings, libraries and exports share tokens in both themes. Mapping list entries show a short record ID and creation time so repeated names remain distinguishable. Evidence coverage bars represent evaluated percentages, never compliance scores.

The focal interaction is the control spectrum: hovering previews a real finding, clicking/focusing pins it, and the preview links to the exact finding ID. Buttons acknowledge presses; arrows indicate navigation; copy actions confirm clipboard success or failure. Uploads respond to file drags and expose removable file chips. Tables expose a direct 3D action. Tabs, findings, disclosures, the command dialog and notifications have short state transitions. Layout and theme changes use native view transitions when available. Routine motion is 140–260ms, with a maximum 320ms layout transition. The OS reduced-motion setting and the in-app motion control disable nonessential motion.

The 3D audit trail is a functional extension of the evidence inspector. The main path joins input, interpretation, evaluation and report; policy feeds evaluation, and investigation leads to a human review gate. Blue records captured artifacts, amber requests review, teal marks active work, red marks a failed stage, and dashed links identify pending or optional destinations. Color always has a text equivalent. Selecting a stage exposes actual hashes, captured mappings, source-backed facts, verdicts or stored Gemini tool responses. Replay is explicitly a guided sequence, never a fabricated execution clock.

The scene stays dark in both themes, like a source pane. Below 1320px the inspector stacks under the graph. Phones start in flat view and can switch to a portrait 3D composition with numbered markers; the stage rail and evidence shortcut preserve readable navigation. Rendering happens only on interaction, resize or data change, with automatic flat fallback if WebGL is unavailable. Selecting a stage produces a bounded 220ms physical lift; it respects motion preferences. The scene has no ambient animation.

## Do's and Don'ts

Preserve product claims, synthetic labels, role restrictions, API paths and review gates. Make long record names wrap safely. Keep code contrast and selection boundaries clear. Avoid fake telemetry, decorative progress rings, tiny tracked labels and monospace prose. Add no runtime design framework.
