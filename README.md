HLSify

Detects when sites try and fail to play an HLS stream, then dynamically loads
and uses hls.js [1] to decode the video in-place (and autoplay it, if that is
what the page was attempting).

Also combines the ability from the Native HLS extension [2] to intercept user
attempts to visit a URL ending in .m3u8 (an HLS stream), and redirects that
tab to the built-in Firefox video player, using hls.js to decode the video.

No configuration necessary; this addon operates passively, listening for any
video error events for HLS streams, and for requests to navigate to .m3u8 URLs.
If the browser natively supports HLS streams, the native player will be used
instead.

Notes on required permissions:
- "Access your data for all sites" because we do not know ahead of time which
  sites will use HLS, and so we must be able to detect it when it happens.

[1] https://github.com/dailymotion/hls.js
[2] https://addons.mozilla.org/en-US/firefox/addon/native_hls_playback/
