import { afterEach, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNativeBinary } from "./native-binary.ts";
import { tmpdir } from "node:os";

const directories: string[] = [];
const source = import.meta.dirname;
const nativeSource = dirname(dirname(resolveNativeBinary()));
const zodSource = dirname(
  fileURLToPath(import.meta.resolve("zod/package.json")),
);
const nonExecutableMode = 0o644;
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function installedStore(
  variant: "available" | "missing" | "missing-binary" | "non-executable",
): Readonly<{
  status: number;
  output: string;
  errors: string;
}> {
  const directory = mkdtempSync(join(tmpdir(), "herdr-native-package-"));
  directories.push(directory);
  for (const file of readdirSync(source).filter((name) =>
    name.endsWith(".ts"),
  )) {
    copyFileSync(join(source, file), join(directory, file));
  }
  copyFileSync(join(source, "package.json"), join(directory, "package.json"));
  const modules = join(directory, "node_modules");
  mkdirSync(join(modules, "@sebastienelet"), { recursive: true });
  symlinkSync(zodSource, join(modules, "zod"));
  installVariant(modules, variant);
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--config=/dev/null",
      "--no-env-file",
      "--eval",
      'import { createBindingStore } from "./binding-store.ts"; console.log(JSON.stringify(await createBindingStore(process.argv[1]).read()));',
      join(directory, "state"),
    ],
    { cwd: directory, stdout: "pipe", stderr: "pipe" },
  );
  return {
    status: result.exitCode,
    output: result.stdout.toString().trim(),
    errors: result.stderr.toString(),
  };
}

function installVariant(
  modules: string,
  variant: "available" | "missing" | "missing-binary" | "non-executable",
): void {
  if (variant !== "missing") {
    const nativeDirectory = join(
      modules,
      "@sebastienelet/herdr-issue-worktree-darwin-arm64",
    );
    mkdirSync(join(nativeDirectory, "bin"), { recursive: true });
    copyFileSync(
      join(nativeSource, "package.json"),
      join(nativeDirectory, "package.json"),
    );
    if (variant !== "missing-binary") {
      const binary = join(nativeDirectory, "bin/herdr-issue-state");
      copyFileSync(join(nativeSource, "bin/herdr-issue-state"), binary);
      if (variant === "non-executable") {
        chmodSync(binary, nonExecutableMode);
      }
    }
  }
}

test("reads bindings from the native package without a checkout build", () => {
  expect(installedStore("available")).toEqual({
    status: 0,
    output: "{}",
    errors: "",
  });
});

test.each(["missing", "missing-binary", "non-executable"] as const)(
  "reports native package failure %s without building or downloading it",
  (variant) => {
    const result = installedStore(variant);
    expect(result.status).not.toBe(0);
    expect(result.errors).toContain(
      "Install @sebastienelet/herdr-issue-worktree-darwin-arm64@1.0.0",
    );
  },
);

test.each([
  ["linux", "x64"],
  ["darwin", "x64"],
  ["win32", "arm64"],
])("refuses unsupported platform %s-%s", (platform, architecture) => {
  expect(() => resolveNativeBinary(platform, architecture)).toThrow(
    "requires darwin-arm64",
  );
});
