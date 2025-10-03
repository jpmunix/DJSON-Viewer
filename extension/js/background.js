/** @license
 DJSON Viewer and Formatter | MIT License
 Copyright 2017 Dario De Santis

 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do
 so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */

const MENU_ROOT_ID = 'djson';
const MENU_IDS = {
    COPY_VALUE: 'copyValue',
    COPY_KEY: 'copyKey',
    COPY_PATH: 'copyPath',
    VIEW_JSON: 'viewJSON',
    VIEW_STRIPPED_JSON: 'viewStripedJSON'
};

const lastContextByTab = new Map();
const pendingJsonTabs = new Map();

function removeComments(str) {
    str = ('__' + str + '__').split('');
    var mode = {
        singleQuote: false,
        doubleQuote: false,
        regex: false,
        blockComment: false,
        lineComment: false,
        condComp: false
    };
    for (var i = 0, l = str.length; i < l; i++) {
        if (mode.regex) {
            if (str[i] === '/' && str[i - 1] !== '\\') {
                mode.regex = false;
            }
            continue;
        }
        if (mode.singleQuote) {
            if (str[i] === "'" && str[i - 1] !== '\\') {
                mode.singleQuote = false;
            }
            continue;
        }
        if (mode.doubleQuote) {
            if (str[i] === '"' && str[i - 1] !== '\\') {
                mode.doubleQuote = false;
            }
            continue;
        }
        if (mode.blockComment) {
            if (str[i] === '*' && str[i + 1] === '/') {
                str[i + 1] = '';
                mode.blockComment = false;
            }
            str[i] = '';
            continue;
        }
        if (mode.lineComment) {
            if (str[i + 1] === '\n' || str[i + 1] === '\r') {
                mode.lineComment = false;
            }
            str[i] = '';
            continue;
        }
        if (mode.condComp) {
            if (str[i - 2] === '@' && str[i - 1] === '*' && str[i] === '/') {
                mode.condComp = false;
            }
            continue;
        }
        mode.doubleQuote = str[i] === '"';
        mode.singleQuote = str[i] === "'";
        if (str[i] === '/') {
            if (str[i + 1] === '*' && str[i + 2] === '@') {
                mode.condComp = true;
                continue;
            }
            if (str[i + 1] === '*') {
                str[i] = '';
                mode.blockComment = true;
                continue;
            }
            if (str[i + 1] === '/') {
                str[i] = '';
                mode.lineComment = true;
                continue;
            }
            mode.regex = true;
        }
    }
    return str.join('').slice(2, -2);
}

function firstJSONCharIndex(s) {
    var arrayIdx = s.indexOf('['),
        objIdx = s.indexOf('{'),
        idx = 0;
    if (arrayIdx !== -1) {
        idx = arrayIdx;
    }
    if (objIdx !== -1) {
        if (arrayIdx === -1) {
            idx = objIdx;
        } else {
            idx = Math.min(objIdx, arrayIdx);
        }
    }
    return idx;
}

function objectByString(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1');
    s = s.replace(/^\./, '');
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}

function createContextMenu() {
    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            title : "DJSON",
            id: MENU_ROOT_ID,
            contexts : [ "page", "selection", "link" ]
        });

        chrome.contextMenus.create({
            title : "Copy Value",
            id: MENU_IDS.COPY_VALUE,
            parentId: MENU_ROOT_ID,
            contexts : [ "page", "selection", "link" ]
        });

        chrome.contextMenus.create({
            title : "Copy Key",
            id: MENU_IDS.COPY_KEY,
            parentId: MENU_ROOT_ID,
            contexts : [ "page", "selection", "link" ]
        });

        chrome.contextMenus.create({
            title : "Copy Path",
            id: MENU_IDS.COPY_PATH,
            parentId: MENU_ROOT_ID,
            contexts : [ "page", "selection", "link" ]
        });

        chrome.contextMenus.create({
            title : "View JSON",
            id: MENU_IDS.VIEW_JSON,
            parentId: MENU_ROOT_ID,
            contexts : [ "selection" ]
        });

        chrome.contextMenus.create({
            title : "View JSON (Strip slashes)",
            id: MENU_IDS.VIEW_STRIPPED_JSON,
            parentId: MENU_ROOT_ID,
            contexts : [ "selection" ]
        });
    });
}

