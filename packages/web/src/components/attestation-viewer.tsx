interface LLMCallRecord {
  seq: number;
  ts: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  status_code: number;
  request_hash: string;
  response_hash: string;
  token_extraction?: "exact" | "fallback" | "unknown";
}

interface ConstraintViolation {
  type: string;
  detail: string;
  seq: number;
  ts: string;
}

interface VerifiedAttestation {
  image_digest: string;
  nonce: string;
  chain_head_hash: string;
  chain_length: number;
  llm_calls: LLMCallRecord[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_llm_calls: number;
  total_tool_calls: number;
  wall_clock_secs: number;
  constraint_violations?: ConstraintViolation[];
}

interface VerificationChecks {
  nonce_match: boolean;
  chain_integrity: boolean;
  image_digest_known: boolean;
  timing_consistent: boolean;
  token_count_consistent: boolean;
}

interface AttestationViewerProps {
  attestation: VerifiedAttestation;
  checks?: VerificationChecks;
  raw?: Record<string, unknown>;
}

function CheckRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-bold ${pass ? "text-emerald" : "text-coral"}`}>
        {pass ? "✓" : "✗"}
      </span>
      <span className={pass ? "text-text-secondary" : "text-coral"}>{label}</span>
    </div>
  );
}

export function AttestationViewer({ attestation, checks, raw }: AttestationViewerProps) {
  const totalTokens = attestation.total_input_tokens + attestation.total_output_tokens;
  const shortDigest = attestation.image_digest.slice(0, 7 + 16) + "…";

  return (
    <div className="space-y-4">
      {/* Verification checks */}
      {checks && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <CheckRow label="Nonce match" pass={checks.nonce_match} />
          <CheckRow label="Chain integrity" pass={checks.chain_integrity} />
          <CheckRow label="Image digest known" pass={checks.image_digest_known} />
          <CheckRow label="Timing consistent" pass={checks.timing_consistent} />
          <CheckRow label="Token count consistent" pass={checks.token_count_consistent} />
        </div>
      )}

      {/* Image digest */}
      <div className="text-xs text-text-muted">
        Image:{" "}
        <code
          className="font-mono text-text-secondary"
          title={attestation.image_digest}
        >
          {shortDigest}
        </code>
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        <span>
          Tokens:{" "}
          <span className="text-gold font-bold">
            {attestation.total_input_tokens.toLocaleString()}in / {attestation.total_output_tokens.toLocaleString()}out
          </span>
        </span>
        <span>
          LLM calls: <span className="text-gold font-bold">{attestation.total_llm_calls}</span>
        </span>
        <span>
          Wall clock: <span className="text-sky font-bold">{attestation.wall_clock_secs}s</span>
        </span>
        <span>
          Total tokens: <span className="font-bold">{totalTokens.toLocaleString()}</span>
        </span>
      </div>

      {/* LLM call table */}
      {attestation.llm_calls.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                <th className="py-1.5 px-2 text-left font-bold w-8">#</th>
                <th className="py-1.5 px-2 text-left font-bold">Provider</th>
                <th className="py-1.5 px-2 text-left font-bold">Model</th>
                <th className="py-1.5 px-2 text-right font-bold">In</th>
                <th className="py-1.5 px-2 text-right font-bold">Out</th>
                <th className="py-1.5 px-2 text-right font-bold">Duration</th>
                <th className="py-1.5 px-2 text-right font-bold">Extraction</th>
              </tr>
            </thead>
            <tbody>
              {attestation.llm_calls.map((call) => (
                <tr key={call.seq} className="border-b border-border/30">
                  <td className="py-1 px-2 text-text-muted">{call.seq}</td>
                  <td className="py-1 px-2 text-sky">{call.provider}</td>
                  <td className="py-1 px-2 text-text-secondary font-mono">{call.model}</td>
                  <td className="py-1 px-2 text-right">{call.input_tokens.toLocaleString()}</td>
                  <td className="py-1 px-2 text-right">{call.output_tokens.toLocaleString()}</td>
                  <td className="py-1 px-2 text-right text-text-muted">{call.duration_ms}ms</td>
                  <td className="py-1 px-2 text-right">
                    <span
                      className={
                        call.token_extraction === "exact"
                          ? "text-emerald"
                          : call.token_extraction === "fallback"
                            ? "text-gold"
                            : "text-text-muted"
                      }
                    >
                      {call.token_extraction ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Constraint violations */}
      {attestation.constraint_violations && attestation.constraint_violations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-coral">
            Constraint Violations ({attestation.constraint_violations.length})
          </p>
          {attestation.constraint_violations.map((v, i) => (
            <div key={i} className="text-[10px] text-coral bg-coral/10 rounded px-2 py-1 border border-coral/20">
              <span className="font-bold uppercase mr-1">{v.type.replace(/_/g, " ")}</span>
              {v.detail}
            </div>
          ))}
        </div>
      )}

      {/* Raw JSON */}
      <details className="text-[10px]">
        <summary className="cursor-pointer text-text-muted hover:text-text-secondary transition-colors">
          View raw attestation JSON
        </summary>
        <pre className="mt-2 bg-bg rounded p-3 text-text-secondary overflow-x-auto border border-border whitespace-pre-wrap">
          {JSON.stringify(raw ?? attestation, null, 2)}
        </pre>
      </details>
    </div>
  );
}
