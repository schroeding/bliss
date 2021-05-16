let common = null;
import("./common.js").then((common) => {
  let defaultSiteConfig = {
    maxHeightPercent: 0.7,
    maxWidthPercent: 0.7,
    maxPercentOfScreenSpace: 0.3,
    isDisabled: false,
  };

  let siteConfig = {};

  function getSiteConfig(hostname) {
    if (hostname in siteConfig) {
      return siteConfig[hostname];
    }
    return defaultSiteConfig;
  }

  function setSiteConfig(hostname, config) {
    siteConfig[hostname] = config;
    browser.storage.sync.set({
      siteConfig: siteConfig,
    });
  }

  let unwantedWords = [];
  let unwantedNgrams = [];
  let regExList = [];

  let isStealthMode = false;

  const allowedTypes = ["text/html", "text/plain", "application/json"];

  function calculateRegExList() {
    regExList = [];
    for (let entry of unwantedWords) {
      try {
        let lengthOfCensorBar = Math.max(6, entry.length - 3);
        regExList.push({
          target: new RegExp(
            `\(?<![a-zA-Z\u007f-\uFFFF])${entry}(?![a-zA-Z\u007f-\uFFFF])`,
            "gi"
          ),
          censorBar: "█".repeat(lengthOfCensorBar),
        });
      } catch {
        console.error("Invalid RegExp for word " + entry);
      }
    }
    for (let entry of unwantedNgrams) {
      try {
        let lengthOfCensorBar = Math.max(6, entry.length - 3);
        regExList.push({
          target: new RegExp(entry, "gi"),
          censorBar: "█".repeat(lengthOfCensorBar),
        });
      } catch {
        console.error("Invalid RegExp for n-gramm " + entry);
      }
    }
  }

  calculateRegExList();

  function textFilter(details) {
    let filter = browser.webRequest.filterResponseData(details.requestId);
    let textEncoder = new TextEncoder();
    let textDecoder = null;
    let readData = [];
    let isNotFiltered = false;
    let onStartDone = false;
    let brokeEncoding = false;

    filter.ondata = (event) => {
      let counter = 0;
      while (!onStartDone) {
        counter++;
        if (counter > 100000) {
          console.error("LOOP DETECTED! THIS SHOULD ***NEVER*** HAPPEN!");
          filter.close();
          return;
        }
      }

      if (isNotFiltered) {
        filter.write(event.data);
        return;
      }

      readData.push(event.data);
    };

    filter.onstop = async (event) => {
      if (!isNotFiltered) {
        if (textDecoder == null) {
          textDecoder = new TextDecoder("utf-8");
        }

        let dataUnicodeText = "";
        for (let dataChunk of readData) {
          dataUnicodeText += textDecoder.decode(dataChunk, { stream: true });
        }
        let dataUnicodeTextUnmodified = dataUnicodeText;

        for (let regExp of regExList.values()) {
          dataUnicodeText = dataUnicodeText.replace(
            regExp.target,
            regExp.censorBar
          );
        }

        if (dataUnicodeText != dataUnicodeTextUnmodified) {
          filter.write(textEncoder.encode(dataUnicodeText));
          if (details.tabId >= 0) {
            // console.log("Injecting CS into request");
            let request = new common.RequestPacket();
            request.type = common.FILTER_MESSAGE;
            request.request = common.HEARTBEAT;
            browser.tabs.sendMessage(details.tabId, request).then(
              function () {
                // console.log("... but is already injected");
              },
              function () {
                browser.tabs.executeScript(details.tabId, {
                  file: "/contentscript.js",
                  allFrames: false,
                });
              }
            );
          }
        } else {
          if (brokeEncoding) {
            filter.write(textEncoder.encode(dataUnicodeText));
          } else {
            for (let readChunk of readData) {
              filter.write(readChunk);
            }
          }
        }
      }

      filter.disconnect();
    };

    let sitePath =
      typeof details.documentUrl == "undefined"
        ? details.url
        : details.documentUrl;
    if (getSiteConfig(common.getHostname(sitePath)).isDisabled) {
      isNotFiltered = true;
      onStartDone = true;
      return;
    }
    for (let i = 0; i < details.responseHeaders.length; i++) {
      headerEntry = details.responseHeaders[i];
      if (headerEntry.name.toLowerCase() == "content-type") {
        let contentTypeData = headerEntry.value.split(";");
        if (allowedTypes.includes(contentTypeData[0].trim().toLowerCase())) {
          for (contentTypeEntry of contentTypeData) {
            let splittedEntry = contentTypeEntry.trim().split("=");
            if (splittedEntry[0].toLowerCase() == "charset") {
              try {
                console.log(splittedEntry[1] + " is okay");
                textDecoder = new TextDecoder(splittedEntry[1].toLowerCase());
                if (splittedEntry[1].toLowerCase() != "utf-8") {
                  details.responseHeaders[i].value =
                    contentTypeData[0] + "; charset=utf-8";
                  brokeEncoding = true;
                }
                console.log(details.responseHeaders);
              } catch {
                console.log("... but an error occoured");
              }
            }
          }
          onStartDone = true;
          return { responseHeaders: details.responseHeaders };
        } else {
          isNotFiltered = true;
          onStartDone = true;
          return;
        }
      }
    }
    // console.log("No MIME");
    isNotFiltered = true;
    onStartDone = true;

    //return blockingResponsePromise;
  }

  function mediaFilter(details) {
    if (details.url.includes(encodeURIComponent("███"))) {
      return {
        redirectUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5QUFFDkf7cDUMAAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAMRSURBVHja7cGBAAAAAMOg+VNf4QBVAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwG8CtAAB/9gEUAAAAABJRU5ErkJggg==",
      };
    }
  }

  browser.webRequest.onHeadersReceived.addListener(
    textFilter,
    {
      urls: ["<all_urls>"],
      types: ["main_frame", "sub_frame", "xmlhttprequest"],
    },
    ["blocking", "responseHeaders"]
  );

  browser.webRequest.onHeadersReceived.addListener(
    mediaFilter,
    {
      urls: ["<all_urls>"],
      types: ["image", "imageset", "media"],
    },
    ["blocking"]
  );

  async function loadSettings() {
    browser.storage.sync
      .get({
        unwantedWords: [],
        unwantedNGrams: [],
        siteConfig: {},
        defaultSiteConfig: {
          maxHeightPercent: 0.7,
          maxWidthPercent: 0.7,
          maxPercentOfScreenSpace: 0.3,
          isDisabled: false,
        },
        isStealthMode: false,
      })
      .then((response) => {
        unwantedWords = response.unwantedWords;
        unwantedNgrams = response.unwantedNGrams;
        siteConfig = response.siteConfig;
        defaultSiteConfig = response.defaultSiteConfig;
        calculateRegExList();
        isStealthMode = response.isStealthMode;
        if (isStealthMode) {
          browser.browserAction.setIcon({ path: "media/icon-decoy.svg" });
          browser.browserAction.setTitle({ title: "AdBlock Pro" });
        } else {
          browser.browserAction.setIcon({});
          browser.browserAction.setTitle({ title: "" });
        }
        return Promise.resolve(true);
      });
  }

  loadSettings();

  browser.storage.onChanged.addListener(function () {
    loadSettings();
  });

  browser.runtime.onMessage.addListener((request) => {
    switch (request.type) {
      case common.POPUP_MESSAGE:
        switch (request.request) {
          case common.GET_SITE_CONFIG:
            let response = new common.SiteConfigPacket();
            response.hostname = request.value;
            response.config = getSiteConfig(request.value);
            return Promise.resolve(response);
          case common.TOGGLE_STATUS:
            let tempConfig = getSiteConfig(request.value);
            tempConfig.isDisabled = !tempConfig.isDisabled;
            setSiteConfig(request.value, tempConfig);
            return Promise.resolve(true);
        }
        break;
      case common.CONTENT_MESSAGE:
        switch (request.request) {
          case common.GET_SITE_CONFIG:
            let response = new common.SiteConfigPacket();
            response.hostname = request.value;
            response.config = getSiteConfig(request.value);
            return Promise.resolve(response);
          case common.SET_SITE_CONFIG:
            setSiteConfig(request.value.hostname, request.value.config);
            return Promise.resolve(true);
        }
        break;
    }
  });
});
