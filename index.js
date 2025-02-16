import {
    eventSource,
    event_types,
    saveChat,
    saveSettingsDebounced,
} from '../../../../script.js';
import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { POPUP_TYPE, Popup, callGenericPopup } from '../../../popup.js';
import JSON5 from './index.min.mjs'
const VERSION = '1.1.31'

let waitingTable = null
let waitingTableIndex = null
let tablePopup = null
let copyTableData = null
let selectedCell = null
let tableEditActions = []
const userTableEditInfo = {
    chatIndex: null,
    editAble: false,
    tables: null,
    tableIndex: null,
    rowIndex: null,
    colIndex: null,
}
const editErrorInfo = {
    forgotCommentTag: false,
    functionNameError: false,
}

/**
 * 默认插件设置
 */
const defaultSettings = {
    injection_mode: 'deep_system',
    deep: -2,
    message_template: `# dataTable表格
dataTable是一个用于储存故事数据的csv格式表格，可以作为你推演下文的重要参考。推演的下文可以在表格基础上做出发展，并影响表格。
## A. 表格说明及数据
你可以在这里查看所有的表格数据，以及表格的说明和修改表格的触发条件。表格中表名格式为[tableIndex:表名]例如[2:角色特征表格];列名的格式为[colIndex:列名]例如[2:示例列];行名的格式为[rowIndex]。
{{tableData}}
# 增删改dataTable操作方法
当你生成正文后，根据前面所列的增删改触发条件，如果判断数据dataTable中的内容需要增删改，则使用这里的操作方法进行。
注意：
1. 当用户要求修改表格时，用户要求的优先级最高。
2. 使用insertRow函数插入行时，应上帝视角填写所有列，禁止写成未知或者空值。
3. 单元格中，不要出现逗号，语义分割应使用/代替。

## 1. 在某个表格中插入新行，使用insertRow函数：
insertRow(tableIndex:number, data:{[colIndex:number]:string|number})
例如：insertRow(0, {0: '2021-10-01', 1: '12:00', 2: '教室', 3: '悠悠'})
注意：请检查data:{[colIndex:number]:string|number}参数是否包含所有的colIndex，且禁止填写为未知。
## 2. 在某个表格中删除行，使用deleteRow函数：
deleteRow(tableIndex:number, rowIndex:number)
例如：deleteRow(0, 0)
## 3. 在某个表格中更新行，使用updateRow函数：
updateRow(tableIndex:number, rowIndex:number, data:{[colIndex:number]:string|number})
例如：updateRow(0, 0, {3: '惠惠'})

你需要根据【增删改触发条件】对每个表格是否需要增删改进行检视，如果有需要增删改的表格，需要你在<tableEdit>标签中使用js的函数写法调用函数。
注意：标签内需要使用<!-- -->标记进行注释

输出示例：
<tableEdit>
<!--
updateRow(0, 0, {3: '惠惠/悠悠'})
insertRow(1, {1:'悠悠', 1:'身高170/体重60kg/身材娇小/黑色长发', 2:'开朗活泼', 3:'学生', 4:'打羽毛球, 5:'鬼灭之刃', 6:'宿舍', 7:'是运动部部长'})
insertRow(2, {1:'悠悠', 1:'喜欢', 2:'依赖/喜欢', 3:'高'})
insertRow(4, {0: '惠惠/悠悠', 1: '惠惠向悠悠表白', 2: '2021-10-01', 3: '教室',4:'感动'})
-->
</tableEdit>
`,
    tableStructure: [
        {
            tableName: "时空表格", tableIndex: 0, columns: ['日期', '时间', '地点（当前描写）', '此地角色'], columnsIndex: [0, 1, 2, 3], enable: true, Required: true, note: "记录时空信息的表格，应保持在一行",
            initNode: '本轮需要记录当前时间、地点、人物信息，使用insertRow函数', updateNode: "当描写的场景，时间，人物变更时", deleteNode: "此表大于一行时应删除多余行"
        },
        {
            tableName: '角色特征表格', tableIndex: 1, columns: ['角色名', '身体特征', '性格', '职业', '爱好', '喜欢的事物（作品、虚拟人物、物品等）', '住所', '其他重要信息'], enable: true, Required: true, columnsIndex: [0, 1, 2, 3, 4, 5, 6, 7], note: '角色天生或不易改变的特征csv表格，思考本轮有否有其中的角色，他应作出什么反应',
            initNode: '本轮必须从上文寻找已知的所有角色使用insertRow插入，角色名不能为空', insertNode: '当本轮出现表中没有的新角色时，应插入', updateNode: "当角色的身体出现持久性变化时，例如伤痕/当角色有新的爱好，职业，喜欢的事物时/当角色更换住所时/当角色提到重要信息时", deleteNode: ""
        },
        {
            tableName: '角色与<user>社交表格', tableIndex: 2, columns: ['角色名', '对<user>关系', '对<user>态度', '对<user>好感'], columnsIndex: [0, 1, 2, 3], enable: true, Required: true, note: '思考如果有角色和<user>互动，应什么态度',
            initNode: '本轮必须从上文寻找已知的所有角色使用insertRow插入，角色名不能为空', insertNode: '当本轮出现表中没有的新角色时，应插入', updateNode: "当角色和<user>的交互不再符合原有的记录时/当角色和<user>的关系改变时", deleteNode: ""
        },
        {
            tableName: '任务、命令或者约定表格', tableIndex: 3, columns: ['角色', '任务', '地点', '持续时间'], columnsIndex: [0, 1, 2, 3], enable: true, Required: false, note: '思考本轮是否应该执行任务/赴约',
            insertNode: '当特定时间约定一起去做某事时/某角色收到做某事的命令或任务时', updateNode: "", deleteNode: "当大家赴约时/任务或命令完成时/任务，命令或约定被取消时"
        },
        {
            tableName: '重要事件历史表格', tableIndex: 4, columns: ['角色', '事件简述', '日期', '地点', '情绪'], columnsIndex: [0, 1, 2, 3, 4], enable: true, Required: true, note: '记录<user>或角色经历的重要事件',
            initNode: '本轮必须从上文寻找可以插入的事件并使用insertRow插入', insertNode: '当某个角色经历让自己印象深刻的事件时，比如表白、分手等', updateNode: "", deleteNode: ""
        },
        {
            tableName: '重要物品表格', tableIndex: 5, columns: ['拥有人', '物品描述', '物品名', '重要原因'], columnsIndex: [0, 1, 2, 3], enable: true, Required: false, note: '对某人很贵重或有特殊纪念意义的物品',
            insertNode: '当某人获得了贵重或有特殊意义的物品时/当某个已有物品有了特殊意义时', updateNode: "", deleteNode: ""
        },
    ],
    isExtensionAble: true,
};

