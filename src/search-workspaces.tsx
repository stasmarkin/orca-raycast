import { List } from "@raycast/api";
import { useMemo, useState } from "react";
import { needsAttention, type Workspace } from "./orca/types";
import { useOrcaWorkspaces } from "./ui/use-orca-workspaces";
import { WorkspaceActions } from "./ui/workspace-actions";
import { lastPreviewLine, statusIcon, workspaceAccessories } from "./ui/workspace-presentation";

type Filter = "all" | "attention" | "active" | "pinned";

export default function Command() {
  const { workspaces, terminalsFor, isLoading, revalidate } = useOrcaWorkspaces();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => workspaces.filter((w) => matchesFilter(w, filter)), [workspaces, filter]);
  const grouped = useMemo(() => groupByRepo(visible), [visible]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search workspaces by name, repo or branch"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(value) => setFilter(value as Filter)}>
          <List.Dropdown.Item title="All" value="all" />
          <List.Dropdown.Item title="Needs You" value="attention" />
          <List.Dropdown.Item title="Active" value="active" />
          <List.Dropdown.Item title="Pinned" value="pinned" />
        </List.Dropdown>
      }
    >
      <List.EmptyView title="No workspaces" description="Nothing matches this filter." />
      {grouped.map(([repo, items]) => (
        <List.Section key={repo} title={repo} subtitle={String(items.length)}>
          {items.map((workspace) => (
            <List.Item
              key={workspace.worktreeId}
              icon={statusIcon(workspace)}
              title={workspace.displayName}
              subtitle={lastPreviewLine(workspace.preview)}
              keywords={[workspace.repo, workspace.branch, workspace.path]}
              accessories={workspaceAccessories(workspace)}
              actions={
                <WorkspaceActions workspace={workspace} terminals={terminalsFor(workspace)} onChanged={revalidate} />
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function matchesFilter(workspace: Workspace, filter: Filter): boolean {
  if (workspace.isArchived) return false;
  switch (filter) {
    case "attention":
      return needsAttention(workspace);
    case "active":
      return workspace.status !== "inactive" || workspace.liveTerminalCount > 0;
    case "pinned":
      return workspace.isPinned;
    default:
      return true;
  }
}

/** Workspaces needing attention float to the top; everything else keeps Orca's recency order. */
function groupByRepo(workspaces: Workspace[]): [string, Workspace[]][] {
  const attention = workspaces.filter(needsAttention);
  const rest = workspaces.filter((workspace) => !needsAttention(workspace));

  const byRepo = new Map<string, Workspace[]>();
  for (const workspace of rest) {
    const bucket = byRepo.get(workspace.repo);
    if (bucket) bucket.push(workspace);
    else byRepo.set(workspace.repo, [workspace]);
  }

  const sections: [string, Workspace[]][] = attention.length > 0 ? [["Needs You", attention]] : [];
  return [...sections, ...byRepo.entries()];
}
