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

export interface VideoStreamOption {
  id: string;
  format: 'MP4' | 'WebM';
  quality: '360p' | '480p' | '720p' | '1080p' | 'Original';
  fileSizeBytes: number | null;
  fileSizeLabel: string;
  downloadUrl: string;
  filename: string;
}

export interface MediaInspectResult {
  success: boolean;
  platform: Platform;
  contentType: ContentType;
  cleanUrl: string;
  contentId?: string;
  metadata: {
    platform: Platform;
    title: string;
    authorName: string;
    authorUrl?: string;
    thumbnailUrl: string;
    type: ContentType;
  };
  videoDownloadInfo: {
    supported: boolean;
    availableStreams: VideoStreamOption[];
    unsupportedReason: string;
  };
  thumbnailInfo: {
    proxyUrl: string;
    originalUrl: string;
    youtubeVideoId?: string;
  };
  permittedAssets: Array<{
    id: string;
    label: string;
    format: string;
    resolution?: string;
    downloadUrl: string;
    filename: string;
  }>;
  embedCode: string | null;
  officialOwnerGuide: {
    title: string;
    steps: string[];
    officialUrl: string;
    officialLabel: string;
  };
  unsupportedExplanation: string;
}
