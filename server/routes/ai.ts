import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  FLUX_RESOLUTIONS,
  FluxResolutionId,
  generateFluxThumbnail,
  getConfiguredNvidiaModel,
  isNvidiaAiConfigured,
  NvidiaAiError,
  ThumbnailStylePreset,
} from '../services/nvidiaFlux.js';

export const aiRouter = Router();

const VALID_PRESETS = new Set<ThumbnailStylePreset>([
  'gaming',
  'tech',
  'cinematic',
  'documentary',
  'reaction',
  'tutorial',
  'entertainment',
  'none',
]);

// Dedicated generation limiter to protect NVIDIA account quota (15 generations / 15 min per IP)
const aiGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'AI generation rate limit reached. Please wait a few minutes before generating more thumbnails.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/ai/config - Safe non-secret NVIDIA FLUX capabilities (never leaks NVIDIA_API_KEY)
aiRouter.get('/config', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    configured: isNvidiaAiConfigured(),
    model: getConfiguredNvidiaModel(),
    multiVariationPerCallSupported: false,
    defaultResolution: '1344x768',
    resolutions: Object.values(FLUX_RESOLUTIONS),
    presets: Array.from(VALID_PRESETS).filter((p) => p !== 'none'),
    limits: {
      maxPromptLength: 1500,
      maxTopicLength: 200,
      minSteps: 5,
      maxSteps: 50,
      defaultSteps: 28,
      minCfgScale: 1,
      maxCfgScale: 9,
      defaultCfgScale: 3.5,
    },
  });
});

// POST /api/ai/thumbnail - Generate AI thumbnail artwork via NVIDIA FLUX
aiRouter.post('/thumbnail', aiGenerateLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const preset = String(body.preset || 'none').toLowerCase() as ThumbnailStylePreset;
    const resolution = String(body.resolution || '1344x768') as FluxResolutionId;

    if (!prompt || prompt.length < 3) {
      return res.status(400).json({ error: 'Please enter a descriptive image prompt (at least 3 characters).' });
    }
    if (prompt.length > 1500) {
      return res.status(400).json({ error: 'Image prompt must be 1500 characters or fewer.' });
    }
    if (topic.length > 200) {
      return res.status(400).json({ error: 'Video topic/title must be 200 characters or fewer.' });
    }
    if (!VALID_PRESETS.has(preset)) {
      return res.status(400).json({ error: 'Invalid style preset selected.' });
    }
    if (!Object.prototype.hasOwnProperty.call(FLUX_RESOLUTIONS, resolution)) {
      return res.status(400).json({ error: 'Unsupported resolution option for FLUX.1-dev.' });
    }

    const steps = body.steps !== undefined ? Number(body.steps) : 28;
    const cfgScale = body.cfgScale !== undefined ? Number(body.cfgScale) : 3.5;
    const seed = body.seed !== undefined ? Number(body.seed) : 0;

    if (!Number.isFinite(steps) || steps < 5 || steps > 50) {
      return res.status(400).json({ error: 'Steps must be between 5 and 50.' });
    }
    if (!Number.isFinite(cfgScale) || cfgScale < 1 || cfgScale > 9) {
      return res.status(400).json({ error: 'CFG Scale must be between 1 and 9.' });
    }
    if (!Number.isFinite(seed) || seed < 0 || seed > 4294967295) {
      return res.status(400).json({ error: 'Seed must be a non-negative 32-bit integer (0 for random).' });
    }

    const result = await generateFluxThumbnail({
      prompt,
      topic,
      preset,
      resolution,
      steps,
      cfgScale,
      seed,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof NvidiaAiError) {
      console.warn(`⚠️ [NVIDIA AI ${err.status}] ${err.code}: ${err.message}`);
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
      });
    }
    console.error('❌ [AI Thumbnail Route Error]:', err);
    return res.status(500).json({ error: 'Unexpected server error during AI thumbnail generation.' });
  }
});
