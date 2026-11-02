import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { findTemplate, launchTemplate, stillRunning } from "./templates/launch-template";
import { modifiersFor, parseModifiers, templateDefaultModifiers, type ModifierId } from "./templates/modifiers";
import { readTemplateFile, type WorkspaceTemplate } from "./templates/template-file";
import { sendTemplate } from "./templates/send-template";
import { readDefaultRepo } from "./templates/repo-selection";
import { describeError } from "./orca/invoke";
import { revealTerminalInOrca } from "./orca/reveal";

export default async function Command(
  props: LaunchProps<{ arguments: { template: string; input?: string; modifiers?: string } }>,
) {
  const query = props.arguments.template.trim();
  const input = props.arguments.input?.trim() ?? "";

  let outcome;
  let template;
  let modifiers: ModifierId[];
  try {
    const file = await readTemplateFile();
    template = findTemplate(file.templates, query);
    // A blank argument means "whatever the template says"; `none` is how a Quicklink spells out an
    // empty set, which an empty string cannot survive — the deeplink drops empty values.
    const requested = props.arguments.modifiers?.trim() ?? "";
    modifiers = requested ? parseModifiers(requested) : templateDefaultModifiers(template);

    if (template.send !== undefined) {
      const applicable = new Set(modifiersFor(template).map((modifier) => modifier.id));
      await sendFromHotkey(
        template,
        input,
        modifiers.filter((id) => applicable.has(id)),
      );
      return;
    }

    await showToast({ style: Toast.Style.Animated, title: `Creating ${template.title}` });
    outcome = await launchTemplate(template, input, {
      modifiers,
      orchestrator: file.orchestrator,
      // No UI here, so fall back to whatever repo was last used on the run screen.
      repoSelector: await readDefaultRepo(),
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: stillRunning(error) ? "Still creating in Orca" : "Template failed",
      message: describeError(error),
    });
    return;
  }

  if (outcome.warnings.length > 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Created with problems",
      message: outcome.warnings.join("; "),
    });
  } else {
    await showHUD(`🚀 ${outcome.result.worktree?.displayName ?? template.title}`);
  }

  if (!modifiers.includes("focus") || !outcome.handle) return;
  try {
    await revealTerminalInOrca(outcome.handle);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Created, but could not switch to Orca",
      message: describeError(error),
    });
  }
}

async function sendFromHotkey(template: WorkspaceTemplate, input: string, modifiers: ModifierId[]): Promise<void> {
  let outcome;
  try {
    await showToast({ style: Toast.Style.Animated, title: `Sending to ${template.send}` });
    outcome = await sendTemplate(template, input);
  } catch (error) {
    await showToast({ style: Toast.Style.Failure, title: "Not sent", message: describeError(error) });
    return;
  }

  if (!modifiers.includes("focus")) {
    await showHUD(`✉️ ${template.send}`);
    return;
  }
  try {
    await revealTerminalInOrca(outcome.handle);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Sent, but could not switch to Orca",
      message: describeError(error),
    });
  }
}
