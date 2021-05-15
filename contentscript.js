if (typeof alreadyInjected == "undefined") {
  const alreadyInjected = true;

  // We must (?) use browser.runtime.getURL instead of "./common.js"
  // This should be completly safe
  let common = null;
  //import(browser.runtime.getURL("common.js")).then((common) => {

  // Very, very ugly workaround until Firefox 89 (which has a ScriptLoader for imports in ContentScripts, bug 1536094)
  // is in ESR
  common = {
    getHostname: function (uri) {
      uri = uri.replace(/(https?:\/\/)?(www.)?/i, "");
      return uri.split("/")[0];
    },

    POPUP_MESSAGE: 1,
    CONTENT_MESSAGE: 2,
    FILTER_MESSAGE: 3,

    RequestPacket: class {
      constructor() {
        this.type = 0;
        this.request = 0;
        this.value = 0;
      }
    },

    SET_SITE_CONFIG: 1,
    GET_SITE_CONFIG: 2,

    SiteConfig: class {
      constructor() {
        this.isDisabled = false;
        this.maxHeightPercent = 0;
        this.maxWidthPercent = 0;
        this.maxPercentOfScreenSpace = 0;
      }
    },

    SiteConfigPacket: class {
      cunstructor() {
        this.hostname = "";
        this.config = new common.SiteConfig();
      }
    },

    GET_CONTENTSCRIPT_STATUS: 1,

    ContentScriptStatus: class {
      constructor() {
        this.isActive = false;
        this.config = new common.SiteConfig();
      }
    },

    TOGGLE_STATUS: 4,
    SET_CONTENTSCRIPT_CONFIG: 5,
  };

  // console.log("CS injected into " + window.location);
  let isActive = true;

  let config = new common.SiteConfig();

  const censorBar = "███";
  const censorClass = "censored-element";
  const protectedTags = [
    "body",
    "media",
    "header",
    "main",
    "aside",
    "nav",
    "footer",
    "input",
    "script",
    "style",
    "ytd-watch-next-secondary-results-renderer",
  ];

  function setConfig() {
    let request = new common.RequestPacket();
    request.type = common.CONTENT_MESSAGE;
    request.request = common.SET_SITE_CONFIG;
    request.value = new common.SiteConfigPacket();
    request.value.hostname = common.getHostname(window.location.href);
    request.value.config = config;
    browser.runtime.sendMessage(request);
  }

  async function getConfig() {
    let request = new common.RequestPacket();
    request.type = common.CONTENT_MESSAGE;
    request.request = common.GET_SITE_CONFIG;
    request.value = common.getHostname(window.location.href);
    browser.runtime.sendMessage(request).then((response) => {
      config = response.config;
      return Promise.resolve(true);
    });
  }

  async function uncensorElement(element, doForce) {
    if (
      doForce ||
      !isValidElement(element) ||
      !element.textContent.includes(censorBar)
    ) {
      element.classList.remove(censorClass);
    }
  }

  function isValidElement(element) {
    let height = element.offsetHeight;
    let width = element.offsetWidth;
    let screenSpace = window.innerHeight * window.outerHeight;

    if (
      height > config.maxHeightPercent * window.innerHeight ||
      width > config.maxWidthPercent * window.innerWidth
    ) {
      return false;
    }
    if (height * width > config.maxPercentOfScreenSpace * screenSpace) {
      return false;
    }
    if (protectedTags.includes(element.nodeName)) {
      return false;
    }
    return true;
  }

  async function censorChildElements(element) {
    let treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let currentNode = null;
    while ((currentNode = treeWalker.nextNode()) && currentNode != null) {
      if (
        currentNode.nodeValue != null &&
        currentNode.firstChild == null &&
        currentNode.nodeValue.includes(censorBar)
      ) {
        // currentNode is a text node, we must get the first parent element in any case
        currentNode = currentNode.parentElement;
        while (
          currentNode.parentElement != null &&
          isValidElement(currentNode.parentElement)
        ) {
          currentNode = currentNode.parentElement;
        }
        currentNode.classList.add(censorClass);
      }
    }
  }

  let censorStyleSheet = document.createElement("style");
  document.head.appendChild(censorStyleSheet);
  censorStyleSheet.sheet.insertRule(
    "." + censorClass + " { display: none !important }"
  );

  let changeObserver = new MutationObserver(function (domMutations) {
    domMutations.forEach(function (domChange) {
      let changedElement = domChange.target;
      if (changedElement.parentElement instanceof Element) {
        for (let childElement of changedElement.parentElement.getElementsByClassName(
          censorClass
        )) {
          uncensorElement(childElement, false);
        }
      }
      if (isActive) {
        censorChildElements(changedElement);
      }
    });
  });

  async function activateFilter() {
    await censorChildElements(document);
    changeObserver.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  async function deactivateFilter() {
    changeObserver.disconnect();
    for (let censoredElement of document.querySelectorAll(`.${censorClass}`)) {
      uncensorElement(censoredElement, true);
    }
    Promise.resolve(true);
  }

  getConfig().then(function () {
    activateFilter();
    setTimeout(function () {
      deactivateFilter().then(activateFilter());
    }, 1500);
  });

  browser.runtime.onMessage.addListener((request) => {
    switch (request.type) {
      case common.POPUP_MESSAGE:
        switch (request.request) {
          case common.GET_CONTENTSCRIPT_STATUS:
            let response = new common.ContentScriptStatus();
            response.isActive = isActive;
            response.config = config;
            return Promise.resolve(response);
          case common.SET_CONTENTSCRIPT_CONFIG:
            config = request.value;
            setConfig();
            if (isActive) {
              deactivateFilter().then(activateFilter());
            }
            return Promise.resolve(true);
          case common.TOGGLE_STATUS:
            isActive = !isActive;
            if (isActive) {
              activateFilter();
            } else {
              deactivateFilter();
            }
            return Promise.resolve(true);
        }
        break;
      case common.FILTER_MESSAGE:
        break;
    }
  });
  //});
}
