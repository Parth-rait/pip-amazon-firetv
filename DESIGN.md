---
name: Pip
description: A calm, ambient helper for watching together on Fire TV
colors:
  night: "#0B0B0F"
  surface: "#15151C"
  surface-raised: "#1E1E27"
  text: "#F4F4F6"
  text-muted: "#9B9BA8"
  pip-mint: "#7CE7C4"
  danger: "#FF6B6B"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 600
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    lineHeight: 1.4
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
rounded:
  card: "20px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    height: "56px"
  button-primary:
    backgroundColor: "{colors.pip-mint}"
    textColor: "{colors.night}"
    rounded: "{rounded.card}"
    height: "56px"
  button-primary-disabled:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
  chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    height: "56px"
  ask-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  reply:
    backgroundColor: "{colors.night}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
  tv-bubble:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
---

# Design System: Pip

> **Merge note (17 Oct 2026).** This file was written by the cloud session from its own pad and browser TV simulator, which were not merged. The principles, colours, type scale, spacing and motion still apply. The component descriptions (reply card with Done, lab panel, TV simulator bubble) describe that UI, not the merged pad (Pip button and sheet, remote, voice button) or the Vega TV app. Reconciling them with Impeccable on the merged UI is open (docs/vnext/REPORT-cloud-merge.md).


Documented from the existing code (`pad/src/styles/tokens.css`, `app.css`, `pip.css`, `pad/src/tv/tv.css`) in Impeccable's DESIGN.md format, then refined by the vNext review. The tokens match PROJECT.md section 3.2; the TV uses the same tokens at the TV type scale. The creative north star below is the agent's proposal for Parth to confirm.

## Overview

**Creative North Star: "The quiet usher"**

Pip behaves like a good usher in a cinema: invisible while the film runs, there the moment someone needs help, gone again once they have it. The interface is matte, dark and calm so the film stays the brightest thing in the room. One mint accent marks Pip and the next action; everything else is grey on near-black. Density is low: big type, big targets, one job per screen.

This is an Operate surface: people are mid-task (watching), so familiarity and precision beat expression. Delight lives in Pip's timing and in short, specific words, not in decoration.

**Key Characteristics:**

- Hidden by default on the TV; brief and dismissible when it appears
- One accent colour, used for Pip and primary actions only
- Surface steps instead of borders; no gradients except Pip's glow
- Large type and 56 px targets for every age
- Motion only explains state, and respects reduced motion

## Colors

Near-black matte surfaces with a single soft mint; red only for errors.

### Primary

- **Pip Mint** (#7CE7C4): Pip's body, the primary button (Play/Pause, Ask, Join), focus rings, the progress line and the host mark. Never decoration.

### Neutral

- **Night** (#0B0B0F): the app and TV background; also the inset reply card and input fields inside panels.
- **Surface** (#15151C): panels (Ask Pip), buttons, the TV reply bubble.
- **Surface Raised** (#1E1E27): chips, pressed states, disabled primary buttons, the progress track.
- **Text** (#F4F4F6): primary text.
- **Text Muted** (#9B9BA8): secondary text, honest "not sure" replies, offline players.
- **Danger** (#FF6B6B): errors and "The TV didn't respond", nothing else.

### Named Rules

**The One Voice Rule.** Mint appears on at most one action per group and on Pip. If two things are mint, one of them is wrong.

**The Not-Sure Is Quiet Rule.** An abstention or fallback is shown in muted text at body size, never as an error and never in mint.

## Typography

**Body Font:** the platform's system UI font (system-ui on the pad, the Vega default on TV).

**Character:** one well-tuned sans for everything; hierarchy comes from size and weight, not from a second family.

### Hierarchy

- **Display** (600, 34px pad / 72dp TV): the pairing code on the TV and the code boxes on the pad.
- **Title** (600, 22px / 48dp): screen titles, a reply to me, film cards.
- **Body** (400, 17px / 36dp): most text, the TV reply text (at most 4 lines).
- **Caption** (400, 15px / 24dp): status lines, "Mia asked:", the credit line.

### Named Rules

**The No-Small-Print Rule.** Nothing on the TV is smaller than 24dp; nothing the pad needs you to read is smaller than 15px.

## Layout

Pad: one column, at most 560px wide, 16px page padding (safe-area aware). The watch screen stacks in order of use: title, host controls (or who has them), a note when Pip is answering someone else on the TV, the Ask Pip panel, and a quiet "Back to films" at the bottom, away from the title. Under 400px the Ask field takes its own row.

TV: a 1920x1080 canvas scaled to the screen, everything inside a 5% safe margin. Lobby: Pip, QR and code on the left; films and players on the right. Watch: the film full screen; the reply bubble bottom-right next to Pip; the pause bar along the bottom for 3 s; the credit line for 4 s, never under the bubble.

## Elevation & Depth

Flat, tonal layering: Night, then Surface, then Surface Raised. No shadows on UI; the only glow is Pip's own soft mint halo. The TV bubble is a near-opaque Surface panel over the film.

**The Flat-By-Default Rule.** Depth comes from surface steps, not shadows or borders.

## Shapes

One radius, 20px (20dp), on cards, buttons, chips, inputs and the TV bubble. Pip is a circle. The capacitive button in the lab panel is a circle and the touchwheel a ring, echoing the hardware.

## Components

- **Buttons:** 56px minimum height, Surface background, Text label; primary is Mint with Night text; disabled primary is Surface Raised with muted text so it stays visibly a button. The host row uses three 72px buttons (−10 s, Play/Pause, +10 s).
- **Action line:** under the host row: "Pausing…" while sent, "Paused" only once the TV confirms (fades after 2.5 s), "The TV didn't respond. Try again." in Danger if never confirmed.
- **Ask Pip panel:** Surface panel with Pip, three starter chips, an input with Ask and (where the browser supports it) a mic button. "Did you mean" options become full-width chips plus "Something else".
- **Reply (pad):** an inset Night card with the answer at Title size and a Done button that also hides Pip on the TV. Not-sure replies are muted at Body size.
- **TV bubble:** "<name> asked: <question>" in caption, the reply in body, at most 4 lines, Pip beside it. Fades in over 180 ms; hides after 8 s or on Done, Hide or the remote's Back.
- **Pip:** states sleep, idle, thinking, talking, cheer. Breathing and blinking only; no costumes, no extra characters. On the TV Pip shows only while the bubble does.

## Do's and Don'ts

- **Do** keep the film full screen until someone asks.
- **Do** show a command's result only when the TV reports it.
- **Do** keep every error to one line that says what happened and what to do.
- **Don't** show quizzes, prediction prompts, chapter walls, reactions or reminders in the default watch path.
- **Don't** add a second accent colour, gradients, shadows or borders.
- **Don't** add characters, costumes or decorative mascot motion.
- **Don't** put anything under the TV reply bubble or outside the safe margin.
