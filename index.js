// 自动补全标签的逻辑
function autoCompleteTags(text: string): string {
    const tagStack: { tag: string }[] = []; // 用于跟踪未闭合的标签
    const tagRegex = /<(\/?)(\w+)[^>]*>/g; // 匹配标签的正则表达式
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
        const [fullTag, isClosing, tagName] = match;
        if (isClosing) {
            // 如果是闭合标签，检查是否与栈顶的标签匹配
            if (tagStack.length > 0 && tagStack[tagStack.length - 1].tag === tagName) {
                tagStack.pop(); // 匹配成功，弹出栈顶标签
            }
        } else {
            // 如果是开始标签，压入栈中
            tagStack.push({ tag: tagName });
        }
    }

    // 从后往前补全未闭合的标签
    let completedText = text;
    for (let i = tagStack.length - 1; i >= 0; i--) {
        const tag = tagStack[i].tag;
        completedText += `</${tag}>`; // 补全闭合标签
    }

    return completedText;
}

// 自动补全代码块的逻辑
function autoCompleteCodeBlocks(text: string): string {
    const tripleQuoteRegex = /('''|```)/g; // 匹配 ''' 或 ```
    let match: RegExpExecArray | null;
    let openQuotes = 0;

    // 统计未闭合的 ''' 或 ```
    while ((match = tripleQuoteRegex.exec(text)) !== null) {
        if (match[1] === "'''" || match[1] === '```') {
            openQuotes++;
        }
    }

    // 如果未闭合的 ''' 或 ``` 是奇数，补全
    if (openQuotes % 2 !== 0) {
        text += "\n'''"; // 补全 '''
    }

    return text;
}

// 主函数：处理文本补全
function autoCompleteAll(text: string): string {
    // 先补全标签
    let completedText = autoCompleteTags(text);
    // 再补全代码块
    completedText = autoCompleteCodeBlocks(completedText);
    return completedText;
}

// 后端补全：在 AI 输出文本后调用
function handleAIOutput(outputText: string): string {
    return autoCompleteAll(outputText); // 返回补全后的文本
}

// 前端补全：在用户输入时实时调用
function handleUserInput(inputText: string): string {
    return autoCompleteAll(inputText); // 返回补全后的文本
}

// 导出扩展
module.exports = {
    name: 'Autocomplete Extension', // 扩展名称
    description: 'Automatically completes unclosed tags and code blocks for both AI output and user input.', // 扩展描述
    hooks: {
        // 在 AI 输出文本后调用
        aiOutput: (outputText: string): string => {
            return handleAIOutput(outputText);
        }
    },
    // 前端补全逻辑
    init: (app: any): void => { // 使用 `any` 因为 `app` 的类型不清楚，具体可以根据你的应用结构调整类型
        // 监听用户输入事件
        const inputBox = document.getElementById('input-box') as HTMLInputElement | null; // 假设输入框的 ID 是 input-box
        if (inputBox) {
            inputBox.addEventListener('input', (event: Event) => {
                const target = event.target as HTMLInputElement; // 明确 event.target 是 HTMLInputElement
                if (target) {
                    const completedText = handleUserInput(target.value);
                    target.value = completedText; // 更新输入框内容
                }
            });
        }
    }
};
