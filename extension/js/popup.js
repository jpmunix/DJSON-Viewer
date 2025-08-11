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

    // Override JSON.parse to use jsonlint for more forgiving parsing.
    JSON._parse = JSON.parse;
    JSON.parse = function (json) {
        try {
            return JSON._parse(json);
        } catch (e) {
            // If standard JSON parsing fails, fall back to jsonlint.
            return jsonlint.parse(json);
        }
    };

    // Modern async copy function
    async function copyToClipboard(text, infoArea) {
        try {
            await navigator.clipboard.writeText(text);
            infoArea.innerHTML = "Copied to clipboard!";
        } catch (err) {
            console.error('Failed to copy: ', err);
            infoArea.innerHTML = "Failed to copy to clipboard.";
        }
    }

    $(document).ready(function () {
        /*
         * Events registration
         */
        $("#input").on("keyup change", function () {
            hasher.update();
        });

        // Open separate window (pop-out)
        $("#button-popout").click(function () {
            chrome.tabs.create({
                url: 'popup.html'
            });
        });

        // Click on tab
        $("#tabs li").click(function () {
            $("#tabs li").removeClass("on");
            $(this).addClass("on");
            hasher.tab = tabs[this.id];
            hasher.init();
            hasher.update();
            $("#input-value").focus();
        });

        $("#callBeautify").click(function () {
            const dumpTextArea = document.getElementById('input-value');
            const infoArea = document.getElementById('infoArea');
            try {
                const ugly = dumpTextArea.value;
                if (ugly.length > 0) {
                    const obj = JSON.parse(ugly);
                    const beautiful = JSON.stringify(obj, undefined, 4);
                    dumpTextArea.value = beautiful;
                    copyToClipboard(beautiful, infoArea);
                    infoArea.innerHTML = "JSON Beautified and copied to your clipboard";
                } else {
                    infoArea.innerHTML = 'Write some JSON in the textarea.';
                }
            } catch (exc) {
                infoArea.innerHTML = exc.toString();
            }
        });

        $("#callMinify").click(function () {
            const dumpTextArea = document.getElementById('input-value');
            const infoArea = document.getElementById('infoArea');
            try {
                const formatted = dumpTextArea.value;
                if (formatted.length > 0) {
                    const minified = JSON.stringify(JSON.parse(formatted));
                    dumpTextArea.value = minified;
                    copyToClipboard(minified, infoArea);
                    infoArea.innerHTML = "JSON Minified and copied to your clipboard";
                } else {
                    infoArea.innerHTML = 'Write some JSON in the textarea.';
                }
            } catch (exc) {
                infoArea.innerHTML = exc.toString();
            }
        });

        $("#callView").click(function () {
            const jsonInput = document.getElementById('input-value').value;
            const infoArea = document.getElementById('infoArea');
            if (jsonInput.length > 0) {
                try {
                    JSON.parse(jsonInput); // Just to validate
                    const port = chrome.runtime.connect({name: 'djson'});
                    port.postMessage({type: "OPEN JSON TAB", json: jsonInput});
                } catch (exc) {
                    infoArea.innerHTML = exc.toString();
                }
            } else {
                infoArea.innerHTML = 'Write some JSON in the textarea.';
            }
        });

        /*
         * Animations
         */
        $(".buttons-2").mouseenter(function () {
            $(this).animate({opacity: 0.8}, 150);
        }).mouseleave(function () {
            $(this).animate({opacity: 0.4}, 300);
        });

        /*
         * Init
         */
        hasher.init();
        hasher.update();

        if (location.search !== "?focusHack") {
            location.search = "?focusHack";
        }
        window.scrollTo(0, 0);
    });
})();