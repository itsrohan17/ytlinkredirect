export type YouTubeUrlType = 'video' | 'shorts' | 'playlist' | 'channel' | 'live';

export interface ParsedYouTubeInfo {
  type: YouTubeUrlType;
  videoId?: string;
  playlistId?: string;
  channelPath?: string; // e.g. '@mkbhd' or 'channel/UC...'
  timestamp?: string; // e.g. '120s' or '120'
  params: Record<string, string>;
  cleanUrl: string;
  androidIntentUrl: string;
  androidCustomSchemeUrl: string;
  iosSchemeUrl: string;
  webFallbackUrl: string;
}

export interface YouTubeMetadata {
  title: string;
  authorName: string;
  authorUrl?: string;
  thumbnailUrl: string;
  type: YouTubeUrlType;
}

export interface LinkRecord {
  id: number;
  code: string;
  original_url: string;
  clean_youtube_url: string;
  url_type: YouTubeUrlType;
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
  device_type: 'android' | 'ios' | 'desktop' | 'tablet' | 'other';
  os_name: string;
  browser_name: string;
  is_in_app_browser: number; // 0 or 1
  referrer: string;
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
  recentClicks: Array<{
    device_type: string;
    os_name: string;
    browser_name: string;
    is_in_app_browser: number;
    referrer: string;
    created_at: string;
  }>;
}
