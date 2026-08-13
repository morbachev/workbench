/**
 * main.ts
 *
 * INVENTORY BATCH のエントリーポイント。
 *
 * このファイルでは以下を担当する。
 *
 * - DOM要素の取得
 * - CSV読込イベント
 * - 出力条件変更イベント
 * - 並び順変更イベント
 * - 各モジュールの接続
 * - 読込件数 / 出力件数 / 印刷枚数 / エラー件数
 * - エラー一覧表示
 * - プレビュー更新
 * - 発行日時更新
 * - 印刷処理
 *
 * CSV解析・業務ロジック・バーコード生成・
 * 商品DOM描画そのものは各専用モジュールへ委譲する。
 */
import { InventoryCsvError, parseInventoryCsv } from "./csv.js";
import { createInventoryOutput } from "./inventory.js";
import { clearInventoryPreview, renderInventoryPreview } from "./render.js";
/* =========================================================
   DOM
   ========================================================= */
const csvFileInput = requireElement("#csv-file-input");
const csvImportButton = requireElement("#csv-import-button");
const selectedFileName = requireElement("#selected-file-name");
/* ---------------------------------------------------------
   集計
   --------------------------------------------------------- */
const loadedCount = requireElement("#loaded-count");
const outputCount = requireElement("#output-count");
const pageCount = requireElement("#page-count");
const errorCount = requireElement("#error-count");
/* ---------------------------------------------------------
   フィルタ
   --------------------------------------------------------- */
const skipNegativeQuantity = requireElement("#skip-negative-quantity");
const skipZeroQuantity = requireElement("#skip-zero-quantity");
/* ---------------------------------------------------------
   並び順
   --------------------------------------------------------- */
const sortOrderInputs = requireElements('input[name="inventory-sort-order"]');
/* ---------------------------------------------------------
   操作
   --------------------------------------------------------- */
const printButton = requireElement("#print-button");
/* ---------------------------------------------------------
   エラー
   --------------------------------------------------------- */
const errorSection = requireElement("#error-section");
const errorList = requireElement("#error-list");
/* ---------------------------------------------------------
   プレビュー
   --------------------------------------------------------- */
const inventoryPreview = requireElement("#inventory-preview");
const inventoryRowTemplate = requireElement("#inventory-row-template");
/* =========================================================
   状態
   ========================================================= */
/**
 * 現在読み込まれているCSVの商品一覧。
 *
 * フィルタ・並び替え適用前の
 * 元データを保持する。
 */
let inventoryItems = [];
/**
 * CSV解析時に発生した行単位エラー。
 */
let csvRowErrors = [];
/**
 * CSVを正常に読み込んだ状態か。
 */
let hasImportedCsv = false;
/* =========================================================
   初期化
   ========================================================= */
initialize();
/**
 * INVENTORY BATCH を初期化する。
 */
function initialize() {
    bindEvents();
    resetSummary();
    clearErrorDisplay();
    clearInventoryPreview(inventoryPreview);
    printButton.disabled =
        true;
}
/* =========================================================
   イベント登録
   ========================================================= */
/**
 * 画面イベントを登録する。
 */
function bindEvents() {
    /* -----------------------------------------------------
       CSV読込
       ----------------------------------------------------- */
    csvImportButton.addEventListener("click", handleCsvImportButtonClick);
    csvFileInput.addEventListener("change", () => {
        void handleCsvFileChange();
    });
    /* -----------------------------------------------------
       数量フィルタ
       ----------------------------------------------------- */
    skipNegativeQuantity.addEventListener("change", handleOutputOptionsChange);
    skipZeroQuantity.addEventListener("change", handleOutputOptionsChange);
    /* -----------------------------------------------------
       並び順
       ----------------------------------------------------- */
    for (const input of sortOrderInputs) {
        input.addEventListener("change", handleOutputOptionsChange);
    }
    /* -----------------------------------------------------
       印刷
       ----------------------------------------------------- */
    printButton.addEventListener("click", handlePrint);
    /**
     * ブラウザメニューや
     * Ctrl / Cmd + Pから印刷された場合にも
     * 発行日時を最新化する。
     */
    window.addEventListener("beforeprint", handleBeforePrint);
}
/* =========================================================
   CSV選択
   ========================================================= */
/**
 * CSV読込ボタン押下。
 */
function handleCsvImportButtonClick() {
    /**
     * 同じファイルを再選択した場合でも
     * changeイベントが発生するよう一度空にする。
     */
    csvFileInput.value =
        "";
    csvFileInput.click();
}
/**
 * CSVファイル選択後。
 */
