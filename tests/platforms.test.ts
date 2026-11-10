import assert from 'assert';
import { detectPlatform, parsePlatformUrl } from '../server/platforms/index.js';

function testPlatforms() {
  console.log('=== TESTING MODULAR PLATFORM DETECTION & PARSING ===');

  // 1. YouTube
  assert.strictEqual(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.strictEqual(detectPlatform('https://youtu.be/dQw4w9WgXcQ?t=45s'), 'youtube');
  assert.strictEqual(detectPlatform('https://www.youtube.com/shorts/5-x1qKq2f1Q'), 'youtube');
  assert.strictEqual(detectPlatform('https://www.youtube.com/playlist?list=PL12345'), 'youtube');
  assert.strictEqual(detectPlatform('https://www.youtube.com/@mkbhd'), 'youtube');

  const ytVideo = parsePlatformUrl('https://youtu.be/dQw4w9WgXcQ?t=90s');
  assert.strictEqual(ytVideo.platform, 'youtube');
  assert.strictEqual(ytVideo.type, 'video');
  assert.strictEqual(ytVideo.videoId, 'dQw4w9WgXcQ');
  assert.ok(ytVideo.cleanUrl.includes('t=90s'));
  assert.ok(ytVideo.androidIntentUrl.includes('package=com.google.android.youtube'));
  assert.ok(ytVideo.androidIntentUrl.includes('S.browser_fallback_url='));
  console.log('[Pass] YouTube URL detection & normalization');

  // 2. Instagram
  assert.strictEqual(detectPlatform('https://www.instagram.com/reel/C0xample123/'), 'instagram');
  assert.strictEqual(detectPlatform('https://instagram.com/p/C0post123/?img_index=2'), 'instagram');
  assert.strictEqual(detectPlatform('https://www.instagram.com/natgeo/'), 'instagram');

  const igReel = parsePlatformUrl('https://www.instagram.com/reel/C0xample123/?igsh=abc');
  assert.strictEqual(igReel.platform, 'instagram');
  assert.strictEqual(igReel.type, 'reel');
  assert.strictEqual(igReel.contentId, 'C0xample123');
  assert.strictEqual(igReel.iosPreferUniversalLink, true);
  assert.ok(igReel.androidIntentUrl.includes('package=com.instagram.android'));
  assert.ok(igReel.androidIntentUrl.includes('S.browser_fallback_url='));

  const igPost = parsePlatformUrl('https://www.instagram.com/p/C0post123/?img_index=2');
  assert.strictEqual(igPost.type, 'post');
  assert.ok(igPost.cleanUrl.includes('img_index=2'));

  const igProfile = parsePlatformUrl('https://www.instagram.com/natgeo/');
  assert.strictEqual(igProfile.type, 'profile');
  assert.strictEqual(igProfile.contentId, 'natgeo');
  assert.strictEqual(igProfile.iosDeepLinkUrl, 'instagram://user?username=natgeo');

  const igReserved = parsePlatformUrl('https://www.instagram.com/explore/');
  assert.notStrictEqual(igReserved.type, 'profile');
  console.log('[Pass] Instagram URL detection, reserved routes & Universal Link logic');

  // 3. Facebook
  assert.strictEqual(detectPlatform('https://www.facebook.com/reel/1234567890'), 'facebook');
  assert.strictEqual(detectPlatform('https://fb.watch/abc123XYZ/'), 'facebook');
  assert.strictEqual(detectPlatform('https://www.facebook.com/watch/?v=9988776655'), 'facebook');
  assert.strictEqual(detectPlatform('https://www.facebook.com/profile.php?id=1000123456'), 'facebook');

  const fbReel = parsePlatformUrl('https://www.facebook.com/reel/1234567890');
  assert.strictEqual(fbReel.platform, 'facebook');
  assert.strictEqual(fbReel.type, 'reel');
  assert.strictEqual(fbReel.contentId, '1234567890');
  assert.ok(fbReel.androidIntentUrl.includes('package=com.facebook.katana'));
  assert.ok(fbReel.iosDeepLinkUrl.startsWith('fb://facewebmodal/f?href='));

  const fbWatch = parsePlatformUrl('https://www.facebook.com/watch/?v=9988776655&t=15');
  assert.strictEqual(fbWatch.type, 'video');
  assert.strictEqual(fbWatch.videoId, '9988776655');
  assert.ok(fbWatch.cleanUrl.includes('v=9988776655'));

  const fbProfile = parsePlatformUrl('https://www.facebook.com/profile.php?id=1000123456');
  assert.strictEqual(fbProfile.type, 'profile');
  assert.ok(fbProfile.cleanUrl.includes('id=1000123456'));

  const fbReserved = parsePlatformUrl('https://www.facebook.com/marketplace/');
  assert.notStrictEqual(fbReserved.type, 'profile');
  console.log('[Pass] Facebook URL detection, reserved routes & deep links');

  // 4. Rejections (only YouTube, Instagram, Facebook allowed)
  assert.strictEqual(detectPlatform('https://example.com/video/123'), null);
  assert.strictEqual(detectPlatform('https://vimeo.com/123456'), null);
  assert.strictEqual(detectPlatform('javascript:alert(1)'), null);
  assert.strictEqual(detectPlatform('not a valid url'), null);
  assert.strictEqual(detectPlatform(''), null);
  console.log('[Pass] Unsupported & malformed URLs safely rejected');

  console.log('=== ALL PLATFORM UNIT TESTS PASSED ===');
}

testPlatforms();
