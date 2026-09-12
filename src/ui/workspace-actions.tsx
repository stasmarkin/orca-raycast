import { Action, ActionPanel, Alert, confirmAlert, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import { removeWorkspace, supportsWorktreeMetadataCommands } from "../orca/workspaces";
import { agentTerminal, anyTerminal } from "../orca/terminals";
import { describeError, OrcaCommandError } from "../orca/invoke";
import { revealTerminalInOrca, activateOrca } from "../orca/reveal";
import type { Terminal, Workspace } from "../orca/types";
import { AgentOutput } from "./agent-output";
import { SendTextForm } from "./send-text-form";
import { runAction } from "./run-action";

export function WorkspaceActions(props: { workspace: Workspace; terminals: Terminal[]; onChanged: () => void }) {
  const { workspace, terminals, onChanged } = props;
  const writable = agentTerminal(terminals);
  const navigable = anyTerminal(terminals);

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Remove ${workspace.displayName}?`,
      message: "This removes the worktree from Orca and from git.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    const toast = await showToast({ style: Toast.Style.Animated, title: "Removing workspace" });
    try {
      await removeWorkspace(workspace.worktreeId, { force: false });
      toast.style = Toast.Style.Success;
      toast.title = "Workspace removed";
      onChanged();
      return;
    } catch (error) {
      // Only a refusal is worth escalating: a timeout or a missing binary says nothing about the
      // worktree, and offering "Force Remove" there would invite a destructive retry on a guess.
      if (!(error instanceof OrcaCommandError)) {
        toast.style = Toast.Style.Failure;
        toast.title = "Remove failed";
        toast.message = describeError(error);
        return;
      }

      // Orca refuses a dirty or still-running worktree; forcing past that destroys uncommitted work,
      // so it needs its own confirmation rather than a hardcoded --force.
      toast.hide();
      const forced = await confirmAlert({
        title: "Orca refused to remove this workspace",
        message: `${describeError(error)}\n\nForcing removal discards uncommitted changes and stops running agents. This cannot be undone.`,
        primaryAction: { title: "Force Remove", style: Alert.ActionStyle.Destructive },
      });
      if (!forced) return;
    }

    const forceToast = await showToast({ style: Toast.Style.Animated, title: "Force-removing workspace" });
    try {
      await removeWorkspace(workspace.worktreeId, { force: true });
      forceToast.style = Toast.Style.Success;
      forceToast.title = "Workspace removed";
      onChanged();
    } catch (error) {
      forceToast.style = Toast.Style.Failure;
      forceToast.title = "Remove failed";
      forceToast.message = describeError(error);
    }
  }

  return (
    <ActionPanel>
      <ActionPanel.Section>
        {navigable ? (
          <Action
            title="Switch to in Orca"
            icon={Icon.Window}
            onAction={runAction("Could not switch to workspace", () => revealTerminalInOrca(navigable.handle))}
          />
        ) : (
          <Action title="Open Orca" icon={Icon.Window} onAction={runAction("Could not open Orca", activateOrca)} />
        )}
        {navigable && (
          <Action.Push
            title="Peek Agent Output"
            icon={Icon.Terminal}
            target={
              <AgentOutput
                handle={navigable.handle}
                title={workspace.displayName}
                canSend={navigable.handle === writable?.handle}
              />
            }
            shortcut={Keyboard.Shortcut.Common.OpenWith}
          />
        )}
        {writable && (
          <Action.Push
            title="Send to Agent"
            icon={Icon.Message}
            target={<SendTextForm handle={writable.handle} title={workspace.displayName} onSent={onChanged} />}
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
            onAction={runAction("Remove failed", remove)}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
          />
        )}
      </ActionPanel.Section>
    </ActionPanel>
  );
}
