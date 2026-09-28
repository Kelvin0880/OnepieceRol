// Hashed bundles from the previous build would pile up in docs/portada forever; only that folder is ours to wipe.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

rmSync(fileURLToPath(new URL("../../docs/portada", import.meta.url)), { recursive: true, force: true });
