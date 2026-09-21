# Orca for Raycast

Control [Orca](https://github.com/stablyai/orca) workspaces, agents and automations without leaving Raycast.

The extension talks to Orca exclusively through the public `orca` CLI (`orca <command> --json`), so it stays on a supported contract and works against a remote Orca runtime as well as the local one.

## Commands

| Command | What it does |
| --- | --- |
| **Search Workspaces** | Every workspace with live agent status, grouped by repo. Workspaces blocked on you float to the top. |
| **Agents Needing You** | Only the workspaces where an agent is waiting — answer it straight from Raycast. |
| **Orca Agents** (menu bar) | Count of agents waiting on you; click one to jump to its terminal in Orca. |
| **Create Workspace** | Repo, name, base branch, agent and brief — the form equivalent of `orca worktree create`. |
| **Send to Agent** | Send a message to any live agent terminal. |
| **Peek Agent Output** | Read the tail of an agent terminal as a detail view. |
| **Run Automation** / **Run Automation Now** | Browse Orca automations and run one; save any of them as a hotkey. |
| **Run Task** / **Run Workspace Template** | Type a template id and its input, toggle modifiers, launch. |

## Run Task

One screen for launching work. Type the template id, then whatever it needs:

```
pp STARTREK-789
│  └── everything after the first word becomes {input}
└───── template id
```

The pane on the right shows what the launch would do before it happens: agent, target checkout, the workspace name it would create, which modifiers are on, and the prompt with `{input}` already expanded.

Modifiers toggle with `⌘1` / `⌘2` (or from `⌘K`) and show as tags in that pane:

| Modifier | Effect |
| --- | --- |
| **Pin** | Pins the new workspace via `orca worktree set --pin`. |
| **Huge Task** | Creates the workspace without an agent, then starts an orchestrator terminal (`claude --model fable` by default), waits for its TUI, and sends the brief. Use it when the job should be split across subagents rather than done by one agent. |

A template's `defaultModifiers` are pre-selected; toggling on this screen overrides them for that launch.

Templates that do not name a `repo` use the repo picked in the search bar dropdown, which is remembered between launches (including for hotkey launches, which have no UI).

## Workspace templates

Templates are presets for a workspace launch, stored in `~/.config/orca-raycast/templates.json`:

```json
{
  "templates": [
    {
      "id": "review",
      "title": "Review a PR",
      "repo": "name:orca",
      "namePattern": "review-{slug}",
      "baseBranch": "main",
      "agent": "claude",
      "prompt": "Review {input}. Start with analysis and a plan; do not write code or commit without an OK.",
      "noParent": true,
      "requiresInput": true,
      "defaultModifiers": ["pin"],
      "activate": false
    }
  ],
  "orchestrator": {
    "command": "claude --model fable",
    "promptPrefix": "You are the orchestrator… Task: {brief}"
  }
}
```

| Field | Meaning |
| --- | --- |
| `id` | What you type on the **Run Task** screen. Must be unique. |
| `namePattern` | Workspace name; supports placeholders. |
| `worktree` | Who makes the checkout: `orca` (default) or `arc`, see below. |
| `repo` | Repo selector for `--repo`, e.g. `name:orca`, `id:<uuid>`, `path:/abs/path`. Omit it to use the dropdown. |
| `project` | Project for `wt new --project`, e.g. `pp`. Required when `worktree` is `arc`, ignored otherwise. |
| `agent`, `prompt` | Agent to launch and the brief sent to it. |
| `baseBranch`, `comment`, `setup`, `noParent`, `activate` | Map 1:1 onto the matching `worktree create` flags. |
| `requiresInput` | Refuse to run without an input. |
| `defaultModifiers` | Modifiers pre-selected for this template (`pin`, `huge`). |

### Arcadia templates

Arcadia is a monorepo on `arc`, not git, so Orca cannot cut a worktree in it. A template with `"worktree": "arc"` delegates to the external [`wt`](#preferences) CLI instead:

```json
{
  "id": "pp",
  "title": "Plugins platform task",
  "worktree": "arc",
  "project": "pp",
  "namePattern": "{input}",
  "agent": "claude",
  "prompt": "Задача {input}…",
  "requiresInput": true,
  "defaultModifiers": ["pin"]
}
```

`wt new` cuts the arc worktree, registers it in Orca as its own project, creates the workspace and starts the agent with the brief. Everything after that — `pin`, **Huge Task**, `activate` — works exactly as for an Orca worktree, because `wt` answers with an Orca worktree id.

Only `namePattern`, `agent`, `prompt`, `requiresInput`, `defaultModifiers` and `activate` apply to an arc template; the flags of `orca worktree create` (`repo`, `baseBranch`, `comment`, `setup`, `noParent`) do not reach `wt`.

The optional top-level `orchestrator` block configures the **Huge Task** modifier: `command` is the startup command, and `promptPrefix` wraps the template's prompt where `{brief}` appears.

Placeholders available in `namePattern`, `prompt` and `comment`: `{input}`, `{slug}` (transliterated, branch-safe form of the input), `{date}`, `{time}`, `{clipboard}`.

### Binding a template to a hotkey

Raycast's command list is static, so a template cannot become a command on its own. Instead, open **Run Task**, pick one, and run **Save as Quicklink** (`⌘L`). That stores a deeplink to **Run Workspace Template** with the template id, the current input and the selected modifiers pre-filled; assign a hotkey or alias to that Quicklink in Raycast's settings. The same works for automations.

## Preferences

- **Orca CLI** — path to the `orca` binary. Raycast runs extensions with a minimal `PATH`, so the extension probes `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin` and `~/bin`; set this if yours lives elsewhere.
- **wt CLI** — path to the `wt` binary, used only by templates with `"worktree": "arc"`. Probed in the same four directories.
- **Environment** — a saved remote Orca runtime (`orca environment list`) to target instead of the local one.

## Development

```sh
npm install
npm run dev        # ray develop — hot reload into Raycast
npm run build      # ray build — installs the built extension locally
npm run typecheck
```

## Known limits

- Folder workspaces (as opposed to git worktrees) cannot be removed or edited from here: Orca's `worktree show/set/rm` only resolve git worktrees. They still show up, and their terminals work normally.
- Status is polled, not streamed; the menu bar refreshes on Raycast's 1-minute interval.
