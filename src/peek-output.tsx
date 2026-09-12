import { Icon } from "@raycast/api";
import { basename } from "node:path";
import { TerminalPicker } from "./ui/terminal-picker";
import { AgentOutput } from "./ui/agent-output";

export default function Command() {
  return (
    <TerminalPicker
      navigationTitle="Peek Agent Output"
      actionTitle="Read Output"
      actionIcon={Icon.Terminal}
      target={(terminal) => (
        <AgentOutput handle={terminal.handle} title={terminal.title || basename(terminal.worktreePath)} />
      )}
    />
  );
}