async function handleCsvFileChange() {
    const file = csvFileInput.files?.[0];
    if (file ===
        undefined) {
        return;
    }
    selectedFileName.textContent =
        file.name;
    await importCsvFile(file);
}
/* =========================================================
   CSV読込
   ========================================================= */
/**
 * CSVを解析して画面へ反映する。
 */
async function importCsvFile(file) {
    setImportingState(true);
    try {
        const result = await parseInventoryCsv(file);
        applyCsvImportResult(result);
        hasImportedCsv =
            true;
        updateOutput();
    }
    catch (error) {
        handleCsvImportError(error);
    }
    finally {
        setImportingState(false);
    }
}
/**
 * CSV解析成功時の結果を内部状態へ保存する。
 */
function applyCsvImportResult(result) {
    inventoryItems =
        result.items;
    csvRowErrors =
        result.errors;
    setCountValue(loadedCount, result.sourceRowCount);
}
/* =========================================================
   出力条件変更
   ========================================================= */
/**
 * フィルタまたは並び順変更時。
 *
 * CSV自体は再読込しない。
 */
function handleOutputOptionsChange() {
    if (!hasImportedCsv) {
        return;
    }
    updateOutput();
}
/* =========================================================
   出力更新
   ========================================================= */
/**
 * 現在のCSVデータと出力設定から
 * プレビュー全体を再生成する。
 */
function updateOutput() {
    const outputOptions = getOutputOptions();
    const output = createInventoryOutput(inventoryItems, outputOptions);
    const renderResult = renderInventoryPreview(output.pages, inventoryPreview, inventoryRowTemplate);
    /* -----------------------------------------------------
       集計
       ----------------------------------------------------- */
    setCountValue(outputCount, output.items.length);
    setCountValue(pageCount, renderResult.pageCount);
    /* -----------------------------------------------------
       エラー
       ----------------------------------------------------- */
    const visibleCsvErrors = filterCsvErrorsByOutputItems(csvRowErrors, output.items);
    const errors = createDisplayErrors(visibleCsvErrors, renderResult.errors);
    renderErrors(errors);
    setCountValue(errorCount, errors.length);
    /* -----------------------------------------------------
       印刷可否
       ----------------------------------------------------- */
    printButton.disabled =
        (output.items.length ===
            0 ||
            renderResult.pageCount ===
                0);
}
/* =========================================================
   出力設定
   ========================================================= */
/**
 * 現在の画面状態を
 * InventoryOutputOptionsへ変換する。
 */
function getOutputOptions() {
    return {
        skipNegativeQuantity: skipNegativeQuantity.checked,
        skipZeroQuantity: skipZeroQuantity.checked,
        sortOrder: getSortOrder()
    };
}
/* =========================================================
   並び順
   ========================================================= */
/**
 * 選択中の並び順を取得する。
 */
function getSortOrder() {
    const selectedInput = sortOrderInputs.find((input) => input.checked);
    if (!selectedInput) {
        return "csv";
    }
    switch (selectedInput.value) {
        case "csv":
            return "csv";
        case "quantity-asc":
            return "quantity-asc";
        case "quantity-desc":
            return "quantity-desc";
        case "jan":
            return "jan";
        case "product-name":
            return "product-name";
        default:
            console.warn("不明な並び順が指定されています。", selectedInput.value);
            return "csv";
    }
}
/* =========================================================
   発行情報
   ========================================================= */
/**
 * 印刷開始直前に全A4ページの
 * 発行日時とページ番号を更新する。
 *
 * 表示例:
 *
 * 2026/08/11 18:13発行 1枚目
 */
function updateIssuedLabels() {
    const issuedAt = new Date();
    const issuedAtText = formatIssuedAt(issuedAt);
    const labels = Array.from(inventoryPreview
        .querySelectorAll(".inventory-page__issued"));
    for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index];
        const pageNumber = label.dataset.pageNumber ??
            String(index +
                1);
        label.textContent =
            `${issuedAtText}発行 ${pageNumber}枚目`;
    }
}
/**
 * 発行日時を
 *
 * YYYY/MM/DD HH:mm
 *
 * 形式へ変換する。
 *
 * ブラウザのローカル時刻を使用する。
 */
function formatIssuedAt(date) {
    const year = date.getFullYear();
    const month = padTwoDigits(date.getMonth() +
        1);
    const day = padTwoDigits(date.getDate());
    const hour = padTwoDigits(date.getHours());
    const minute = padTwoDigits(date.getMinutes());
    return (`${year}/${month}/${day} ${hour}:${minute}`);
}
/**
 * 1桁の数字を
 * 2桁文字列へ変換する。
 */
function padTwoDigits(value) {
    return String(value).padStart(2, "0");
}
/* =========================================================
   印刷
   ========================================================= */
