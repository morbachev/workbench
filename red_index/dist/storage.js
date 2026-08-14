import { cloneRedIndexData, createInitialData, parseRedIndexData } from "./model.js";
/* =========================================================
   Local Storage
   ========================================================= */
const STORAGE_KEY = "workbench.red-index.v1";
/* =========================================================
   Load
   ========================================================= */
export function loadRedIndexData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored ===
            null) {
            return createInitialData();
        }
        const parsed = JSON.parse(stored);
        return parseRedIndexData(parsed);
    }
    catch (error) {
        console.warn("RED INDEXの保存データを読み込めませんでした。", error);
        return createInitialData();
    }
}
/* =========================================================
   Save
   ========================================================= */
/**
 * 入力変更のたびに呼び出す。
 *
 * RED INDEXでは保存ボタンを用意せず、
 * 現在の入力状態を常に保存する。
 */
export function saveRedIndexData(data) {
    try {
        const safeData = cloneRedIndexData(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
    }
    catch (error) {
        console.error("RED INDEXの入力内容を保存できませんでした。", error);
    }
}
//# sourceMappingURL=storage.js.map