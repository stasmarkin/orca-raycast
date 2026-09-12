import { useCachedPromise } from "@raycast/utils";
import { listTerminals, terminalsForWorkspace } from "../orca/terminals";
import { listWorkspaces } from "../orca/workspaces";
import type { Terminal, Workspace } from "../orca/types";

export type OrcaSnapshot = { workspaces: Workspace[]; terminals: Terminal[] };

const EMPTY: OrcaSnapshot = { workspaces: [], terminals: [] };

export function useOrcaWorkspaces() {
  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (): Promise<OrcaSnapshot> => {
      const [workspaces, terminals] = await Promise.all([listWorkspaces(), listTerminals()]);
      return { workspaces, terminals };
    },
    [],
    { initialData: EMPTY, keepPreviousData: true },
  );

  return {
    workspaces: data.workspaces,
    terminalsFor: (workspace: Workspace) => terminalsForWorkspace(data.terminals, workspace.path),
    isLoading,
    error,
    revalidate,
  };
}
