const hlsJSURL = browser.extension.getURL("hls.js");
const addonName = browser.i18n.getMessage("addonName");
const messageHLSJSattempt = browser.i18n.getMessage("hlsjsAttempt");
const messageHLSJSloaded = browser.i18n.getMessage("hlsjsLoaded");
const messageHLSJSloadError = browser.i18n.getMessage("hlsjsLoadError");
const messageHLSJSmanifestLoaded = browser.i18n.getMessage("hlsjsManifestLoaded");
const messageHLSJSattached = browser.i18n.getMessage("hlsjsAttached");
const messageHLSJSerror = browser.i18n.getMessage("hlsjsError");

let port = window.eval(`(function() {
  // We return a message port back to the outer content script, so we can
  // securely communicate with it without polluting the window's namespace.
  let channel = new MessageChannel();

  // We override XMLHttpRequests only for hls.js, to punch a hole through CORS
  // as it can block the requests made by hls.js. This requires us to actually
  // do the requests in the content script rather than the page script, as
  // simply running everything from the content script does not work
  // (hls.js creates useless blobs which play no audio/video).
  let HLSJSXHRs = new WeakMap();
  let NextXHRID = 1;
  const HLSJSXHR = class HLSJSXHR {
    constructor() {
      this.data = {id: NextXHRID++, headers: {}};
      HLSJSXHRs[this.data.id] = this;
    }
    open(method, url) {
      this.data.method = method;
      this.data.url = url;
    }
    setRequestHeader(name, value) {
      headers[name] = value;
    }
    send() {
      this.data.responseType = this.responseType;
      channel.port1.postMessage({send: this.data});
    }
    abort() {
      channel.port1.postMessage({abort: this.data.id});
    }
  };

  channel.port1.onmessage = e => {
    let msg = e.data;
    let xhr = HLSJSXHRs[msg.id];
    if (xhr) {
      for (let i of ["readyState",
                     "response", "responseText",
                     "status", "statusText"]) {
        if (msg[i]) {
          xhr[i] = msg[i];
        }
      }
      if (msg.progress && xhr.onprogress) {
        xhr.onprogress({
          target: xhr,
          currentTarget: xhr,
          lengthComputable: msg.progress.lengthComputable,
          loaded: msg.progress.loaded,
          total: msg.progress.total,
        });
      } else if (msg.readystatechange && xhr.onreadystatechange) {
        xhr.onreadystatechange({
          target: xhr,
          currentTarget: xhr,
        });
      }
    }
  };

  // We wait for hls.js to load by waiting for this promise, which
  // loads the hls.js script as text and evals it, both to keep hls.js
  // from polluting the main page scope, and also so that we can keep
  // the hls.js source file unmodified, while tweaking it here so it
  // uses our custom XMLHttpRequest over-ride.
  const hlsjsLoaded = new Promise((resolve, reject) => {
    fetch("${hlsJSURL}", {
      headers: { "Content-Type": "text/plain" }
    }).then(response => response.text()).
    then(scriptText => {
      try {
        eval(scriptText.replace("new XMLHttpRequest", "new HLSJSXHR"));
      } catch(err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  function getHLSSource(node) {
    try {
      if (new URL(node.src).pathname.toLowerCase().endsWith(".m3u8")) {
        return node.src;
      }
    } catch(e) {
    }
  }

  // The easiest way to hook up hls.js is to simply listen for when any
  // audio/video/source element sends an "error" DOM message, check if it's
  // for an m3u8, then feed that source to hls.js re-using the same A/V element.
  document.addEventListener("error", e => {
    let mediaElement = e.target.closest("video") || e.target.closest("audio");
    if (!mediaElement) {
      return;
    }
    if (mediaElement.canPlayType("application/vnd.apple.mpegurl")) {
      return;
    }
    let src = getHLSSource(e.target);
    if (!src) {
      return;
    }
    console.info("${addonName}:", "${messageHLSJSattempt}");
    hlsjsLoaded.then(() => {
      console.info("${addonName}:", "${messageHLSJSloaded}");
      let hls = new Hls();
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("${addonName}:", "${messageHLSJSerror}", event, data);
      });
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.info("${addonName}:", "${messageHLSJSattached}", mediaElement);
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.info("${addonName}:", "${messageHLSJSmanifestLoaded}", data);
        if (mediaElement.autoplay) {
          mediaElement.play();
        }
      });
      hls.attachMedia(mediaElement);
    }).catch(err => {
      console.error("${addonName}:", "${messageHLSJSloadError}", err);
    });
  }, true);

  // Return the message port via eval's return value.
  return channel.port2;
}());`);

// Here is our minimal cross-script XHR implementation, which only
// implements what hls.js requires and sends only the information
// that seems to be minimally required to get the job done.
let XHRs = {};
port.onmessage = e => {
  let msg = e.data;
  if (msg.abort) {
    try {
      XHRs[msg.abort].abort();
    } catch(e) {}
  } else if (msg.send) {
    let {id, method, url, responseType, headers} = msg.send;
    let xhr = XHRs[id] = new XMLHttpRequest;
    xhr.open(method, url);
    if (responseType) {
      xhr.responseType = responseType;
    }
    for (let [name, value] in Object.entries(headers || {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.onreadystatechange = () => {
      let msg = {
        id,
        readystatechange: true,
        readyState: xhr.readyState,
      };
      if (xhr.readyState === 4) {
        // hls.js doesn't need these values until rsc=4, so we
        // only send it now to minimize the data we pass around.
        msg = Object.assign(msg, {
          status: xhr.status,
          statusText: xhr.statusText,
          responseType: xhr.responseType,
          response: xhr.responseType === "arraybuffer" ? xhr.response : undefined,
          responseText: xhr.responseType !== "arraybuffer" ? xhr.responseText : undefined,
        });
      }
      port.postMessage(msg);
    };
    xhr.onprogress = e => {
      port.postMessage({id, progress: {
        lengthComputable: e.lengthComputable,
        loaded: e.loaded,
        total: e.total,
      }});
    };
    xhr.onloadend = e => {
      // Make sure to let the XHR die to conserve memory.
      delete(XHRs[id]);
      xhr = null;
    };
    xhr.send();
  }
};
