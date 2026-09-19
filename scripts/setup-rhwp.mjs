import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

// 1. Fixed RHWP_VERSION 0.8.6
export const RHWP_VERSION = "0.8.6";

const OFFICIAL_RELEASE_BASE = `https://github.com/edwardkim/rhwp/releases/download/v${RHWP_VERSION}/`;

// Official SHA-256 Checksums from GitHub release v0.8.6 SHA256SUMS.txt
const CHECKSUMS = {
  "rhwp-v0.8.6-linux-x86_64.tar.gz": "458de22a6b9b86088dfdcd59552d4e8fab5362a64578c64761fa28df9be45e9a",
  "rhwp-v0.8.6-linux-aarch64.tar.gz": "1288aa5609a67574a6b1372397bef9a8941fda9ad16b1224342512f915ae016e",
  "rhwp-v0.8.6-macos-x86_64.tar.gz": "a9581617e7ccab75481b9d36069d28c46e30a543a1fb0aa9ff581567a25321b8",
  "rhwp-v0.8.6-macos-aarch64.tar.gz": "7d8928faeb03f00c35c8028f0b562f08f3da22bef86f750e0d7e0cd19344eaa3",
  "rhwp-v0.8.6-windows-x86_64.zip": "867e0a84b778ebda92b88433ede301818eaea21e7d58eb77ff9a732f41d170d9",
};

/**
 * Detect OS & CPU architecture to determine release asset name
 */
function detectTargetAsset() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "linux") {
    if (arch === "x64") return "rhwp-v0.8.6-linux-x86_64.tar.gz";
    if (arch === "arm64") return "rhwp-v0.8.6-linux-aarch64.tar.gz";
  } else if (platform === "darwin") {
    if (arch === "x64") return "rhwp-v0.8.6-macos-x86_64.tar.gz";
    if (arch === "arm64") return "rhwp-v0.8.6-macos-aarch64.tar.gz";
  } else if (platform === "win32") {
    if (arch === "x64") return "rhwp-v0.8.6-windows-x86_64.zip";
  }

  throw new Error(
    `[setup:rhwp] 지원되지 않는 플랫폼 또는 아키텍처입니다: ${platform} (${arch}).\n` +
    `지원 대상: Linux (x86_64, aarch64), macOS (x86_64, arm64), Windows (x86_64).`
  );
}

/**
 * Fetch URL as Buffer with redirect following
 */
