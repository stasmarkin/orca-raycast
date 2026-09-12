import { Action, ActionPanel, Color, Icon, List, showToast, Toast, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { listAutomations, runAutomation } from "./orca/automations";
import type { Automation } from "./orca/types";
import { commandDeeplink } from "./ui/deeplink";

export default function Command() {
  const { data, isLoading, revalidate } = useCachedPromise(listAutomations, [], {
    initialData: [] as Automation[],
    keepPreviousData: true,
  });

  async function run(automation: Automation) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Running ${automation.name}` });
    try {
      await runAutomation(automation.id);
      toast.style = Toast.Style.Success;
      toast.title = "Automation started";
      revalidate();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Run failed";
      toast.message = String(error);
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search automations">
      <List.EmptyView title="No automations" description="Create one in Orca first." />
      {data.map((automation) => (
        <List.Item
          key={automation.id}
          icon={{
            source: automation.enabled ? Icon.Clock : Icon.Pause,
            tintColor: automation.enabled ? Color.Green : Color.SecondaryText,
          }}
          title={automation.name}
          subtitle={automation.prompt.slice(0, 80)}
          accessories={[
            ...(automation.agentId ? [{ tag: automation.agentId }] : []),
            ...(automation.nextRunAt ? [{ date: new Date(automation.nextRunAt), tooltip: "Next run" }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action title="Run Now" icon={Icon.Play} onAction={() => run(automation)} />
              <Action.CreateQuicklink
                title="Save as Quicklink"
                icon={Icon.Link}
                quicklink={{
                  name: `Run ${automation.name}`,
                  link: commandDeeplink("run-automation-now", { automation: automation.id }),
                }}
                shortcut={{ modifiers: ["cmd"], key: "l" }}
              />
              <Action.CopyToClipboard title="Copy Automation ID" content={automation.id} />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={revalidate}
                shortcut={Keyboard.Shortcut.Common.Refresh}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
