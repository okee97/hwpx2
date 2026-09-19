import { execFile } from "child_process";
import path from "path";
import fs from "fs";

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
  binary: string;
  exitCode: number | string;
  stdout: string;
  stderr: string;
  durationMs: number;
  success: boolean;
  data: T | null;
  error?: string;
  errorCode?: string;
}

export interface ParseResponse {
  success: boolean;
  file: {
    name: string;
    format: string;
    size: number;
  };
  rhwp: {
    binary: string;
    version: string | null;
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

export interface RhwpConnectionStatus {
  connected: boolean;
  binary: string;
  version: string | null;
  capabilities: RhwpCapabilities | null;
  error?: string;
  errorCode?: string;
}

const EXEC_TIMEOUT_MS = 25000;
const MAX_BUFFER_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Determine binary path with priority:
 * 1. process.env.RHWP_BIN (if explicitly set and file exists)
 * 2. Project local binary (.local/rhwp/rhwp on Linux/macOS, .local/rhwp/rhwp.exe on Windows)
 * 3. Fallback to process.env.RHWP_BIN or PATH 'rhwp' / 'rhwp.exe'
 */
export function getRhwpBinary(): string {
  if (process.env.RHWP_BIN && fs.existsSync(process.env.RHWP_BIN)) {
    return process.env.RHWP_BIN;
  }

  const isWin = process.platform === "win32";
  const localBinary = path.resolve(
    process.cwd(),
    ".local",
    "rhwp",
    isWin ? "rhwp.exe" : "rhwp"
  );

  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  return process.env.RHWP_BIN || (isWin ? "rhwp.exe" : "rhwp");
}

/**
 * Execute rhwp CLI securely with argument array (no shell=True).
 * Does not swallow ENOENT or error.message.
 */
export function executeRhwp(args: string[]): Promise<{
  binary: string;
  exitCode: number | string;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}> {
  const binary = getRhwpBinary();
  const startTime = Date.now();

  return new Promise((resolve) => {
    execFile(
      binary,
      args,
      {
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        let exitCode: number | string = 0;
        let errorCode: string | undefined;
        let errorMessage: string | undefined;

        if (error) {
          const nodeErr = error as NodeJS.ErrnoException;
          errorCode = nodeErr.code;

          if (nodeErr.code === "ENOENT") {
            exitCode = "ENOENT";
            errorMessage = `rhwp 실행파일을 찾을 수 없습니다. (시도된 바이너리: "${binary}")`;
          } else {
            exitCode = typeof nodeErr.code === "number" ? nodeErr.code : 1;
            errorMessage = error.message;
          }
        }

        resolve({
          binary,
          exitCode,
          stdout: stdout ? stdout.trim() : "",
          stderr: stderr ? stderr.trim() : "",
          durationMs,
          errorCode,
          errorMessage,
        });
      }
    );
  });
}

/**
 * Perform a live check of rhwp connection by verifying --version and capabilities.
 */
export async function checkRhwpConnection(): Promise<RhwpConnectionStatus> {
  const binary = getRhwpBinary();

  // Step 1: Check rhwp --version
  const versionRes = await executeRhwp(["--version"]);
  if (versionRes.exitCode !== 0 || !versionRes.stdout) {
    const errorMsg =
      versionRes.errorCode === "ENOENT"
        ? `rhwp 실행파일을 찾을 수 없습니다. (시도된 바이너리: "${binary}")`
        : versionRes.errorMessage || versionRes.stderr || `rhwp --version 실행 실패 (exit code: ${versionRes.exitCode})`;

    return {
      connected: false,
      binary,
      version: null,
      capabilities: null,
      error: errorMsg,
      errorCode: versionRes.errorCode,
    };
  }

  const version = versionRes.stdout;

  // Step 2: Check rhwp capabilities
  const capRes = await executeRhwp(["capabilities"]);
  if (capRes.exitCode !== 0 || !capRes.stdout) {
    const errorMsg =
      capRes.errorCode === "ENOENT"
        ? `rhwp 실행파일을 찾을 수 없습니다. (시도된 바이너리: "${binary}")`
        : capRes.errorMessage || capRes.stderr || `rhwp capabilities 실행 실패 (exit code: ${capRes.exitCode})`;

    return {
      connected: false,
      binary,
      version,
      capabilities: null,
      error: errorMsg,
      errorCode: capRes.errorCode,
    };
  }

  let capabilities: RhwpCapabilities;
  try {
    capabilities = JSON.parse(capRes.stdout) as RhwpCapabilities;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      binary,
      version,
      capabilities: null,
      error: `rhwp capabilities JSON 파싱 실패: ${message}`,
    };
  }

  return {
    connected: true,
    binary,
    version,
    capabilities,
  };
}

/**
 * Server startup self-test
 */
export async function runRhwpSelfTest(): Promise<RhwpConnectionStatus> {
  const status = await checkRhwpConnection();
  if (status.connected) {
    console.log("[rhwp] CONNECTED");
    console.log(`binary: ${status.binary}`);
    console.log(`version: ${status.version}`);
    console.log("capabilities: OK");
  } else {
    console.log("[rhwp] NOT CONNECTED");
    console.log(`binary: ${status.binary}`);
    console.log(`reason: ${status.error || "알 수 없는 오류"}`);
  }
  return status;
}

/**
 * Check if a command is supported and accepts --json based on capabilities
 */
function isCommandSupportedWithJson(
  capabilities: RhwpCapabilities | null,
  cmdName: string
): boolean {
  if (!capabilities || !capabilities.commands) {
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
  const connStatus = await checkRhwpConnection();

  if (!connStatus.connected) {
    throw new Error(connStatus.error || "rhwp CLI가 실행환경에 연결되어 있지 않습니다.");
  }

  const binary = connStatus.binary;
  const version = connStatus.version;
  const capabilities = connStatus.capabilities;

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
        binary,
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
      parseError = execRes.errorMessage || execRes.stderr || `명령 실행 실패 (exit code: ${execRes.exitCode})`;
    }

    const success = execRes.exitCode === 0 && parsedData !== null && !parseError;

    return {
      command: cmdArgs,
      binary: execRes.binary,
      exitCode: execRes.exitCode,
      stdout: execRes.stdout,
      stderr: execRes.stderr,
      durationMs: execRes.durationMs,
      success,
      data: parsedData,
      error: parseError,
      errorCode: execRes.errorCode,
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
      binary,
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
