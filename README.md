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
| **Workspace Templates** / **Run Workspace Template** | Launch a saved workspace preset, optionally bound to a hotkey. |

## Workspace templates

Templates are presets for `orca worktree create`, stored in `~/.config/orca-raycast/templates.json`:

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
      "activate": false
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Used by the **Run Workspace Template** argument. Must be unique. |
| `namePattern` | Workspace name; supports placeholders. |
| `repo` | Repo selector for `--repo`, e.g. `name:orca`, `id:<uuid>`, `path:/abs/path`. |
| `agent`, `prompt` | Agent to launch and the brief sent to it. |
| `baseBranch`, `comment`, `setup`, `noParent`, `activate` | Map 1:1 onto the matching `worktree create` flags. |
| `requiresInput` | Refuse to run without an `input` argument. |

Placeholders available in `namePattern`, `prompt` and `comment`: `{input}`, `{slug}` (transliterated, branch-safe form of the input), `{date}`, `{time}`, `{clipboard}`.

### Binding a template to a hotkey

Raycast's command list is static, so a template cannot become a command on its own. Instead, open **Workspace Templates**, pick one, and run **Save as Quicklink** (`⌘L`). That stores a deeplink to **Run Workspace Template** with the template id pre-filled; assign a hotkey or alias to that Quicklink in Raycast's settings. The same works for automations.

## Preferences

- **Orca CLI** — path to the `orca` binary. Raycast runs extensions with a minimal `PATH`, so the extension probes `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin` and `~/bin`; set this if yours lives elsewhere.
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
