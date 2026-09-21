# Task launch screens: Run Task and New Task

Status: implemented, then decided. Date: 2026-09-21.

**Outcome:** both screens were built and tried the same day. `Run Task` won and `New Task` was deleted; the shared pieces it forced out (`resolveModifiers`, `previewTemplate`, `launchWithToasts`, the clipboard read) stayed, because the detail pane is built on them. The rest of this document describes the comparison as it was designed.

## Problem

Launching a workflow is one line of text. The search bar of `Run Task` takes `<template> <input>`, so a multi-sentence brief is typed into a single-line field, and nothing on screen says what the workflow will actually do: which agent starts, which project it checks out, which modifiers are on by default, or what prompt the agent receives. The first sign of a wrong choice is a workspace that already exists.

Both screens below are built, kept side by side, and judged in daily use. Whichever loses is deleted later; this document does not pick a winner.

## Command 1 — Run Task (existing screen, gains a detail pane)

`src/workspace-templates.tsx` keeps its search bar as the input. The list turns on `isShowingDetail`, so each row shows only the template id and title, and everything else moves to the pane:

- **Metadata**: agent, target (arc project or Orca repo), base branch, the worktree name this launch would create, and whether the template still needs input.
- **Modifier tags**: one `TagList` with every modifier, green when active. Raycast recommends dropping row accessories in detail mode, which is why the tags move here.
- **Prompt**: the expanded prompt as markdown, below the metadata.

`⌘P` / `⌘H` keep toggling modifiers, and the pane re-renders on every keystroke in the search bar.

## Command 2 — New Task (new screen)

A form, `src/new-task.tsx`, registered as one new entry in `package.json`:

- workflow dropdown,
- multi-line brief (`Form.TextArea`, focused on open),
- one checkbox per modifier, pre-checked from the template's `defaultModifiers` and reset when the workflow changes,
- repo dropdown, shown only when the selected template names no repo and is not an arc template,
- a description block with the prompt and the worktree name the launch will produce.

Submit runs the same launch path as `Run Task`: the same toasts, the same partial-success warnings, the same reveal when the template sets `activate`.

## Shared core

Both screens call the existing `launchTemplate` and read the same `templates.json`. What they cannot share today is the answer to "what would this launch do", which currently lives inside `workspace-templates.tsx`. That moves into two small pieces:

- `resolveModifiers(template, overrides)` in `src/templates/modifiers.ts` — the template's defaults, overridden per modifier by what the user toggled on the screen.
- `src/templates/template-preview.ts` — given a template, the input and the clipboard, returns the expanded prompt and the worktree name (through `toWtWorktreeName` for arc templates, the raw expanded pattern otherwise, since Orca allows spaces). Agent, target and base branch are plain template fields, so the screens render them directly rather than through this module.

`expandPlaceholders` gains an optional `clipboard` value in its context. When present it uses that instead of reading the clipboard itself.

## Clipboard

A preview that expands `{clipboard}` must not read the clipboard on every keystroke. Each screen reads it once when it opens and passes that value into the preview. The launch path is untouched and still reads the clipboard at launch time, so a clipboard changed mid-screen makes the preview stale — acceptable, and the alternative (a literal `{clipboard}` in the preview) hides exactly what the user came to check.

`{date}` and `{time}` behave the same way: computed when the preview renders, recomputed at launch.

## Corner cases

- Template requires input and the brief is empty: the form blocks submit with a field-level validation error instead of a toast; `Run Task` keeps its current toast.
- No templates at all: both screens offer to create the starter file, as `Run Task` does today.
- Template names no repo and none is selected: the form hides submit behind the same check `Run Task` already makes.
- Newlines in the brief: the preview shows the prompt as the user typed it. Collapsing newlines stays where it is today, in the launch path, because a newline inside a TUI agent submits the message.
- A prompt longer than the pane: markdown in the detail pane scrolls; the form's description block grows.
- Template file edited while a screen is open: both screens re-read it through the existing `useCachedPromise` revalidation.

## Out of scope

Generating a Raycast command per template, changing the `templates.json` format, and any change to `wt` or Orca itself.

## Testing

Unit tests, in the existing vitest setup with the `@raycast/api` mock:

- `resolveModifiers`: template defaults, a user override in both directions, an unknown modifier id.
- `previewTemplate`: placeholder expansion with an injected clipboard, arc worktree name slugified, non-arc name left alone, template without a prompt.

The screens themselves are checked by hand — Raycast UI is not worth mocking here.
