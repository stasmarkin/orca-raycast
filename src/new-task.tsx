import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { resolveModifiers } from "./templates/modifiers";
import { overridesFromDraft, readAllTaskDrafts } from "./templates/task-draft";
import { previewTemplate, usesClipboard } from "./templates/template-preview";
import { ensureTemplateFile, readTemplateFile, TEMPLATE_FILE, type WorkspaceTemplate } from "./templates/template-file";
import { readClipboardOnce } from "./ui/clipboard-once";
import { OrcaErrorBanner } from "./ui/orca-empty-view";
import { TaskForm } from "./ui/task-form";
import { TemplateDetail } from "./ui/template-detail";

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(readTemplateFile, [], {
    initialData: { templates: [] as WorkspaceTemplate[] },
  });
  const { data: drafts = {}, revalidate: revalidateDrafts } = usePromise(readAllTaskDrafts);

  const needsClipboard = data.templates.some(usesClipboard);
  const { data: clipboard = "" } = usePromise(readClipboardOnce, [], { execute: needsClipboard });

  return (
    <List isLoading={isLoading} isShowingDetail={data.templates.length > 0} searchBarPlaceholder="Workflow to start">
      <OrcaErrorBanner error={error} hasData={data.templates.length > 0} onRetry={revalidate} />

      {data.templates.length === 0 && !error && (
        <List.EmptyView
          icon={Icon.BlankDocument}
          title="No workflows yet"
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

      {data.templates.map((template) => {
        const draft = drafts[template.id];
        // The row previews the unsent brief, so a draft is recognisable before opening it.
        const active = resolveModifiers(template, draft ? overridesFromDraft(draft.modifiers) : {});
        return (
          <List.Item
            key={template.id}
            icon={{ source: Icon.Rocket, tintColor: draft ? Color.Yellow : Color.Blue }}
            title={template.id}
            accessories={draft ? [{ tag: { value: "draft", color: Color.Yellow } }] : []}
            detail={
              <TemplateDetail
                template={template}
                preview={previewTemplate(template, draft?.input ?? "", clipboard)}
                active={active}
                orchestrator={data.orchestrator}
                repoName={undefined}
                missingInput={Boolean(template.requiresInput) && !draft}
                {...(draft ? { draftLine: firstLine(draft.input) } : {})}
              />
            }
            actions={
              <ActionPanel>
                <Action.Push
                  title={draft ? `Continue ${template.id}` : `Write ${template.id} Brief`}
                  icon={draft ? Icon.Pencil : Icon.Plus}
                  target={
                    <TaskForm template={template} orchestrator={data.orchestrator} onLaunched={revalidateDrafts} />
                  }
                />
                <Action.Open
                  title="Edit Template File"
                  target={TEMPLATE_FILE}
                  shortcut={Keyboard.Shortcut.Common.Edit}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={() => {
                    revalidate();
                    revalidateDrafts();
                  }}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

const DRAFT_LINE_MAX_LENGTH = 60;

function firstLine(input: string): string {
  const line = input.trim().split("\n")[0] ?? "";
  return line.length > DRAFT_LINE_MAX_LENGTH ? `${line.slice(0, DRAFT_LINE_MAX_LENGTH)}…` : line;
}
