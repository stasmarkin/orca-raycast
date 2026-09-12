import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { listAutomations, runAutomation } from "./orca/automations";
import { findTemplate } from "./templates/launch-template";
import { describeError } from "./orca/invoke";

export default async function Command(props: LaunchProps<{ arguments: { automation: string } }>) {
  const query = props.arguments.automation.trim();

  try {
    const automations = await listAutomations();
    const match = findTemplate(
      automations.map((automation) => ({ ...automation, title: automation.name })),
      query,
    );

    await runAutomation(match.id);
    await showHUD(`▶︎ ${match.name}`);
  } catch (error) {
    await showToast({ style: Toast.Style.Failure, title: "Run failed", message: describeError(error) });
  }
}
