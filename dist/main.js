/**
 * main.ts
 *
 * WORKBENCH 親ポータル画面の起動処理。
 *
 * 定型印刷物:
 *
 * IndexedDB
 *     ↓
 * PresetDocument[]
 *     ↓
 * preset-render
 *     ↓
 * カード生成
 *
 * 管理UIはpreset-managerへ委譲する。
 */
import { getPresetDocuments } from "./preset/preset-db.js";
import { renderPresetGrid, renderPresetGridError } from "./preset/preset-render.js";
import { setupPresetManager } from "./preset/preset-manager.js";
/* =========================================================
   DOM
   ========================================================= */
const presetGrid = requireElement("#preset-grid");
/* =========================================================
   Manager
   ========================================================= */
const presetManager = setupPresetManager({
    /**
     * 保存 / 削除などでデータが変わったら
     * メイン画面のカードを再描画する。
     */
    onChanged: refreshPresetGrid
});
/* =========================================================
   Initial Load
   ========================================================= */
void refreshPresetGrid();
/* =========================================================
   Preset Grid
   ========================================================= */
async function refreshPresetGrid() {
    presetGrid.setAttribute("aria-busy", "true");
    try {
        const documents = await getPresetDocuments();
        renderPresetGrid(documents, presetGrid, {
            onAddRequested: () => {
                presetManager
                    .openCreateEditor();
            }
        });
    }
    catch (error) {
        console.error("定型印刷物を読み込めませんでした。", error);
        renderPresetGridError(presetGrid, "このブラウザに保存されている定型印刷物を読み込めませんでした。");
    }
}
/* =========================================================
   DOM Utility
   ========================================================= */
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`必要な要素が見つかりません: ${selector}`);
    }
    return element;
}
//# sourceMappingURL=main.js.map