async function downloadFile(url) {
  console.log(`[setup:rhwp] 다운로드 시작: ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`다운로드 실패 (HTTP ${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Patch Linux x86_64 ELF binary for glibc < 2.39 compatibility
 * (Resolves GLIBC_2.39 requirement for pidfd_spawnp/pidfd_getpid in Rust std)
 */
function patchGlibcCompatibility(binaryPath) {
  try {
    const data = bytearrayFromBuffer(fs.readFileSync(binaryPath));

    // Check if GLIBC_2.39 is present in .gnu.version_r
    const glibc239Idx = bufferIndexOf(data, Buffer.from("GLIBC_2.39\0"));
    if (glibc239Idx === -1) {
      return; // No patch needed
    }

    // Read ELF header
    const e_shoff = Number(data.readBigUInt64LE(40));
    const e_shentsize = data.readUInt16LE(58);
    const e_shnum = data.readUInt16LE(60);
    const e_shstrndx = data.readUInt16LE(62);

    const shstrHdrOffset = e_shoff + e_shstrndx * e_shentsize;
    const shstrOffset = Number(data.readBigUInt64LE(shstrHdrOffset + 24));

    const sections = {};
    for (let i = 0; i < e_shnum; i++) {
      const sh = e_shoff + i * e_shentsize;
      const nameIdx = data.readUInt32LE(sh);
      let nameEnd = shstrOffset + nameIdx;
      while (data[nameEnd] !== 0) nameEnd++;
      const name = data.subarray(shstrOffset + nameIdx, nameEnd).toString("utf8");
      const offset = Number(data.readBigUInt64LE(sh + 24));
      const size = Number(data.readBigUInt64LE(sh + 32));
      sections[name] = { offset, size };
    }

    if (!sections[".gnu.version_r"] || !sections[".gnu.version"]) {
      return;
    }

    const verrOff = sections[".gnu.version_r"].offset;
    const verrSize = sections[".gnu.version_r"].size;

    // Locate libc.so.6 Verneed entry and adjust count
    let curr = verrOff;
    while (curr < verrOff + verrSize) {
      const vn_cnt = data.readUInt16LE(curr + 2);
      const vn_file = data.readUInt32LE(curr + 4);
      const vn_aux = data.readUInt32LE(curr + 8);
      const vn_next = data.readUInt32LE(curr + 12);

      const dynstrOff = sections[".dynstr"].offset;
      let nameEnd = dynstrOff + vn_file;
      while (data[nameEnd] !== 0) nameEnd++;
      const libname = data.subarray(dynstrOff + vn_file, nameEnd).toString("utf8");

      if (libname === "libc.so.6") {
        // Decrease count from 18 to 17
        data.writeUInt16LE(vn_cnt - 1, curr + 2);

        // Find the 17th Vernaux entry and set vna_next to 0 (terminate chain before GLIBC_2.39)
        let aux = curr + vn_aux;
        for (let i = 0; i < vn_cnt - 1; i++) {
          if (i === vn_cnt - 2) {
            // Set vna_next to 0 on 17th entry
            data.writeUInt32LE(0, aux + 12);
          } else {
            const vna_next = data.readUInt32LE(aux + 12);
            aux += vna_next;
          }
        }
        break;
      }
      if (vn_next === 0) break;
      curr += vn_next;
    }

    // In .gnu.version (versym), remap symbol version index 23 to 1 (VER_NDX_GLOBAL)
    const versymOff = sections[".gnu.version"].offset;
    const versymSize = sections[".gnu.version"].size;
    for (let i = 0; i < versymSize; i += 2) {
      const ver = data.readUInt16LE(versymOff + i);
      if (ver === 23) {
        data.writeUInt16LE(1, versymOff + i);
      }
    }

    fs.writeFileSync(binaryPath, data);
    console.log("[setup:rhwp] Linux GLIBC 호환성 패치 적용 완료 (GLIBC 2.36+ 지원)");
  } catch (err) {
    console.warn(`[setup:rhwp] 호환성 패치 시도 중 경고:`, err.message);
  }
}

function bytearrayFromBuffer(buf) {
  return Buffer.from(buf);
}

function bufferIndexOf(buf, search) {
  return buf.indexOf(search);
}

/**
 * Main Setup Workflow
 */
async function main() {
  console.log("==================================================");
  console.log(`[setup:rhwp] rhwp v${RHWP_VERSION} CLI 자동 설치 및 검증`);
  console.log("==================================================");

  const assetName = detectTargetAsset();
  const expectedHash = CHECKSUMS[assetName];
  console.log(`[setup:rhwp] 감지된 환경: ${process.platform}-${process.arch}`);
  console.log(`[setup:rhwp] 대상 바이너리 아카이브: ${assetName}`);

  const projectRoot = process.cwd();
  const localDir = path.resolve(projectRoot, ".local", "rhwp");
  const isWin = process.platform === "win32";
  const binaryName = isWin ? "rhwp.exe" : "rhwp";
  const finalBinaryPath = path.resolve(localDir, binaryName);

  // Check if binary is already installed and verified
  if (fs.existsSync(finalBinaryPath)) {
    try {
      const verOut = execFileSync(finalBinaryPath, ["--version"], { encoding: "utf8" }).trim();
      if (verOut.includes(RHWP_VERSION)) {
        console.log(`[setup:rhwp] 이미 설치된 rhwp (${verOut}) 감지됨: ${finalBinaryPath}`);
        runSelfTest(finalBinaryPath);
        return;
      }
    } catch {
      // Re-download and install if execution failed
    }
  }

  // 1. Download official release archive
  const downloadUrl = `${OFFICIAL_RELEASE_BASE}${assetName}`;
  const archiveBuffer = await downloadFile(downloadUrl);

  // 2. Verify SHA256
  console.log(`[setup:rhwp] SHA-256 무결성 검증 중...`);
  const actualHash = crypto.createHash("sha256").update(archiveBuffer).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `[setup:rhwp] SHA256 검증 실패!\n기대값: ${expectedHash}\n실제값: ${actualHash}`
    );
  }
  console.log(`[setup:rhwp] SHA-256 검증 통과 (${actualHash.slice(0, 16)}...)`);

  // 3. Prepare target directory
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  // Temporary directory for extraction
  const tempExtractDir = path.resolve(localDir, `tmp_extract_${Date.now()}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  const tempArchiveFile = path.resolve(tempExtractDir, assetName);
  fs.writeFileSync(tempArchiveFile, archiveBuffer);

  // 4. Extract archive
  console.log(`[setup:rhwp] 아카이브 추출 중...`);
  try {
    if (assetName.endsWith(".tar.gz")) {
      execFileSync("tar", ["-xzf", tempArchiveFile, "-C", tempExtractDir]);
    } else if (assetName.endsWith(".zip")) {
      if (isWin) {
        execFileSync("tar", ["-xf", tempArchiveFile, "-C", tempExtractDir]);
      } else {
        execFileSync("unzip", ["-q", tempArchiveFile, "-d", tempExtractDir]);
      }
    }
  } catch (extractErr) {
    throw new Error(`아카이브 압축 해제 실패: ${extractErr.message}`);
  }

  // Find extracted binary
  let foundBinary = null;
  function searchBinary(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.resolve(dir, ent.name);
      if (ent.isDirectory()) {
        searchBinary(fullPath);
      } else if (ent.isFile() && ent.name === binaryName) {
        foundBinary = fullPath;
        return;
      }
    }
  }
  searchBinary(tempExtractDir);

  if (!foundBinary) {
    throw new Error(`압축 파일 내에서 '${binaryName}' 실행파일을 찾지 못했습니다.`);
  }

  // Move to final location
  if (fs.existsSync(finalBinaryPath)) {
    fs.unlinkSync(finalBinaryPath);
  }
  fs.copyFileSync(foundBinary, finalBinaryPath);

  // Set executable permission
  if (!isWin) {
    fs.chmodSync(finalBinaryPath, 0o755);
  }

  // Cleanup temp extract folder
  try {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  } catch {}

  // 5. Test compatibility on Linux and apply patch if needed
  if (process.platform === "linux" && process.arch === "x64") {
    try {
      execFileSync(finalBinaryPath, ["--version"]);
    } catch (err) {
      if (err.message && err.message.includes("GLIBC_2.39")) {
        console.log("[setup:rhwp] 호환성 조정 필요 감지 (GLIBC_2.39), 호환성 패치 진행...");
        patchGlibcCompatibility(finalBinaryPath);
      }
    }
  }

  console.log(`[setup:rhwp] 바이너리 설치 완료: ${finalBinaryPath}`);

  // 6. Run Self-Test
  runSelfTest(finalBinaryPath);
}

/**
 * Execute rhwp self-test verification
 */
function runSelfTest(binaryPath) {
  console.log("\n--- [rhwp self-test] 검증 시작 ---");
  try {
    const versionOutput = execFileSync(binaryPath, ["--version"], { encoding: "utf8" }).trim();
    console.log(`✓ rhwp --version: ${versionOutput}`);

    const capRaw = execFileSync(binaryPath, ["capabilities"], { encoding: "utf8" }).trim();
    const cap = JSON.parse(capRaw);
    console.log(`✓ rhwp capabilities: OK (commands: ${cap.commands ? cap.commands.length : 0}개 등록)`);

    console.log(`✓ rhwp 자가진단 성공: CONNECTED (${versionOutput})`);
    console.log("--- [rhwp self-test] 완료 ---\n");
  } catch (testErr) {
    console.error(`✗ rhwp self-test 실패: ${testErr.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[setup:rhwp] 치명적 오류: ${err.message}`);
  process.exit(1);
});