function getOptions() {
    return new Promise(function (resolve) {
        chrome.storage.local.get({
            theme: null,
            startCollapsed: false,
            startCollapsedIfBig: false,
            showAlwaysCount: false,
            hideLineNumbers: false
        }, function (items) {
            resolve(items);
        });
    });
}

function openJsonTab(json) {
    var viewTabUrl = chrome.runtime.getURL('json.html');
    var jsonText = typeof json === 'string' ? json : JSON.stringify(json);

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var index = tabs && tabs.length ? tabs[0].index : 0;
        chrome.tabs.create({url: viewTabUrl, active: true, index: index + 1}, function (tab) {
            if (tab && typeof tab.id === 'number') {
                pendingJsonTabs.set(tab.id, jsonText);
            }
        });
    });
}

function sendJsonToTab(tabId, json) {
    chrome.tabs.sendMessage(tabId, {type: 'LOAD_JSON', json: json});
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'complete' && pendingJsonTabs.has(tabId)) {
        var json = pendingJsonTabs.get(tabId);
        pendingJsonTabs.delete(tabId);
        sendJsonToTab(tabId, json);
    }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
    pendingJsonTabs.delete(tabId);
    lastContextByTab.delete(tabId);
});

function handleViewJSON(info, stripSlashes) {
    if (typeof info.selectionText === 'undefined') {
        return;
    }
    var str = info.selectionText;
    if(!str || str.length === 0) {
        return;
    }
    try {
        if(stripSlashes) {
            str = str.replace(/\\(.)/mg, "$1");
        }
        if( typeof JSON.parse(str) === "undefined" ) {
            return;
        }
        openJsonTab(str);
    } catch (e) {}
}

function handleContextCopy(menuId, tabId) {
    var context = lastContextByTab.get(tabId);
    if (!context) {
        return;
    }
    var textToCopy = '';
    if (menuId === MENU_IDS.COPY_PATH) {
        textToCopy = context.path || '';
    } else if (menuId === MENU_IDS.COPY_KEY) {
        var keyPath = context.path;
        if (keyPath && keyPath.length > 1) {
            if (keyPath.slice(-1) === ']') {
                keyPath = keyPath.replace(/\[\d+\]$/, '');
            }
            if (keyPath.length > 1) {
                textToCopy = keyPath.substring(keyPath.lastIndexOf('.') + 1);
            }
        }
    } else if (menuId === MENU_IDS.COPY_VALUE) {
        if (context.path && context.path.length > 1 && context.obj) {
            var prop = context.path.substring(1);
            if(context.path.charAt(1) === "."){
                prop = prop.substring(1);
            }
            var result = objectByString(context.obj, prop);
            if(typeof result === "object"){
                textToCopy = JSON.stringify(result);
            } else {
                textToCopy = result;
            }
        }
    }
    if (textToCopy !== undefined && textToCopy !== null && tabId !== undefined) {
        chrome.tabs.sendMessage(tabId, {type: 'COPY_TO_CLIPBOARD', text: String(textToCopy)});
    }
}

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (!info.menuItemId) {
        return;
    }
    if (info.menuItemId === MENU_IDS.VIEW_JSON) {
        handleViewJSON(info, false);
    } else if (info.menuItemId === MENU_IDS.VIEW_STRIPPED_JSON) {
        handleViewJSON(info, true);
    } else if (info.menuItemId === MENU_IDS.COPY_PATH || info.menuItemId === MENU_IDS.COPY_KEY || info.menuItemId === MENU_IDS.COPY_VALUE) {
        if (tab && typeof tab.id === 'number') {
            handleContextCopy(info.menuItemId, tab.id);
        }
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
    createContextMenu();
    if(details.reason === "update") {
        chrome.tabs.create({url: chrome.runtime.getURL('changelog.html'), active: true});
    }
});

