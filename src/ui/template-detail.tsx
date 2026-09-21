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
};

export function TemplateDetail(props: TemplateDetailProps) {
  const { template, preview, active, orchestrator, repoName, missingInput } = props;
  const isHuge = active.includes("huge");
  const agent = isHuge ? (orchestrator?.command ?? DEFAULT_ORCHESTRATOR_COMMAND) : (template.agent ?? "none");
  const target =
    template.worktree === "arc" ? `${template.project} (arc)` : (template.repo ?? repoName ?? "pick one in ⌘P");
  const settings = describeSettings(template);

  return (
    <List.Item.Detail
      markdown={promptMarkdown(template, preview, missingInput)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Workflow" text={template.title} />
          <List.Item.Detail.Metadata.Label
            title={isHuge ? "Orchestrator" : "Agent"}
            text={agent}
            icon={isHuge ? Icon.Crown : Icon.Person}
          />
          <List.Item.Detail.Metadata.Label title="Target" text={target} />
          {template.baseBranch && <List.Item.Detail.Metadata.Label title="Base branch" text={template.baseBranch} />}
          <List.Item.Detail.Metadata.Label
            title="Workspace name"
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

/** Template switches that change what the launch does, as short tags. */
function describeSettings(template: WorkspaceTemplate): string[] {
  return [
    ...(template.noParent ? ["no parent"] : []),
    ...(template.activate ? ["switch to Orca"] : []),
    ...(template.setup ? [`setup: ${template.setup}`] : []),
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
