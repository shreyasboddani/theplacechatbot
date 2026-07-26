import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export type NpmArguments = string[];
export type NpmRunner = (args: NpmArguments) => Promise<void>;
export type BuildEnvironment = Readonly<Record<string, string | undefined>>;

export function buildVercelCommandPlan(
  environment: BuildEnvironment,
): NpmArguments[] {
  const target = environment.VERCEL_ENV?.trim();
  if (!target) {
    throw new Error(
      "VERCEL_ENV is missing. Refusing to guess whether this is a production deployment.",
    );
  }

  if (target !== "production") {
    return [["run", "build"]];
  }

  const missing = ["GEMINI_API_KEY", "GEMINI_FILE_SEARCH_STORE"].filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Production knowledge synchronization requires these Vercel variables: ${missing.join(", ")}.`,
    );
  }

  return [
    ["run", "knowledge:verify"],
    ["run", "knowledge:sync", "--", "--reconcile", "--apply"],
    ["run", "build"],
  ];
}

async function runNpm(args: NpmArguments): Promise<void> {
  const npmCli = process.env.npm_execpath?.trim();
  const command = npmCli ? process.execPath : "npm";
  const commandArguments = npmCli ? [npmCli, ...args] : args;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, commandArguments, {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `npm ${args.join(" ")} failed${
            signal ? ` with signal ${signal}` : ` with exit code ${code ?? "unknown"}`
          }.`,
        ),
      );
    });
  });
}

export async function runVercelBuild(
  environment: BuildEnvironment = process.env,
  runner: NpmRunner = runNpm,
): Promise<void> {
  const plan = buildVercelCommandPlan(environment);
  if (environment.VERCEL_ENV !== "production") {
    process.stdout.write(
      "Non-production deployment: skipping Gemini File Search mutation.\n",
    );
  }
  for (const args of plan) await runner(args);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  runVercelBuild().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown build error";
    process.stderr.write(`Vercel build failed: ${message}\n`);
    process.exitCode = 1;
  });
}
