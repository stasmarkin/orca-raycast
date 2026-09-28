import { LaunchProps, showHUD, showToast, Toast } from "@raycast/api";
import { findTemplate, launchTemplate, stillRunning } from "./templates/launch-template";
import { parseModifiers } from "./templates/modifiers";
import { readTemplateFile } from "./templates/template-file";
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
  try {
    const file = await readTemplateFile();
    template = findTemplate(file.templates, query);
    // A blank argument means "whatever the template says"; `none` is how a Quicklink spells out an
    // empty set, which an empty string cannot survive — the deeplink drops empty values.
    const requested = props.arguments.modifiers?.trim() ?? "";
    const modifiers = requested ? parseModifiers(requested) : (template.defaultModifiers ?? []);

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

  if (!template.activate || !outcome.handle) return;
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
