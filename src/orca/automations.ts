import { invokeOrca } from "./invoke";
import type { Automation } from "./types";

export async function listAutomations(): Promise<Automation[]> {
  const result = await invokeOrca<{ automations: Automation[]; orphanCount: number }>(["automations", "list"]);
  return result.automations;
}

export async function runAutomation(id: string): Promise<void> {
  await invokeOrca(["automations", "run", "--id", id], { timeoutMs: 120_000 });
}
