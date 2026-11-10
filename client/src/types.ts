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
  canManage?: boolean;
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

export type DashboardView = 'overview' | 'links' | 'analytics' | 'media' | 'utilities' | 'settings';

export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultView: DashboardView;
  defaultQrSize: 256 | 384 | 512 | 768 | 1024;
  defaultQrEc: 'L' | 'M' | 'Q' | 'H';
  compactTables: boolean;
}

export interface PaginatedLinksResult {
  links: LinkRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GlobalAnalyticsDashboard {
  range: '7d' | '30d' | '90d' | 'all';
  platform: 'all' | Platform;
  totalClicksInRange: number;
  inAppClicksInRange: number;
  byPlatform: {
    youtube: number;
    instagram: number;
    facebook: number;
  };
  devices: {
    android: number;
    ios: number;
    desktop: number;
    other: number;
  };
  timeline: Array<{
    date: string;
    clicks: number;
  }>;
  geo: {
    hasReliableGeoData: boolean;
    knownGeoClicks: number;
    unknownGeoClicks: number;
    countries: Array<{ country: string; clicks: number }>;
  };
  topBrowsers: Array<{ name: string; clicks: number }>;
  topReferrers: Array<{ name: string; clicks: number }>;
  topLinks: LinkRecord[];
  recentClicks: Array<{
    link_code: string;
    link_title: string;
    platform: string;
    device_type: string;
    os_name: string;
    browser_name: string;
    is_in_app_browser: number;
    referrer: string;
    country: string;
    created_at: string;
  }>;
  activityPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ServerHealthStatus {
  status: string;
  timestamp: string;
  environment: 'vercel' | 'node';
  capabilities: {
    databaseMode: 'turso' | 'local-sqlite' | 'memory';
    objectStorageConfigured: boolean;
    workerQueueSupported: boolean;
    limits: {
      browserWasmMaxMb: number;
      workerMaxMb: number;
      signedUrlTtlSeconds: number;
      fileTtlHours: number;
    };
  };
}

export interface JobsSummaryData {
  summary: {
    totalJobs: number;
    completedJobs: number;
    queuedJobs: number;
    totalInputBytes: number;
    totalOutputBytes: number;
    activeStorageBytes: number;
    objectStorageConfigured: boolean;
  };
  recentJobs: Array<{
    job_id: string;
    module: string;
    processing_mode: string;
    input_filename: string;
    output_format: string;
    input_size: number;
    output_size: number | null;
    status: string;
    created_at: string;
  }>;
}
