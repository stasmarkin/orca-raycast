import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { findTemplate, launchTemplate } from "./templates/launch-template";
import { readTemplates } from "./templates/template-file";
import { describeError, OrcaTimeoutError } from "./orca/invoke";
import { revealTerminalInOrca } from "./orca/reveal";

export default async function Command(props: LaunchProps<{ arguments: { template: string; input?: string } }>) {
  const query = props.arguments.template.trim();
  const input = props.arguments.input?.trim() ?? "";

  let created;
  let template;
  try {
    template = findTemplate(await readTemplates(), query);
    await showToast({ style: Toast.Style.Animated, title: `Creating ${template.title}` });
    created = await launchTemplate(template, input);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: error instanceof OrcaTimeoutError ? "Still creating in Orca" : "Template failed",
      message: describeError(error),
    });
    return;
  }

  await showHUD(`🚀 ${created.worktree?.displayName ?? template.title}`);

  const handle = created.agentTerminalHandle ?? created.startupTerminal?.handle;
  if (!template.activate || !handle) return;
  try {
    await revealTerminalInOrca(handle);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Created, but could not switch to Orca",
      message: describeError(error),
    });
  }
}
