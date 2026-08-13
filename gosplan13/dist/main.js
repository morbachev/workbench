import { initializeCopyMenu } from "./button.js";
import { compressImageToJpeg } from "./image.js";
import { processJanInput } from "./jan.js";
import { initializeLayout } from "./layout.js";
import { initializeExport, } from "./export.js";
import { initializeImport, } from "./import.js";
import { initializeStorage, } from "./storage.js";
import { initializeClear, } from "./clear.js";
import { initializeDuplicate, } from "./duplicate.js";
/* =========================================================
   定数
   ========================================================= */
/**
 * 生成する商品ラベルの最大数。
 *
 * 画像ありモードではCSSによって25件目以降を非表示にし、
 * 画像なしモードでは48件すべてを表示する。
 *
 * DOMからは削除しないため、
 * モードを切り替えても入力内容は保持される。
 */
const LABEL_COUNT = 48;
/* =========================================================
   DOM要素の取得
   ========================================================= */
/**
 * A4ラベルプレビュー。
 */
const preview = document.querySelector("#a4-preview");
/**
 * 商品ラベル複製用template。
 */
const template = document.querySelector("#product-label-template");
/**
 * 通常の印刷・PDFボタン。
 */
const printButton = document.querySelector("#print-button");
/**
 * 画像あり／画像なしモード切替。
 */
const imageModeToggle = document.querySelector("#image-mode-toggle");
/**
 * プレビュー集中表示へ切り替えるボタン。
 */
const previewFocusButton = document.querySelector("#preview-focus-button");
/**
 * プレビュー集中表示から通常表示へ戻すボタン。
 */
const previewFocusExitButton = document.querySelector("#preview-focus-exit-button");
/**
 * 複製メニューを開閉するボタン。
 */
const copyMenuButton = document.querySelector("#copy-menu-button");
/**
 * 複製操作を表示するメニュー。
 */
const copyMenu = document.querySelector("#copy-menu");
/**
 * JSONエクスポートボタン。
 */
const jsonExportButton = document.querySelector("#json-export-button");
/**
 * JSONインポートボタン。
 */
const jsonImportButton = document.querySelector("#json-import-button");
/**
 * 全クリアボタン。
 */
const clearAllButton = document.querySelector("#clear-all-button");
/**
 * 左上の商品を全体へ複製するボタン。
 */
const duplicateAllButton = document.querySelector("#duplicate-all-button");
/**
 * 1行目を下方向へ複製するボタン。
 */
const duplicateRowButton = document.querySelector("#duplicate-row-button");
/* =========================================================
   必須要素の検証
   ========================================================= */
if (!preview || !template) {
    throw new Error("ラベル生成に必要な要素が見つかりません。");
}
if (!printButton) {
    throw new Error("印刷ボタンが見つかりません。");
}
if (!imageModeToggle ||
    !previewFocusButton ||
    !previewFocusExitButton) {
    throw new Error("レイアウト制御に必要な要素が見つかりません。");
}
if (!copyMenuButton || !copyMenu) {
    throw new Error("複製メニューに必要な要素が見つかりません。");
}
if (!jsonExportButton) {
    throw new Error("JSON出力ボタンが見つかりません。");
}
if (!jsonImportButton) {
    throw new Error("JSONインポートボタンが見つかりません。");
}
if (!clearAllButton) {
    throw new Error("すべてクリアボタンが見つかりません。");
}
if (!duplicateAllButton ||
    !duplicateRowButton) {
    throw new Error("複製ボタンが見つかりません。");
}
/* =========================================================
   商品ラベルの生成
   ========================================================= */
/**
 * 最大48件の商品ラベルを最初に一度だけ生成する。
 *
 * 画像ありモードでもDOMから削除せず、
 * CSSによって25件目以降を非表示にする。
 */
for (let index = 1; index <= LABEL_COUNT; index++) {
    const fragment = template.content.cloneNode(true);
    const productLabel = fragment.querySelector(".product-label");
    if (!productLabel) {
        throw new Error("テンプレート内に.product-labelがありません。");
    }
    /*
     * ラベル番号を内部データとして保持する。
     */
    productLabel.dataset.labelIndex =
        String(index);
    preview.append(fragment);
}
/* =========================================================
   レイアウト機能の初期化
   ========================================================= */
/**
 * 画像モードとプレビュー集中表示を初期化する。
 *
 * layout.tsが担当するもの:
 * - 画像あり／画像なしの切り替え
 * - 集中表示への切り替え
 * - 通常表示への復帰
 * - Escapeキーによる集中表示解除
 */
initializeLayout({
    preview,
    imageModeToggle,
    previewFocusButton,
    previewFocusExitButton
});
/* =========================================================
   JSONインポート
   ========================================================= */
initializeImport({
    preview,
    imageModeToggle,
    importButton: jsonImportButton,
});
/* =========================================================
   JSONエクスポート
   ========================================================= */
initializeExport({
    preview,
    imageModeToggle,
    exportButton: jsonExportButton,
});
/* =========================================================
   自動保存
   ========================================================= */
const storageController = initializeStorage({
    preview,
    imageModeToggle,
});
/* =========================================================
   全クリア
   ========================================================= */
initializeClear({
    preview,
    clearButton: clearAllButton,
    clearStoredData: storageController.clearStorage,
});
/* =========================================================
   複製
   ========================================================= */
