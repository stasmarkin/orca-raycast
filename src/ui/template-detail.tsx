import { Color, Icon, List } from "@raycast/api";
import { MODIFIERS, type ModifierId } from "../templates/modifiers";
import type { TemplatePreview } from "../templates/template-preview";
import {
  DEFAULT_ORCHESTRATOR_COMMAND,
  type OrchestratorConfig,
  type WorkspaceTemplate,
} from "../templates/template-file";

export type TemplateDetailProps = {
  template: WorkspaceTemplate;
  preview: TemplatePreview;
  active: ModifierId[];
  orchestrator: OrchestratorConfig | undefined;
  /** Display name of the repo picked in the dropdown, for templates that name none. */
  repoName: string | undefined;
  missingInput: boolean;
  /** First line of an unsent brief, when one is waiting for this workflow. */
  draftLine?: string;
};

export function TemplateDetail(props: TemplateDetailProps) {
  const { template, preview, active, orchestrator, repoName, missingInput, draftLine } = props;
  const isHuge = active.includes("huge");
  const agent = isHuge ? (orchestrator?.command ?? DEFAULT_ORCHESTRATOR_COMMAND) : (template.agent ?? "none");
  const target = describeTarget(template, repoName);
  const settings = describeSettings(template);

  return (
    <List.Item.Detail
      markdown={promptMarkdown(template, preview, missingInput)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Workflow" text={template.title} />
          {draftLine !== undefined && (
            <List.Item.Detail.Metadata.Label title="Unsent draft" text={draftLine} icon={Icon.Pencil} />
          )}
          <List.Item.Detail.Metadata.Label
            title={isHuge ? "Orchestrator" : "Agent"}
            text={agent}
            icon={isHuge ? Icon.Crown : Icon.Person}
          />
          <List.Item.Detail.Metadata.Label title="Target" text={target} />
          {/* `wt` takes no base ref from here, so showing one for arc would promise a branch nobody uses. */}
          {template.baseBranch && template.worktree !== "arc" && (
            <List.Item.Detail.Metadata.Label title="Base branch" text={template.baseBranch} />
          )}
          <List.Item.Detail.Metadata.Label
            title={template.worktree === "main" ? "Terminal title" : "Workspace name"}
            text={preview.worktreeName}
            icon={missingInput ? Icon.ExclamationMark : undefined}
          />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.TagList title="Modifiers">
            {MODIFIERS.map((modifier) => (
              <List.Item.Detail.Metadata.TagList.Item
                key={modifier.id}
                text={`⌘${modifier.key} ${modifier.title}`}
                color={active.includes(modifier.id) ? Color.Green : Color.SecondaryText}
              />
            ))}
          </List.Item.Detail.Metadata.TagList>
          {settings.length > 0 && (
            <List.Item.Detail.Metadata.TagList title="Settings">
              {settings.map((setting) => (
                <List.Item.Detail.Metadata.TagList.Item key={setting} text={setting} color={Color.Blue} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function describeTarget(template: WorkspaceTemplate, repoName: string | undefined): string {
  if (template.worktree === "arc") return `${template.project} (arc)`;
  const repo = template.repo ?? repoName ?? "pick one in ⌘P";
  return template.worktree === "main" ? `${repo} — repo folder, no checkout` : repo;
}

/** Template switches that change what the launch does, as short tags. */
function describeSettings(template: WorkspaceTemplate): string[] {
  // Only Orca's own `worktree create` takes these: `wt` builds an arc checkout its own way, and a
  // `main` launch creates nothing at all, so showing them anywhere else would lie.
  const viaOrca = template.worktree === undefined || template.worktree === "orca";
  return [
    ...(template.noParent && viaOrca ? ["no parent"] : []),
    ...(template.setup && viaOrca ? [`setup: ${template.setup}`] : []),
    ...(template.activate ? ["switch to Orca"] : []),
    ...(template.requiresInput ? ["input required"] : []),
  ];
}

function promptMarkdown(template: WorkspaceTemplate, preview: TemplatePreview, missingInput: boolean): string {
  if (missingInput) {
    return `## Prompt\n\nType the input after \`${template.id}\` to see the brief this workflow sends.`;
  }
  if (preview.prompt === undefined) {
    return "## Prompt\n\nThis workflow starts its agent with no brief.";
  }
  return `## Prompt\n\n${preview.prompt}`;
}
