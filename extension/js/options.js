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

    const supportedThemes = ["default", "monokai", "xcode", "solarized", "darkorange", "halewa"];
    const themeChooserSelect = document.getElementById("themeChooserSelectContainer").firstElementChild;
    const themeChooserPreview = document.getElementById("themeChooserPreview");

    // Load theme from storage and populate the select box
    chrome.storage.local.get("theme", function (data) {
        const currentTheme = data.theme;
        supportedThemes.forEach(function (themeName) {
            const option = document.createElement('option');
            option.value = themeName;
            option.innerText = themeName;
            if (currentTheme && currentTheme === themeName) {
                option.selected = 'selected';
                themeChooserPreview.setAttribute('data-theme', themeName);
            }
            themeChooserSelect.appendChild(option);
        });
    });

    // Save theme choice to storage on change
    themeChooserSelect.addEventListener('change', function () {
        const selectedTheme = this.options[this.selectedIndex].value;
        themeChooserPreview.setAttribute('data-theme', selectedTheme);
        chrome.storage.local.set({ "theme": selectedTheme });
    });

    // Initialize a checkbox option
    function optionInit(checkBoxId) {
        const checkbox = document.getElementById(checkBoxId);
        const settingName = checkBoxId.replace("Checkbox", "");

        // Load setting from storage
        chrome.storage.local.get(settingName, function(data) {
            if (data[settingName]) {
                checkbox.checked = true;
            }
        });

        // Save setting to storage on click
        checkbox.addEventListener('click', function () {
            const setting = {};
            setting[settingName] = checkbox.checked;
            chrome.storage.local.set(setting);
        });
    }

    // Initialize all options
    optionInit("startCollapsedCheckbox");
    optionInit("startCollapsedIfBigCheckbox");
    optionInit("showAlwaysCountCheckbox");
    optionInit("hideLineNumbersCheckbox");

})();