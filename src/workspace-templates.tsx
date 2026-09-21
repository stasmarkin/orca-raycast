import { Action, ActionPanel, Color, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { launchTemplate, stillRunning } from "./templates/launch-template";
import { MODIFIERS, type ModifierId } from "./templates/modifiers";
import { matchTemplates, parseRunQuery } from "./templates/run-query";
import { ensureTemplateFile, readTemplateFile, TEMPLATE_FILE, type WorkspaceTemplate } from "./templates/template-file";
import { writeDefaultRepo } from "./templates/repo-selection";
import { listRepos } from "./orca/workspaces";
import { revealTerminalInOrca } from "./orca/reveal";
import { describeError } from "./orca/invoke";
import { commandDeeplink } from "./ui/deeplink";
import { OrcaErrorBanner } from "./ui/orca-empty-view";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(readTemplateFile, [], {
    initialData: { templates: [] as WorkspaceTemplate[] },
  });
  const { data: repos } = useCachedPromise(listRepos, [], { initialData: [] });
  const [searchText, setSearchText] = useState("");
  const [toggled, setToggled] = useState<Partial<Record<ModifierId, boolean>>>({});
  const [repo, setRepo] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const { templateQuery, input } = useMemo(() => parseRunQuery(searchText), [searchText]);
  const matches = useMemo(() => matchTemplates(data.templates, templateQuery), [data.templates, templateQuery]);

  /** A template's defaults apply until the user overrides that modifier on this screen. */
  function modifiersFor(template: WorkspaceTemplate): ModifierId[] {
    const defaults = new Set(template.defaultModifiers ?? []);
    return MODIFIERS.filter(({ id }) => toggled[id] ?? defaults.has(id)).map(({ id }) => id);
  }

  async function run(template: WorkspaceTemplate) {
    const modifiers = modifiersFor(template);
    if (template.requiresInput && !input) {
      await showToast({
        style: Toast.Style.Failure,
        title: `${template.title} needs input`,
        message: `Type it after the template id, e.g. "${template.id} STARTREK-789"`,
      });
      return;
    }

    if (template.worktree !== "arc" && !template.repo && !repo) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Pick a repo first",
        message: "This template does not name one — choose it in the dropdown (⌘P)",
      });
      return;
    }

    setIsRunning(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: `Creating ${template.title}` });
    let outcome;
    try {
      if (repo) await writeDefaultRepo(repo);
      outcome = await launchTemplate(template, input, {
        modifiers,
        orchestrator: data.orchestrator,
        repoSelector: repo,
      });
    } catch (launchError) {
      toast.style = Toast.Style.Failure;
      toast.title = stillRunning(launchError) ? "Still creating in Orca" : "Template failed";
      toast.message = describeError(launchError);
      return;
    } finally {
      setIsRunning(false);
    }

    toast.style = outcome.warnings.length > 0 ? Toast.Style.Failure : Toast.Style.Success;
    toast.title = outcome.warnings.length > 0 ? "Created with problems" : "Workspace created";
    toast.message = outcome.warnings.join("; ") || outcome.result.worktree?.path;

    if (template.activate && outcome.handle) {
      try {
        await revealTerminalInOrca(outcome.handle);
      } catch (revealError) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Created, but could not switch to Orca",
          message: describeError(revealError),
        });
      }
    }
  }

  return (
    <List
      isLoading={isLoading || isRunning}
      filtering={false}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="template then input, e.g. pp STARTREK-789"
      searchBarAccessory={
        <List.Dropdown tooltip="Repo for templates that do not name one" storeValue onChange={setRepo}>
          {repos.map((entry) => (
            <List.Dropdown.Item key={entry.id} title={entry.displayName || entry.path} value={`id:${entry.id}`} />
          ))}
        </List.Dropdown>
      }
    >
      <OrcaErrorBanner error={error} hasData={data.templates.length > 0} onRetry={revalidate} />

      {data.templates.length === 0 && !error && (
        <List.EmptyView
          icon={Icon.BlankDocument}
          title="No templates yet"
          description={`Define them in ${TEMPLATE_FILE}`}
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
        />
      )}

      {data.templates.length > 0 && matches.length === 0 && (
        <List.EmptyView icon={Icon.MagnifyingGlass} title={`No template matches "${templateQuery}"`} />
      )}

      {matches.map((template) => {
        const active = modifiersFor(template);
        return (
          <List.Item
            key={template.id}
            icon={{ source: Icon.Rocket, tintColor: Color.Blue }}
            title={template.id}
            subtitle={input ? `${template.title} — ${input}` : template.title}
            accessories={[
              ...MODIFIERS.map((modifier) => ({
                tag: {
                  value: modifier.title,
                  color: active.includes(modifier.id) ? Color.Green : Color.SecondaryText,
                },
                tooltip: `⌘${modifier.key} — ${modifier.description}`,
              })),
              ...(template.requiresInput && !input ? [{ icon: Icon.ExclamationMark, tooltip: "Needs input" }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action title={`Run ${template.id}`} icon={Icon.Play} onAction={() => run(template)} />
                <ActionPanel.Section title="Modifiers">
                  {MODIFIERS.map((modifier) => (
                    <Action
                      key={modifier.id}
                      title={`${active.includes(modifier.id) ? "Disable" : "Enable"} ${modifier.title}`}
                      icon={active.includes(modifier.id) ? Icon.CheckCircle : Icon.Circle}
                      shortcut={{ modifiers: ["cmd"], key: modifier.key }}
                      onAction={() =>
                        setToggled((current) => ({ ...current, [modifier.id]: !active.includes(modifier.id) }))
                      }
                    />
                  ))}
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.CreateQuicklink
                    title="Save as Quicklink"
                    icon={Icon.Link}
                    quicklink={{
                      name: template.title,
                      link: commandDeeplink("run-template", {
                        template: template.id,
                        input,
                        modifiers: active.join(","),
                      }),
                    }}
                    shortcut={{ modifiers: ["cmd"], key: "l" }}
                  />
                  <Action.Open
                    title="Edit Template File"
                    target={TEMPLATE_FILE}
                    shortcut={Keyboard.Shortcut.Common.Edit}
                  />
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    onAction={revalidate}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
