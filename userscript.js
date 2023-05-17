// ==UserScript==
// @name         Export ChatGPT transcript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Easily export your ChatGPT transcripts to the clipboard.
// @author       Denis Kasak
// @match        https://chat.openai.com/c/*
// @icon         https://chat.openai.com/favicon-32x32.png
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function copyToClipboard(text) {
        GM_setClipboard(text);
    }

    function extractMarkdown() {
        const thread = document.querySelectorAll("#__next main .group");
        let extractedItems = [];

        for (const node of thread) {
            extractedItems.push({
                from: node.querySelector('div > svg') ? "**GPT**" : "**Human**",
                value: node.querySelector(".text-base > div:nth-child(2) .whitespace-pre-wrap").outerHTML,
            });
        }

        return extractedItems;
    }

    function htmlToMarkdown(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        // Find the first span inside the response div with the pattern
        // "x / y", where x, y are integers, indicating alternate human prompts.
        // Ignore this span.
        const firstSpan = doc.querySelector('span');
        if (firstSpan) {
            firstSpan.parentNode.removeChild(firstSpan);
        }

        function extractLanguageCode(node) {
            const classList = node.classList;

            for (let i = 0; i < classList.length; i++) {
                const className = classList[i];
                if (className.startsWith("language-")) {
                    const lang = className.replace("language-", "");
                    return lang;
                }
            }

            return "";
        }

        function traverse(node, insidePre = false, listItemLevel = -1) {
            const prepend = listItemLevel >= 0 ? ' '.repeat(listItemLevel * 2) : '';

            if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue;
            }

            if (node.nodeName === 'BUTTON') {
                return ''; // Skip buttons
            }

            console.log(node.nodeName, listItemLevel);

            let markdown = prepend;

            if (node.nodeName === 'B' || node.nodeName === 'STRONG') {
                markdown += '**';
            } else if (node.nodeName === 'I' || node.nodeName === 'EM') {
                markdown += '_';
            } else if (node.nodeName === 'U') {
                markdown += '__';
            } else if (node.nodeName === 'H1') {
                markdown += '# ';
            } else if (node.nodeName === 'H2') {
                markdown += '## ';
            } else if (node.nodeName === 'H3') {
                markdown += '### ';
            } else if (node.nodeName === 'H4') {
                markdown += '#### ';
            } else if (node.nodeName === 'H5') {
                markdown += '##### ';
            } else if (node.nodeName === 'H6') {
                markdown += '###### ';
            } else if (node.nodeName === 'PRE') {
                // Extract language from code snippet
                const language = extractLanguageCode(node.querySelector("code"));

                // Remove UI element which is displaying the snippet's language
                const langSpan = node.querySelector("div:first-child > div > span");
                if (langSpan) langSpan.remove();

                markdown += '```' + language + "\n";
                insidePre = true;
            } else if (node.nodeName === 'CODE' && !insidePre) {
                markdown += '`';
            } else if (node.nodeName === 'LI') {
                markdown += '- ';
            } else if (node.nodeName === 'A') {
                markdown += `[${traverse(node.childNodes[0])}](${node.getAttribute('href')})`;
                return markdown;
            } else if (node.nodeName === 'IMG') {
                markdown += `![${node.getAttribute('alt')}](${node.getAttribute('src')})`;
                return markdown;
            } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                listItemLevel += 1;
            }

            for (const child of node.childNodes) {
                markdown += traverse(child, insidePre, listItemLevel);
            }

            if (node.nodeName === 'PRE') {
                markdown += '```\n\n';
                insidePre = false;
            } else if (node.nodeName === 'CODE' && !insidePre) {
                markdown += '`';
            } else if (node.nodeName === 'B' || node.nodeName === 'STRONG') {
                markdown += '**';
            } else if (node.nodeName === 'I' || node.nodeName === 'EM') {
                markdown += '_';
            } else if (node.nodeName === 'U') {
                markdown += '__';
            } else if (node.nodeName === 'LI') {
                markdown += '\n';
            } else if (node.nodeName === 'P' || /^H[1-6]$/.test(node.nodeName)) {
                if (!insidePre && node.nextSibling !== null) {
                    markdown += '\n\n';
                }
            } else if (node.nodeName === 'BR' || node.nodeName === 'OL' || node.nodeName === 'LI') {
                markdown += '\n';
            }

            return markdown;
        }

        return traverse(doc.body).trim();
    }

    GM_registerMenuCommand("Copy transcript", function() {
        var items = extractMarkdown();
        var transcript = items.map(item => `${item.from}: ${htmlToMarkdown(item.value)}`).join("\n\n");
        copyToClipboard(transcript);
    });

    GM_registerMenuCommand("Copy last response", function() {
        var items = extractMarkdown();
        var response = htmlToMarkdown(items.slice(-1)[0].value);
        copyToClipboard(response);
    });

    GM_registerMenuCommand("Copy last prompt/response pair", function() {
        var items = extractMarkdown();
        var pair = items.slice(-2).map(item => `${item.from}: ${htmlToMarkdown(item.value)}`).join("\n\n");
        copyToClipboard(pair);
    });
})();
