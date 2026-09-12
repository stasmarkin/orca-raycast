import { Icon } from "@raycast/api";
import { basename } from "node:path";
import { TerminalPicker } from "./ui/terminal-picker";
import { SendTextForm } from "./ui/send-text-form";

export default function Command() {
  return (
    <TerminalPicker
      navigationTitle="Send to Agent"
      actionTitle="Compose Message"
      actionIcon={Icon.Message}
      writableAgentsOnly
      target={(terminal) => (
        <SendTextForm handle={terminal.handle} title={terminal.title || basename(terminal.worktreePath)} />
      )}
    />
  );
}
