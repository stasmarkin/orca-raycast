import { Action, ActionPanel, Color, Icon, List, openExtensionPreferences } from "@raycast/api";
import { OrcaBinaryNotFound } from "../orca/binary";
import { describeError } from "../orca/invoke";

/**
 * Renders failure as failure. Without this an unreachable Orca looks like "you have no workspaces",
 * and the user walks away believing no agent is waiting.
 */
/**
 * `List.EmptyView` only renders when the list has no other children, so a stale cache would hide the
 * failure entirely. This banner renders as a regular section and is therefore always visible.
 */
export function OrcaErrorBanner(props: { error: unknown; hasData: boolean; onRetry: () => void }) {
  if (!props.error) return null;
  const isMissingBinary = props.error instanceof OrcaBinaryNotFound;

  return (
    <List.Section title="Orca unreachable">
      <List.Item
        icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
        title={isMissingBinary ? "Orca CLI not found" : props.hasData ? "Showing cached data" : "Could not reach Orca"}
        subtitle={describeError(props.error)}
        actions={
          <ActionPanel>
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
            {isMissingBinary && (
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            )}
          </ActionPanel>
        }
      />
    </List.Section>
  );
}

export function OrcaEmptyView(props: {
  error: unknown;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: { source: Icon; tintColor: Color };
  onRetry: () => void;
}) {
  if (!props.error) {
    return (
      <List.EmptyView
        icon={props.emptyIcon ?? Icon.MagnifyingGlass}
        title={props.emptyTitle}
        description={props.emptyDescription}
        actions={
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
          </ActionPanel>
        }
      />
    );
  }

  const isMissingBinary = props.error instanceof OrcaBinaryNotFound;
  return (
    <List.EmptyView
      icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
      title={isMissingBinary ? "Orca CLI not found" : "Could not reach Orca"}
      description={describeError(props.error)}
      actions={
        <ActionPanel>
          {isMissingBinary && (
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          )}
          <Action title="Retry" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
        </ActionPanel>
      }
    />
  );
}
