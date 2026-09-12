import { Color, Icon, launchCommand, LaunchType, MenuBarExtra, open } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { listTerminals, preferredAgentTerminal, terminalsForWorkspace } from "./orca/terminals";
import { listWorkspaces } from "./orca/workspaces";
import { needsAttention, type Terminal, type Workspace } from "./orca/types";
import { revealTerminalInOrca } from "./orca/reveal";
import { lastPreviewLine } from "./ui/workspace-presentation";

export default function Command() {
  const { data, isLoading } = useCachedPromise(
    async () => {
      const [workspaces, terminals] = await Promise.all([listWorkspaces(), listTerminals()]);
      return { workspaces, terminals };
    },
    [],
    { initialData: { workspaces: [] as Workspace[], terminals: [] as Terminal[] }, keepPreviousData: true },
  );

  const waiting = data.workspaces.filter(needsAttention);
  const working = data.workspaces.filter((w) => !needsAttention(w) && w.agents.some((a) => a.state === "working"));

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={
        waiting.length > 0
          ? { source: Icon.QuestionMarkCircle, tintColor: Color.Orange }
          : { source: Icon.Circle, tintColor: Color.SecondaryText }
      }
      title={waiting.length > 0 ? String(waiting.length) : undefined}
      tooltip={`${waiting.length} waiting, ${working.length} working`}
    >
      {waiting.length > 0 && (
        <MenuBarExtra.Section title="Needs You">
          {waiting.map((workspace) => (
            <MenuBarExtra.Item
              key={workspace.worktreeId}
              title={workspace.displayName}
              subtitle={lastPreviewLine(workspace.preview)}
              icon={{ source: Icon.QuestionMarkCircle, tintColor: Color.Orange }}
              onAction={() => reveal(workspace, data.terminals)}
            />
          ))}
        </MenuBarExtra.Section>
      )}

      {working.length > 0 && (
        <MenuBarExtra.Section title="Working">
          {working.map((workspace) => (
            <MenuBarExtra.Item
              key={workspace.worktreeId}
              title={workspace.displayName}
              subtitle={lastPreviewLine(workspace.preview)}
              icon={{ source: Icon.CircleProgress50, tintColor: Color.Blue }}
              onAction={() => reveal(workspace, data.terminals)}
            />
          ))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Agents Needing You"
          icon={Icon.AppWindowList}
          onAction={() => launchCommand({ name: "needs-you", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item
          title="Search Workspaces"
          icon={Icon.MagnifyingGlass}
          onAction={() => launchCommand({ name: "search-workspaces", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

async function reveal(workspace: Workspace, terminals: Terminal[]): Promise<void> {
  const terminal = preferredAgentTerminal(terminalsForWorkspace(terminals, workspace.path));
  if (terminal) await revealTerminalInOrca(terminal.handle);
  else await open(workspace.path);
}
