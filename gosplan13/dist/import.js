/**
 * import.ts
 *
 * GOSPLAN13でExportしたJSONファイルを読み込み、
 * 画面上の入力状態を復元する。
 *
 * 復元するもの:
 * - 画像あり / 画像なしモード
 * - 全ラベルの商品名
 * - 全ラベルのJANコード
 * - 全ラベルの商品画像（Base64 Data URL）
 *
 * labels配列の位置 = 画面上のラベル位置として扱う。
 *
 * Import時にデータを詰めたり、
 * 空欄を削除したりしてはいけない。
 */
/* =========================================================
   定数
   ========================================================= */
const SUPPORTED_APP_NAME = "GOSPLAN13";
const SUPPORTED_VERSION = 1;
/* =========================================================
   汎用型判定
   ========================================================= */
function isObject(value) {
    return (typeof value === "object"
        && value !== null
        && !Array.isArray(value));
}
/* =========================================================
   ラベルデータ検証
   ========================================================= */
function isExportLabelData(value) {
    if (!isObject(value)) {
        return false;
    }
    if (typeof value.name !== "string") {
        return false;
    }
    if (typeof value.jan !== "string") {
        return false;
    }
    if (value.image !== null
        && typeof value.image !== "string") {
        return false;
    }
    /*
     * 画像が存在する場合は、
     * GOSPLAN13がExportするData URL形式のみ許可する。
     */
    if (typeof value.image === "string"
        && value.image !== ""
        && !value.image.startsWith("data:image/")) {
        return false;
    }
    return true;
}
/* =========================================================
   JSON全体検証
   ========================================================= */
function validateImportData(value) {
    if (!isObject(value)) {
        throw new Error("JSONの形式が正しくありません。");
    }
    if (value.app !==
        SUPPORTED_APP_NAME) {
        throw new Error("GOSPLAN13で作成されたJSONではありません。");
    }
    if (value.version !==
        SUPPORTED_VERSION) {
        throw new Error(`対応していないJSONバージョンです。`
            + ` version: ${String(value.version)}`);
    }
    if (typeof value.exportedAt
        !== "string") {
        throw new Error("JSONの出力日時が不正です。");
    }
    if (!isObject(value.settings)) {
        throw new Error("JSONの設定情報が不正です。");
    }
    if (typeof value.settings.imageMode
        !== "boolean") {
        throw new Error("画像モードの設定が不正です。");
    }
    if (!Array.isArray(value.labels)) {
        throw new Error("ラベル情報が見つかりません。");
    }
    if (!value.labels.every(isExportLabelData)) {
        throw new Error("ラベル情報の形式が正しくありません。");
    }
    /*
     * ここまで検証できたため、
     * GOSPLAN13 v1のExportデータとして扱える。
     */
    return value;
}
/* =========================================================
   JSONファイル読込
   ========================================================= */
async function readJsonFile(file) {
    const text = await file.text();
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error("JSONファイルを読み取れませんでした。");
    }
}
/* =========================================================
   ラベルDOM取得
   ========================================================= */
function getProductLabels(preview) {
    return Array.from(preview.querySelectorAll(".product-label"));
}
/* =========================================================
   入力イベント通知
   ========================================================= */
/**
 * JANをプログラムから変更した場合でも、
 * main.ts側の既存処理へ変更を通知する。
 *
 * 現在のGOSPLAN13では入力欄のchange / focusoutを
 * 利用してJAN描画などを行うため、
 * 両方を発火する。
 */
function notifyInputChanged(input) {
    input.dispatchEvent(new Event("input", {
        bubbles: true,
    }));
    input.dispatchEvent(new Event("change", {
        bubbles: true,
    }));
    input.dispatchEvent(new FocusEvent("focusout", {
        bubbles: true,
    }));
}
/* =========================================================
   商品名復元
   ========================================================= */
function restoreLabelName(label, value) {
    const input = label.querySelector(".product-label__name-input");
    if (!input) {
        throw new Error("商品名入力欄が見つかりません。");
    }
    input.value =
        value;
    notifyInputChanged(input);
}
/* =========================================================
   JAN復元
   ========================================================= */
function restoreLabelJan(label, value) {
    const input = label.querySelector(".product-label__jan-input");
    if (!input) {
        throw new Error("JAN入力欄が見つかりません。");
    }
    input.value =
        value;
    /*
     * JANバーコードの再描画を
     * main.ts側へ通知する。
     */
    notifyInputChanged(input);
}
/* =========================================================
   商品画像復元
   ========================================================= */
