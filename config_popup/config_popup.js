browser.theme.getCurrent().then((theme) => {
	console.log(theme);
	document.body.style.backgroundColor = theme.colors.popup;
	document.body.style.color = theme.colors.popup_text;
});

let isLoaded = false;

let statusBox = document.getElementById("status-box");
let statusLabel = document.getElementById("status-label");
let statusToggle = document.getElementById("status-toggle");

let configBox = document.getElementById("config-box");

let heightLabel = document.getElementById("max-height-label");
let heightSlider = document.getElementById("max-height-slider");
let heightPreview = document.getElementById("max-height-preview");

let widthLabel = document.getElementById("max-width-label");
let widthSlider = document.getElementById("max-width-slider");
let widthPreview = document.getElementById("max-width-preview");

let siteSettingsLabel = document.getElementById("site-settings-label");
let maxDimensionsLabel = document.getElementById("max-dimensions-label");

let sizeLabel = document.getElementById("max-size-label");
let sizeSlider = document.getElementById("max-size-slider");
let sizePreview = document.getElementById("max-size-preview");

let disableFilterToggle = document.getElementById("disable-reload");

let linkToSettings = document.getElementById("settings-link");

statusLabel.textContent = browser.i18n.getMessage("statusNotRunning");
statusToggle.textContent = browser.i18n.getMessage("statusToggle");
siteSettingsLabel.textContent = browser.i18n.getMessage("siteSettings");
maxDimensionsLabel.textContent = browser.i18n.getMessage("maxDimensions");
heightLabel.textContent = browser.i18n.getMessage("height");
widthLabel.textContent = browser.i18n.getMessage("width");
sizeLabel.textContent = browser.i18n.getMessage("percentOfScreenspace");
disableFilterToggle.textContent = browser.i18n.getMessage("disableAndReload");
linkToSettings.textContent = browser.i18n.getMessage("optionsSite");

let common = null;
import("../common.js").then((common) => {
	let config = new common.SiteConfig();

	function setStatusIndicator(status) {
		if (!isLoaded) {
			if (status) {
				statusLabel.textContent = browser.i18n.getMessage("statusNotRunning");
				statusBox.classList.remove("perm-disabled");
				statusBox.classList.add("not-running");
				statusBox.classList.remove("disabled");
				statusBox.classList.remove("active");
				configBox.classList.add("not-running");
			} else {
				statusLabel.textContent = browser.i18n.getMessage("statusPermDisabled");
				disableFilterToggle.textContent = browser.i18n.getMessage(
					"enableAndReload"
				);
				statusBox.classList.add("perm-disabled");
				statusBox.classList.remove("not-running");
				statusBox.classList.remove("disabled");
				statusBox.classList.remove("active");
				configBox.classList.add("not-running");
			}
			return;
		}
		if (status) {
			statusLabel.textContent = browser.i18n.getMessage("statusActive");
			statusBox.classList.remove("perm-disabled");
			statusBox.classList.remove("not-running");
			statusBox.classList.remove("disabled");
			statusBox.classList.add("active");
			configBox.classList.remove("not-running");
		} else {
			statusLabel.textContent = browser.i18n.getMessage("statusDisabled");
			statusBox.classList.remove("perm-disabled");
			statusBox.classList.remove("not-running");
			statusBox.classList.add("disabled");
			statusBox.classList.remove("active");
			configBox.classList.remove("not-running");
		}
	}

	function sendRequestToTab(
		request,
		callback,
		errorCallback = function (error) {
			console.log(error);
		}
	) {
		browser.tabs
			.query({ currentWindow: true, active: true })
			.then(function (tabs) {
				browser.tabs
					.sendMessage(tabs[0].id, request)
					.then(callback)
					.catch(errorCallback);
			});
	}

	async function getCurrentTabIfURLNotEmpty() {
		let tabs = await browser.tabs.query({
			currentWindow: true,
			active: true,
		});

		if (typeof tabs[0].url == "undefined") {
			return Promise.resolve(false);
		}
		return Promise.resolve(tabs[0]);
	}

	function getStatus() {
		let request = new common.RequestPacket();
		request.type = common.POPUP_MESSAGE;
		request.request = common.GET_CONTENTSCRIPT_STATUS;
		sendRequestToTab(
			request,
			(response) => {
				isLoaded = true;
				config = response.config;
				if (config.isDisabled) {
					isLoaded = false;
					if (response.config.isDisabled) {
						setStatusIndicator(false);
						return;
					}
				}
				setStatusIndicator(response.isActive);
				heightSlider.value = config.maxHeightPercent * 100;
				heightPreview.style.height = `${heightSlider.value}%`;
				widthSlider.value = config.maxWidthPercent * 100;
				widthPreview.style.width = `${widthSlider.value}%`;
				sizeSlider.value = config.maxPercentOfScreenSpace * 100;
				sizePreview.style.width = `${sizeSlider.value}%`;
				sizePreview.style.height = `${sizeSlider.value}%`;
				console.log(response);
			},
			(error) => {
				isLoaded = false;
				getCurrentTabIfURLNotEmpty().then((tab) => {
					if (!tab) {
						return;
					}
					let request = new common.RequestPacket();
					request.type = common.POPUP_MESSAGE;
					request.request = common.GET_SITE_CONFIG;
					request.value = common.getHostname(tab.url);
					browser.runtime.sendMessage(request).then((response) => {
						console.log(response);
						console.log("tt");
						if (response.config.isDisabled) {
							setStatusIndicator(false);
						}
					});
				});
			}
		);
	}

	getStatus();

	function setConfig() {
		let request = new common.RequestPacket();
		request.type = common.POPUP_MESSAGE;
		request.request = common.SET_CONTENTSCRIPT_CONFIG;
		request.value = config;
		sendRequestToTab(request, (response) => {
			getStatus();
		});
	}

	statusToggle.addEventListener("click", (event) => {
		let request = new common.RequestPacket();
		request.type = common.POPUP_MESSAGE;
		request.request = common.TOGGLE_STATUS;
		sendRequestToTab(request, (response) => {
			getStatus();
		});
	});

	heightSlider.addEventListener("change", (event) => {
		heightPreview.style.height = `${event.target.value}%`;
		config.maxHeightPercent = event.target.value / 100;
		setConfig();
	});

	widthSlider.addEventListener("change", (event) => {
		widthPreview.style.width = `${event.target.value}%`;
		config.maxWidthPercent = event.target.value / 100;
		setConfig();
	});

	sizeSlider.addEventListener("change", (event) => {
		sizePreview.style.width = `${event.target.value}%`;
		sizePreview.style.height = `${event.target.value}%`;
		config.maxPercentOfScreenSpace = event.target.value / 100;
		setConfig();
	});

	disableFilterToggle.addEventListener("click", (event) => {
		getCurrentTabIfURLNotEmpty().then((tab) => {
			if (!tab) {
				return;
			}
			let request = new common.RequestPacket();
			request.type = common.POPUP_MESSAGE;
			request.request = common.TOGGLE_STATUS;
			console.log(common.getHostname(tab.url) + " permanent");
			request.value = common.getHostname(tab.url);
			browser.runtime.sendMessage(request).then((response) => {
				browser.tabs.reload(tab.tabId);
				window.close();
			});
		});
	});

	linkToSettings.addEventListener("click", function () {
		browser.runtime.openOptionsPage();
	});

	browser.tabs.onActivated.addListener(function () {
		window.close();
	});
});
