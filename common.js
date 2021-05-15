export function getHostname(uri) {
  uri = uri.replace(/(https?:\/\/)?(www.)?/i, "");
  return uri.split("/")[0];
}

export const POPUP_MESSAGE = 1;
export const CONTENT_MESSAGE = 2;
export const FILTER_MESSAGE = 3;

export class RequestPacket {
  constructor() {
    this.type = 0;
    this.request = 0;
    this.value = 0;
  }
}

export const SET_SITE_CONFIG = 1;
export const GET_SITE_CONFIG = 2;

export class SiteConfig {
  constructor() {
    this.isDisabled = false;
    this.maxHeightPercent = 0;
    this.maxWidthPercent = 0;
    this.maxPercentOfScreenSpace = 0;
  }
}

export class SiteConfigPacket {
  cunstructor() {
    this.hostname = "";
    this.config = new SiteConfig();
  }
}

export const GET_CONTENTSCRIPT_STATUS = 1;

export class ContentScriptStatus {
  constructor() {
    this.isActive = false;
    this.config = new SiteConfig();
  }
}

export const TOGGLE_STATUS = 4;
export const SET_CONTENTSCRIPT_CONFIG = 5;
