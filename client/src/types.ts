export type Platform = 'youtube' | 'instagram' | 'facebook';

export type ContentType =
  | 'video'
  | 'shorts'
  | 'playlist'
  | 'channel'
  | 'live'
  | 'reel'
  | 'post'
  | 'profile';

export type AppView = 'links' | 'thumbnails' | 'ai';

export interface LinkRecord {
  id: number;
  code: string;
  platform: Platform;
  original_url: string;
  clean_url: string;
  clean_youtube_url: string;
  url_type: ContentType;
  content_id: string | null;
  video_id: string | null;
  playlist_id: string | null;
  channel_id: string | null;
  title: string;
  author_name: string;
  thumbnail_url: string;
  created_at: string;
  click_count: number;
}

export interface ParsedTarget {
  platform: Platform;
  type: ContentType;
  contentId?: string;
  videoId?: string;
  playlistId?: string;
  channelPath?: string;
  cleanUrl: string;
  androidIntentUrl: string;
  androidCustomSchemeUrl?: string;
  iosDeepLinkUrl: string;
  iosPreferUniversalLink: boolean;
  webFallbackUrl: string;
}

export interface GeneratedLinkResult {
  platform?: Platform;
  link: LinkRecord;
  shortUrl: string;
  parsed: ParsedTarget;
}

export interface ThumbnailVariant {
  quality: 'maxres' | 'sd' | 'hq' | 'mq' | 'default';
  label: string;
  resolution: string;
  width: number;
  height: number;
  available: boolean;
  sizeBytes: number | null;
  previewUrl: string;
  downloadUrl: string;
  filename: string;
}

export interface ThumbnailInspectResult {
  success: boolean;
  videoId: string;
  contentType: ContentType;
  cleanUrl: string;
  metadata: {
    title: string;
    authorName: string;
  };
  highestAvailable: ThumbnailVariant | null;
  resolutions: ThumbnailVariant[];
}

export type ThumbnailStylePreset =
  | 'gaming'
  | 'tech'
  | 'cinematic'
  | 'documentary'
  | 'reaction'
  | 'tutorial'
  | 'entertainment'
  | 'none';

export type FluxResolutionId = '1280x720' | '1344x768' | '1024x576' | '1024x1024' | '768x1344';

export interface AiResolutionOption {
  id: FluxResolutionId;
  label: string;
  aspectRatio: '16:9' | '1:1' | '9:16';
  width: number;
  height: number;
}

export interface AiConfigResponse {
  success: boolean;
  configured: boolean;
  model: string;
  multiVariationPerCallSupported: boolean;
  defaultResolution: FluxResolutionId;
  resolutions: AiResolutionOption[];
  presets: ThumbnailStylePreset[];
  limits: {
    maxPromptLength: number;
    maxTopicLength: number;
    minSteps: number;
    maxSteps: number;
    defaultSteps: number;
    minCfgScale: number;
    maxCfgScale: number;
    defaultCfgScale: number;
  };
}

export interface AiGeneratedImage {
  model: string;
  seed: number;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  dataUrl: string;
}
