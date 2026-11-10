export type ThumbnailStylePreset =
  | 'gaming'
  | 'tech'
  | 'cinematic'
  | 'documentary'
  | 'reaction'
  | 'tutorial'
  | 'entertainment'
  | 'none';

export type FluxResolutionId = '1344x768' | '1280x768' | '1216x832' | '1024x1024' | '768x1344';

export interface FluxResolutionSpec {
  id: FluxResolutionId;
  label: string;
  aspectRatio: '16:9' | '5:3' | '3:2' | '1:1' | '9:16';
  width: number;
  height: number;
}

// Width and height must strictly match the official NVIDIA NIM FLUX.1-dev integer enum:
// [768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344]
export const FLUX_RESOLUTIONS: Record<FluxResolutionId, FluxResolutionSpec> = {
  '1344x768': { id: '1344x768', label: '1344 × 768 (16:9 Widescreen)', aspectRatio: '16:9', width: 1344, height: 768 },
  '1280x768': { id: '1280x768', label: '1280 × 768 (5:3 Landscape)', aspectRatio: '5:3', width: 1280, height: 768 },
  '1216x832': { id: '1216x832', label: '1216 × 832 (3:2 Landscape)', aspectRatio: '3:2', width: 1216, height: 832 },
  '1024x1024': { id: '1024x1024', label: '1024 × 1024 (1:1 Square)', aspectRatio: '1:1', width: 1024, height: 1024 },
  '768x1344': { id: '768x1344', label: '768 × 1344 (9:16 Vertical)', aspectRatio: '9:16', width: 768, height: 1344 },
};

const PRESET_ENHANCERS: Record<ThumbnailStylePreset, string> = {
  gaming:
    'vibrant neon esports lighting, dynamic wide-angle composition, high contrast shadows, crisp foreground focal subject, clean negative space for thumbnail headline, no text, no letters, no watermark',
  tech:
    'sleek modern studio product photography, subtle cyan and emerald rim lighting, crisp shallow depth of field, dark matte background with clean negative space, no text, no letters, no watermark',
  cinematic:
    'dramatic 35mm film still, volumetric lighting, rich color grading, strong depth and atmosphere, wide composition with clean negative space, no text, no letters, no watermark',
  documentary:
    'editorial photojournalism style, authentic atmospheric lighting, compelling storytelling subject framing, sharp detail, clean space for title overlay, no text, no letters, no watermark',
  reaction:
    'expressive close-up studio portrait lighting, vibrant blurred background bokeh, high saturation, punchy contrast, clean off-center subject composition leaving open headline space, no text, no letters, no watermark',
  tutorial:
    'clean bright key lighting, organized uncluttered composition, sharp main object, modern minimal backdrop with clear area for overlay text, no text, no letters, no watermark',
  entertainment:
    'energetic bold lighting, colorful high-impact visual storytelling, expressive dynamic framing, crisp detail and clean background separation, no text, no letters, no watermark',
  none: 'high quality YouTube thumbnail background artwork, clear focal subject, clean negative space for overlay headline, no embedded text, no watermark',
};

export class NvidiaAiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NvidiaAiError';
    this.status = status;
    this.code = code;
  }
}

export function getConfiguredNvidiaModel(): string {
  const raw = (process.env.NVIDIA_NIM_MODEL || '').trim();
  if (!raw) return 'black-forest-labs/flux.1-dev';
  // build.nvidia.com web URL slug uses underscore (flux_1-dev), while NIM REST path expects flux.1-dev
  if (raw === 'black-forest-labs/flux_1-dev') {
    return 'black-forest-labs/flux.1-dev';
  }
  return raw;
}

export function isNvidiaAiConfigured(): boolean {
  return Boolean((process.env.NVIDIA_API_KEY || '').trim());
}

export function buildNvidiaInvokeUrl(model: string): string {
  const baseRaw = (process.env.NVIDIA_NIM_BASE_URL || 'https://ai.api.nvidia.com/v1/genai').trim();
  const base = baseRaw.replace(/\/+$/, '');
  if (base.endsWith('/infer') || base.endsWith(`/${model}`)) {
    return base;
  }
  if (base.endsWith('/v1/genai')) {
    return `${base}/${model}`;
  }
  if (/^https?:\/\/ai\.api\.nvidia\.com$/i.test(base)) {
    return `${base}/v1/genai/${model}`;
  }
  if (/^https?:\/\/ai\.api\.nvidia\.com\/v1$/i.test(base)) {
    return `${base}/genai/${model}`;
  }
  if (base.endsWith('/v1')) {
    return `${base}/infer`;
  }
  return `${base}/v1/infer`;
}

export function buildThumbnailPrompt(options: {
  prompt: string;
  topic?: string;
  preset?: ThumbnailStylePreset;
}): string {
  const basePrompt = options.prompt.trim();
  const topic = (options.topic || '').trim();
  const preset = options.preset && PRESET_ENHANCERS[options.preset] ? options.preset : 'none';
  const styleCue = PRESET_ENHANCERS[preset];

  const parts: string[] = [];
  if (topic) {
    parts.push(`Visual concept for YouTube video about "${topic}":`);
  }
  parts.push(basePrompt);
  parts.push(`Style direction: ${styleCue}.`);
  return parts.join(' ').slice(0, 4000);
}

