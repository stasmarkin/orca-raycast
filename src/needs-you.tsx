import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useMemo } from "react";
import { needsAttention } from "./orca/types";
import { agentTerminal, anyTerminal } from "./orca/terminals";
import { useOrcaWorkspaces } from "./ui/use-orca-workspaces";
import { WorkspaceActions } from "./ui/workspace-actions";
import { AgentOutput } from "./ui/agent-output";
import { SendTextForm } from "./ui/send-text-form";
import { OrcaEmptyView, OrcaErrorBanner } from "./ui/orca-empty-view";
import { fencedBlock, lastPreviewLine, workspaceAccessories } from "./ui/workspace-presentation";

export default function Command() {
  const { workspaces, terminalsFor, truncated, isLoading, error, revalidate } = useOrcaWorkspaces();
  const waiting = useMemo(() => workspaces.filter(needsAttention), [workspaces]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter blocked agents" isShowingDetail={waiting.length > 0}>
      <OrcaEmptyView
        error={error}
        emptyTitle="Nobody is waiting"
        emptyDescription="No agent is blocked on you right now."
        emptyIcon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
        onRetry={revalidate}
      />
      <OrcaErrorBanner error={error} hasData={workspaces.length > 0} onRetry={revalidate} />
      {truncated && (
        <List.Section title="Incomplete">
          <List.Item
            icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
            title="Orca truncated its workspace list"
            subtitle="Some waiting agents may be missing"
          />
        </List.Section>
      )}
      {waiting.map((workspace) => {
        const terminals = terminalsFor(workspace);
        const writable = agentTerminal(terminals);
        const navigable = anyTerminal(terminals);
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
                markdown={workspace.preview ? fencedBlock(workspace.preview) : "_No preview_"}
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
              writable ? (
                <ActionPanel>
                  <Action.Push
                    title="Answer Agent"
                    icon={Icon.Message}
                    target={<SendTextForm handle={writable.handle} title={workspace.displayName} onSent={revalidate} />}
                  />
                  {navigable && (
                    <Action.Push
                      title="Peek Agent Output"
                      icon={Icon.Terminal}
                      target={
                        <AgentOutput
                          handle={navigable.handle}
                          title={workspace.displayName}
                          canSend={navigable.handle === writable.handle}
                        />
                      }
                      shortcut={Keyboard.Shortcut.Common.OpenWith}
                    />
                  )}
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
