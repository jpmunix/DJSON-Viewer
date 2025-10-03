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

(function (root) {

    "use strict";

    var lineNumber = 1,
        numChildClasses = {};

    var TYPE_STRING = 1,
        TYPE_NUMBER = 2,
        TYPE_OBJECT = 3,
        TYPE_ARRAY = 4,
        TYPE_BOOL = 5,
        TYPE_NULL = 6;

    var baseSpan = document.createElement('span');

    function getSpanBoth(innerText, className) {
        var span = baseSpan.cloneNode(false);
        span.className = className;
        span.innerText = innerText;
        return span;
    }

    function getSpanClass(className) {
        var span = baseSpan.cloneNode(false);
        span.className = className;
        return span;
    }

    var templatesObj = {
        t_dObj: getSpanClass('dObj'),
        t_exp: getSpanClass('expander'),
        t_key: getSpanClass('key'),
        t_string: getSpanClass('s'),
        t_number: getSpanClass('n'),
        t_nested: getSpanClass('nested'),

        t_null: getSpanBoth('null', 'nl'),
        t_true: getSpanBoth('true', 'bl'),
        t_false: getSpanBoth('false', 'bl'),

        t_oBrace: getSpanBoth('{', 'b'),
        t_cBrace: getSpanBoth('}', 'b lastB'),
        t_oBracket: getSpanBoth('[', 'b'),
        t_cBracket: getSpanBoth(']', 'b lastB'),

        t_ellipsis: getSpanClass('ellipsis'),
        t_blockInner: getSpanClass('blockInner'),

        t_colonAndSpace: document.createTextNode(':\u00A0'),
        t_commaText: document.createTextNode(','),
        t_dblqText: document.createTextNode('"')
    };

    function getdObjDOM(value, keyName, startCollapsed, isRoot, hideLineNumber) {
        var type,
            dObj,
            nonZeroSize,
            templates = templatesObj,
            objKey,
            keySpan,
            valueElement,
            dObjChildLength = 0;

        if (typeof value === 'string') {
            type = TYPE_STRING;
        } else if (typeof value === 'number') {
            type = TYPE_NUMBER;
        } else if (value === false || value === true) {
            type = TYPE_BOOL;
        } else if (value === null) {
            type = TYPE_NULL;
        } else if (value instanceof Array) {
            type = TYPE_ARRAY;
        } else {
            type = TYPE_OBJECT;
        }

        dObj = templates.t_dObj.cloneNode(false);
        if (!hideLineNumber) {
            dObj.setAttribute('line-number', lineNumber++);
        }

        if (type === TYPE_OBJECT || type === TYPE_ARRAY) {
            nonZeroSize = false;
            for (objKey in value) {
                if (value.hasOwnProperty(objKey)) {
                    nonZeroSize = true;
                    break;
                }
            }
            if (nonZeroSize) {
                dObj.appendChild(templates.t_exp.cloneNode(false));
            }
        }

        if (keyName !== false) {
            dObj.classList.add('dObjProp');
            keySpan = templates.t_key.cloneNode(false);
            keySpan.textContent = JSON.stringify(keyName).slice(1, -1);
            dObj.appendChild(templates.t_dblqText.cloneNode(false));
            dObj.appendChild(keySpan);
            dObj.appendChild(templates.t_dblqText.cloneNode(false));
            dObj.appendChild(templates.t_colonAndSpace.cloneNode(false));
        } else {
            dObj.classList.add('arrElem');
        }

        var blockInner, childdObj;
        switch (type) {
            case TYPE_STRING:
                var innerStringEl = baseSpan.cloneNode(false),
                    escapedString = JSON.stringify(value);
                escapedString = escapedString.substring(1, escapedString.length - 1);
                if (value.charAt(0) === 'h' && value.substring(0, 4) === 'http') {
                    var innerStringA = document.createElement('A');
                    innerStringA.href = value;
                    innerStringA.innerText = escapedString;
                    innerStringEl.appendChild(innerStringA);
                }
                else {
                    innerStringEl.innerText = escapedString;
                }
                valueElement = templates.t_string.cloneNode(false);
                valueElement.appendChild(templates.t_dblqText.cloneNode(false));
                valueElement.appendChild(innerStringEl);
                valueElement.appendChild(templates.t_dblqText.cloneNode(false));

                try {
                    if ((value.charAt(0) === '{' || value.charAt(0) === '[') && typeof JSON.parse(escapedString.replace(/\\(.)/mg, "$1")) !== "undefined") {
                        valueElement.appendChild(templates.t_nested.cloneNode(false));
                    }
                } catch (e) {}

                dObj.appendChild(valueElement);
                break;

            case TYPE_NUMBER:
                valueElement = templates.t_number.cloneNode(false);
                valueElement.innerText = value;
                dObj.appendChild(valueElement);
                break;

            case TYPE_OBJECT:
                dObj.appendChild(templates.t_oBrace.cloneNode(true));
                if (typeof nonZeroSize === 'undefined') {
                    nonZeroSize = false;
                    for (objKey in value) {
                        if (value.hasOwnProperty(objKey)) {
                            nonZeroSize = true;
                            break;
                        }
                    }
                }
                if (nonZeroSize) {
                    dObj.appendChild(templates.t_ellipsis.cloneNode(false));
                    blockInner = templates.t_blockInner.cloneNode(false);
                    var count = 0, k, comma;
                    for (k in value) {
                        if (value.hasOwnProperty(k)) {
                            count++;
                            childdObj = getdObjDOM(value[k], k, startCollapsed, false, hideLineNumber);
                            comma = templates.t_commaText.cloneNode(false);
                            childdObj.appendChild(comma);
                            blockInner.appendChild(childdObj);
                        }
                    }
                    dObjChildLength = count;
                    childdObj.removeChild(comma);
                    dObj.appendChild(blockInner);
                }

                var closingBrace = templates.t_cBrace.cloneNode(true);
                if (nonZeroSize) {
                    closingBrace.setAttribute('line-number', lineNumber++);
                }
                dObj.appendChild(closingBrace);
                break;

            case TYPE_ARRAY:
                dObj.appendChild(templates.t_oBracket.cloneNode(true));
                if (value.length) {
                    dObj.appendChild(templates.t_ellipsis.cloneNode(false));
                    blockInner = templates.t_blockInner.cloneNode(false);
                    dObjChildLength = value.length;
                    for (var i = 0, lastIndex = dObjChildLength - 1; i < dObjChildLength; i++) {
                        childdObj = getdObjDOM(value[i], false, startCollapsed, false, hideLineNumber);
                        if (i < lastIndex) {
                            childdObj.appendChild(templates.t_commaText.cloneNode(false));
                        }
                        blockInner.appendChild(childdObj);
                    }
                    dObj.appendChild(blockInner);
                }
                var closingBracket = templates.t_cBracket.cloneNode(true);
                if (value.length) {
                    closingBracket.setAttribute('line-number', lineNumber++);
                }
                dObj.appendChild(closingBracket);
                break;

            case TYPE_BOOL:
                if (value) {
                    dObj.appendChild(templates.t_true.cloneNode(true));
                } else {
                    dObj.appendChild(templates.t_false.cloneNode(true));
                }
                break;

            case TYPE_NULL:
                dObj.appendChild(templates.t_null.cloneNode(true));
                break;
        }

        if (dObjChildLength > 0) {
            if (startCollapsed && !isRoot) {
                dObj.classList.add('collapsed');
            }
            dObj.classList.add('numChild' + dObjChildLength);
            numChildClasses[dObjChildLength] = 1;
        }

        return dObj;
    }

    function jsonObjToHTML(obj, jsonpFunctionName, startCollapsed, hideLineNumber) {
        lineNumber = jsonpFunctionName === null ? 1 : 2;
        numChildClasses = {};
        var rootDObj = getdObjDOM(obj, false, startCollapsed, true, hideLineNumber);
        rootDObj.classList.add('rootDObj');

        var gutterWidth = 1 + (lineNumber.toString().length * 0.5) + 'rem';
        var gutter = document.createElement('div');
        gutter.id = 'gutter';
        gutter.style.width = gutterWidth;

        var divFormattedJson = document.createElement('DIV');
        divFormattedJson.id = 'formattedJson';
        if (!hideLineNumber) {
            divFormattedJson.style.marginLeft = gutterWidth;
        }
        divFormattedJson.appendChild(rootDObj);

        if (jsonpFunctionName !== null) {
            divFormattedJson.innerHTML =
                '<div id="jsonpOpener" ' + (!hideLineNumber ? ' line-number="1"' : '') + '>' + jsonpFunctionName + ' ( </div>' +
                divFormattedJson.innerHTML +
                '<div id="jsonpCloser" ' + (!hideLineNumber ? ' line-number="' + lineNumber + '"' : '') + '>)</div>';
        }

        return {
            html: (!hideLineNumber ? gutter.outerHTML : '') + divFormattedJson.outerHTML,
            numChildClasses: Object.keys(numChildClasses)
        };
    }

    function shouldStartCollapsed(options) {
        var startCollapsed = options.startCollapsed === true;
        if (!startCollapsed && options.startCollapsedIfBig && options.textLength) {
            startCollapsed = options.textLength > 1000000;
        }
        return startCollapsed;
    }

    root.DJSONFormatter = {
        format: function (obj, jsonpFunctionName, options) {
            options = options || {};
            var startCollapsed = shouldStartCollapsed(options);
            var hideLineNumber = options.hideLineNumbers === true;
            return jsonObjToHTML(obj, jsonpFunctionName, startCollapsed, hideLineNumber);
        }
    };

})(typeof window !== 'undefined' ? window : this);
