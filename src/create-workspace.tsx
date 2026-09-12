import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { AGENT_IDS } from "./orca/agent-ids";
import { createWorkspace, listRepos } from "./orca/workspaces";
import { describeError, OrcaTimeoutError } from "./orca/invoke";
import { revealTerminalInOrca } from "./orca/reveal";

type FormValues = {
  repo: string;
  name: string;
  baseBranch: string;
  agent: string;
  prompt: string;
  comment: string;
  setup: string;
  activate: boolean;
};

export default function Command() {
  const { data: repos, isLoading } = useCachedPromise(listRepos, [], { initialData: [] });
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  async function submit(values: FormValues) {
    if (!values.name.trim()) {
      setNameError("Required");
      return;
    }

    setIsCreating(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating workspace" });
    let created: Awaited<ReturnType<typeof createWorkspace>>;
    try {
      created = await createWorkspace({
        name: values.name.trim(),
        repoSelector: values.repo ? `id:${values.repo}` : undefined,
        baseBranch: values.baseBranch.trim() || undefined,
        agent: values.agent || undefined,
        prompt: values.prompt.trim() || undefined,
        comment: values.comment.trim() || undefined,
        setup: (values.setup || undefined) as "run" | "skip" | "inherit" | undefined,
        // Raycast has no Orca terminal context to inherit lineage from.
        noParent: true,
        activate: values.activate,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Workspace created";
      toast.message = created.worktree?.path;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      // A timed-out create usually left a real worktree behind; saying "failed" invites a duplicate.
      toast.title = error instanceof OrcaTimeoutError ? "Still creating in Orca" : "Create failed";
      toast.message = describeError(error);
      return;
    } finally {
      setIsCreating(false);
    }

    const handle = created.agentTerminalHandle ?? created.startupTerminal?.handle;
    if (!values.activate || !handle) return;
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

  return (
    <Form
      isLoading={isLoading || isCreating}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Workspace" icon={Icon.Plus} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="repo" title="Repo" storeValue>
        {repos.map((repo) => (
          <Form.Dropdown.Item key={repo.id} value={repo.id} title={repo.displayName} />
        ))}
      </Form.Dropdown>

      <Form.TextField
        id="name"
        title="Name"
        placeholder="fix-login-redirect"
        error={nameError}
        onChange={() => setNameError(undefined)}
        autoFocus
      />
      <Form.TextField id="baseBranch" title="Base Branch" placeholder="repo default" />

      <Form.Separator />

      <Form.Dropdown id="agent" title="Agent" storeValue>
        <Form.Dropdown.Item value="" title="None" />
        {AGENT_IDS.map((agent) => (
          <Form.Dropdown.Item key={agent} value={agent} title={agent} />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="prompt" title="Brief" placeholder="Initial prompt sent to the agent" />

      <Form.Separator />

      <Form.TextField id="comment" title="Comment" placeholder="Stored in Orca metadata" />
      <Form.Dropdown id="setup" title="Setup Hooks" storeValue>
        <Form.Dropdown.Item value="" title="Default" />
        <Form.Dropdown.Item value="run" title="Run" />
        <Form.Dropdown.Item value="skip" title="Skip" />
        <Form.Dropdown.Item value="inherit" title="Inherit" />
      </Form.Dropdown>
      <Form.Checkbox id="activate" label="Reveal in Orca when ready" storeValue />
    </Form>
  );
}
