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

export interface ParsedLinkInfo {
  platform: Platform;
  type: ContentType;
  contentId?: string;
  videoId?: string;
  playlistId?: string;
  channelPath?: string;
  timestamp?: string;
  params: Record<string, string>;
  cleanUrl: string;
  androidIntentUrl: string;
  androidCustomSchemeUrl?: string;
  iosDeepLinkUrl: string;
  iosPreferUniversalLink: boolean;
  webFallbackUrl: string;
}

export interface PlatformMetadata {
  platform: Platform;
  title: string;
  authorName: string;
  authorUrl?: string;
  thumbnailUrl: string;
  type: ContentType;
}

export interface LinkRecord {
  id: number;
  code: string;
  platform: Platform;
  original_url: string;
  clean_url: string;
  clean_youtube_url: string; // Kept for backward compatibility
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

export interface ClickRecord {
  id?: number;
  link_id: number;
  code: string;
  platform: Platform;
  device_type: 'android' | 'ios' | 'desktop' | 'tablet' | 'other';
  os_name: string;
  browser_name: string;
  is_in_app_browser: number; // 0 or 1
  referrer: string;
  country: string;
  user_agent: string;
  ip_hash?: string;
  created_at?: string;
}

export interface LinkStats {
  link: LinkRecord;
  totalClicks: number;
  devices: {
    android: number;
    ios: number;
    desktop: number;
    other: number;
  };
  inAppCount: number;
  referrers: Record<string, number>;
  browsers: Record<string, number>;
  countries: Record<string, number>;
  recentClicks: Array<{
    platform: string;
    device_type: string;
    os_name: string;
    browser_name: string;
    is_in_app_browser: number;
    referrer: string;
    country: string;
    created_at: string;
  }>;
}

export interface PlatformAnalyticsSummary {
  totalLinks: number;
  totalClicks: number;
  byPlatform: {
    youtube: { links: number; clicks: number };
    instagram: { links: number; clicks: number };
    facebook: { links: number; clicks: number };
  };
  devices: {
    android: number;
    ios: number;
    desktop: number;
    other: number;
  };
  topCountries: Record<string, number>;
  topBrowsers: Record<string, number>;
  topReferrers: Record<string, number>;
}

export type MediaModule =
  | 'video-converter'
  | 'image-studio'
  | 'thumbnail-studio'
  | 'audio-studio'
  | 'file-compressor';

export type MediaJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'expired';

export type ProcessingMode = 'browser-wasm' | 'browser-canvas' | 'server-worker';

export interface MediaJobRecord {
  id: number;
  job_id: string;
  module: MediaModule;
  processing_mode: ProcessingMode;
  input_filename: string;
  input_mime: string;
  input_size: number;
  output_format: string;
  output_size: number | null;
  status: MediaJobStatus;
  storage_key: string | null;
  output_storage_key: string | null;
  owner_token_hash: string | null;
  dedupe_key: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageUsageSummary {
  totalJobs: number;
  completedJobs: number;
  queuedJobs: number;
  totalInputBytes: number;
  totalOutputBytes: number;
  activeStorageBytes: number;
  objectStorageConfigured: boolean;
}
