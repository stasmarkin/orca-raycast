import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useState } from "react";
import { MODIFIERS, resolveModifiers, type ModifierOverrides } from "./templates/modifiers";
import { previewTemplate } from "./templates/template-preview";
import { ensureTemplateFile, readTemplateFile, TEMPLATE_FILE, type WorkspaceTemplate } from "./templates/template-file";
import { listRepos } from "./orca/workspaces";
import { readClipboardOnce } from "./ui/clipboard-once";
import { launchWithToasts } from "./ui/launch-with-toasts";

export default function Command() {
  const { data, isLoading, revalidate } = useCachedPromise(readTemplateFile, [], {
    initialData: { templates: [] as WorkspaceTemplate[] },
  });
  const { data: repos } = useCachedPromise(listRepos, [], { initialData: [] });
  const { data: clipboard = "" } = usePromise(readClipboardOnce);

  const [templateId, setTemplateId] = useState("");
  const [input, setInput] = useState("");
  const [overrides, setOverrides] = useState<ModifierOverrides>({});
  const [repo, setRepo] = useState("");
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);

  const template = data.templates.find((entry) => entry.id === templateId) ?? data.templates[0];

  if (!isLoading && !template) {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action
              title="Create Starter File"
              icon={Icon.NewDocument}
              onAction={async () => {
                await ensureTemplateFile();
                revalidate();
              }}
            />
          </ActionPanel>
        }
      >
        <Form.Description title="No workflows yet" text={`Define them in ${TEMPLATE_FILE}`} />
      </Form>
    );
  }

  const active = template ? resolveModifiers(template, overrides) : [];
  const preview = template ? previewTemplate(template, input, clipboard) : undefined;
  const needsRepo = Boolean(template) && template?.worktree !== "arc" && !template?.repo;

  async function submit() {
    if (!template) return;
    if (template.requiresInput && !input.trim()) {
      setInputError("This workflow needs a brief");
      return;
    }
    if (needsRepo && !repo) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Pick a repo first",
        message: "This workflow does not name one",
      });
      return;
    }

    setIsRunning(true);
    try {
      await launchWithToasts(template, input, {
        modifiers: active,
        orchestrator: data.orchestrator,
        repoSelector: repo,
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Form
      isLoading={isLoading || isRunning}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={template ? `Run ${template.id}` : "Run"} icon={Icon.Play} onSubmit={submit} />
          <Action.Open title="Edit Template File" target={TEMPLATE_FILE} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="template"
        title="Workflow"
        value={template?.id ?? ""}
        onChange={(id) => {
          setTemplateId(id);
          // Another workflow brings its own defaults; carrying over toggles would hide them.
          setOverrides({});
          setInputError(undefined);
        }}
      >
        {data.templates.map((entry) => (
          <Form.Dropdown.Item key={entry.id} value={entry.id} title={`${entry.id} — ${entry.title}`} />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="input"
        title="Brief"
        placeholder="Ticket, link, or the whole task in your own words"
        value={input}
        error={inputError}
        onChange={(value) => {
          setInput(value);
          if (inputError) setInputError(undefined);
        }}
      />

      {needsRepo && (
        <Form.Dropdown id="repo" title="Repo" value={repo} onChange={setRepo}>
          <Form.Dropdown.Item value="" title="Pick a repo" />
          {repos.map((entry) => (
            <Form.Dropdown.Item key={entry.id} value={`id:${entry.id}`} title={entry.displayName || entry.path} />
          ))}
        </Form.Dropdown>
      )}

      {MODIFIERS.map((modifier) => (
        <Form.Checkbox
          key={modifier.id}
          id={modifier.id}
          label={modifier.title}
          info={modifier.description}
          value={active.includes(modifier.id)}
          onChange={(value) => setOverrides((current) => ({ ...current, [modifier.id]: value }))}
        />
      ))}

      <Form.Separator />

      <Form.Description title="Workspace name" text={preview?.worktreeName ?? ""} />
      <Form.Description title="Prompt" text={preview?.prompt ?? "This workflow starts its agent with no brief."} />
    </Form>
  );
}
