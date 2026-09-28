import { Action, ActionPanel, Color, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { MODIFIERS, resolveModifiers, type ModifierOverrides } from "./templates/modifiers";
import { matchTemplates, parseRunQuery } from "./templates/run-query";
import { previewTemplate, usesClipboard } from "./templates/template-preview";
import { usesClipboardPlaceholder } from "./templates/placeholders";
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
  const [searchText, setSearchText] = useState("");
  // `{clipboard}` typed into the search bar counts too: it is how a brief too long to paste gets in.
  const needsClipboard = useMemo(
    () => data.templates.some(usesClipboard) || usesClipboardPlaceholder(searchText),
    [data.templates, searchText],
  );
  const { data: clipboard = "" } = usePromise(readClipboardOnce, [], { execute: needsClipboard });
  // Keyed by template: toggling Pin off for one workflow must not silently disarm the next one.
  const [overrides, setOverrides] = useState<Record<string, ModifierOverrides>>({});
  const [repo, setRepo] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const { templateQuery, input } = useMemo(() => parseRunQuery(searchText), [searchText]);
  const matches = useMemo(() => matchTemplates(data.templates, templateQuery), [data.templates, templateQuery]);

  async function run(template: WorkspaceTemplate) {
    // Enter repeats while the launch is in flight, and every repeat would create another workspace.
    if (isRunning) return;
    const modifiers = resolveModifiers(template, overrides[template.id]);
    if (template.requiresInput && !input) {
      // Enter on a row whose id was never typed: pick it, so the input can follow. Refusing here is
      // what made arrowing through the list look broken.
      setSearchText(`${template.id} `);
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
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="template then input, e.g. pp STARTREK-789"
      searchBarAccessory={
        <List.Dropdown tooltip="Repo for templates that do not name one" storeValue onChange={setRepo}>
          {/* Without it Raycast selects the first repo by itself, and a template without its own
              repo would quietly land in whichever one `orca repo list` happened to return first. */}
          <List.Dropdown.Item title="No repo picked" value="" />
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
        const active = resolveModifiers(template, overrides[template.id]);
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
                <Action
                  title={template.requiresInput && !input ? `Pick ${template.id}` : `Run ${template.id}`}
                  icon={template.requiresInput && !input ? Icon.TextInput : Icon.Play}
                  onAction={() => run(template)}
                />
                <ActionPanel.Section title="Modifiers">
                  {MODIFIERS.map((modifier) => (
                    <Action
                      key={modifier.id}
                      title={`${active.includes(modifier.id) ? "Disable" : "Enable"} ${modifier.title}`}
                      icon={active.includes(modifier.id) ? Icon.CheckCircle : Icon.Circle}
                      shortcut={{ modifiers: ["cmd"], key: modifier.key }}
                      onAction={() =>
                        setOverrides((current) => ({
                          ...current,
                          [template.id]: { ...current[template.id], [modifier.id]: !active.includes(modifier.id) },
                        }))
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
                        // Spelled out, because an empty value is dropped from the link and would
                        // silently restore the template's defaults on every hotkey launch.
                        modifiers: active.length > 0 ? active.join(",") : "none",
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