chrome.runtime.onStartup.addListener(function() {
    createContextMenu();
});

createContextMenu();

chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'djson') {
        return;
    }

    port.onMessage.addListener(function (msg) {
        if (!msg || !msg.type) {
            return;
        }

        if (msg.type === 'OPEN JSON TAB') {
            if (msg.json) {
                openJsonTab(msg.json);
            }
        }
        else if (msg.type === 'OPEN OPTION TAB') {
            var viewTabUrl = chrome.runtime.getURL('options.html');
            chrome.tabs.query({url: viewTabUrl, currentWindow: true}, function (tabs) {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, {'active': true});
                } else {
                    chrome.tabs.query({active: true, currentWindow: true}, function (activeTabs) {
                        var index = activeTabs && activeTabs.length ? activeTabs[0].index : 0;
                        chrome.tabs.create({url: viewTabUrl, active: true, index: index + 1});
                    });
                }
            });
        }
        else if (msg.type === 'VIEW NESTED') {
            var prop = msg.path ? msg.path.substring(1) : '';
            if(msg.path && msg.path.charAt(1) === "."){
                prop = prop.substring(1);
            }
            var result = msg.obj ? objectByString(msg.obj, prop) : undefined;
            if (typeof result !== 'undefined') {
                openJsonTab(typeof result === 'string' ? result : JSON.stringify(result));
            }
        }
        else if (msg.type === 'SENDING TEXT') {
            handleSendingText(port, msg);
        }
        else if (msg.type === 'COPY PATH') {
            if (port.sender && port.sender.tab && typeof port.sender.tab.id === 'number') {
                lastContextByTab.set(port.sender.tab.id, {path: msg.path, obj: msg.obj});
            }
        }
    });
});

function handleSendingText(port, msg) {
    var text = msg.text;
    var jsonpFunctionName = null;
    var validJsonText;
    var obj;

    var strippedText = text.substring(firstJSONCharIndex(text));

    try {
        obj = JSON.parse(strippedText);
        validJsonText = strippedText;
    }
    catch (e) {
        text = text.trim();
        var indexOfParen;
        if (!(indexOfParen = text.indexOf('(') )) {
            port.postMessage({type: 'NOT JSON', reason: 'no opening parenthesis'});
            port.disconnect();
            return;
        }

        var firstBit = removeComments(text.substring(0, indexOfParen)).trim();
        if (!firstBit.match(/^[a-zA-Z_$][\.\[\]'"0-9a-zA-Z_$]*$/)) {
            port.postMessage({type: 'NOT JSON', reason: 'first bit not a valid function name'});
            port.disconnect();
            return;
        }

        var indexOfLastParen;
        if (!(indexOfLastParen = text.lastIndexOf(')') )) {
            port.postMessage({type: 'NOT JSON', reason: 'no closing paren'});
            port.disconnect();
            return;
        }

        var lastBit = removeComments(text.substring(indexOfLastParen + 1)).trim();
        if (lastBit !== "" && lastBit !== ';') {
            port.postMessage({type: 'NOT JSON', reason: 'last closing paren followed by invalid characters'});
            port.disconnect();
            return;
        }

        text = text.substring(indexOfParen + 1, indexOfLastParen);
        try {
            obj = JSON.parse(text);
            validJsonText = text;
        }
        catch (e2) {
            port.postMessage({type: 'NOT JSON', reason: 'looks like a function call, but the parameter is not valid JSON'});
            return;
        }

        jsonpFunctionName = firstBit;
    }

    if (typeof obj !== 'object' || obj === null) {
        port.postMessage({type: 'NOT JSON', reason: 'technically JSON but not an object or array'});
        port.disconnect();
        return;
    }

    getOptions().then(function (options) {
        port.postMessage({type: 'FORMATTING', options: options});
        port.postMessage({
            type: 'FORMATTED',
            json: validJsonText,
            jsonObject: obj,
            jsonpFunctionName: jsonpFunctionName,
            options: options
        });
    });
}
