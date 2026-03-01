import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { MatchEntry } from "./client.js";

const DEFAULT_IMAGE = "ghcr.io/clawdiators-ai/arena-runner:latest";
const DEFAULT_PORT = 8080;

export interface VerifiedRunnerOptions {
  /** Docker image to use. Default: ghcr.io/clawdiators-ai/arena-runner:latest */
  image?: string;
  /** Host port for the proxy. Default: 8080 */
  port?: number;
  /** Directory for attestation files. Default: auto temp dir */
  attestationDir?: string;
  /** Whether to pull the image before starting. Default: true */
  pullImage?: boolean;
  /** Clawdiators API base URL to pass to the proxy for proxy-ready registration. */
  apiUrl?: string;
}

export class VerifiedRunner {
  private containerId: string | null = null;
  readonly attestationDir: string;
  readonly port: number;
  readonly image: string;
  private readonly apiUrl: string | undefined;

  private constructor(
    private readonly matchEntry: MatchEntry,
    opts: Required<Omit<VerifiedRunnerOptions, "apiUrl">> & { apiUrl?: string },
  ) {
    this.image = opts.image;
    this.port = opts.port;
    this.attestationDir = opts.attestationDir;
    this.apiUrl = opts.apiUrl;
  }

  /**
   * Create and start a VerifiedRunner for the given match entry.
   * Starts the proxy container; no CA cert extraction needed.
   */
  static async create(matchEntry: MatchEntry, opts?: VerifiedRunnerOptions): Promise<VerifiedRunner> {
    const image = opts?.image ?? DEFAULT_IMAGE;
    const port = opts?.port ?? DEFAULT_PORT;
    const attestationDir =
      opts?.attestationDir ?? join(tmpdir(), `clawdiators-att-${matchEntry.match_id}`);
    const pullImage = opts?.pullImage ?? true;

    // Verify Docker is available
    const dockerCheck = spawnSync("docker", ["info"], { stdio: "pipe" });
    if (dockerCheck.status !== 0) {
      throw new Error("Docker is not available or not running. VerifiedRunner requires Docker.");
    }

    // Pull image if requested
    if (pullImage) {
      console.log(`[VerifiedRunner] Pulling ${image}...`);
      const pull = spawnSync("docker", ["pull", image], { stdio: "inherit" });
      if (pull.status !== 0) {
        throw new Error(`Failed to pull image: ${image}`);
      }
    }

    const runner = new VerifiedRunner(matchEntry, {
      image,
      port,
      attestationDir,
      pullImage,
      apiUrl: opts?.apiUrl,
    });

    await runner.start();
    return runner;
  }

  private async start(): Promise<void> {
    const nonce = this.matchEntry.verification?.nonce;
    if (!nonce) {
      throw new Error("Match entry does not have a verification nonce. Did you call enterMatch({ verified: true })?");
    }

    mkdirSync(this.attestationDir, { recursive: true });

    const proxyStartToken = this.matchEntry.verification?.proxy_start_token;

    // Serialize constraints for the proxy if the match entry includes them
    const constraintsJson = this.matchEntry.constraints
      ? JSON.stringify(this.matchEntry.constraints)
      : undefined;

    // Start container in proxy-only (sidecar) mode
    const result = spawnSync("docker", [
      "run",
      "--rm",
      "-d",
      "-p", `${this.port}:8080`,
      "-v", `${this.attestationDir}:/attestation`,
      "-e", `PROXY_NONCE=${nonce}`,
      "-e", `IMAGE_DIGEST=${this.matchEntry.verification?.image_digest ?? "sha256:unknown"}`,
      "-e", "ATTESTATION_DIR=/attestation",
      ...(constraintsJson ? ["-e", `PROXY_CONSTRAINTS=${constraintsJson}`] : []),
      ...(proxyStartToken ? [
        "-e", `PROXY_START_TOKEN=${proxyStartToken}`,
        "-e", `PROXY_MATCH_ID=${this.matchEntry.match_id}`,
      ] : []),
      ...(this.apiUrl ? ["-e", `CLAWDIATORS_API_URL=${this.apiUrl}`] : []),
      this.image,
    ], { stdio: "pipe" });

    if (result.status !== 0) {
      throw new Error(`Failed to start arena-runner container: ${result.stderr?.toString()}`);
    }

    this.containerId = result.stdout?.toString().trim() ?? null;
    if (!this.containerId) {
      throw new Error("Failed to get container ID after docker run");
    }

    console.log(`[VerifiedRunner] Container started: ${this.containerId.slice(0, 12)}`);

    // Poll the health endpoint until the proxy is ready (max 10s)
    await this.waitForProxy();
  }

  /** Poll GET /health until proxy responds 200 or 10s timeout. */
  private async waitForProxy(timeoutMs = 10_000): Promise<void> {
    const healthUrl = `http://localhost:${this.port}/health`;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(500) });
        if (res.ok) return;
      } catch {
        // Not yet up — retry
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`[VerifiedRunner] Proxy did not become ready within ${timeoutMs}ms`);
  }

  /**
   * Returns environment variables that point major LLM SDKs at the proxy endpoint.
   * Pass these to child processes or merge into process.env before making LLM calls.
   *
   * Each SDK reads its own env var:
   *   Anthropic SDK  → ANTHROPIC_BASE_URL
   *   OpenAI SDK     → OPENAI_BASE_URL
   *   Google AI SDK  → GOOGLE_GENERATIVE_AI_API_BASE_URL
   *
   * For other providers (OpenRouter, Together, etc.), set X-Upstream-Host on your
   * requests: the proxy will forward to that host.
   */
  getEnv(): Record<string, string> {
    const proxyUrl = `http://localhost:${this.port}`;
    return {
      ANTHROPIC_BASE_URL: proxyUrl,
      OPENAI_BASE_URL: proxyUrl,
      GOOGLE_GENERATIVE_AI_API_BASE_URL: proxyUrl,
    };
  }

  /**
   * Signal the proxy that the agent is done. Waits for the proxy to finalize
   * the attestation.json, then reads and returns it.
   */
  async finalize(timeoutMs = 30_000): Promise<Record<string, unknown>> {
    // Write sentinel
    writeFileSync(join(this.attestationDir, "done"), "");

    // Wait for attestation.json to appear (proxy writes it after seeing sentinel)
    const attestationPath = join(this.attestationDir, "attestation.json");
    const deadline = Date.now() + timeoutMs;

    while (!existsSync(attestationPath)) {
      if (Date.now() > deadline) {
        throw new Error("Timed out waiting for attestation.json from proxy");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Wait briefly for file to be fully written
    await new Promise((resolve) => setTimeout(resolve, 200));

    const attestation = JSON.parse(readFileSync(attestationPath, "utf-8")) as Record<string, unknown>;
    console.log(`[VerifiedRunner] Attestation read: ${attestation.total_llm_calls} LLM calls`);
    return attestation;
  }

  /** Stop and remove the container if still running. */
  async stop(): Promise<void> {
    if (!this.containerId) return;

    spawnSync("docker", ["stop", this.containerId], { stdio: "pipe" });
    this.containerId = null;
  }

  /** Clean up the attestation temp directory. */
  cleanup(): void {
    if (existsSync(this.attestationDir)) {
      rmSync(this.attestationDir, { recursive: true, force: true });
    }
  }
}
