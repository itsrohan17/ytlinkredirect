export type YouTubeUrlType = 'video' | 'shorts' | 'playlist' | 'channel' | 'live';

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

export interface ParsedTarget {
  type: YouTubeUrlType;
  videoId?: string;
  playlistId?: string;
  channelPath?: string;
  cleanUrl: string;
  androidIntentUrl: string;
  iosSchemeUrl: string;
  webFallbackUrl: string;
}

export interface GeneratedLinkResult {
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
  recentClicks: Array<{
    device_type: string;
    os_name: string;
    browser_name: string;
    is_in_app_browser: number;
    referrer: string;
    created_at: string;
  }>;
}
