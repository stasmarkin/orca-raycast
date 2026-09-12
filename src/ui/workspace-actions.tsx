import { Action, ActionPanel, Alert, confirmAlert, Icon, showToast, Toast, Keyboard } from "@raycast/api";
import { removeWorkspace, supportsWorktreeMetadataCommands } from "../orca/workspaces";
import { preferredAgentTerminal } from "../orca/terminals";
import { revealTerminalInOrca, activateOrca } from "../orca/reveal";
import type { Terminal, Workspace } from "../orca/types";
import { AgentOutput } from "./agent-output";
import { SendTextForm } from "./send-text-form";

export function WorkspaceActions(props: { workspace: Workspace; terminals: Terminal[]; onChanged: () => void }) {
  const { workspace, terminals, onChanged } = props;
  const terminal = preferredAgentTerminal(terminals);

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Remove ${workspace.displayName}?`,
      message: "This removes the worktree from Orca and from git.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    const toast = await showToast({ style: Toast.Style.Animated, title: "Removing workspace" });
    try {
      await removeWorkspace(workspace.worktreeId);
      toast.style = Toast.Style.Success;
      toast.title = "Workspace removed";
      onChanged();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Remove failed";
      toast.message = String(error);
    }
  }

  return (
    <ActionPanel>
      <ActionPanel.Section>
        {terminal ? (
          <Action title="Switch to in Orca" icon={Icon.Window} onAction={() => revealTerminalInOrca(terminal.handle)} />
        ) : (
          <Action title="Open Orca" icon={Icon.Window} onAction={activateOrca} />
        )}
        {terminal && (
          <Action.Push
            title="Peek Agent Output"
            icon={Icon.Terminal}
            target={<AgentOutput handle={terminal.handle} title={workspace.displayName} />}
            shortcut={Keyboard.Shortcut.Common.OpenWith}
          />
        )}
        {terminal && (
          <Action.Push
            title="Send to Agent"
            icon={Icon.Message}
            target={<SendTextForm handle={terminal.handle} title={workspace.displayName} onSent={onChanged} />}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
          />
        )}
      </ActionPanel.Section>

      <ActionPanel.Section>
        <Action.CopyToClipboard title="Copy Path" content={workspace.path} shortcut={Keyboard.Shortcut.Common.Copy} />
        <Action.ShowInFinder path={workspace.path} />
        <Action.Open title="Open in Default App" target={workspace.path} />
        {workspace.branch && <Action.CopyToClipboard title="Copy Branch" content={workspace.branch} />}
      </ActionPanel.Section>

      <ActionPanel.Section>
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          onAction={onChanged}
          shortcut={Keyboard.Shortcut.Common.Refresh}
        />
        {!workspace.isMainWorktree && supportsWorktreeMetadataCommands(workspace) && (
          <Action
            title="Remove Workspace"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={remove}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
          />
        )}
      </ActionPanel.Section>
    </ActionPanel>
  );
}
