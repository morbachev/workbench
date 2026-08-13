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

import {
    InventoryCsvError,
    parseInventoryCsv
} from "./csv.js";

import type {
    CsvImportResult,
    CsvRowError
} from "./csv.js";

import {
    createInventoryOutput
} from "./inventory.js";

import type {
    InventoryItem,
    InventoryOutputOptions,
    InventorySortOrder
} from "./inventory.js";

import {
    clearInventoryPreview,
    renderInventoryPreview
} from "./render.js";

import type {
    InventoryRenderError
} from "./render.js";


/* =========================================================
   型定義
   ========================================================= */

/**
 * 画面に表示するエラー。
 *
 * CSV由来・バーコード由来・
 * CSV全体の読込失敗を同じ形式で扱う。
 */
type DisplayError = {
    rowNumber?: number;
    message: string;
};


/* =========================================================
   DOM
   ========================================================= */

const csvFileInput =
    requireElement<HTMLInputElement>(
        "#csv-file-input"
    );


const csvImportButton =
    requireElement<HTMLButtonElement>(
        "#csv-import-button"
    );


const selectedFileName =
    requireElement<HTMLElement>(
        "#selected-file-name"
    );


/* ---------------------------------------------------------
   集計
   --------------------------------------------------------- */

const loadedCount =
    requireElement<HTMLElement>(
        "#loaded-count"
    );


const outputCount =
    requireElement<HTMLElement>(
        "#output-count"
    );


const pageCount =
    requireElement<HTMLElement>(
        "#page-count"
    );


const errorCount =
    requireElement<HTMLElement>(
        "#error-count"
    );


/* ---------------------------------------------------------
   フィルタ
   --------------------------------------------------------- */

const skipNegativeQuantity =
    requireElement<HTMLInputElement>(
        "#skip-negative-quantity"
    );


const skipZeroQuantity =
    requireElement<HTMLInputElement>(
        "#skip-zero-quantity"
    );


/* ---------------------------------------------------------
   並び順
   --------------------------------------------------------- */

const sortOrderInputs =
    requireElements<HTMLInputElement>(
        'input[name="inventory-sort-order"]'
    );


/* ---------------------------------------------------------
   操作
   --------------------------------------------------------- */

const printButton =
    requireElement<HTMLButtonElement>(
        "#print-button"
    );


/* ---------------------------------------------------------
   エラー
   --------------------------------------------------------- */

const errorSection =
    requireElement<HTMLElement>(
        "#error-section"
    );


const errorList =
    requireElement<HTMLUListElement>(
        "#error-list"
    );


/* ---------------------------------------------------------
   プレビュー
   --------------------------------------------------------- */

const inventoryPreview =
    requireElement<HTMLElement>(
        "#inventory-preview"
    );


const inventoryRowTemplate =
    requireElement<HTMLTemplateElement>(
        "#inventory-row-template"
    );


/* =========================================================
   状態
   ========================================================= */

/**
 * 現在読み込まれているCSVの商品一覧。
 *
 * フィルタ・並び替え適用前の
 * 元データを保持する。
 */
let inventoryItems:
    InventoryItem[] =
    [];


/**
 * CSV解析時に発生した行単位エラー。
 */
let csvRowErrors:
    CsvRowError[] =
    [];


/**
 * CSVを正常に読み込んだ状態か。
 */
let hasImportedCsv =
    false;


/* =========================================================
   初期化
   ========================================================= */

initialize();


/**
 * INVENTORY BATCH を初期化する。
 */
function initialize():
    void {

    bindEvents();

    resetSummary();

    clearErrorDisplay();

    clearInventoryPreview(
        inventoryPreview
    );

    printButton.disabled =
        true;
}


/* =========================================================
   イベント登録
   ========================================================= */

/**
 * 画面イベントを登録する。
 */
function bindEvents():
    void {

    /* -----------------------------------------------------
       CSV読込
       ----------------------------------------------------- */

    csvImportButton.addEventListener(
        "click",
        handleCsvImportButtonClick
    );


    csvFileInput.addEventListener(
        "change",
        () => {
            void handleCsvFileChange();
        }
    );


    /* -----------------------------------------------------
       数量フィルタ
       ----------------------------------------------------- */

    skipNegativeQuantity.addEventListener(
        "change",
        handleOutputOptionsChange
    );


    skipZeroQuantity.addEventListener(
        "change",
        handleOutputOptionsChange
    );


    /* -----------------------------------------------------
       並び順
       ----------------------------------------------------- */

    for (
        const input
        of sortOrderInputs
    ) {

        input.addEventListener(
            "change",
            handleOutputOptionsChange
        );
    }


    /* -----------------------------------------------------
       印刷
       ----------------------------------------------------- */

    printButton.addEventListener(
        "click",
        handlePrint
    );


    /**
     * ブラウザメニューや
     * Ctrl / Cmd + Pから印刷された場合にも
     * 発行日時を最新化する。
     */
    window.addEventListener(
        "beforeprint",
        handleBeforePrint
    );
}


