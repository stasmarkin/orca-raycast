import { Action, ActionPanel, Color, Icon, List, showToast, Toast, useNavigation, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { Form } from "@raycast/api";
import { useState } from "react";
import { launchTemplate } from "./templates/launch-template";
import { ensureTemplateFile, readTemplates, TEMPLATE_FILE, type WorkspaceTemplate } from "./templates/template-file";
import { revealTerminalInOrca } from "./orca/reveal";
import { describeError, OrcaTimeoutError } from "./orca/invoke";
import { commandDeeplink } from "./ui/deeplink";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(readTemplates, [], {
    initialData: [] as WorkspaceTemplate[],
  });

  async function createStarterFile() {
    const path = await ensureTemplateFile();
    await showToast({ style: Toast.Style.Success, title: "Template file ready", message: path });
    revalidate();
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search workspace templates">
      <List.EmptyView
        icon={error ? Icon.ExclamationMark : Icon.BlankDocument}
        title={error ? "Could not read templates" : "No templates yet"}
        description={error ? String(error.message) : `Create ${TEMPLATE_FILE} to define presets.`}
        actions={
          <ActionPanel>
            <Action title="Create Starter File" icon={Icon.NewDocument} onAction={createStarterFile} />
            <Action.Open title="Open Template File" target={TEMPLATE_FILE} />
          </ActionPanel>
        }
      />
      {data.map((template) => (
        <List.Item
          key={template.id}
          icon={{ source: Icon.Rocket, tintColor: Color.Blue }}
          title={template.title}
          subtitle={template.prompt?.slice(0, 70)}
          accessories={[
            ...(template.agent ? [{ tag: template.agent }] : []),
            ...(template.repo ? [{ text: template.repo }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="Run Template" icon={Icon.Play} target={<RunTemplateForm template={template} />} />
              <Action.CreateQuicklink
                title="Save as Quicklink"
                icon={Icon.Link}
                quicklink={{
                  name: template.title,
                  link: commandDeeplink("run-template", { template: template.id }),
                }}
                shortcut={{ modifiers: ["cmd"], key: "l" }}
              />
              <Action.Open title="Edit Template File" target={TEMPLATE_FILE} shortcut={Keyboard.Shortcut.Common.Edit} />
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

function RunTemplateForm(props: { template: WorkspaceTemplate }) {
  const { pop } = useNavigation();
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);

  async function submit() {
    if (props.template.requiresInput && !input.trim()) {
      setInputError("Required by this template");
      return;
    }

    setIsRunning(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: `Creating ${props.template.title}` });
    let created;
    try {
      created = await launchTemplate(props.template, input);
      toast.style = Toast.Style.Success;
      toast.title = "Workspace created";
      toast.message = created.worktree?.path;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = error instanceof OrcaTimeoutError ? "Still creating in Orca" : "Template failed";
      toast.message = describeError(error);
      return;
    } finally {
      setIsRunning(false);
    }

    const handle = created.agentTerminalHandle ?? created.startupTerminal?.handle;
    if (props.template.activate && handle) {
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
    pop();
  }

  return (
    <Form
      isLoading={isRunning}
      navigationTitle={props.template.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Workspace" icon={Icon.Play} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="input"
        title="Input"
        placeholder="Fills {input} and {slug} in the template"
        value={input}
        error={inputError}
        onChange={(value) => {
          setInput(value);
          setInputError(undefined);
        }}
        autoFocus
      />
      <Form.Description text={`Name: ${props.template.namePattern}`} />
      {props.template.prompt && <Form.Description text={`Brief: ${props.template.prompt}`} />}
    </Form>
  );
}
