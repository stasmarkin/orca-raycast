import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { listAutomations, runAutomation } from "./orca/automations";

export default async function Command(props: LaunchProps<{ arguments: { automation: string } }>) {
  const query = props.arguments.automation.trim();

  try {
    const automations = await listAutomations();
    const match =
      automations.find((automation) => automation.id === query) ??
      automations.find((automation) => automation.name.toLowerCase() === query.toLowerCase());

    if (!match) {
      await showToast({ style: Toast.Style.Failure, title: "Automation not found", message: query });
      return;
    }

    await runAutomation(match.id);
    await showHUD(`▶︎ ${match.name}`);
  } catch (error) {
    await showToast({ style: Toast.Style.Failure, title: "Run failed", message: String(error) });
  }
}
