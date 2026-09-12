import { useCachedPromise } from "@raycast/utils";
import { listTerminals, terminalsForWorkspace } from "../orca/terminals";
import { listWorkspaces } from "../orca/workspaces";
import { isVisible, type Terminal, type Workspace } from "../orca/types";

export type OrcaSnapshot = {
  workspaces: Workspace[];
  terminals: Terminal[];
  /** Set when Orca still capped the workspace listing despite the explicit limit, so the UI can say so. */
  truncated: boolean;
  /** Total workspaces Orca reports, which is what the shown count should be compared against. */
  totalCount: number;
};

const EMPTY: OrcaSnapshot = { workspaces: [], terminals: [], truncated: false, totalCount: 0 };

export function useOrcaWorkspaces() {
  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (): Promise<OrcaSnapshot> => {
      const [workspaces, terminals] = await Promise.all([listWorkspaces(), listTerminals()]);
      return {
        workspaces: workspaces.worktrees.filter(isVisible),
        terminals: terminals.terminals,
        truncated: workspaces.truncated,
        totalCount: workspaces.totalCount,
      };
    },
    [],
    { initialData: EMPTY, keepPreviousData: true },
  );

  return {
    workspaces: data.workspaces,
    truncated: data.truncated,
    totalCount: data.totalCount,
    terminalsFor: (workspace: Workspace) => terminalsForWorkspace(data.terminals, workspace.path),
    isLoading,
    error,
    revalidate,
  };
}
