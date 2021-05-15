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
		for (let entry of unwantedWords.values()) {
			try {
				let lengthOfCensorBar = Math.max(6, entry.length - 3);
				regExList.push({
					target: new RegExp(
						`\(?<![a-zA-Z\u0100-\uFFFF])${entry}(?![a-zA-Z\u0120-\uFFFF])`,
						"gi"
					),
					censorBar: "█".repeat(lengthOfCensorBar),
				});
			} catch {
				console.error("Invalid RegExp for word " + entry);
			}
		}
		for (let entry of unwantedNgrams.values()) {
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

		filter.onstart = (event) => {
			onStartDone = true;
			console.log(
				"OnStart RequestID " + details.requestId + " (" + details.url + ")"
			);

			let sitePath =
				typeof details.documentUrl == "undefined"
					? details.url
					: details.documentUrl;
			if (getSiteConfig(common.getHostname(sitePath)).isDisabled) {
				isNotFiltered = true;
				onStartDone = true;
				return;
			}
			for (let headerEntry of details.responseHeaders) {
				if (headerEntry.name.toLowerCase() == "content-type") {
					let contentTypeData = headerEntry.value.split(";");
					if (allowedTypes.includes(contentTypeData[0].trim().toLowerCase())) {
						for (contentTypeEntry of contentTypeData) {
							let splittedEntry = contentTypeEntry.trim().split("=");
							if (splittedEntry[0].toLowerCase() == "charset") {
								try {
									console.log(splittedEntry[1] + " is okay");
									textDecoder = new TextDecoder(splittedEntry[1].toLowerCase());
								} catch {
									console.log("... but an error occoured");
								}
							}
						}
						onStartDone = true;
						return;
					} else {
						isNotFiltered = true;
						onStartDone = true;
						return;
					}
				}
			}
			console.log("No MIME");
			isNotFiltered = true;
			onStartDone = true;
		};

		filter.ondata = (event) => {
			console.log("OnData RequestID " + details.requestId);

			let counter = 0;
			while (!onStartDone) {
				console.log("onStart is not done");
				counter++;
				if (counter > 100000) {
					console.log("LOOP DETECTED! THIS SHOULD ***NEVER*** HAPPEN!");
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
			console.log("OnStop RequestID " + details.requestId);

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
						console.log("Injecting CS into request");
						let request = new common.RequestPacket();
						request.type = common.FILTER_MESSAGE;
						request.request = common.HEARTBEAT;
						browser.tabs.sendMessage(details.tabId, request).then(
							function () {
								console.log("... but is already injected");
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
					for (let readChunk of readData) {
						filter.write(readChunk);
					}
				}
			}

			filter.disconnect();
		};
	}

	function mediaFilter(details) {
		if (details.url.includes(encodeURIComponent("███"))) {
			return {
				redirectUrl: browser.runtime.getURL("media/placeholder_image.png"),
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
