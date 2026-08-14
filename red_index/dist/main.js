import { createEmptyCategory } from "./model.js";
import { loadRedIndexData, saveRedIndexData } from "./storage.js";
import { exportRedIndexJson, importRedIndexJson } from "./json.js";
import { renderEditor, renderPreview } from "./render.js";
/* =========================================================
   Elements
   ========================================================= */
const categoryList = requireElement("category-list", HTMLElement);
const categoryEditorTemplate = requireElement("category-editor-template", HTMLTemplateElement);
const categoryItemTemplate = requireElement("category-item-template", HTMLTemplateElement);
const categoryAddButton = requireElement("category-add-button", HTMLButtonElement);
const jsonImportInput = requireElement("json-import-input", HTMLInputElement);
const jsonImportButton = requireElement("json-import-button", HTMLButtonElement);
const jsonExportButton = requireElement("json-export-button", HTMLButtonElement);
const printButton = requireElement("print-button", HTMLButtonElement);
const redIndexContent = requireElement("red-index-content", HTMLElement);
/* =========================================================
   State
   ========================================================= */
let data = loadRedIndexData();
/* =========================================================
   Editor Configuration
   ========================================================= */
const editorElements = {
    categoryList,
    categoryEditorTemplate,
    categoryItemTemplate
};
/* =========================================================
   Initial Render
   ========================================================= */
/*
 * HTML内に置いてある画面確認用サンプルは
 * 起動時にすべて破棄され、
 * localStorageの内容へ置き換わる。
 */
renderAll();
/* =========================================================
   Change
   ========================================================= */
function handleDataChange() {
    /*
     * 入力のたびに保存。
     *
     * 保存ボタンは存在しない。
     */
    saveRedIndexData(data);
    /*
     * Editor自体は再描画しない。
     *
     * input中に再描画すると
     * フォーカスやカーソル位置が失われるため。
     */
    renderPreview(redIndexContent, data);
}
/* =========================================================
   Add Category
   ========================================================= */
categoryAddButton.addEventListener("click", () => {
    data.categories.push(createEmptyCategory());
    saveRedIndexData(data);
    renderAll();
});
/* =========================================================
   JSON Import Button
   ========================================================= */
jsonImportButton.addEventListener("click", () => {
    jsonImportInput.click();
});
/* =========================================================
   JSON Import
   ========================================================= */
jsonImportInput.addEventListener("change", async () => {
    const file = jsonImportInput.files?.[0];
    /*
     * 同じJSONをもう一度選べるよう、
     * inputの値は毎回最後に空へ戻す。
     */
    if (!file) {
        jsonImportInput.value =
            "";
        return;
    }
    try {
        const importedData = await importRedIndexJson(file);
        data =
            importedData;
        /*
         * インポートした内容も
         * 即座にデフォルト状態として保存。
         */
        saveRedIndexData(data);
        renderAll();
        window.alert("JSONを読み込みました。");
    }
    catch (error) {
        console.error("JSONインポートに失敗しました。", error);
        window.alert(getErrorMessage(error));
    }
    finally {
        jsonImportInput.value =
            "";
    }
});
/* =========================================================
   JSON Export
   ========================================================= */
jsonExportButton.addEventListener("click", () => {
    try {
        exportRedIndexJson(data);
    }
    catch (error) {
        console.error("JSON出力に失敗しました。", error);
        window.alert(getErrorMessage(error));
    }
});
/* =========================================================
   Print
   ========================================================= */
printButton.addEventListener("click", () => {
    /*
     * 印刷直前にも現在状態を保存しておく。
     */
    saveRedIndexData(data);
    /*
     * CSS側の @media print により
     * A4プレビュー部分だけ印刷される。
     */
    window.print();
});
/* =========================================================
   Render All
   ========================================================= */
function renderAll() {
    renderEditor(editorElements, data, handleDataChange);
    renderPreview(redIndexContent, data);
}
/* =========================================================
   Error
   ========================================================= */
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return ("処理中に不明なエラーが発生しました。");
}
function requireElement(id, constructor) {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) {
        throw new Error(`#${id} が見つからないか、要素の種類が正しくありません。`);
    }
    return element;
}
//# sourceMappingURL=main.js.map