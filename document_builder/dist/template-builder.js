import { DOCUMENT_PACKAGE_VERSION, parseDocumentPackage } from "./template.js";
import { downloadTemplateJson } from "./template-import.js";
/* =========================================================
   Setup
   ========================================================= */
export function setupTemplateBuilder(options) {
    /* -----------------------------------------------------
       Views
       ----------------------------------------------------- */
    const dialog = requireElement("#template-settings-dialog");
    const listView = requireElement("#template-list-view");
    const builderView = requireElement("#template-builder-view");
    /* -----------------------------------------------------
       Header
       ----------------------------------------------------- */
    const backButton = requireElement("#template-builder-back-button");
    const closeButton = requireElement("#template-builder-close-button");
    const title = requireElement("#template-builder-title");
    /* -----------------------------------------------------
       Form
       ----------------------------------------------------- */
    const form = requireElement("#template-builder-form");
    const idInput = requireElement("#template-builder-id");
    const idDisplay = requireElement("#template-builder-id-display");
    const nameInput = requireElement("#template-builder-name");
    /* -----------------------------------------------------
       Fields
       ----------------------------------------------------- */
    const fieldsContainer = requireElement("#template-builder-fields");
    const addFieldButton = requireElement("#template-builder-add-field-button");
    const fieldTemplate = requireElement("#template-builder-field-template");
    /* -----------------------------------------------------
       Document
       ----------------------------------------------------- */
    const topLeftInput = requireElement("#template-builder-top-left");
    const topRightInput = requireElement("#template-builder-top-right");
    const openingInput = requireElement("#template-builder-opening");
    const bodyInput = requireElement("#template-builder-body");
    const closingInput = requireElement("#template-builder-closing");
    const endInput = requireElement("#template-builder-end");
    /* -----------------------------------------------------
       Footer
       ----------------------------------------------------- */
    const exportButton = requireElement("#template-builder-export-button");
    const cancelButton = requireElement("#template-builder-cancel-button");
    const saveButton = requireElement("#template-builder-save-button");
    const errorElement = requireElement("#template-builder-error");
    /* -----------------------------------------------------
       State
       ----------------------------------------------------- */
    let mode = "create";
    /* =====================================================
       Views
       ===================================================== */
    function showListView() {
        builderView.hidden =
            true;
        listView.hidden =
            false;
    }
    function showBuilderView() {
        listView.hidden =
            true;
        builderView.hidden =
            false;
    }
    /* =====================================================
       Create
       ===================================================== */
    function openCreate() {
        mode =
            "create";
        resetBuilder();
        const templateId = createTemplateId();
        idInput.value =
            templateId;
        idDisplay.textContent =
            templateId;
        title.textContent =
            "テンプレートを作成";
        saveButton.textContent =
            "テンプレートとして登録";
        /*
         * ビジネス文書で使用頻度の高いものだけ
         * 初期値として置いておく。
         */
        openingInput.value =
            "拝啓";
        closingInput.value =
            "敬具";
        endInput.value =
            "以上";
        /*
         * 最初からfield1を1個作る。
         */
        addField();
        showBuilderView();
        focusLater(nameInput);
    }
    /* =====================================================
       Edit
       ===================================================== */
    function openEdit(template) {
        mode =
            "edit";
        resetBuilder();
        idInput.value =
            template.id;
        idDisplay.textContent =
            template.id;
        nameInput.value =
            template.name;
        for (const field of template.fields) {
            appendFieldRow(field);
        }
        topLeftInput.value =
            template.document.topLeft;
        topRightInput.value =
            template.document.topRight;
        openingInput.value =
            template.document.opening;
        bodyInput.value =
            template.document.body;
        closingInput.value =
            template.document.closing;
        endInput.value =
            template.document.end;
        title.textContent =
            "テンプレートを編集";
        saveButton.textContent =
            "変更を保存";
        showBuilderView();
        focusLater(nameInput);
    }
    /* =====================================================
       Reset
       ===================================================== */
    function resetBuilder() {
        form.reset();
        idInput.value =
            "";
        idDisplay.textContent =
            "";
        fieldsContainer.replaceChildren();
        topLeftInput.value =
            "";
        topRightInput.value =
            "";
        openingInput.value =
            "";
        bodyInput.value =
            "";
        closingInput.value =
            "";
        endInput.value =
            "";
        hideError();
    }
    function reset() {
        mode =
            "create";
        resetBuilder();
        showListView();
    }
    /* =====================================================
       Field Add
       ===================================================== */
    function addField() {
        const fieldId = createNextFieldId();
        appendFieldRow({
            id: fieldId,
            label: "",
            type: "text"
        });
    }
    /* =====================================================
       Field Row
       ===================================================== */
    function appendFieldRow(field) {
        const fragment = fieldTemplate
            .content
            .cloneNode(true);
        const row = fragment.firstElementChild;
        if (!(row instanceof
            HTMLElement)) {
            throw new Error("入力項目編集欄を生成できませんでした。");
        }
        row.dataset.fieldId =
            field.id;
        const id = requireChild(row, ".template-builder-field__id");
        const token = requireChild(row, ".template-builder-field__token");
        const label = requireChild(row, ".template-builder-field__label");
        const type = requireChild(row, ".template-builder-field__type");
        const defaultValue = requireChild(row, ".template-builder-field__default");
        const placeholder = requireChild(row, ".template-builder-field__placeholder");
        const required = requireChild(row, ".template-builder-field__required");
        const removeButton = requireChild(row, ".template-builder-field__remove");
        id.textContent =
            field.id;
        token.textContent =
            `{${field.id}}`;
        label.value =
            field.label;
        type.value =
            field.type;
        defaultValue.value =
            field.defaultValue ??
                "";
        placeholder.value =
            field.placeholder ??
                "";
        required.checked =
            field.required ??
                false;
        removeButton.addEventListener("click", () => {
            row.remove();
        });
        fieldsContainer.appendChild(row);
    }
    /* =====================================================
       Next Field ID
       ===================================================== */
    function createNextFieldId() {
        const usedIds = new Set(Array
            .from(fieldsContainer.querySelectorAll(".template-builder-field"))
            .map((row) => row.dataset.fieldId ??
            ""));
        let number = 1;
        while (usedIds.has(`field${number}`)) {
            number +=
                1;
        }
        return `field${number}`;
    }
    /* =====================================================
       Build Template
       ===================================================== */
    function buildTemplateFromForm() {
        hideError();
        const id = idInput.value.trim();
        const name = nameInput.value.trim();
        if (name.length ===
            0) {
            throw new Error("テンプレート名を入力してください。");
        }
        const fields = readFields();
        /*
         * 一度unknown相当のデータとして組み立て、
         * 既存のJSONパーサーで検証する。
         *
         * これにより、
         * ・ID
         * ・重複field
         * ・存在しない{field}
         * 等もJSONインポートと同じルールになる。
         */
        const packageData = parseDocumentPackage({
            version: DOCUMENT_PACKAGE_VERSION,
            template: {
                id,
                name,
                fields,
                document: {
                    topLeft: topLeftInput.value,
                    topRight: topRightInput.value,
                    opening: openingInput.value,
                    body: bodyInput.value,
                    closing: closingInput.value,
                    end: endInput.value
                }
            }
        });
        return packageData.template;
    }
    /* =====================================================
       Read Fields
       ===================================================== */
    function readFields() {
        const rows = Array.from(fieldsContainer.querySelectorAll(".template-builder-field"));
        return rows.map((row, index) => {
            const id = row.dataset.fieldId;
            if (!id) {
                throw new Error(`入力項目${index + 1}のIDを取得できませんでした。`);
            }
            const label = requireChild(row, ".template-builder-field__label")
                .value
                .trim();
            if (label.length ===
                0) {
                throw new Error(`{${id}} の表示名を入力してください。`);
            }
            const typeValue = requireChild(row, ".template-builder-field__type").value;
            const type = parseFieldType(typeValue);
            const defaultValue = requireChild(row, ".template-builder-field__default").value;
            const placeholder = requireChild(row, ".template-builder-field__placeholder").value;
            const required = requireChild(row, ".template-builder-field__required").checked;
            const field = {
                id,
                label,
                type
            };
            if (defaultValue.length >
                0) {
                field.defaultValue =
                    defaultValue;
            }
            if (placeholder.length >
                0) {
                field.placeholder =
                    placeholder;
            }
            if (required) {
                field.required =
                    true;
            }
            return field;
        });
    }
    /* =====================================================
       Export
       ===================================================== */
    function handleExport() {
        try {
            const template = buildTemplateFromForm();
            downloadTemplateJson(template);
        }
        catch (error) {
            showError(getErrorMessage(error));
        }
    }
    /* =====================================================
       Save
       ===================================================== */
    async function handleSubmit(event) {
        event.preventDefault();
        hideError();
        let template;
        try {
            template =
                buildTemplateFromForm();
        }
        catch (error) {
            showError(getErrorMessage(error));
            return;
        }
        saveButton.disabled =
            true;
        const originalText = saveButton.textContent;
        saveButton.textContent =
            "保存中...";
        try {
            await options.onSave(template, mode);
            resetBuilder();
            showListView();
            options.onReturnToList();
        }
        catch (error) {
            showError(getErrorMessage(error));
        }
        finally {
            saveButton.disabled =
                false;
            saveButton.textContent =
                originalText;
        }
    }
    /* =====================================================
       Leave
       ===================================================== */
    function leaveBuilder() {
        resetBuilder();
        showListView();
        options.onReturnToList();
    }
    /* =====================================================
       Error
       ===================================================== */
    function showError(message) {
        errorElement.textContent =
            message;
        errorElement.hidden =
            false;
    }
    function hideError() {
        errorElement.textContent =
            "";
        errorElement.hidden =
            true;
    }
    /* =====================================================
       Events
       ===================================================== */
    addFieldButton.addEventListener("click", () => {
        addField();
    });
    backButton.addEventListener("click", () => {
        leaveBuilder();
    });
    cancelButton.addEventListener("click", () => {
        leaveBuilder();
    });
    closeButton.addEventListener("click", () => {
        dialog.close();
    });
    exportButton.addEventListener("click", () => {
        handleExport();
    });
    form.addEventListener("submit", (event) => {
        void handleSubmit(event);
    });
    /* =====================================================
       Controller
       ===================================================== */
    return {
        showListView,
        openCreate,
        openEdit,
        reset
    };
}
/* =========================================================
   Template ID
   ========================================================= */
function createTemplateId() {
    const timestamp = Date.now()
        .toString(36);
    const random = Math.random()
        .toString(36)
        .slice(2, 8);
    return (`template-${timestamp}-${random}`);
}
/* =========================================================
   Field Type
   ========================================================= */
function parseFieldType(value) {
    if (value === "text" ||
        value === "textarea" ||
        value === "date") {
        return value;
    }
    throw new Error("入力項目の種類が正しくありません。");
}
/* =========================================================
   Error
   ========================================================= */
function getErrorMessage(error) {
    if (error instanceof
        Error &&
        error.message) {
        return error.message;
    }
    return ("処理に失敗しました。");
}
/* =========================================================
   Focus
   ========================================================= */
function focusLater(element) {
    window.setTimeout(() => {
        element.focus();
    }, 0);
}
/* =========================================================
   DOM
   ========================================================= */
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`${selector} が見つかりません。`);
    }
    return element;
}
function requireChild(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) {
        throw new Error(`${selector} が見つかりません。`);
    }
    return element;
}
//# sourceMappingURL=template-builder.js.map