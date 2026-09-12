import { Color, Icon, type List } from "@raycast/api";
import { needsAttention, type Workspace, type WorkspaceAgent } from "../orca/types";

export const ORCA_BUNDLE_ID = "com.stablyai.orca";

export function statusIcon(workspace: Workspace): { source: Icon; tintColor: Color } {
  if (needsAttention(workspace)) return { source: Icon.QuestionMarkCircle, tintColor: Color.Orange };
  if (workspace.agents.some((agent) => agent.state === "working")) {
    return { source: Icon.CircleProgress50, tintColor: Color.Blue };
  }
  if (workspace.status === "active") return { source: Icon.Circle, tintColor: Color.Green };
  return { source: Icon.Circle, tintColor: Color.SecondaryText };
}

export function agentSummary(agents: WorkspaceAgent[]): string | undefined {
  if (agents.length === 0) return undefined;
  const waiting = agents.filter((agent) => agent.state === "waiting").length;
  const working = agents.filter((agent) => agent.state === "working").length;
  if (waiting > 0) return `${waiting} waiting`;
  if (working > 0) return `${working} working`;
  return `${agents.length} idle`;
}

export function workspaceAccessories(workspace: Workspace): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];

  const agents = agentSummary(workspace.agents);
  if (agents) accessories.push({ tag: { value: agents, color: agentTagColor(workspace) } });
  if (workspace.linkedPR) {
    accessories.push({ tag: { value: `#${workspace.linkedPR.number}`, color: prColor(workspace.linkedPR.state) } });
  }
  if (workspace.unread) accessories.push({ icon: { source: Icon.Dot, tintColor: Color.Blue } });
  if (workspace.lastActivityAt)
    accessories.push({ date: new Date(workspace.lastActivityAt), tooltip: "Last activity" });

  return accessories;
}

function agentTagColor(workspace: Workspace): Color {
  if (needsAttention(workspace)) return Color.Orange;
  if (workspace.agents.some((agent) => agent.state === "working")) return Color.Blue;
  return Color.SecondaryText;
}

function prColor(state: string): Color {
  if (state === "merged") return Color.Purple;
  if (state === "closed") return Color.Red;
  return Color.Green;
}

/** The last non-empty transcript line, which is what actually tells you where the agent stands. */
export function lastPreviewLine(preview: string | null): string | undefined {
  if (!preview) return undefined;
  const lines = preview
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[─━=]+$/.test(line));
  return lines.at(-1);
}
