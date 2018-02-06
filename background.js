// When the user tries to navigate to a URL ending in .m3u8 we can detect and
// cancel that as a main-frame webRequest, cancel it so the user doesn't get a
// download prompt, and instead navigate that tab to an extension page which
// uses hls.js to play the stream using the browser's built-in player.
let video = document.createElement("video");
if (!video.canPlayType("application/vnd.apple.mpegurl")) {
  browser.webRequest.onBeforeRequest.addListener(	
    details => {
      if (details.url &&
          new URL(details.url).pathname.toLowerCase().endsWith(".m3u8")) {
        let url = `${browser.runtime.getURL("player.html")}#${details.url}`;
        browser.tabs.update(details.tabId, {url});
        return {cancel: true}
      }
    },
    {urls: ["*://*/*.m3u8*"], types:["main_frame"]},
    ["blocking"]
  );
}
