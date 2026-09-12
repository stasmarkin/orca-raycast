import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { useMemo } from "react";
import { needsAttention } from "./orca/types";
import { preferredAgentTerminal } from "./orca/terminals";
import { useOrcaWorkspaces } from "./ui/use-orca-workspaces";
import { WorkspaceActions } from "./ui/workspace-actions";
import { AgentOutput } from "./ui/agent-output";
import { SendTextForm } from "./ui/send-text-form";
import { lastPreviewLine, workspaceAccessories } from "./ui/workspace-presentation";
import { Color } from "@raycast/api";

export default function Command() {
  const { workspaces, terminalsFor, isLoading, revalidate } = useOrcaWorkspaces();
  const waiting = useMemo(() => workspaces.filter(needsAttention), [workspaces]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter blocked agents" isShowingDetail={waiting.length > 0}>
      <List.EmptyView
        icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
        title="Nobody is waiting"
        description="No agent is blocked on you right now."
      />
      {waiting.map((workspace) => {
        const terminals = terminalsFor(workspace);
        const terminal = preferredAgentTerminal(terminals);
        const blockedOn = workspace.agents.find((agent) => agent.state === "waiting");

        return (
          <List.Item
            key={workspace.worktreeId}
            icon={{ source: Icon.QuestionMarkCircle, tintColor: Color.Orange }}
            title={workspace.displayName}
            subtitle={lastPreviewLine(workspace.preview)}
            accessories={workspaceAccessories(workspace)}
            detail={
              <List.Item.Detail
                markdown={workspace.preview ? `\`\`\`\n${workspace.preview}\n\`\`\`` : "_No preview_"}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Repo" text={workspace.repo} />
                    {workspace.branch && <List.Item.Detail.Metadata.Label title="Branch" text={workspace.branch} />}
                    {blockedOn?.agentType && (
                      <List.Item.Detail.Metadata.Label title="Agent" text={blockedOn.agentType} />
                    )}
                    {blockedOn?.toolName && <List.Item.Detail.Metadata.Label title="Tool" text={blockedOn.toolName} />}
                    {blockedOn?.prompt && <List.Item.Detail.Metadata.Label title="Prompt" text={blockedOn.prompt} />}
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              terminal ? (
                <ActionPanel>
                  <Action.Push
                    title="Answer Agent"
                    icon={Icon.Message}
                    target={<SendTextForm handle={terminal.handle} title={workspace.displayName} onSent={revalidate} />}
                  />
                  <Action.Push
                    title="Peek Agent Output"
                    icon={Icon.Terminal}
                    target={<AgentOutput handle={terminal.handle} title={workspace.displayName} />}
                    shortcut={Keyboard.Shortcut.Common.OpenWith}
                  />
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                  />
                </ActionPanel>
              ) : (
                <WorkspaceActions workspace={workspace} terminals={terminals} onChanged={revalidate} />
              )
            }
          />
        );
      })}
    </List>
  );
}
