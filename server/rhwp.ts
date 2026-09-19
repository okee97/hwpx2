import { execFile } from "child_process";
import fs from "fs";
import path from "path";

export interface RhwpCapabilityCommand {
  name: string;
  category?: string;
  summary?: string;
  flags?: string[];
  json?: boolean;
  recordFields?: string[];
  batch?: boolean;
}

export interface RhwpCapabilities {
  tool: string;
  version: string;
  schemaVersion?: string;
  commands: RhwpCapabilityCommand[];
  formats?: {
    read?: string[];
    write?: string[];
  };
  exitCodes?: Record<string, string>;
  [key: string]: unknown;
}

export interface RhwpExecutionResult<T = unknown> {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  success: boolean;
  data: T | null;
  error?: string;
}

export interface ParseResponse {
  success: boolean;
  file: {
    name: string;
    format: string;
    size: number;
  };
  rhwp: {
    version: string;
    capabilities: RhwpCapabilities | null;
  };
  info: unknown | null;
  text: unknown | null;
  tables: unknown | null;
  structure: unknown | null;
  execution: {
    info: RhwpExecutionResult;
    export_text: RhwpExecutionResult;
    export_tables: RhwpExecutionResult;
    export_structure: RhwpExecutionResult;
  };
}

const RHWP_BIN = "/usr/local/bin/rhwp";
const EXEC_TIMEOUT_MS = 25000;
const MAX_BUFFER_BYTES = 25 * 1024 * 1024; // 25MB

let cachedCapabilities: RhwpCapabilities | null = null;
let cachedVersion: string | null = null;

/**
 * Execute rhwp CLI securely with argument array (no shell=True).
 */
export function executeRhwp(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    execFile(
      RHWP_BIN,
      args,
      {
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        let exitCode = 0;

        if (error) {
          exitCode = typeof error.code === "number" ? error.code : 1;
        }

        resolve({
          exitCode,
          stdout: stdout ? stdout.trim() : "",
          stderr: stderr ? stderr.trim() : "",
          durationMs,
        });
      }
    );
  });
}

/**
 * Query rhwp version (rhwp --version)
 */
export async function getRhwpVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const res = await executeRhwp(["--version"]);
    if (res.exitCode === 0 && res.stdout) {
      cachedVersion = res.stdout;
      return cachedVersion;
    }
  } catch {
    // fallback
  }
  return "unknown";
}

/**
 * Query rhwp capabilities (rhwp capabilities)
 */
export async function getRhwpCapabilities(): Promise<RhwpCapabilities | null> {
  if (cachedCapabilities) return cachedCapabilities;
  try {
    const res = await executeRhwp(["capabilities"]);
    if (res.exitCode === 0 && res.stdout) {
      cachedCapabilities = JSON.parse(res.stdout) as RhwpCapabilities;
      return cachedCapabilities;
    }
  } catch (err) {
    console.error("Failed to parse rhwp capabilities:", err);
  }
  return null;
}

/**
 * Check if a command is supported and accepts --json based on capabilities
 */
function isCommandSupportedWithJson(
  capabilities: RhwpCapabilities | null,
  cmdName: string
): boolean {
  if (!capabilities || !capabilities.commands) {
    // If capabilities unavailable, do not speculate
    return false;
  }
  const cmd = capabilities.commands.find((c) => c.name === cmdName);
  if (!cmd) return false;
  const supportsJson = cmd.json === true || (Array.isArray(cmd.flags) && cmd.flags.includes("--json"));
  return Boolean(supportsJson);
}

/**
 * Parse an uploaded HWP/HWPX file using verified rhwp CLI commands.
 */
export async function parseHwpFile(
  filePath: string,
  originalName: string,
  sizeBytes: number
): Promise<ParseResponse> {
  const version = await getRhwpVersion();
  const capabilities = await getRhwpCapabilities();

  // Infer extension
  const ext = path.extname(originalName).toLowerCase().replace(".", "");
  const format = ext === "hwpx" ? "hwpx" : ext === "hwp" ? "hwp" : ext || "unknown";

  // Check supported commands according to capabilities
  const canRunInfo = isCommandSupportedWithJson(capabilities, "info");
  const canRunText = isCommandSupportedWithJson(capabilities, "export-text");
  const canRunTables = isCommandSupportedWithJson(capabilities, "export-tables");
  const canRunStructure = isCommandSupportedWithJson(capabilities, "export-structure");

  // Helper to run a json command safely
  async function runSubcommand(
    name: string,
    isSupported: boolean,
    additionalArgs: string[] = []
  ): Promise<RhwpExecutionResult> {
    if (!isSupported) {
      return {
        command: [name, filePath, "--json", ...additionalArgs],
        exitCode: -1,
        stdout: "",
        stderr: `명령 '${name}'은 rhwp capabilities에서 지원되지 않거나 --json을 지원하지 않습니다.`,
        durationMs: 0,
        success: false,
        data: null,
        error: "Command not supported according to rhwp capabilities",
      };
    }

    const cmdArgs = [name, filePath, "--json", ...additionalArgs];
    const execRes = await executeRhwp(cmdArgs);

    let parsedData: unknown = null;
    let parseError: string | undefined;

    if (execRes.exitCode === 0 && execRes.stdout) {
      try {
        parsedData = JSON.parse(execRes.stdout);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        parseError = `JSON 파싱 실패: ${message}`;
      }
    } else if (execRes.exitCode !== 0) {
      parseError = execRes.stderr || `명령 실행 실패 (exit code: ${execRes.exitCode})`;
    }

    const success = execRes.exitCode === 0 && parsedData !== null && !parseError;

    return {
      command: cmdArgs,
      exitCode: execRes.exitCode,
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      durationMs: execRes.durationMs,
      success,
      data: parsedData,
      error: parseError,
    };
  }

  // Execute commands in parallel safely
  const [infoRes, textRes, tablesRes, structureRes] = await Promise.all([
    runSubcommand("info", canRunInfo),
    runSubcommand("export-text", canRunText),
    runSubcommand("export-tables", canRunTables),
    runSubcommand("export-structure", canRunStructure),
  ]);

  // If at least one parsing command succeeded or info succeeded, overall is success
  const success = infoRes.success || textRes.success || tablesRes.success || structureRes.success;

  return {
    success,
    file: {
      name: originalName,
      format,
      size: sizeBytes,
    },
    rhwp: {
      version,
      capabilities,
    },
    info: infoRes.data,
    text: textRes.data,
    tables: tablesRes.data,
    structure: structureRes.data,
    execution: {
      info: infoRes,
      export_text: textRes,
      export_tables: tablesRes,
      export_structure: structureRes,
    },
  };
}
