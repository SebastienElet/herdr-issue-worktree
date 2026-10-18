import { accessSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { optionalDependencies } from "./package.json";

const nativePackage = "@sebastienelet/herdr-issue-worktree-darwin-arm64";

function resolveNativeBinary(
  platform: string = process.platform,
  architecture: string = process.arch,
): string {
  if (platform !== "darwin" || architecture !== "arm64") {
    throw new Error(
      `Unsupported Herdr issue-worktree platform: ${platform}-${architecture}; requires darwin-arm64`,
    );
  }
  try {
    const binary = fileURLToPath(
      import.meta.resolve(`${nativePackage}/herdr-issue-state`),
    );
    accessSync(binary, constants.X_OK);
    return binary;
  } catch (error) {
    throw new Error(
      `Install ${nativePackage}@${optionalDependencies[nativePackage]} with its executable herdr-issue-state companion before launching issue work`,
      { cause: error },
    );
  }
}

export { resolveNativeBinary };
