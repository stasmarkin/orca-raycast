import { showToast, Toast } from "@raycast/api";
import { launchTemplate, stillRunning, type LaunchOptions } from "../templates/launch-template";
import type { WorkspaceTemplate } from "../templates/template-file";
import { writeDefaultRepo } from "../templates/repo-selection";
import { describeError } from "../orca/invoke";
import { revealTerminalInOrca } from "../orca/reveal";

/**
 * Launches a template and reports what the user must see: failure, partial success, the reveal.
 * Returns false when the workspace was never created, so a caller can keep what the user typed.
 */
export async function launchWithToasts(
  template: WorkspaceTemplate,
  input: string,
  options: LaunchOptions,
): Promise<boolean> {
  const toast = await showToast({ style: Toast.Style.Animated, title: `Creating ${template.title}` });

  let outcome;
  try {
    // The no-view launch path has no repo picker, so it inherits whatever a screen last chose for a
    // template that needed one. A template with its own repo must not overwrite that memory.
    if (options.repoSelector && !template.repo) await writeDefaultRepo(options.repoSelector);
    outcome = await launchTemplate(template, input, options);
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = stillRunning(error) ? "Still creating in Orca" : "Template failed";
    toast.message = describeError(error);
    return false;
  }

  toast.style = outcome.warnings.length > 0 ? Toast.Style.Failure : Toast.Style.Success;
  toast.title = outcome.warnings.length > 0 ? "Created with problems" : "Workspace created";
  toast.message = outcome.warnings.join("; ") || outcome.result.worktree?.path;

  if (!template.activate || !outcome.handle) return true;
  try {
    await revealTerminalInOrca(outcome.handle);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Created, but could not switch to Orca",
      message: describeError(error),
    });
  }
  return true;
}
