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

(function () {

    "use strict";

    var supportedThemes = ["default", "monokai", "xcode", "solarized", "darkorange", "halewa"];
    var themeChooserSelectContainer = document.getElementById("themeChooserSelectContainer");
    var themeChooserSelect = themeChooserSelectContainer.firstElementChild;
    var themeChooserPreview = document.getElementById("themeChooserPreview");

    function setTheme(themeName) {
        themeChooserPreview.setAttribute('data-theme', themeName);
        chrome.storage.local.set({theme: themeName});
    }

    function handleCheckboxChange(key, checkbox) {
        var update = {};
        update[key] = checkbox.checked;
        chrome.storage.local.set(update);
    }

    chrome.storage.local.get({
        theme: null,
        startCollapsed: false,
        startCollapsedIfBig: false,
        showAlwaysCount: false,
        hideLineNumbers: false
    }, function (items) {
        supportedThemes.forEach(function (themeName) {
            var option = document.createElement('option');
            option.value = themeName;
            option.innerText = themeName;
            if(items.theme && items.theme === themeName){
                option.selected = 'selected';
                themeChooserPreview.setAttribute('data-theme', themeName);
            }
            themeChooserSelect.appendChild(option);
        });

        themeChooserSelect.addEventListener('change', function () {
            var selectedTheme = this.options[this.selectedIndex].value;
            setTheme(selectedTheme);
        });

        function optionInit(checkBoxId, storageKey) {
            var checkbox = document.getElementById(checkBoxId);
            if(items[storageKey]){
                checkbox.checked = true;
            }
            checkbox.addEventListener('click', function () {
                handleCheckboxChange(storageKey, checkbox);
            });
        }

        optionInit("startCollapsedCheckbox", "startCollapsed");
        optionInit("startCollapsedIfBigCheckbox", "startCollapsedIfBig");
        optionInit("showAlwaysCountCheckbox", "showAlwaysCount");
        optionInit("hideLineNumbersCheckbox", "hideLineNumbers");
    });

})();
