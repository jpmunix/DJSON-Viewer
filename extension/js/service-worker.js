/** @license
 * DJSON Viewer and Formatter | MIT License
 * Copyright 2017 Dario De Santis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is the service worker for the DJSON Viewer extension.
 */

"use strict";

// A global object to store the JSON data, as the service worker can be terminated.
let obj;
let path;

const fns = {
    copyPath: function (info, tab) {
        chrome.tabs.sendMessage(tab.id, {action: "copy", type: "path"});
    },
    copyValue: function (info, tab) {
        chrome.tabs.sendMessage(tab.id, {action: "copy", type: "value"});
    },
    copyKey: function (info, tab) {
        chrome.tabs.sendMessage(tab.id, {action: "copy", type: "key"});
    },
    _viewJSON: function (info, stripSlashes) {
        if (typeof info.selectionText === "undefined") return;
        let str = info.selectionText;
        if (!str || str.length === 0) return;
        try {
            if (stripSlashes) {
                str = str.replace(/\\(.)/mg, "$1");
            }
            if (typeof JSON.parse(str) === "undefined") return;
            openJsonTab(str);
        } catch (e) {
        }
    },
    viewJSON: function (info) {
        this._viewJSON(info, false);
    },
    viewStripedJSON: function (info) {
        this._viewJSON(info, true);
    }
};

function createContextMenu() {
    const swallowErorrs = function () {
        if (chrome.runtime.lastError) {
            // Ignore error for duplicate id
        }
    };

    chrome.contextMenus.create({
        title: "DJSON",
        id: "djson",
        contexts: ["page", "selection", "link"]
    }, swallowErorrs);

    chrome.contextMenus.create({
        title: "Copy Value",
        id: "copyValue",
        parentId: "djson",
        contexts: ["page", "selection", "link"]
    }, swallowErorrs);

    chrome.contextMenus.create({
        title: "Copy Key",
        id: "copyKey",
        parentId: "djson",
        contexts: ["page", "selection", "link"]
    }, swallowErorrs);

    chrome.contextMenus.create({
        title: "Copy Path",
        id: "copyPath",
        parentId: "djson",
        contexts: ["page", "selection", "link"]
    }, swallowErorrs);

    chrome.contextMenus.create({
        title: "View JSON",
        id: "viewJSON",
        parentId: "djson",
        contexts: ["selection"]
    }, swallowErorrs);

    chrome.contextMenus.create({
        title: "View JSON (Strip slashes)",
        id: "viewStripedJSON",
        parentId: "djson",
        contexts: ["selection"]
    }, swallowErorrs);
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (fns[info.menuItemId]) {
        fns[info.menuItemId](info);
    }
});

function openJsonTab(json) {
    const viewTabUrl = chrome.runtime.getURL('json.html');
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const index = tabs[0] ? tabs[0].index + 1 : 0;
        chrome.tabs.create({url: viewTabUrl, active: true, index: index}, function (tab) {
            // Wait for the tab to be ready before sending the message
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {json: json});
            }, 500);
        });
    });
}

// Listen for requests from content pages wanting to set up a port
chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'djson') {
        return;
    }

    port.onMessage.addListener(function (msg) {
        if (msg.type === 'SENDING TEXT') {
            const text = msg.text;
            let validJsonText;

            try {
                // First attempt to parse directly
                obj = JSON.parse(text);
                validJsonText = text;
            } catch (e) {
                // If it fails, it might be JSONP
                try {
                    const firstParen = text.indexOf('(');
                    const lastParen = text.lastIndexOf(')');
                    if (firstParen !== -1 && lastParen !== -1) {
                        const jsonpBody = text.substring(firstParen + 1, lastParen);
                        obj = JSON.parse(jsonpBody);
                        validJsonText = jsonpBody;
                    } else {
                        throw new Error("Not JSON or JSONP.");
                    }
                } catch (e2) {
                    port.postMessage(['NOT JSON', 'Invalid JSON or JSONP.']);
                    return;
                }
            }

            if (typeof obj !== 'object' || obj === null) {
                port.postMessage(['NOT JSON', 'Valid JSON but not an object or array.']);
                return;
            }

            // Get settings from storage and then send the data to the content script
            chrome.storage.local.get(null, (settings) => {
                port.postMessage(['FORMATTING', JSON.stringify(settings)]);
                port.postMessage(['FORMATTED', obj, validJsonText, JSON.stringify(settings)]);
            });
        } else if (msg.type === 'OPEN OPTION TAB') {
            const viewTabUrl = chrome.runtime.getURL('options.html');
            chrome.tabs.query({url: viewTabUrl, currentWindow: true}, function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, {'active': true});
                } else {
                    chrome.tabs.create({url: viewTabUrl, active: true});
                }
            });
        }
    });
});


// on app update show change log
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "update") {
        chrome.tabs.create({url: chrome.runtime.getURL('changelog.html'), active: true});
    }
});

createContextMenu();
