import { Action, ActionPanel, Color, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { MODIFIERS, resolveModifiers, type ModifierOverrides } from "./templates/modifiers";
import { matchTemplates, parseRunQuery } from "./templates/run-query";
import { previewTemplate } from "./templates/template-preview";
import { ensureTemplateFile, readTemplateFile, TEMPLATE_FILE, type WorkspaceTemplate } from "./templates/template-file";
import { listRepos } from "./orca/workspaces";
import { readClipboardOnce } from "./ui/clipboard-once";
import { commandDeeplink } from "./ui/deeplink";
import { launchWithToasts } from "./ui/launch-with-toasts";
import { OrcaErrorBanner } from "./ui/orca-empty-view";
import { TemplateDetail } from "./ui/template-detail";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(readTemplateFile, [], {
    initialData: { templates: [] as WorkspaceTemplate[] },
  });
  const { data: repos } = useCachedPromise(listRepos, [], { initialData: [] });
  const { data: clipboard = "" } = usePromise(readClipboardOnce);
  const [searchText, setSearchText] = useState("");
  const [overrides, setOverrides] = useState<ModifierOverrides>({});
  const [repo, setRepo] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const { templateQuery, input } = useMemo(() => parseRunQuery(searchText), [searchText]);
  const matches = useMemo(() => matchTemplates(data.templates, templateQuery), [data.templates, templateQuery]);

  async function run(template: WorkspaceTemplate) {
    const modifiers = resolveModifiers(template, overrides);
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
    try {
      await launchWithToasts(template, input, {
        modifiers,
        orchestrator: data.orchestrator,
        repoSelector: repo,
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <List
      isLoading={isLoading || isRunning}
      isShowingDetail={matches.length > 0}
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
        const active = resolveModifiers(template, overrides);
        return (
          <List.Item
            key={template.id}
            icon={{ source: Icon.Rocket, tintColor: Color.Blue }}
            title={template.id}
            detail={
              <TemplateDetail
                template={template}
                preview={previewTemplate(template, input, clipboard)}
                active={active}
                orchestrator={data.orchestrator}
                repoName={repoName(repos, repo)}
                missingInput={Boolean(template.requiresInput) && !input}
              />
            }
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
                        setOverrides((current) => ({ ...current, [modifier.id]: !active.includes(modifier.id) }))
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

function repoName(repos: { id: string; displayName: string; path: string }[], selector: string): string | undefined {
  if (!selector) return undefined;
  const match = repos.find((entry) => `id:${entry.id}` === selector);
  return match ? match.displayName || match.path : selector;
}
