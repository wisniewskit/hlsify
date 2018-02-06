const addonName = browser.i18n.getMessage("addonName");
const messagePlayerRecoveryAttempt = browser.i18n.getMessage("playerRecoveryAttempt");
const messagePlayerAudioCodecSwapRecoveryAttempt = browser.i18n.getMessage("playerAudioCodecSwapRecoveryAttempt");
const messagePlayerRecoveryAttemptFailed = browser.i18n.getMessage("playerRecoveryAttemptFailed");
const messagePlayerNetworkError = browser.i18n.getMessage("playerNetworkError");
const messagePlayerUnrecoverableError = browser.i18n.getMessage("playerUnrecoverableError");

let hls;
let debug;
let recoverDecodingErrorDate;
let recoverSwapAudioCodecDate;

function handleMediaError(hls) {
  var now = performance.now();
  if (!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
    recoverDecodingErrorDate = performance.now();
    console.warn(`${addonName}: ${messagePlayerRecoveryAttempt}`);
    hls.recoverMediaError();
  } else {
    if(!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
      recoverSwapAudioCodecDate = performance.now();
      console.warn(`${addonName}: ${messagePlayerAudioCodecSwapRecoveryAttempt}`);
      hls.swapAudioCodec();
      hls.recoverMediaError();
    } else {
      console.error(`${addonName}: ${messagePlayerRecoveryAttemptFailed}`);
    }
  }
}

function playM3U8(url) {
  document.title = url;

  let video = document.getElementById("video");
  if (hls) {
    hls.destroy();
  }
  hls = new Hls({debug});
  hls.on(Hls.Events.ERROR, (event, data) => {
    console.error(`${addonName}: ${browser.i18n.getMessage("playerError", [data.type])}`, data.details);
    if (data.fatal) {
      switch(data.type) {
        case Hls.ErrorTypes.MEDIA_ERROR:
          handleMediaError(hls);
          break;
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.error(`${addonName}: ${messagePlayerNetworkError}`);
          break;
        default:
          console.error(`${addonName}: ${messagePlayerUnrecoverableError}`);
          hls.destroy();
          break;
      }
    }
  });
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play();
  });

  var m3u8Url = decodeURIComponent(url);
  hls.loadSource(m3u8Url);
  hls.attachMedia(video);
}

function go() {
  playM3U8(window.location.href.split("#")[1]);
}

window.addEventListener("DOMContentLoaded", go);
window.addEventListener("hashchange", go);
