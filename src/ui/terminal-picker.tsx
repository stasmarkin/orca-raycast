import { Action, ActionPanel, Color, Icon, List, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { basename } from "node:path";
import { listTerminals } from "../orca/terminals";
import type { Terminal } from "../orca/types";
import { revealTerminalInOrca } from "../orca/reveal";
import { lastPreviewLine } from "./workspace-presentation";

export function TerminalPicker(props: {
  navigationTitle: string;
  actionTitle: string;
  actionIcon: Icon;
  target: (terminal: Terminal) => ReactNode;
}) {
  const { data, isLoading, revalidate } = useCachedPromise(listTerminals, [], {
    initialData: [] as Terminal[],
    keepPreviousData: true,
  });

  // Agent panes first: they are what you actually want to talk to or read.
  const agents = data.filter((terminal) => terminal.agentIdentity);
  const plain = data.filter((terminal) => !terminal.agentIdentity);

  return (
    <List isLoading={isLoading} navigationTitle={props.navigationTitle} searchBarPlaceholder="Search agent terminals">
      <List.EmptyView title="No live terminals" description="Orca has no running terminal sessions." />
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
                      onAction={() => revealTerminalInOrca(terminal.handle)}
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