function detectImageMimeFromBytes(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export interface GenerateFluxThumbnailParams {
  prompt: string;
  topic?: string;
  preset?: ThumbnailStylePreset;
  resolution?: FluxResolutionId;
  steps?: number;
  cfgScale?: number;
  seed?: number;
}

export interface GenerateFluxThumbnailResult {
  model: string;
  seed: number;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  dataUrl: string;
  composedPrompt: string;
}

export async function generateFluxThumbnail(
  params: GenerateFluxThumbnailParams
): Promise<GenerateFluxThumbnailResult> {
  const apiKey = (process.env.NVIDIA_API_KEY || '').trim();
  if (!apiKey) {
    throw new NvidiaAiError(
      503,
      'NVIDIA_API_KEY_MISSING',
      'AI generation is unavailable because NVIDIA_API_KEY is not configured on the server.'
    );
  }

  const resSpec = FLUX_RESOLUTIONS[params.resolution || '1344x768'] || FLUX_RESOLUTIONS['1344x768'];
  const steps = Math.min(50, Math.max(5, Math.round(Number(params.steps ?? 28))));
  const cfgScale = Math.min(9, Math.max(1, Number(params.cfgScale ?? 3.5)));
  const rawSeed = Math.round(Number(params.seed ?? 0));
  const seed = Number.isFinite(rawSeed) && rawSeed >= 0 && rawSeed <= 4294967295 ? rawSeed : 0;

  const model = getConfiguredNvidiaModel();
  const invokeUrl = buildNvidiaInvokeUrl(model);
  const composedPrompt = buildThumbnailPrompt({
    prompt: params.prompt,
    topic: params.topic,
    preset: params.preset,
  });

  const controller = new AbortController();
  const timeoutMs = Number(process.env.NVIDIA_TIMEOUT_MS || 55000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: composedPrompt,
        mode: 'base',
        width: resSpec.width,
        height: resSpec.height,
        cfg_scale: cfgScale,
        steps,
        seed,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new NvidiaAiError(
        504,
        'NVIDIA_TIMEOUT',
        'NVIDIA FLUX generation timed out before completion. Try fewer steps or retry.'
      );
    }
    throw new NvidiaAiError(
      502,
      'NVIDIA_NETWORK_ERROR',
      'Could not reach the NVIDIA NIM image generation service.'
    );
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();
  let jsonBody: any = null;
  try {
    jsonBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    jsonBody = null;
  }

  if (!response.ok) {
    const upstreamMsg = String(
      jsonBody?.detail || jsonBody?.title || jsonBody?.error?.message || jsonBody?.message || ''
    )
      .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
      .slice(0, 240);

    if (response.status === 401) {
      throw new NvidiaAiError(
        401,
        'NVIDIA_AUTH_FAILED',
        'NVIDIA API authentication failed. Please check that NVIDIA_API_KEY is valid and active.'
      );
    }
    if (response.status === 402) {
      throw new NvidiaAiError(
        402,
        'NVIDIA_QUOTA_EXCEEDED',
        'NVIDIA API account has insufficient credits or quota remaining for FLUX generation.'
      );
    }
    if (response.status === 403) {
      throw new NvidiaAiError(
        403,
        'NVIDIA_FORBIDDEN',
        `Your NVIDIA API account does not have access to model "${model}".`
      );
    }
    if (response.status === 404) {
      throw new NvidiaAiError(
        404,
        'NVIDIA_MODEL_UNAVAILABLE',
        `The configured NVIDIA model endpoint "${model}" is unavailable on your account.`
      );
    }
    if (response.status === 429) {
      throw new NvidiaAiError(
        429,
        'NVIDIA_RATE_LIMIT',
        'NVIDIA API rate limit exceeded. Wait a short moment before generating again.'
      );
    }
    if (response.status === 422 || response.status === 400) {
      throw new NvidiaAiError(
        400,
        'NVIDIA_INVALID_REQUEST',
        upstreamMsg || 'NVIDIA FLUX rejected the generation parameters.'
      );
    }
    throw new NvidiaAiError(
      502,
      'NVIDIA_UPSTREAM_ERROR',
      upstreamMsg || `NVIDIA FLUX service returned HTTP ${response.status}.`
    );
  }

  const artifact = Array.isArray(jsonBody?.artifacts) ? jsonBody.artifacts[0] : null;
  const base64Str = typeof artifact?.base64 === 'string' ? artifact.base64.trim() : '';
  if (!base64Str) {
    throw new NvidiaAiError(
      502,
      'NVIDIA_EMPTY_ARTIFACT',
      'NVIDIA FLUX response did not include a generated image artifact.'
    );
  }

  const imgBuffer = Buffer.from(base64Str, 'base64');
  if (imgBuffer.length < 64) {
    throw new NvidiaAiError(
      502,
      'NVIDIA_CORRUPT_ARTIFACT',
      'NVIDIA FLUX returned an invalid or empty image buffer.'
    );
  }

  const mimeType = detectImageMimeFromBytes(imgBuffer);
  const returnedSeed = typeof artifact?.seed === 'number' ? artifact.seed : seed;

  return {
    model,
    seed: returnedSeed,
    width: resSpec.width,
    height: resSpec.height,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64Str}`,
    composedPrompt,
  };
}
