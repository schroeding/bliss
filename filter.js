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
		let textDecoder = new TextDecoder("utf-8");

		filter.onstart = (event) => {
			try {
				console.log(
					"Request (" + common.getHostname(details.url) + ") called OnStart Event"
				);
				let documentPath =
					typeof details.documentUrl == "undefined"
						? details.url
						: details.documentUrl;
				if (getSiteConfig(common.getHostname(documentPath)).isDisabled) {
					console.log("Ignoring request, is disabled");
					filter.disconnect();
					return;
				}
				for (let headerEntry of details.responseHeaders) {
					if (headerEntry.name.toLowerCase() == "content-type") {
						if (allowedTypes.includes(headerEntry.value.split(";")[0])) {
							console.log("Request is valid");
							return;
						}

						console.log("Request is not valid!");
						filter.disconnect();
						return;
					}
				}
				console.log("Request is valid (no mime)");
				console.log(details.responseHeaders);
			} catch { filter.disconnect(); }
		};

		let readData = [];
		filter.ondata = (event) => {
			try {
				readData.push(event.data);
			} catch { console.log("Error in onData event!") }
		};

		filter.onstop = async (event) => {
			//let dataBlob = new Blob(readData);
			//let dataUnicodeText = await dataBlob.text();
			let dataUnicodeText = ''
			for (let dataChunk of readData) {
				dataUnicodeText += textDecoder.decode(dataChunk, { stream: true });
			}
			let dataUnicodeTextUnmodified = dataUnicodeText;

			//console.log(dataBlob);
			
			for (let regExp of regExList.values()) {
				dataUnicodeText = dataUnicodeText.replace(
					regExp.target,
					regExp.censorBar
				);
			}

			if (dataUnicodeText != dataUnicodeTextUnmodified) {
				filter.write(textEncoder.encode(dataUnicodeText));
				filter.disconnect();

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
				console.log("No Change for Request, sending unmodified original...")
				for (let dataChunk of readData) {
					filter.write(dataChunk);
				}
				filter.disconnect();
			}
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

	function loadSettings() {
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
			})
			.then((response) => {
				unwantedWords = response.unwantedWords;
				unwantedNgrams = response.unwantedNGrams;
				siteConfig = response.siteConfig;
				defaultSiteConfig = response.defaultSiteConfig;
				calculateRegExList();
			});
	}

	loadSettings();

	browser.storage.onChanged.addListener(function () {
		loadSettings();
	});

	browser.runtime.onMessage.addListener((request) => {
		console.log("CM recieved (filter)");
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
						console.log(tempConfig);
						tempConfig.isDisabled = !tempConfig.isDisabled;
						console.log(tempConfig);
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
						console.log(response);
						return Promise.resolve(response);
					case common.SET_SITE_CONFIG:
						setSiteConfig(request.value.hostname, request.value.config);
						return Promise.resolve(true);
				}
				break;
		}
	});
});