/**
 * 印刷ボタン押下。
 */
function handlePrint() {
    if (printButton.disabled ||
        !hasImportedCsv) {
        return;
    }
    /**
     * window.print()より先に日時を設定する。
     *
     * beforeprintでも再度更新するので、
     * ブラウザによる印刷経路の差にも対応する。
     */
    updateIssuedLabels();
    window.print();
}
/**
 * 印刷直前イベント。
 *
 * Ctrl / Cmd + Pや
 * ブラウザメニュー経由にも対応する。
 */
function handleBeforePrint() {
    if (!hasImportedCsv) {
        return;
    }
    updateIssuedLabels();
}
/* =========================================================
   CSVエラー絞り込み
   ========================================================= */
/**
 * 現在の出力対象になっている行だけ
 * CSVエラーを残す。
 */
function filterCsvErrorsByOutputItems(errors, outputItems) {
    const outputRowNumbers = new Set(outputItems.map((item) => item.rowNumber));
    return errors.filter((error) => outputRowNumbers.has(error.rowNumber));
}
/* =========================================================
   エラー統合
   ========================================================= */
/**
 * CSV由来エラーとバーコード由来エラーを
 * 画面表示用形式へ統合する。
 */
function createDisplayErrors(csvErrors, renderErrors) {
    const errors = [];
    for (const error of csvErrors) {
        errors.push({
            rowNumber: error.rowNumber,
            message: error.message
        });
    }
    for (const error of renderErrors) {
        errors.push({
            rowNumber: error.rowNumber,
            message: error.message
        });
    }
    /**
     * エラー一覧自体は
     * CSV元行番号順。
     */
    errors.sort((first, second) => (first.rowNumber ??
        0) -
        (second.rowNumber ??
            0));
    return errors;
}
/* =========================================================
   エラー表示
   ========================================================= */
/**
 * エラー一覧を画面へ描画する。
 */
function renderErrors(errors) {
    errorList.replaceChildren();
    if (errors.length ===
        0) {
        errorSection.hidden =
            true;
        return;
    }
    const fragment = document.createDocumentFragment();
    for (const error of errors) {
        const listItem = document.createElement("li");
        listItem.textContent =
            error.message;
        fragment.appendChild(listItem);
    }
    errorList.appendChild(fragment);
    errorSection.hidden =
        false;
}
/**
 * エラー表示を初期状態へ戻す。
 */
function clearErrorDisplay() {
    errorList.replaceChildren();
    errorSection.hidden =
        true;
}
/* =========================================================
   CSV読込失敗
   ========================================================= */
/**
 * CSV全体の読込に失敗した場合。
 */
function handleCsvImportError(error) {
    inventoryItems =
        [];
    csvRowErrors =
        [];
    hasImportedCsv =
        false;
    clearInventoryPreview(inventoryPreview);
    resetSummary();
    printButton.disabled =
        true;
    if (error instanceof
        InventoryCsvError) {
        renderErrors([
            {
                message: error.message
            }
        ]);
        return;
    }
    console.error("CSVの読み込みに失敗しました。", error);
    renderErrors([
        {
            message: "CSVの読み込み中に予期しないエラーが発生しました。"
        }
    ]);
}
/* =========================================================
   CSV読込中
   ========================================================= */
/**
 * CSV解析中のUI状態を切り替える。
 */
function setImportingState(importing) {
    csvImportButton.disabled =
        importing;
    if (importing) {
        csvImportButton.setAttribute("aria-busy", "true");
        return;
    }
    csvImportButton.removeAttribute("aria-busy");
}
/* =========================================================
   件数表示
   ========================================================= */
/**
 * 集計表示を初期状態へ戻す。
 */
function resetSummary() {
    setCountValue(loadedCount, 0);
    setCountValue(outputCount, 0);
    setCountValue(pageCount, 0);
    setCountValue(errorCount, 0);
}
/**
 * 件数表示を更新する。
 */
function setCountValue(element, value) {
    const unit = element.querySelector(".inventory-summary__unit");
    if (unit ===
        null) {
        element.textContent =
            String(value);
        return;
    }
    element.textContent =
        String(value);
    element.appendChild(unit);
}
/* =========================================================
   DOMユーティリティ
   ========================================================= */
/**
 * 必須DOM要素を1件取得する。
 */
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (element ===
        null) {
        throw new Error(`必要な要素が見つかりません: ${selector}`);
    }
    return element;
}
/**
 * 必須DOM要素を複数取得する。
 */
function requireElements(selector) {
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length ===
        0) {
        throw new Error(`必要な要素が見つかりません: ${selector}`);
    }
    return elements;
}
//# sourceMappingURL=main.js.map