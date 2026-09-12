import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { sendToTerminal } from "../orca/terminals";
import { describeError } from "../orca/invoke";
import { revealTerminalInOrca } from "../orca/reveal";

export function SendTextForm(props: { handle: string; title: string; onSent?: () => void }) {
  const { pop } = useNavigation();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function submit(options: { reveal: boolean }) {
    if (!text.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Nothing to send" });
      return;
    }
    setIsSending(true);
    try {
      // A newline inside an agent TUI submits, so multi-line text would arrive as separate messages.
      await sendToTerminal(props.handle, text.replace(/\n/g, " "), true);
      await showToast({ style: Toast.Style.Success, title: "Sent", message: props.title });
      props.onSent?.();
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Send failed", message: describeError(error) });
      return;
    } finally {
      setIsSending(false);
    }

    // The message is already delivered; a failed reveal must not read as a failed send.
    if (options.reveal) {
      try {
        await revealTerminalInOrca(props.handle);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Sent, but could not switch to Orca",
          message: describeError(error),
        });
      }
    }
    pop();
  }

  return (
    <Form
      isLoading={isSending}
      navigationTitle={`Send to ${props.title}`}
      actions={
        <ActionPanel>
          <Action title="Send" icon={Icon.Message} onAction={() => submit({ reveal: false })} />
          <Action
            title="Send and Switch to Orca"
            icon={Icon.Window}
            onAction={() => submit({ reveal: true })}
            shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Message"
        placeholder="Text sent to the agent, followed by Enter"
        value={text}
        onChange={setText}
        autoFocus
      />
      <Form.Description text="Newlines are collapsed to spaces: in an agent TUI a newline submits the message." />
    </Form>
  );
}
