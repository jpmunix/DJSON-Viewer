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
 * This file contains the DOM-building logic for rendering JSON.
 */

"use strict";

var numChildClasses, lineNumber;

// Constants
var
    TYPE_STRING = 1,
    TYPE_NUMBER = 2,
    TYPE_OBJECT = 3,
    TYPE_ARRAY = 4,
    TYPE_BOOL = 5,
    TYPE_NULL = 6
;

// Utility functions
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
        idx = 0
    ;
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

// Template elements
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

// Create template nodes
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

// Core recursive DOM-building function
function getdObjDOM(value, keyName, startCollapsed, isRoot, hideLineNumber) {
    var type,
        dObj,
        nonZeroSize,
        templates = templatesObj, // bring into scope for tiny speed boost
        objKey,
        keySpan,
        valueElement,
        dObjChildLength = 0
    ;

    // Establish value type
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

    // Root node for this dObj
    dObj = templates.t_dObj.cloneNode(false);
    if (!hideLineNumber) {
        dObj.setAttribute('line-number', lineNumber++);
    }

    // Add an 'expander' first (if this is object/array with non-zero size)
    if (type === TYPE_OBJECT || type === TYPE_ARRAY) {
        nonZeroSize = false;
        for (objKey in value) {
            if (value.hasOwnProperty(objKey)) {
                nonZeroSize = true;
                break; // no need to keep counting; only need one
            }
        }
        if (nonZeroSize) {
            dObj.appendChild(templates.t_exp.cloneNode(false));
        }
    }

    // If there's a key, add that before the value
    if (keyName !== false) { // NB: "" is a legal keyname in JSON
        // This dObj must be an object property
        dObj.classList.add('dObjProp');
        // Create a span for the key name
        keySpan = templates.t_key.cloneNode(false);
        keySpan.textContent = JSON.stringify(keyName).slice(1, -1); // remove quotes
        // Add it to dObj, with quote marks
        dObj.appendChild(templates.t_dblqText.cloneNode(false));
        dObj.appendChild(keySpan);
        dObj.appendChild(templates.t_dblqText.cloneNode(false));
        // Also add ":&nbsp;" (colon and non-breaking space)
        dObj.appendChild(templates.t_colonAndSpace.cloneNode(false));
    }
    else {
        // This is an array element instead
        dObj.classList.add('arrElem');
    }

    // Generate DOM for this value
    var blockInner, childdObj;
    switch (type) {
        case TYPE_STRING:
            // If string is a URL, get a link, otherwise get a span
            var innerStringEl = baseSpan.cloneNode(false),
                escapedString = JSON.stringify(value)
            ;
            escapedString = escapedString.substring(1, escapedString.length - 1); // remove quotes
            if (value.charAt(0) === 'h' && value.substring(0, 4) === 'http') { // crude but fast - some false positives, but rare, and UX doesn't suffer terribly from them.
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

            // check if is nested json
            try {
                if( (value.charAt(0) === '{' || value.charAt(0) === '[') && typeof JSON.parse(escapedString.replace(/\\(.)/mg, "$1")) !== "undefined" ) {
                    valueElement.appendChild(templates.t_nested.cloneNode(false));
                }
            } catch (e){}

            dObj.appendChild(valueElement);
            break;

        case TYPE_NUMBER:
            // Simply add a number element (span.n)
            valueElement = templates.t_number.cloneNode(false);
            valueElement.innerText = value;
            dObj.appendChild(valueElement);
            break;

        case TYPE_OBJECT:
            // Add opening brace
            dObj.appendChild(templates.t_oBrace.cloneNode(true));
            // If any properties, add a blockInner containing k/v pair(s)
            if (nonZeroSize) {
                // Add ellipsis (empty, but will be made to do something when dObj is collapsed)
                dObj.appendChild(templates.t_ellipsis.cloneNode(false));
                // Create blockInner, which indents (don't attach yet)
                blockInner = templates.t_blockInner.cloneNode(false);
                // For each key/value pair, add as a dObj to blockInner
                var count = 0, k, comma;
                for (k in value) {
                    if (value.hasOwnProperty(k)) {
                        count++;
                        childdObj = getdObjDOM(value[k], k, startCollapsed, false, hideLineNumber);
                        // Add comma
                        comma = templates.t_commaText.cloneNode(false);
                        childdObj.appendChild(comma);
                        blockInner.appendChild(childdObj);
                    }
                }
                dObjChildLength = count;
                // Now remove the last comma
                childdObj.removeChild(comma);
                // Add blockInner
                dObj.appendChild(blockInner);
            }

            // Add closing brace
            var closingBrace = templates.t_cBrace.cloneNode(true);
            if (nonZeroSize) {
                closingBrace.setAttribute('line-number', lineNumber++);
            }
            dObj.appendChild(closingBrace);
            break;

        case TYPE_ARRAY:
            // Add opening bracket
            dObj.appendChild(templates.t_oBracket.cloneNode(true));
            // If non-zero length array, add blockInner containing inner vals
            if (nonZeroSize) {
                // Add ellipsis
                dObj.appendChild(templates.t_ellipsis.cloneNode(false));
                // Create blockInner (which indents) (don't attach yet)
                blockInner = templates.t_blockInner.cloneNode(false);
                // For each key/value pair, add the markup
                dObjChildLength = value.length;
                for (var i = 0, lastIndex = dObjChildLength - 1; i < dObjChildLength;
                     i++) {
                    // Make a new dObj, with no key
                    childdObj = getdObjDOM(value[i], false, startCollapsed, false, hideLineNumber);
                    // Add comma if not last one
                    if (i < lastIndex) {
                        childdObj.appendChild(templates.t_commaText.cloneNode(false));
                    }
                    // Append the child dObj
                    blockInner.appendChild(childdObj);
                }
                // Add blockInner
                dObj.appendChild(blockInner);
            }
            // Add closing bracket
            var closingBracket = templates.t_cBracket.cloneNode(true);
            if (nonZeroSize) {
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
        if(typeof startCollapsed !== "undefined" && startCollapsed != null && !isRoot) {
            dObj.classList.add('collapsed');
        }
        dObj.classList.add('numChild' + dObjChildLength);
        numChildClasses[dObjChildLength] = 1;
    }

    return dObj;
}

// Function to convert object to an HTML string
function jsonObjToHTML(obj, jsonpFunctionName, startCollapsed, hideLineNumber) {

    lineNumber = jsonpFunctionName === null ? 1 : 2;

    // reset number of children
    numChildClasses = {};

    // Format object (using recursive dObj builder)
    var rootDObj = getdObjDOM(obj, false, startCollapsed, true, hideLineNumber);

    // The whole DOM is now built.

    // Set class on root node to identify it
    rootDObj.classList.add('rootDObj');

    // create gutter for lineNumbers
    var gutterWidth = 1 + (lineNumber.toString().length * 0.5) + 'rem';
    var gutter = document.createElement('div');
    gutter.id = 'gutter';
    gutter.style.width = gutterWidth;

    // Make div#formattedJson and append the root dObj
    var divFormattedJson = document.createElement('DIV');
    divFormattedJson.id = 'formattedJson';
    if (!hideLineNumber) {
        divFormattedJson.style.marginLeft = gutterWidth;
    }
    divFormattedJson.appendChild(rootDObj);

    // Top and tail with JSONP padding if necessary
    if (jsonpFunctionName !== null) {
        divFormattedJson.innerHTML =
            '<div id="jsonpOpener" ' + (!hideLineNumber ? ' line-number="1"' : '') +'>' + jsonpFunctionName + ' ( </div>' +
            divFormattedJson.innerHTML +
            '<div id="jsonpCloser" ' + (!hideLineNumber ? ' line-number="' + lineNumber + '"' : '') +'>)</div>';
    }

    // Return the HTML
    return (!hideLineNumber ? gutter.outerHTML : '') + divFormattedJson.outerHTML;
}

Object.byString = function (o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
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
};
