import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// template-file resolves its path from HOME at import time, so this has to run before any test import.
process.env.HOME = mkdtempSync(join(tmpdir(), "orca-raycast-test-"));
