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
 */

(function () {
    "use strict";

    let djsonContent, pre, djson, slowAnalysisTimeout, port;

    // Listener for receiving messages from the service worker
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.json && window.location.href.includes('json.html')) {
            // This is for opening selected text in a new tab
            while (document.body.firstChild) {
                document.body.removeChild(document.body.firstChild);
            }
            pre = document.createElement('pre');
            pre.id = 'emptyPre';
            pre.innerText = request.json;
            document.body.appendChild(pre);
            ready();
        } else if (request.action === 'copy') {
            // This handles copy actions from the context menu
            const statusText = document.getElementById("status") ? document.getElementById("status").innerText : '';
            if (!statusText) return;

            let textToCopy = '';
            const path = statusText.substring(1); // remove '$'

            if (request.type === 'path') {
                textToCopy = statusText;
            } else if (request.type === 'value') {
                 let result = Object.byString(djson, path);
                 if(typeof result === "object"){
                    result = JSON.stringify(result);
                 }
                 textToCopy = result;
            } else if (request.type === 'key') {
                let keyPath = path.replace(/\[\d\]$/, '');
                if (keyPath.length > 0) {
                    textToCopy = keyPath.substring(keyPath.lastIndexOf(".") + 1);
                }
            }

            if(textToCopy){
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Maybe show a small notification? For now, just log it.
                    console.log('DJSON: Copied to clipboard:', textToCopy);
                }).catch(err => {
                    console.error('DJSON: Failed to copy text: ', err);
                });
            }
        }
    });

    function connectToPort() {
        port = chrome.runtime.connect({name: 'djson'});

        port.onMessage.addListener(function (msg) {
            const [type, ...args] = msg;

            switch (type) {
                case 'NOT JSON':
                    pre.hidden = false;
                    if (djsonContent) {
                        document.body.removeChild(djsonContent);
                    }
                    break;

                case 'FORMATTING':
                    clearTimeout(slowAnalysisTimeout);
                    setupUI(JSON.parse(args[0]));
                    break;

                case 'FORMATTED':
                    const [obj, validJsonText, localStorageOptions] = args;
                    djson = obj; // Keep the parsed object
                    const html = jsonObjToHTML(obj, null, localStorageOptions.startCollapsed, localStorageOptions.hideLineNumbers);
                    djsonContent.innerHTML = html;

                    // Expose djson to the page in a CSP-compliant way
                    document.dispatchEvent(new CustomEvent('djson-ready', {detail: validJsonText}));

                    // Add dynamic CSS rules for item counts
                    const djsonStyleEl = document.getElementById('djsonStyleEl');
                    const numChildClasses = window.numChildClasses || {};
                    for (const count in numChildClasses) {
                        if (numChildClasses.hasOwnProperty(count)) {
                            const comment = count + (count === 1 ? ' item' : ' items');
                            let rule = `\n.numChild${count}.collapsed:after{color: #aaa; content:" // ${comment}"}`;
                            if (localStorageOptions.showAlwaysCount) {
                                rule += `\n.numChild${count}:not(.collapsed)>.b:not(.lastB):after{color: #aaa; font-weight: normal; content:" // ${comment}"}`;
                            }
                            djsonStyleEl.insertAdjacentHTML('beforeend', rule);
                        }
                    }

                    // Add event listeners for interaction
                    addEventListeners();
                    break;

                default:
                    console.error('DJSON: Message not understood: ', type);
            }
        });
    }

    function setupUI(localStorageOptions) {
        // Insert CSS file
        const djsonStyleEl = document.createElement('link');
        djsonStyleEl.id = 'djsonStyleEl';
        djsonStyleEl.rel = 'stylesheet';
        djsonStyleEl.href = chrome.runtime.getURL('css/content.css');
        document.head.appendChild(djsonStyleEl);

        const theme = localStorageOptions && localStorageOptions.theme ? localStorageOptions.theme : null;
        if (theme) {
            document.body.setAttribute("data-theme", theme);
        }

        djsonContent.innerHTML = '<p id="formattingMsg"><span class="loader"></span> Formatting...</p>';
        const formattingMsg = document.getElementById('formattingMsg');
        formattingMsg.hidden = true;
        setTimeout(() => {
            formattingMsg.hidden = false;
        }, 250);

        if (!document.getElementById("status")) {
            const statusElement = document.createElement('div');
            statusElement.id = "status";
            document.body.appendChild(statusElement);
        }

        if (!document.getElementById("optionBar")) {
            const optionBar = document.createElement('div');
            optionBar.id = 'optionBar';

            // Buttons will be added here
            const buttonExpand = document.createElement('button');
            buttonExpand.id = 'expandAll';
            buttonExpand.innerText = 'Expand All';
            buttonExpand.addEventListener('click', () => expand([document.querySelector('.expander').parentNode], true));

            const buttonCollapse = document.createElement('button');
            buttonCollapse.id = 'collapseAll';
            buttonCollapse.innerText = 'Collapse All';
            buttonCollapse.addEventListener('click', () => {
                const firstBlockInner = document.querySelector(".rootDObj > .blockInner");
                if (firstBlockInner) collapse(firstBlockInner.children, true);
            });

            optionBar.appendChild(buttonExpand);
            optionBar.appendChild(buttonCollapse);
            // ... more buttons ...
            document.body.insertBefore(optionBar, pre);
        }
    }

    function addEventListeners() {
        djsonContent.addEventListener('mouseover', onMouseMove);
        document.body.addEventListener('contextmenu', onContextMenu);
        document.addEventListener('click', generalClick, false);

        const nested = document.getElementsByClassName('nested');
        for (let i = 0; i < nested.length; i++) {
            nested[i].addEventListener('click', function () {
                port.postMessage({
                    type: "VIEW NESTED",
                    obj: djson,
                    path: document.getElementById("status").innerText
                });
            }, false);
        }
    }


    const onMouseMove = (function () {
        function onmouseOut() {
            const statusElement = document.getElementById("status");
            if (statusElement) statusElement.innerText = "";
        }

        function findDObjElement(element) {
            if (!element || element.id === "gutter" || element.id === "formattedJson" || element.id === "djsonContent") {
                return false;
            }
            while (element && !element.classList.contains("dObj")) {
                element = element.parentNode;
            }
            if (element && element.classList.contains('rootDObj')) {
                return false;
            }
            return element;
        }

        return function (event) {
            let str = "", statusElement = document.getElementById("status");
            let element = findDObjElement(event.target);
            if (element) {
                do {
                    if (element.classList.contains("arrElem")) {
                        const index = Array.from(element.parentNode.children).indexOf(element);
                        str = `[${index}]` + str;
                    } else if (element.classList.contains("dObjProp")) {
                        const key = element.getElementsByClassName("key")[0].innerText;
                        str = "." + key + str;
                    }
                    element = element.parentNode.parentNode;
                } while (element && element.classList.contains("dObj") && !element.classList.contains("rootDObj"));
                str = "$" + str;
                if(statusElement) statusElement.innerText = str;
                return;
            }
            onmouseOut();
        };
    })();

    function onContextMenu() {
        const status = document.getElementById("status");
        if (status && status.innerText.length > 0) {
            port.postMessage({type: "COPY_PATH", obj: djson, path: status.innerText});
        }
    }

    function ready() {
        // Check if the page is just a single PRE element with JSON
        pre = document.body.querySelector('pre');
        if (document.body.childElementCount === 1 && pre) {
            // Load formatter script
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('js/dom-formatter.js');
            script.onload = function() {
                connectToPort();
                pre.hidden = true;
                slowAnalysisTimeout = setTimeout(() => {
                    pre.hidden = false;
                }, 1000);

                djsonContent = document.createElement('div');
                djsonContent.id = 'djsonContent';
                document.body.appendChild(djsonContent);

                port.postMessage({
                    type: "SENDING TEXT",
                    text: pre.innerText,
                    length: pre.innerText.length
                });
            };
            document.head.appendChild(script);
        }
    }

    function findBlockInner(el) {
        return el.querySelector('.blockInner');
    }

    function collapse(elements, recursive) {
        for (let i = elements.length - 1; i >= 0; i--) {
            elements[i].classList.add('collapsed');
            if (recursive) {
                const blockInner = findBlockInner(elements[i]);
                if (blockInner) collapse(blockInner.children, recursive);
            }
        }
    }

    function expand(elements, recursive) {
        for (let i = elements.length - 1; i >= 0; i--) {
            elements[i].classList.remove('collapsed');
            if (recursive) {
                const blockInner = findBlockInner(elements[i]);
                if (blockInner) expand(blockInner.children, recursive);
            }
        }
    }

    const modKey = navigator.platform.includes('Mac') ?
        (ev) => ev.metaKey :
        (ev) => ev.ctrlKey;

    function generalClick(ev) {
        if (ev.which === 1 && ev.target.className === 'expander') {
            ev.preventDefault();
            const parent = ev.target.parentNode;
            if (parent.classList.contains('collapsed')) {
                if (ev.shiftKey) expand([parent], true);
                else if (modKey(ev)) expand(parent.parentNode.children);
                else expand([parent]);
            } else {
                if (ev.shiftKey) collapse([parent], true);
                else if (modKey(ev)) collapse(parent.parentNode.children);
                else collapse([parent]);
            }
        }
    }

    // Inject a script into the main page to listen for our custom event
    const injectedScript = document.createElement('script');
    injectedScript.innerHTML = `
        document.addEventListener('djson-ready', function(e) {
            window.djson = JSON.parse(e.detail);
            console.log('DJSON Viewer: Type "djson" to inspect the JSON object.');
        });
    `;
    document.documentElement.appendChild(injectedScript);
    injectedScript.remove(); // Clean up the script tag from the DOM

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ready);
    } else {
        ready();
    }
})();