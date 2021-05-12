browser.theme.getCurrent().then((theme) => {
	console.log(theme);
	document.body.style.backgroundColor = theme.colors.ntp_background;
	document.body.style.color = theme.colors.ntp_text;
});

let listWords = document.getElementById("words-list");
let listWordsLabel = document.getElementById("words-list-label");
let listWordsDescription = document.getElementById("words-list-description");
let listNGrams = document.getElementById("n-grams-list");
let listNGramsLabel = document.getElementById("n-grams-list-label");
let listNGramsDescription = document.getElementById("n-grams-list-description");

let heightLabel = document.getElementById("max-height-label");
let heightSlider = document.getElementById("max-height-slider");
let heightPreview = document.getElementById("max-height-preview");

let widthLabel = document.getElementById("max-width-label");
let widthSlider = document.getElementById("max-width-slider");
let widthPreview = document.getElementById("max-width-preview");

let descriptionLabel = document.getElementById("description-label");
let globalSettingsLabel = document.getElementById("global-settings-label");
let maxDimensionsLabel = document.getElementById("max-dimensions-label");

let sizeLabel = document.getElementById("max-size-label");
let sizeSlider = document.getElementById("max-size-slider");
let sizePreview = document.getElementById("max-size-preview");

let stealthLabel = document.getElementById("stealthmode-label");
let stealthDescription = document.getElementById("stealthmode-description");
let stealthCheckboxLabel = document.getElementById("stealthmode-checkbox-label");
let stealthModeCheckbox = document.getElementById("stealthmode-checkbox");

descriptionLabel.textContent = browser.i18n.getMessage("settingsDescription");
listWordsLabel.textContent = browser.i18n.getMessage("wordsListLabel");
listWordsDescription.textContent = browser.i18n.getMessage(
	"wordsListDescription"
);
listNGramsLabel.textContent = browser.i18n.getMessage("ngramsListLabel");
listNGramsDescription.textContent = browser.i18n.getMessage(
	"ngramsListDescription"
);
globalSettingsLabel.textContent = browser.i18n.getMessage("globalSettings");
maxDimensionsLabel.textContent = browser.i18n.getMessage("maxDimensions");
heightLabel.textContent = browser.i18n.getMessage("height");
widthLabel.textContent = browser.i18n.getMessage("width");
sizeLabel.textContent = browser.i18n.getMessage("percentOfScreenspace");

stealthLabel.textContent = browser.i18n.getMessage("stealthLabel");
stealthDescription.textContent = browser.i18n.getMessage("stealthDescription");
stealthCheckboxLabel.textContent = browser.i18n.getMessage("stealthCheckbox");

let unwantedWords = [];
let unwantedNGrams = [];
let defaultSiteConfig = {
	maxHeightPercent: 0.7,
	maxWidthPercent: 0.7,
	maxPercentOfScreenSpace: 0.3,
	isDisabled: false,
};
let isStealthMode = false;

function updateSettings() {
	browser.storage.sync.set({
		unwantedWords: unwantedWords,
		unwantedNGrams: unwantedNGrams,
		defaultSiteConfig: defaultSiteConfig,
		isStealthMode: isStealthMode,
	});
}

function addListEntry(name, isFragment) {
	let listEntry = document.createElement("li");
	let listEntryName = document.createElement("span");
	let listEntryInput = document.createElement("input");
	listEntryInput.type = "text";

	if (!name) {
		listEntryName.textContent = browser.i18n.getMessage("addEntryToList");
	} else {
		listEntryName.textContent = name;
		listEntryInput.value = name;
	}

	listEntry.appendChild(listEntryName);
	listEntry.appendChild(listEntryInput);
	if (isFragment) {
		listNGrams.appendChild(listEntry);
	} else {
		listWords.appendChild(listEntry);
	}

	listEntryName.addEventListener("click", function () {
		listEntry.classList.add("edit");
		listEntryInput.focus();
	});

	listEntryInput.addEventListener("blur", function () {
		listEntry.classList.remove("edit");
		if (!name) {
			if (listEntryInput.value != "") {
				addListEntry(listEntryInput.value, isFragment);
				if (isFragment) {
					unwantedNGrams.push(listEntryInput.value);
				} else {
					unwantedWords.push(listEntryInput.value);
				}
				updateSettings();
			}
			listEntryInput.value = "";
			listEntryInput.focus();
			return;
		} else {
			if (listEntryInput.value == "") {
				if (isFragment) {
					unwantedNGrams.splice(
						unwantedNGrams.indexOf(listEntryName.textContent),
						1
					);
				} else {
					unwantedWords.splice(
						unwantedWords.indexOf(listEntryName.textContent),
						1
					);
				}
				listEntry.remove();
				updateSettings();
			} else {
				if (isFragment) {
					unwantedNGrams.splice(
						unwantedNGrams.indexOf(listEntryName.textContent),
						1,
						listEntryInput.value
					);
				} else {
					unwantedWords.splice(
						unwantedWords.indexOf(listEntryName.textContent),
						1,
						listEntryInput.value
					);
				}
				listEntryName.textContent = listEntryInput.value;
				updateSettings();
			}
		}
	});

	listEntryInput.addEventListener("keyup", function (event) {
		if (event.key == "Enter") {
			listEntryInput.blur();
		}
	});

	return listEntry;
}

browser.storage.sync.get(
	{
		unwantedWords: [],
		unwantedNGrams: [],
		defaultSiteConfig: {
			maxHeightPercent: 0.7,
			maxWidthPercent: 0.7,
			maxPercentOfScreenSpace: 0.3,
			isDisabled: false,
		},
		isStealthMode: false,
	},
	(response) => {
		unwantedWords = response.unwantedWords;
		unwantedNGrams = response.unwantedNGrams;
		defaultSiteConfig = response.defaultSiteConfig;
		isStealthMode = response.isStealthMode;

		heightSlider.value = defaultSiteConfig.maxHeightPercent * 100;
		heightPreview.style.height = `${heightSlider.value}%`;
		widthSlider.value = defaultSiteConfig.maxWidthPercent * 100;
		widthPreview.style.width = `${widthSlider.value}%`;
		sizeSlider.value = defaultSiteConfig.maxPercentOfScreenSpace * 100;
		sizePreview.style.width = `${sizeSlider.value}%`;
		sizePreview.style.height = `${sizeSlider.value}%`;
		stealthModeCheckbox.checked = isStealthMode;

		addListEntry(false, false);
		for (word of unwantedWords) {
			addListEntry(word, false);
		}

		addListEntry(false, true);
		for (ngram of unwantedNGrams) {
			addListEntry(ngram, true);
		}
	}
);

heightSlider.addEventListener("change", (event) => {
	heightPreview.style.height = `${event.target.value}%`;
	defaultSiteConfig.maxHeightPercent = event.target.value / 100;
	updateSettings();
});

widthSlider.addEventListener("change", (event) => {
	widthPreview.style.width = `${event.target.value}%`;
	defaultSiteConfig.maxWidthPercent = event.target.value / 100;
	updateSettings();
});

sizeSlider.addEventListener("change", (event) => {
	sizePreview.style.width = `${event.target.value}%`;
	sizePreview.style.height = `${event.target.value}%`;
	defaultSiteConfig.maxPercentOfScreenSpace = event.target.value / 100;
	updateSettings();
});

stealthModeCheckbox.addEventListener("change", (event) => {
	isStealthMode = event.target.checked;
	updateSettings();
})