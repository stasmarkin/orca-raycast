import { Action, ActionPanel, Color, Detail, Icon, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { readTerminal } from "../orca/terminals";
import { describeError } from "../orca/invoke";
import { revealTerminalInOrca } from "../orca/reveal";
import { SendTextForm } from "./send-text-form";
import { fencedBlock } from "./workspace-presentation";
import { runAction } from "./run-action";

const TAIL_LINES = 120;

/** `canSend` must mirror `agentTerminal()`: a plain shell pane would execute the typed text. */
export function AgentOutput(props: { handle: string; title: string; canSend: boolean }) {
  const { data, isLoading, error, revalidate } = useCachedPromise(
    (handle: string) => readTerminal(handle, TAIL_LINES),
    [props.handle],
  );

  const body = data?.tail.join("\n") ?? "";
  const markdown = error
    ? `## ${props.title}\n\n> Could not read this terminal: ${describeError(error)}`
    : `## ${props.title}\n\n${fencedBlock(body)}`;

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
            {data.truncated && (
              <Detail.Metadata.Label
                title="Output"
                text="Truncated"
                icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
              />
            )}
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          {props.canSend && (
            <Action.Push
              title="Send to Agent"
              icon={Icon.Message}
              target={<SendTextForm handle={props.handle} title={props.title} />}
            />
          )}
          <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={revalidate} />
          <Action
            title="Switch to in Orca"
            icon={Icon.Window}
            onAction={runAction("Could not switch to terminal", () => revealTerminalInOrca(props.handle))}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          <Action.CopyToClipboard title="Copy Output" content={body} />
        </ActionPanel>
      }
    />
  );
}