/* =========================================================
   CSV選択
   ========================================================= */

/**
 * CSV読込ボタン押下。
 */
function handleCsvImportButtonClick():
    void {

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
async function handleCsvFileChange():
    Promise<void> {

    const file =
        csvFileInput.files?.[0];


    if (
        file ===
        undefined
    ) {

        return;
    }


    selectedFileName.textContent =
        file.name;


    await importCsvFile(
        file
    );
}


/* =========================================================
   CSV読込
   ========================================================= */

/**
 * CSVを解析して画面へ反映する。
 */
async function importCsvFile(
    file: File
): Promise<void> {

    setImportingState(
        true
    );


    try {

        const result =
            await parseInventoryCsv(
                file
            );


        applyCsvImportResult(
            result
        );


        hasImportedCsv =
            true;


        updateOutput();

    } catch (
    error
    ) {

        handleCsvImportError(
            error
        );

    } finally {

        setImportingState(
            false
        );
    }
}


/**
 * CSV解析成功時の結果を内部状態へ保存する。
 */
function applyCsvImportResult(
    result: CsvImportResult
): void {

    inventoryItems =
        result.items;


    csvRowErrors =
        result.errors;


    setCountValue(
        loadedCount,
        result.sourceRowCount
    );
}


/* =========================================================
   出力条件変更
   ========================================================= */

/**
 * フィルタまたは並び順変更時。
 *
 * CSV自体は再読込しない。
 */
function handleOutputOptionsChange():
    void {

    if (
        !hasImportedCsv
    ) {

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
function updateOutput():
    void {

    const outputOptions =
        getOutputOptions();


    const output =
        createInventoryOutput(
            inventoryItems,
            outputOptions
        );


    const renderResult =
        renderInventoryPreview(
            output.pages,
            inventoryPreview,
            inventoryRowTemplate
        );


    /* -----------------------------------------------------
       集計
       ----------------------------------------------------- */

    setCountValue(
        outputCount,
        output.items.length
    );


    setCountValue(
        pageCount,
        renderResult.pageCount
    );


    /* -----------------------------------------------------
       エラー
       ----------------------------------------------------- */

    const visibleCsvErrors =
        filterCsvErrorsByOutputItems(
            csvRowErrors,
            output.items
        );


    const errors =
        createDisplayErrors(
            visibleCsvErrors,
            renderResult.errors
        );


    renderErrors(
        errors
    );


    setCountValue(
        errorCount,
        errors.length
    );


    /* -----------------------------------------------------
       印刷可否
       ----------------------------------------------------- */

    printButton.disabled =
        (
            output.items.length ===
            0 ||
            renderResult.pageCount ===
            0
        );
}


/* =========================================================
   出力設定
   ========================================================= */

/**
 * 現在の画面状態を
 * InventoryOutputOptionsへ変換する。
 */
function getOutputOptions():
    InventoryOutputOptions {

    return {

        skipNegativeQuantity:
            skipNegativeQuantity.checked,

        skipZeroQuantity:
            skipZeroQuantity.checked,

        sortOrder:
            getSortOrder()
    };
}


/* =========================================================
   並び順
   ========================================================= */

/**
 * 選択中の並び順を取得する。
 */
function getSortOrder():
    InventorySortOrder {

    const selectedInput =
        sortOrderInputs.find(
            (input) =>
                input.checked
        );


    if (
        !selectedInput
    ) {

        return "csv";
    }


    switch (
    selectedInput.value
    ) {

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

            console.warn(
                "不明な並び順が指定されています。",
                selectedInput.value
            );


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
function updateIssuedLabels():
    void {

    const issuedAt =
        new Date();


    const issuedAtText =
        formatIssuedAt(
            issuedAt
        );


    const labels =
        Array.from(
            inventoryPreview
                .querySelectorAll<HTMLElement>(
                    ".inventory-page__issued"
                )
        );


    for (
        let index = 0;
        index < labels.length;
        index += 1
    ) {

        const label =
            labels[
            index
            ];


        const pageNumber =
            label.dataset.pageNumber ??
            String(
                index +
                1
            );


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
function formatIssuedAt(
    date: Date
): string {

    const year =
        date.getFullYear();


    const month =
        padTwoDigits(
            date.getMonth() +
            1
        );


    const day =
        padTwoDigits(
            date.getDate()
        );


    const hour =
        padTwoDigits(
            date.getHours()
        );


    const minute =
        padTwoDigits(
            date.getMinutes()
        );


    return (
        `${year}/${month}/${day} ${hour}:${minute}`
    );
}


/**
 * 1桁の数字を
 * 2桁文字列へ変換する。
 */
function padTwoDigits(
    value: number
): string {

    return String(
        value
    ).padStart(
        2,
        "0"
    );
}


/* =========================================================
   印刷
   ========================================================= */

/**
 * 印刷ボタン押下。
 */
function handlePrint():
    void {

    if (
        printButton.disabled ||
        !hasImportedCsv
    ) {

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
function handleBeforePrint():
    void {

    if (
        !hasImportedCsv
    ) {

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
function filterCsvErrorsByOutputItems(
    errors: readonly CsvRowError[],
    outputItems:
        readonly InventoryItem[]
): CsvRowError[] {

    const outputRowNumbers =
        new Set(
            outputItems.map(
                (item) =>
                    item.rowNumber
            )
        );


    return errors.filter(
        (error) =>
            outputRowNumbers.has(
                error.rowNumber
            )
    );
}


/* =========================================================
   エラー統合
   ========================================================= */

/**
 * CSV由来エラーとバーコード由来エラーを
 * 画面表示用形式へ統合する。
 */
function createDisplayErrors(
    csvErrors:
        readonly CsvRowError[],
    renderErrors:
        readonly InventoryRenderError[]
): DisplayError[] {

    const errors:
        DisplayError[] =
        [];


    for (
        const error
        of csvErrors
    ) {

        errors.push({

            rowNumber:
                error.rowNumber,

            message:
                error.message
        });
    }


    for (
        const error
        of renderErrors
    ) {

        errors.push({

            rowNumber:
                error.rowNumber,

            message:
                error.message
        });
    }


    /**
     * エラー一覧自体は
     * CSV元行番号順。
     */
    errors.sort(
        (
            first,
            second
        ) =>
            (
                first.rowNumber ??
                0
            ) -
            (
                second.rowNumber ??
                0
            )
    );


    return errors;
}


/* =========================================================
   エラー表示
   ========================================================= */

/**
 * エラー一覧を画面へ描画する。
 */
function renderErrors(
    errors:
        readonly DisplayError[]
): void {

    errorList.replaceChildren();


    if (
        errors.length ===
        0
    ) {

        errorSection.hidden =
            true;


        return;
    }


    const fragment =
        document.createDocumentFragment();


    for (
        const error
        of errors
    ) {

        const listItem =
            document.createElement(
                "li"
            );


        listItem.textContent =
            error.message;


        fragment.appendChild(
            listItem
        );
    }


    errorList.appendChild(
        fragment
    );


    errorSection.hidden =
        false;
}


/**
 * エラー表示を初期状態へ戻す。
 */
function clearErrorDisplay():
    void {

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
function handleCsvImportError(
    error: unknown
): void {

    inventoryItems =
        [];


    csvRowErrors =
        [];


    hasImportedCsv =
        false;


    clearInventoryPreview(
        inventoryPreview
    );


    resetSummary();


    printButton.disabled =
        true;


    if (
        error instanceof
        InventoryCsvError
    ) {

        renderErrors([
            {
                message:
                    error.message
            }
        ]);


        return;
    }


    console.error(
        "CSVの読み込みに失敗しました。",
        error
    );


    renderErrors([
        {
            message:
                "CSVの読み込み中に予期しないエラーが発生しました。"
        }
    ]);
}


/* =========================================================
   CSV読込中
   ========================================================= */

/**
 * CSV解析中のUI状態を切り替える。
 */
function setImportingState(
    importing: boolean
): void {

    csvImportButton.disabled =
        importing;


    if (
        importing
    ) {

        csvImportButton.setAttribute(
            "aria-busy",
            "true"
        );


        return;
    }


    csvImportButton.removeAttribute(
        "aria-busy"
    );
}


/* =========================================================
   件数表示
   ========================================================= */

/**
 * 集計表示を初期状態へ戻す。
 */
function resetSummary():
    void {

    setCountValue(
        loadedCount,
        0
    );


    setCountValue(
        outputCount,
        0
    );


    setCountValue(
        pageCount,
        0
    );


    setCountValue(
        errorCount,
        0
    );
}


/**
 * 件数表示を更新する。
 */
function setCountValue(
    element: HTMLElement,
    value: number
): void {

    const unit =
        element.querySelector<HTMLElement>(
            ".inventory-summary__unit"
        );


    if (
        unit ===
        null
    ) {

        element.textContent =
            String(
                value
            );


        return;
    }


    element.textContent =
        String(
            value
        );


    element.appendChild(
        unit
    );
}


/* =========================================================
   DOMユーティリティ
   ========================================================= */

/**
 * 必須DOM要素を1件取得する。
 */
function requireElement<
    T extends Element
>(
    selector: string
): T {

    const element =
        document.querySelector<T>(
            selector
        );


    if (
        element ===
        null
    ) {

        throw new Error(
            `必要な要素が見つかりません: ${selector}`
        );
    }


    return element;
}


/**
 * 必須DOM要素を複数取得する。
 */
function requireElements<
    T extends Element
>(
    selector: string
): T[] {

    const elements =
        Array.from(
            document.querySelectorAll<T>(
                selector
            )
        );


    if (
        elements.length ===
        0
    ) {

        throw new Error(
            `必要な要素が見つかりません: ${selector}`
        );
    }


    return elements;
}