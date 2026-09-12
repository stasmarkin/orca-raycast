import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { readTerminal } from "../orca/terminals";
import { revealTerminalInOrca } from "../orca/reveal";
import { SendTextForm } from "./send-text-form";

const TAIL_LINES = 120;

export function AgentOutput(props: { handle: string; title: string }) {
  const { data, isLoading, revalidate } = useCachedPromise(
    (handle: string) => readTerminal(handle, TAIL_LINES),
    [props.handle],
  );

  const body = data?.tail.join("\n") ?? "";
  const markdown = `## ${props.title}\n\n\`\`\`\n${body}\n\`\`\``;

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={props.title}
      metadata={
        data ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Status" text={data.status} />
            <Detail.Metadata.Label title="Lines" text={String(data.returnedLineCount)} />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          <Action.Push
            title="Send to Agent"
            icon={Icon.Message}
            target={<SendTextForm handle={props.handle} title={props.title} />}
          />
          <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
          <Action
            title="Switch to in Orca"
            icon={Icon.Window}
            onAction={() => revealTerminalInOrca(props.handle)}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <Action.CopyToClipboard title="Copy Output" content={body} />
        </ActionPanel>
      }
    />
  );
}
