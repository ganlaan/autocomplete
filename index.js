// 自动补全标签的逻辑
function autoCompleteTags(text: string): string {
    const tagStack: { tag: string }[] = [];
    const tagRegex = /<(\/?)(\w+)[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
        const [fullTag, isClosing, tagName] = match;
        if (isClosing) {
            if (tagStack.length > 0 && tagStack[tagStack.length - 1].tag === tagName) {
                tagStack.pop();
            }
        } else {
            tagStack.push({ tag: tagName });
        }
    }

    let completedText = text;
    for (let i = tagStack.length - 1; i >= 0; i--) {
        const tag = tagStack[i].tag;
        completedText += `</${tag}>`;
    }

    return completedText;
}

// 自动补全代码块的逻辑
function autoCompleteCodeBlocks(text: string): string {
    const tripleQuoteRegex = /('''|```)/g;
    let match: RegExpExecArray | null;
    let openQuotes = 0;

    while ((match = tripleQuoteRegex.exec(text)) !== null) {
        if (match[1] === "'''" || match[1] === '```') {
            openQuotes++;
        }
    }

    if (openQuotes % 2 !== 0) {
        text += "\n'''";
    }

    return text;
}

// 主函数：处理文本补全
function autoCompleteAll(text: string): string {
    if (!extension_settings.autocomplete.enabled) {
        return text;
    }

    let completedText = text;

    if (extension_settings.autocomplete.mode === 'auto') {
        completedText = autoCompleteTags(completedText);
        completedText = autoCompleteCodeBlocks(completedText);
    }

    return completedText;
}

// 加载设置
function loadSettings() {
    extension_settings.autocomplete = extension_settings.autocomplete || {
        mode: 'auto',
        enabled: true
    };

    const modeSelect = document.getElementById('autocomplete-mode') as HTMLSelectElement;
    const toggleCheckbox = document.getElementById('autocomplete-toggle') as HTMLInputElement;

    if (modeSelect) {
        modeSelect.value = extension_settings.autocomplete.mode;
    }
    if (toggleCheckbox) {
        toggleCheckbox.checked = extension_settings.autocomplete.enabled;
    }

    updateSwitch();
}

// 保存设置
function saveSettings() {
    if (typeof saveSettingsToServer === 'function') {
        saveSettingsToServer(extension_settings);
    }
}

// 更新开关状态
function updateSwitch() {
    const toggleCheckbox = document.getElementById('autocomplete-toggle') as HTMLInputElement;
    if (toggleCheckbox) {
        if (extension_settings.autocomplete.enabled) {
            toggleCheckbox.checked = true;
            console.log('补全功能已启用');
        } else {
            toggleCheckbox.checked = false;
            console.log('补全功能已禁用');
        }
    }
}

// 导出扩展
module.exports = {
    name: 'Autocomplete Extension',
    description: 'Automatically completes unclosed tags and code blocks for both AI output and user input.',
    hooks: {
        aiOutput: (outputText: string): string => {
            return autoCompleteAll(outputText);
        }
    },
    init: (app: any): void => {
        const uiContainer = document.createElement('div');
        uiContainer.id = 'autocomplete-extension-ui';
        uiContainer.innerHTML = `
            <label for="autocomplete-mode">补全模式：</label>
            <select id="autocomplete-mode">
                <option value="auto">自动</option>
                <option value="manual">手动</option>
            </select>

            <label for="autocomplete-toggle">启用补全：</label>
            <input type="checkbox" id="autocomplete-toggle">
        `;
        document.body.appendChild(uiContainer);

        const modeSelect = document.getElementById('autocomplete-mode') as HTMLSelectElement;
        const toggleCheckbox = document.getElementById('autocomplete-toggle') as HTMLInputElement;

        loadSettings();

        modeSelect.addEventListener('change', (event: Event) => {
            const selectedMode = (event.target as HTMLSelectElement).value;
            extension_settings.autocomplete.mode = selectedMode;
            saveSettings();
        });

        toggleCheckbox.addEventListener('change', (event: Event) => {
            const isEnabled = (event.target as HTMLInputElement).checked;
            extension_settings.autocomplete.enabled = isEnabled;
            saveSettings();
            updateSwitch();
        });

        const inputBox = document.getElementById('input-box') as HTMLInputElement | null;
        if (inputBox) {
            inputBox.addEventListener('input', (event: Event) => {
                const target = event.target as HTMLInputElement;
                if (target && extension_settings.autocomplete.enabled) {
                    const completedText = handleUserInput(target.value);
                    target.value = completedText;
                }
            });
        }
    }
};