/**
 * 通过表格索引查找表格结构
 * @param {number} index 表格索引
 * @returns 此索引的表格结构
 */
function findTableStructureByIndex(index) {
    return extension_settings.muyoo_dataTable.tableStructure.find(table => table.tableIndex === index);
}

/**
 * 加载设置
 */
function loadSettings() {
    extension_settings.muyoo_dataTable = extension_settings.muyoo_dataTable || {};
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings.muyoo_dataTable, key)) {
            extension_settings.muyoo_dataTable[key] = defaultSettings[key];
        }
    }
    extension_settings.muyoo_dataTable.message_template = defaultSettings.message_template
    extension_settings.muyoo_dataTable.tableStructure = defaultSettings.tableStructure
    if (!extension_settings.muyoo_dataTable.updateIndex) {
        if (extension_settings.muyoo_dataTable.deep === -3) extension_settings.muyoo_dataTable.deep = -2
        extension_settings.muyoo_dataTable.updateIndex = 1
    }
    $(`#dataTable_injection_mode option[value="${extension_settings.muyoo_dataTable.injection_mode}"]`).attr('selected', true);
    $('#dataTable_deep').val(extension_settings.muyoo_dataTable.deep);
    $('#dataTable_message_template').val(extension_settings.muyoo_dataTable.message_template);
    updateSwitch()
}

/**
 * 更新设置中的开关状态
 */
function updateSwitch() {
    if (extension_settings.muyoo_dataTable.isExtensionAble) {
        $("#table_switch .table-toggle-on").show()
        $("#table_switch .table-toggle-off").hide()
    } else {
        $("#table_switch .table-toggle-on").hide()
        $("#table_switch .table-toggle-off").show()
    }
}

/**
 * 重置设置
 */
function resetSettings() {
    extension_settings.muyoo_dataTable = { ...defaultSettings };
    loadSettings();
    saveSettingsDebounced();
    toastr.success('已重置设置');
}

jQuery(async () => {
    fetch("http://api.muyoo.com.cn/check-version", {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientVersion: VERSION, user: getContext().name1 })
    }).then(res => res.json()).then(res => {
        if (res.success) {
            if (!res.isLatest) $("#tableUpdateTag").show()
            if (res.toastr) toastr.warning(res.toastrText)
            if (res.message) $("#table_message_tip").text(res.message)
        }
    })
    const html = await renderExtensionTemplateAsync('third-party/st-memory-enhancement', 'index');
    const buttonHtml = await renderExtensionTemplateAsync('third-party/st-memory-enhancement', 'buttons');
    const button = `
    <div title="查看表格" class="mes_button open_table_by_id">
        表格
    </div>`;
    $('#data_bank_wand_container').append(buttonHtml);
    $('.extraMesButtons').append(button);
    $('#translation_container').append(html);
    $(document).on('pointerup', '.open_table_by_id', function () {
        try {
            const messageId = $(this).closest('.mes').attr('mesid');
            openTablePopup(parseInt(messageId));
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    });
    loadSettings();
    $('#dataTable_injection_mode').on('change', (event) => {
        extension_settings.muyoo_dataTable.injection_mode = event.target.value;
        saveSettingsDebounced();
    });
    $('#dataTable_message_template').on("input", function () {
        const value = $(this).val();
        extension_settings.muyoo_dataTable.message_template = value;
        saveSettingsDebounced();
    })
    $('#dataTable_deep').on("input", function () {
        const value = $(this).val();
        extension_settings.muyoo_dataTable.deep = value;
        saveSettingsDebounced();
    })
    $("#open_table").on('click', () => openTablePopup());
    $("#reset_settings").on('click', () => resetSettings());
    $("#table_update_button").on('click', updateTablePlugin);
    $(".table-toggle-on").on('click', () => {
        extension_settings.muyoo_dataTable.isExtensionAble = false;
        updateSwitch()
        saveSettingsDebounced();
        toastr.success('插件已关闭，可以打开和编辑表格但不会要求AI生成');
    })
    $(".table-toggle-off").on('click', () => {
        extension_settings.muyoo_dataTable.isExtensionAble = true;
        updateSwitch()
        saveSettingsDebounced();
        toastr.success('插件已开启');
    })
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
    eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageSwiped);
});
