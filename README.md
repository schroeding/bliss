# Bliss - Content Filter

[![CI Status](https://github.com/schroeding/bliss/workflows/CI/badge.svg?branch=master)](https://github.com/schroeding/bliss/actions?query=workflow:CI%20branch:master) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/6a82bd753ce549d2a166ff79e07dc7ea)](https://www.codacy.com/gh/schroeding/bliss/dashboard)

This extension can be used to hide parts of web pages that contain unwanted keywords, defined by yourself. Ideally, you will not even notice that they appear on a web page.

You determine which words or parts of words ("n-grams", also usable for languages without word separation) you do not want to see. You can also use regular expressions, but you don't have to.

As soon as an unwanted word appears, it's redacted on-the-fly. The part of the web page in which the word occurred is then also removed.

You can define for each web page how large the area to be removed may be, by setting the maximum height, width and size in relation to the screen.
The default values should work on most websites, but this allows you to, for example, remove articles from the front page of your favorite news site without hiding other, unrelated content by accident.

As this extension only modifies websites with unwanted words and not all sites, the performance penalty should be minor.

Your settings are synchronized via your browser (only if you are logged into Firefox Sync). This extension does not collect or transmit any data beyond that.

## Installation

- [Firefox AMO](https://addons.mozilla.org/en-US/firefox/addon/bliss-content-filter)

## Build Process

1. [Install Mozillas web-ext tool](https://github.com/mozilla/web-ext).

2. Pack the extension with web-ext:

```bash
web-ext build -a build --overwrite-dest
```

3. To test it, open the [Firefox Debug Page](about:debugging) and load the newly created ZIP file from the "build" folder as a temporary extension
