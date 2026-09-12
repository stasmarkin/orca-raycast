import { showToast, Toast } from "@raycast/api";
import { describeError } from "../orca/invoke";

/**
 * Wraps an action handler so a rejected promise surfaces as a toast. Raycast's `onAction` is
 * synchronous, so an unhandled rejection there is invisible — the click just does nothing.
 */
export function runAction(title: string, action: () => Promise<unknown>): () => void {
  return () => {
    void action().catch(async (error) => {
      await showToast({ style: Toast.Style.Failure, title, message: describeError(error) });
    });
  };
}
