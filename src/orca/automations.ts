import { z } from "zod";
import { invokeOrca } from "./invoke";
import { AutomationListSchema, type Automation } from "./types";

export async function listAutomations(): Promise<Automation[]> {
  const result = await invokeOrca(["automations", "list"], AutomationListSchema);
  return result.automations;
}

export async function runAutomation(id: string): Promise<void> {
  await invokeOrca(["automations", "run", `--id=${id}`], z.unknown(), { timeoutMs: 120_000 });
}
