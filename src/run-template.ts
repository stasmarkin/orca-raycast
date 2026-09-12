import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { launchTemplate } from "./templates/launch-template";
import { readTemplates } from "./templates/template-file";
import { revealTerminalInOrca } from "./orca/reveal";

export default async function Command(props: LaunchProps<{ arguments: { template: string; input?: string } }>) {
  const query = props.arguments.template.trim();
  const input = props.arguments.input?.trim() ?? "";

  try {
    const templates = await readTemplates();
    const match =
      templates.find((template) => template.id === query) ??
      templates.find((template) => template.title.toLowerCase() === query.toLowerCase());

    if (!match) {
      await showToast({ style: Toast.Style.Failure, title: "Template not found", message: query });
      return;
    }
    if (match.requiresInput && !input) {
      await showToast({ style: Toast.Style.Failure, title: `${match.title} needs an input argument` });
      return;
    }

    await showToast({ style: Toast.Style.Animated, title: `Creating ${match.title}` });
    const result = await launchTemplate(match, input);

    const handle = result.agentTerminalHandle ?? result.startupTerminal?.handle;
    if (match.activate && handle) await revealTerminalInOrca(handle);

    await showHUD(`🚀 ${result.worktree?.displayName ?? match.title}`);
  } catch (error) {
    await showToast({ style: Toast.Style.Failure, title: "Template failed", message: String(error) });
  }
}
