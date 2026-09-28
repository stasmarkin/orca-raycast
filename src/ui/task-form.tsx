import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { MODIFIERS, resolveModifiers, type ModifierId, type ModifierOverrides } from "../templates/modifiers";
import { usesClipboardPlaceholder } from "../templates/placeholders";
import { clearTaskDraft, overridesFromDraft, readTaskDraft, writeTaskDraft } from "../templates/task-draft";
import { previewTemplate, usesClipboard } from "../templates/template-preview";
import type { OrchestratorConfig, WorkspaceTemplate } from "../templates/template-file";
import { listRepos } from "../orca/workspaces";
import { readClipboardOnce } from "./clipboard-once";
import { launchWithToasts } from "./launch-with-toasts";

// Every keystroke would hammer LocalStorage; a lost tail of a few hundred ms is not worth that.
const DRAFT_SAVE_DELAY_MS = 400;

export type TaskFormProps = {
  template: WorkspaceTemplate;
  orchestrator: OrchestratorConfig | undefined;
  /** Lets the list drop the draft badge for a workflow that just launched. */
  onLaunched: () => void;
};

export function TaskForm({ template, orchestrator, onLaunched }: TaskFormProps) {
  const { pop } = useNavigation();
  const { data: repos } = useCachedPromise(listRepos, [], { initialData: [] });

  const [input, setInput] = useState("");
  const [overrides, setOverrides] = useState<ModifierOverrides>({});
  const [repo, setRepo] = useState("");
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  // Until the stored draft has been applied, saving would overwrite it with the empty initial state.
  const [isRestored, setIsRestored] = useState(false);

  usePromise(
    async (id: string) => {
      const draft = await readTaskDraft(id);
      if (draft) {
        setInput(draft.input);
        setOverrides(overridesFromDraft(draft.modifiers));
        setRepo(draft.repo);
      }
      setIsRestored(true);
    },
    [template.id],
  );

  const active = resolveModifiers(template, overrides);
  useDraftAutosave(template.id, { isRestored, input, modifiers: active, repo });

  const needsClipboard = usesClipboard(template) || usesClipboardPlaceholder(input);
  const { data: clipboard = "" } = usePromise(readClipboardOnce, [], { execute: needsClipboard });

  const preview = previewTemplate(template, input, clipboard);
  const needsRepo = template.worktree !== "arc" && !template.repo;

  async function submit() {
    if (isRunning) return;
    if (template.requiresInput && !input.trim()) {
      setInputError("This workflow needs a brief");
      return;
    }
    if (needsRepo && !repo) {
      await showToast({ style: Toast.Style.Failure, title: "Pick a repo first", message: "This one names none" });
      return;
    }

    setIsRunning(true);
    try {
      const launched = await launchWithToasts(template, input, {
        modifiers: active,
        orchestrator,
        repoSelector: repo,
      });
      // A failed launch keeps the brief: retyping it is exactly what the draft exists to prevent.
      if (!launched) return;
      await clearTaskDraft(template.id);
      onLaunched();
      pop();
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Form
      isLoading={isRunning}
      navigationTitle={template.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={`Run ${template.id}`} icon={Icon.Play} onSubmit={submit} />
          {/* The checkboxes are reachable by Tab, but not without leaving the brief mid-sentence. */}
          <ActionPanel.Section title="Modifiers">
            {MODIFIERS.map((modifier) => (
              <Action
                key={modifier.id}
                title={`${active.includes(modifier.id) ? "Disable" : "Enable"} ${modifier.title}`}
                icon={active.includes(modifier.id) ? Icon.CheckCircle : Icon.Circle}
                shortcut={{ modifiers: ["cmd"], key: modifier.key }}
                onAction={() =>
                  setOverrides((current) => ({ ...current, [modifier.id]: !active.includes(modifier.id) }))
                }
              />
            ))}
          </ActionPanel.Section>
          <Action
            title="Discard Draft"
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={async () => {
              await clearTaskDraft(template.id);
              setInput("");
              setInputError(undefined);
              onLaunched();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="input"
        title="Brief"
        placeholder="Ticket, link, or the whole task in your own words — as many lines as you need"
        value={input}
        error={inputError}
        onChange={(value) => {
          setInput(value);
          if (inputError) setInputError(undefined);
        }}
      />

      {needsRepo && (
        <Form.Dropdown id="repo" title="Repo" value={repo} onChange={setRepo}>
          <Form.Dropdown.Item value="" title="No repo picked" />
          {repos.map((entry) => (
            <Form.Dropdown.Item key={entry.id} value={`id:${entry.id}`} title={entry.displayName || entry.path} />
          ))}
        </Form.Dropdown>
      )}

      {MODIFIERS.map((modifier) => (
        <Form.Checkbox
          key={modifier.id}
          id={modifier.id}
          label={`${modifier.title}  ⌘${modifier.key}`}
          info={modifier.description}
          value={active.includes(modifier.id)}
          onChange={(value) => setOverrides((current) => ({ ...current, [modifier.id]: value }))}
        />
      ))}

      <Form.Separator />

      <Form.Description
        title={template.worktree === "main" ? "Terminal title" : "Workspace name"}
        text={preview.worktreeName}
      />
      <Form.Description title="Prompt" text={preview.prompt ?? "This workflow starts its agent with no brief."} />
    </Form>
  );
}

function useDraftAutosave(
  templateId: string,
  state: { isRestored: boolean; input: string; modifiers: ModifierId[]; repo: string },
): void {
  const { isRestored, input, repo } = state;
  const modifiers = state.modifiers.join(",");
  const saved = useRef("");

  useEffect(() => {
    if (!isRestored) return;

    const snapshot = JSON.stringify({ templateId, input, modifiers, repo });
    if (snapshot === saved.current) return;

    const timer = setTimeout(() => {
      saved.current = snapshot;
      const draft = { input, modifiers: state.modifiers, repo };
      void (input.trim() ? writeTaskDraft(templateId, draft) : clearTaskDraft(templateId));
    }, DRAFT_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // `state.modifiers` is a fresh array each render; the joined string is what actually changes.
  }, [templateId, isRestored, input, modifiers, repo]);
}
