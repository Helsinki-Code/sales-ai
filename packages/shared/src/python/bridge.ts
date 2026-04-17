import { spawn } from "node:child_process";
import path from "node:path";
import { getSharedConfig } from "../config.js";

export type PythonCommandOptions = {
  args?: string[];
  stdin?: string;
  timeoutMs?: number;
};

export async function runPythonCommand(
  scriptFileName: string,
  options: PythonCommandOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const { scriptsDir } = getSharedConfig();
  const scriptPath = path.join(scriptsDir, scriptFileName);
  const timeoutMs = options.timeoutMs ?? 120000;

  return new Promise((resolve, reject) => {
    const child = spawn("python", [scriptPath, ...(options.args ?? [])], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Python script timeout (${timeoutMs}ms): ${scriptFileName}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Python script failed (${code}): ${stderr.trim()}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

export async function runPythonJsonCommand<T>(
  scriptFileName: string,
  options: PythonCommandOptions = {}
): Promise<T> {
  const { stdout } = await runPythonCommand(scriptFileName, options);
  return JSON.parse(stdout) as T;
}