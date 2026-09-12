import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { basename } from "node:path";
import { canReceiveInput, listTerminals } from "../orca/terminals";
import type { Terminal, TerminalList } from "../orca/types";
import { revealTerminalInOrca } from "../orca/reveal";
import { lastPreviewLine } from "./workspace-presentation";
import { OrcaEmptyView, OrcaErrorBanner } from "./orca-empty-view";
import { runAction } from "./run-action";

const EMPTY: TerminalList = { terminals: [], totalCount: 0, truncated: false };

export function TerminalPicker(props: {
  navigationTitle: string;
  actionTitle: string;
  actionIcon: Icon;
  /** Send targets must be writable agent panes; typing into a plain shell would run the text as a command. */
  writableAgentsOnly?: boolean;
  target: (terminal: Terminal) => ReactNode;
}) {
  const { data, isLoading, error, revalidate } = useCachedPromise(listTerminals, [], {
    initialData: EMPTY,
    keepPreviousData: true,
  });

  const eligible = props.writableAgentsOnly ? data.terminals.filter(canReceiveInput) : data.terminals;

  const agents = eligible.filter((terminal) => terminal.agentIdentity);
  const plain = eligible.filter((terminal) => !terminal.agentIdentity);

  return (
    <List isLoading={isLoading} navigationTitle={props.navigationTitle} searchBarPlaceholder="Search agent terminals">
      <OrcaEmptyView
        error={error}
        emptyTitle={props.writableAgentsOnly ? "No agent terminals" : "No live terminals"}
        emptyDescription={
          props.writableAgentsOnly
            ? "No running agent accepts input right now."
            : "Orca has no running terminal sessions."
        }
        emptyIcon={{ source: Icon.Terminal, tintColor: Color.SecondaryText }}
        onRetry={revalidate}
      />
      <OrcaErrorBanner error={error} hasData={eligible.length > 0} onRetry={revalidate} />
      {data.truncated && (
        <List.Section title="Incomplete">
          <List.Item
            icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
            title={`Orca returned only ${data.terminals.length} of ${data.totalCount} terminals`}
          />
        </List.Section>
      )}
      {[
        { title: "Agents", items: agents },
        { title: "Other Terminals", items: plain },
      ]
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <List.Section key={section.title} title={section.title} subtitle={String(section.items.length)}>
            {section.items.map((terminal) => (
              <List.Item
                key={terminal.handle}
                icon={{
                  source: terminal.connected ? Icon.Terminal : Icon.Plug,
                  tintColor: terminal.connected ? Color.Green : Color.SecondaryText,
                }}
                title={terminal.title || basename(terminal.worktreePath)}
                subtitle={lastPreviewLine(terminal.preview)}
                keywords={[terminal.worktreePath, terminal.branch, terminal.agentIdentity ?? ""]}
                accessories={[
                  ...(terminal.agentIdentity ? [{ tag: terminal.agentIdentity }] : []),
                  { text: basename(terminal.worktreePath) },
                ]}
                actions={
                  <ActionPanel>
                    <Action.Push title={props.actionTitle} icon={props.actionIcon} target={props.target(terminal)} />
                    <Action
                      title="Switch to in Orca"
                      icon={Icon.Window}
                      onAction={runAction("Could not switch to terminal", () => revealTerminalInOrca(terminal.handle))}
                      shortcut={Keyboard.Shortcut.Common.Open}
                    />
                    <Action.CopyToClipboard title="Copy Workspace Path" content={terminal.worktreePath} />
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      onAction={revalidate}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        ))}
    </List>
  );
}