function restoreLabelImage(label, imageDataUrl) {
    const imageInput = label.querySelector(".product-label__image-input");
    const imagePreview = label.querySelector(".product-label__image-preview");
    const imagePlaceholder = label.querySelector(".product-label__image-placeholder");
    if (!imageInput) {
        throw new Error("商品画像入力欄が見つかりません。");
    }
    if (!imagePreview) {
        throw new Error("商品画像プレビューが見つかりません。");
    }
    if (!imagePlaceholder) {
        throw new Error("商品画像プレースホルダーが見つかりません。");
    }
    /*
     * File inputへプログラムからファイルを
     * セットすることはできないため、
     * Import時には選択状態をクリアする。
     */
    imageInput.value = "";
    if (imageDataUrl === null
        || imageDataUrl === "") {
        imagePreview.removeAttribute("src");
        imagePreview.hidden =
            true;
        imagePlaceholder.hidden =
            false;
        return;
    }
    /*
     * Export時に保存した加工済みBase64画像を
     * そのままプレビューへ復元する。
     */
    imagePreview.src =
        imageDataUrl;
    imagePreview.hidden =
        false;
    imagePlaceholder.hidden =
        true;
}
/* =========================================================
   1面分を復元
   ========================================================= */
function restoreLabel(label, data) {
    restoreLabelName(label, data.name);
    restoreLabelJan(label, data.jan);
    restoreLabelImage(label, data.image);
}
/* =========================================================
   空ラベル生成
   ========================================================= */
/**
 * 将来的にラベル数が増えた場合や、
 * 古いJSONが現在より少ない面数だった場合に、
 * 残りを空欄として扱う。
 */
function createEmptyLabelData() {
    return {
        name: "",
        jan: "",
        image: null,
    };
}
/* =========================================================
   画面状態を復元
   ========================================================= */
export function restoreImportData(data, preview, imageModeToggle) {
    const labels = getProductLabels(preview);
    if (labels.length === 0) {
        throw new Error("復元先のラベルが見つかりません。");
    }
    /*
     * 現在の画面よりJSON側のラベル数が多い場合は、
     * 意図せずデータを捨てる可能性があるため拒否する。
     */
    if (data.labels.length
        > labels.length) {
        throw new Error("このJSONには、現在の画面で扱える数を超えるラベルが保存されています。");
    }
    /*
     * まず画像モードを復元する。
     *
     * checkbox.checkedを書き換えるだけでは
     * layout.tsへ伝わらないためchangeを発火する。
     */
    imageModeToggle.checked =
        data.settings.imageMode;
    imageModeToggle.dispatchEvent(new Event("change", {
        bubbles: true,
    }));
    /*
     * 位置を維持したまま復元する。
     *
     * JSON側に存在しない後方ラベルは
     * 空欄へ戻す。
     */
    labels.forEach((label, index) => {
        const labelData = data.labels[index]
            ?? createEmptyLabelData();
        restoreLabel(label, labelData);
    });
}
/* =========================================================
   Import処理
   ========================================================= */
export async function importFromFile(file, preview, imageModeToggle) {
    /*
     * すべて検証してから画面へ適用する。
     *
     * JSONが壊れている場合、
     * 現在の入力内容を途中まで破壊しないため。
     */
    const json = await readJsonFile(file);
    const data = validateImportData(json);
    restoreImportData(data, preview, imageModeToggle);
}
/* =========================================================
   ファイル選択input生成
   ========================================================= */
function createFileInput() {
    const input = document.createElement("input");
    input.type =
        "file";
    input.accept =
        ".json,application/json";
    /*
     * UIとして表示する必要はない。
     * JSONインポートボタンからのみ使用する。
     */
    input.hidden =
        true;
    return input;
}
/* =========================================================
   初期化
   ========================================================= */
export function initializeImport(elements) {
    const { preview, imageModeToggle, importButton, } = elements;
    const fileInput = createFileInput();
    document.body.append(fileInput);
    /*
     * リボンのJSONインポートボタンを押したら
     * OSのファイル選択画面を開く。
     */
    importButton.addEventListener("click", () => {
        /*
         * 同じJSONを連続して選択した場合でも
         * changeイベントが発生するようクリアする。
         */
        fileInput.value =
            "";
        fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) {
            return;
        }
        try {
            await importFromFile(file, preview, imageModeToggle);
        }
        catch (error) {
            console.error("JSONの読み込みに失敗しました。", error);
            const message = error instanceof Error
                ? error.message
                : "不明なエラーが発生しました。";
            /*
             * 現時点では専用Toastがないため、
             * Import失敗だけalertで通知する。
             *
             * 将来Toastを実装した場合は
             * ここを置き換えればよい。
             */
            window.alert(`JSONを読み込めませんでした。\n\n${message}`);
        }
        finally {
            fileInput.value =
                "";
        }
    });
}
//# sourceMappingURL=import.js.map