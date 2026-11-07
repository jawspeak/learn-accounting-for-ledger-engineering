import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { schemas, type AttemptState, type EngineApi, type SandboxState } from '@contracts';

export const encodeState: EngineApi['encodeState'] = (state) =>
  compressToEncodedURIComponent(JSON.stringify(state));

function decode<T>(encoded: string, schema: { safeParse(x: unknown): { success: boolean; data?: unknown } }): T | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data as T) : null;
  } catch {
    return null;
  }
}

export const decodeSandbox: EngineApi['decodeSandbox'] = (s) => decode<SandboxState>(s, schemas.sandboxStateSchema);
export const decodeAttempt: EngineApi['decodeAttempt'] = (s) => decode<AttemptState>(s, schemas.attemptStateSchema);
