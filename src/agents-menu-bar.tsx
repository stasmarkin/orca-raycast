import { Color, Icon, launchCommand, LaunchType, MenuBarExtra, open, openExtensionPreferences } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { anyTerminal, listTerminals, terminalsForWorkspace } from "./orca/terminals";
import { listWorkspaces } from "./orca/workspaces";
import { describeError } from "./orca/invoke";
import { isVisible, needsAttention, type Workspace, type WorkspaceList } from "./orca/types";
import { revealTerminalInOrca } from "./orca/reveal";
import { lastPreviewLine } from "./ui/workspace-presentation";

const EMPTY: WorkspaceList = { worktrees: [], totalCount: 0, truncated: false };

export default function Command() {
  // Terminals are only needed to answer a click, so they are fetched then rather than every minute.
  const { data, isLoading, error } = useCachedPromise(listWorkspaces, [], {
    initialData: EMPTY,
    keepPreviousData: true,
  });

  const workspaces = data.worktrees.filter(isVisible);
  const waiting = workspaces.filter(needsAttention);
  const working = workspaces.filter((w) => !needsAttention(w) && w.agents.some((a) => a.state === "working"));

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={menuIcon(error, waiting.length)}
      title={error ? "!" : waiting.length > 0 ? String(waiting.length) : undefined}
      tooltip={
        error ? `Orca unreachable: ${describeError(error)}` : `${waiting.length} waiting, ${working.length} working`
      }
    >
      {error && (
        <MenuBarExtra.Section title="Orca unreachable">
          <MenuBarExtra.Item
            title={describeError(error)}
            icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
            onAction={openExtensionPreferences}
          />
        </MenuBarExtra.Section>
      )}

      {data.truncated && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title={`Showing ${workspaces.length} of ${data.totalCount} workspaces`}
            icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
          />
        </MenuBarExtra.Section>
      )}

      {waiting.length > 0 && (
        <MenuBarExtra.Section title="Needs You">
          {waiting.map((workspace) => (
            <MenuBarExtra.Item
              key={workspace.worktreeId}
              title={workspace.displayName}
              subtitle={lastPreviewLine(workspace.preview)}
              icon={{ source: Icon.QuestionMarkCircle, tintColor: Color.Orange }}
              onAction={() => void reveal(workspace)}
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
              onAction={() => void reveal(workspace)}
            />
          ))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Agents Needing You"
          icon={Icon.AppWindowList}
          onAction={() => void launchCommand({ name: "needs-you", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item
          title="Search Workspaces"
          icon={Icon.MagnifyingGlass}
          onAction={() => void launchCommand({ name: "search-workspaces", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

function menuIcon(error: unknown, waitingCount: number) {
  if (error) return { source: Icon.ExclamationMark, tintColor: Color.Red };
  if (waitingCount > 0) return { source: Icon.QuestionMarkCircle, tintColor: Color.Orange };
  return { source: Icon.Circle, tintColor: Color.SecondaryText };
}

async function reveal(workspace: Workspace): Promise<void> {
  try {
    const terminals = await listTerminals();
    const terminal = anyTerminal(terminalsForWorkspace(terminals.terminals, workspace.path));
    if (terminal) await revealTerminalInOrca(terminal.handle);
    else await open(workspace.path);
  } catch {
    await open(workspace.path);
  }
}
