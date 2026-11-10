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

export type AppView = 'links' | 'thumbnails' | 'upscaler';

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