/**
 * 実際の複製処理はduplicate.tsへ委譲する。
 *
 * 現在の複製操作:
 * - 左上の商品を全体へ複製
 * - 1行目を下方向へ複製
 */
initializeDuplicate({
    preview,
    imageModeToggle,
    duplicateAllButton,
    duplicateRowButton,
});
/* =========================================================
   複製メニューの初期化
   ========================================================= */
/**
 * 複製メニューの開閉のみを初期化する。
 *
 * 実際の複製処理はduplicate.tsが担当する。
 */
initializeCopyMenu({
    menuButton: copyMenuButton,
    menu: copyMenu,
});
/* =========================================================
   印刷
   ========================================================= */
/**
 * 印刷・PDFボタンを押したときに、
 * ブラウザの印刷ダイアログを表示する。
 */
printButton.addEventListener("click", () => {
    window.print();
});
/* =========================================================
   テキスト入力
   ========================================================= */
/**
 * 商品名・JAN入力欄からフォーカスが外れたときの処理。
 *
 * 各ラベルへ個別にイベントを登録せず、
 * A4プレビューでfocusoutイベントを受け取る。
 */
preview.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
        return;
    }
    const productLabel = target.closest(".product-label");
    if (!productLabel) {
        return;
    }
    if (target.matches(".product-label__jan-input")) {
        handleJanFocusOut(productLabel, target);
        return;
    }
    if (target.matches(".product-label__name-input")) {
        handleNameFocusOut(productLabel, target);
    }
});
/* =========================================================
   画像入力
   ========================================================= */
/**
 * 商品画像が選択されたときの処理。
 *
 * 各file inputへ個別にイベントを登録せず、
 * A4プレビューでchangeイベントを受け取る。
 */
preview.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
        return;
    }
    if (!target.matches(".product-label__image-input")) {
        return;
    }
    const productLabel = target.closest(".product-label");
    if (!productLabel) {
        return;
    }
    /*
     * 非同期処理を開始する。
     *
     * エラー処理はhandleImageChange内部で行う。
     */
    void handleImageChange(productLabel, target);
});
/* =========================================================
   JAN処理
   ========================================================= */
/**
 * JANコード入力欄の値を処理する。
 *
 * JANコードの正規化、検証、画面表示、
 * バーコードSVG描画はjan.tsへ委譲する。
 *
 * @param productLabel 処理対象の商品ラベル
 * @param janInput JANコード入力欄
 */
function handleJanFocusOut(productLabel, janInput) {
    const result = processJanInput(productLabel, janInput);
    if (!result.success) {
        console.warn("JANコード入力エラー", {
            index: productLabel.dataset.labelIndex,
            errorMessage: result.errorMessage
        });
        return;
    }
    if (result.jan === "") {
        return;
    }
}
/* =========================================================
   商品名処理
   ========================================================= */
/**
 * 商品名入力欄の値を処理する。
 *
 * 現在は先頭と末尾の空白を除去し、
 * 入力欄へ反映する。
 *
 * @param productLabel 処理対象の商品ラベル
 * @param nameInput 商品名入力欄
 */
function handleNameFocusOut(productLabel, nameInput) {
    const name = nameInput.value.trim();
    nameInput.value =
        name;
}
/* =========================================================
   画像処理
   ========================================================= */
/**
 * 選択された商品画像をJPEG形式へ変換し、
 * 軽量化されたBase64として商品画像へ反映する。
 *
 * @param productLabel 処理対象の商品ラベル
 * @param imageInput 商品画像のfile入力欄
 */
async function handleImageChange(productLabel, imageInput) {
    const imagePreview = productLabel.querySelector(".product-label__image-preview");
    const imagePlaceholder = productLabel.querySelector(".product-label__image-placeholder");
    if (!imagePreview || !imagePlaceholder) {
        throw new Error("商品画像の表示要素が見つかりません。");
    }
    const file = imageInput.files?.[0];
    if (!file) {
        return;
    }
    try {
        /*
         * 選択された画像を、
         * JPEG形式・800px以内・軽量化済みの
         * Base64へ変換する。
         */
        const compressedImage = await compressImageToJpeg(file);
        /*
         * 画面表示とJSON出力で、
         * 同じBase64データを使用する。
         */
        imagePreview.src =
            compressedImage.base64;
        imagePreview.dataset.imageBase64 =
            compressedImage.base64;
        imagePreview.hidden =
            false;
        imagePlaceholder.hidden =
            true;
    }
    catch (error) {
        console.error("画像の変換に失敗しました。", error);
        /*
         * 同じファイルを再選択できるように、
         * file inputを空へ戻す。
         */
        imageInput.value =
            "";
    }
}
/* =========================================================
   共通モーダル
   ========================================================= */
const appModal = document.querySelector("#app-modal");
const appModalEyebrow = document.querySelector("#app-modal-eyebrow");
const appModalTitle = document.querySelector("#app-modal-title");
const appModalDescription = document.querySelector("#app-modal-description");
const appModalBody = document.querySelector("#app-modal-body");
const appModalFooter = document.querySelector("#app-modal-footer");
const appModalCloseButton = document.querySelector("#app-modal-close-button");
if (!appModal ||
    !appModalEyebrow ||
    !appModalTitle ||
    !appModalDescription ||
    !appModalBody ||
    !appModalFooter ||
    !appModalCloseButton) {
    throw new Error("共通モーダルのHTML要素が見つかりません。");
}
//# sourceMappingURL=main.js.map