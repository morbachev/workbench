/**
 * render.ts
 *
 * INVENTORY BATCH の
 * A4プレビュー描画を担当する。
 *
 * このファイルでは以下を担当する。
 *
 * - A4ページDOM生成
 * - 発行情報表示領域の生成
 * - 商品行テンプレート複製
 * - 奇数 / 偶数レイアウト付与
 * - 商品名 / 数量 / PLU表示
 * - EAN-13バーコード描画
 * - バーコードエラー収集
 *
 * CSV解析・フィルタ・並び替え・
 * 印刷日時の決定は担当しない。
 */
import { renderEan13Barcode } from "./barcode.js";
/* =========================================================
   Public API
   ========================================================= */
/**
 * A4プレビューを描画する。
 *
 * pagesはinventory.ts側で
 * 56件ごとに分割済みであることを前提とする。
 */
export function renderInventoryPreview(pages, container, rowTemplate) {
    container.replaceChildren();
    if (pages.length ===
        0) {
        clearInventoryPreview(container);
        return {
            pageCount: 0,
            errors: []
        };
    }
    const fragment = document.createDocumentFragment();
    const errors = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = createInventoryPage(pages[pageIndex], pageIndex, rowTemplate, errors);
        fragment.appendChild(page);
    }
    container.appendChild(fragment);
    return {
        pageCount: pages.length,
        errors
    };
}
/**
 * プレビューを空状態へ戻す。
 */
export function clearInventoryPreview(container) {
    container.replaceChildren();
    const empty = document.createElement("p");
    empty.className =
        "inventory-preview__empty";
    empty.textContent =
        "CSVを読み込むと、ここに印刷プレビューが表示されます。";
    container.appendChild(empty);
}
/* =========================================================
   A4 Page
   ========================================================= */
/**
 * A4 1ページ分のDOMを生成する。
 */
function createInventoryPage(items, pageIndex, rowTemplate, errors) {
    const page = document.createElement("section");
    page.className =
        "inventory-page";
    page.setAttribute("aria-label", `棚卸JAN印刷プレビュー ${pageIndex + 1}枚目`);
    /* -----------------------------------------------------
       発行情報
       ----------------------------------------------------- */
    /**
     * 発行日時はここでは決定しない。
     *
     * main.ts側が印刷開始時に、
     *
     * 2026/08/11 18:13発行 1枚目
     *
     * の形式でtextContentを設定する。
     *
     * position:absoluteのため、
     * 56件グリッドには一切影響しない。
     */
    const issuedLabel = createIssuedLabel(pageIndex +
        1);
    page.appendChild(issuedLabel);
    /* -----------------------------------------------------
       商品行
       ----------------------------------------------------- */
    for (let rowIndex = 0; rowIndex < items.length; rowIndex += 1) {
        const row = createInventoryRow(rowTemplate);
        applyRowLayout(row, rowIndex);
        renderInventoryItem(row, items[rowIndex], errors);
        page.appendChild(row);
    }
    return page;
}
/* =========================================================
   発行情報
   ========================================================= */
/**
 * 各A4ページ左上に配置する
 * 発行情報要素を生成する。
 *
 * 日時は印刷開始時にmain.tsが設定するため、
 * 初期状態では空文字。
 */
function createIssuedLabel(pageNumber) {
    const label = document.createElement("p");
    label.className =
        "inventory-page__issued";
    /**
     * 印刷時にmain.tsから
     * ページ番号を取得できるよう保持する。
     */
    label.dataset.pageNumber =
        String(pageNumber);
    /**
     * 印刷前は発行日時未確定。
     *
     * CSSの:emptyにより
     * 空の間は非表示となる。
     */
    label.textContent =
        "";
    return label;
}
/* =========================================================
   Row
   ========================================================= */
/**
 * templateから商品行を複製する。
 */
function createInventoryRow(rowTemplate) {
    const firstElement = rowTemplate
        .content
        .firstElementChild;
    if (!(firstElement instanceof HTMLElement)) {
        throw new Error("棚卸JAN行テンプレートが正しくありません。");
    }
    const row = firstElement.cloneNode(true);
    if (!(row instanceof HTMLElement)) {
        throw new Error("棚卸JAN行テンプレートを複製できませんでした。");
    }
    return row;
}
/**
 * 1ページ内の行番号に応じて
 * odd / evenクラスを付与する。
 *
 * ページが変わるたびに
 * rowIndexは0から再開する。
 */
function applyRowLayout(row, rowIndex) {
    row.classList.remove("inventory-row--odd", "inventory-row--even");
    const isOddRow = rowIndex %
        2 ===
        0;
    row.classList.add(isOddRow
        ? "inventory-row--odd"
        : "inventory-row--even");
}
/* =========================================================
   商品描画
   ========================================================= */
/**
 * 1商品分を行へ描画する。
 */
function renderInventoryItem(row, item, errors) {
    const elements = getInventoryRowElements(row);
    /* -----------------------------------------------------
       商品名
       ----------------------------------------------------- */
    elements.nameText.textContent =
        normalizeDisplayText(item.productName);
    /* -----------------------------------------------------
       数量
       ----------------------------------------------------- */
    elements.quantityValue.textContent =
        Number.isFinite(item.quantity)
            ? String(item.quantity)
            : "—";
    /* -----------------------------------------------------
       PLU
       ----------------------------------------------------- */
    elements.pluText.textContent =
        normalizeDisplayText(item.pluCode);
    /* -----------------------------------------------------
       バーコード
       ----------------------------------------------------- */
    const barcodeResult = renderEan13Barcode(elements.barcode, item.pluCode);
    if (barcodeResult.success) {
        /**
         * SVGSVGElementでは
         * hidden属性ではなくdisplayを使用する。
         */
        elements.barcode.style.display =
            "";
        elements.barcodeError.hidden =
            true;
        elements.barcodeError.textContent =
            "";
        elements.barcode.removeAttribute("title");
        return;
    }
    /* -----------------------------------------------------
       バーコード生成失敗
       ----------------------------------------------------- */
    elements.barcode.style.display =
        "none";
    elements.barcodeError.hidden =
        false;
    elements.barcodeError.textContent =
        "バーコード生成不可";
    elements.barcodeError.title =
        barcodeResult.message;
    errors.push({
        rowNumber: item.rowNumber,
        pluCode: item.pluCode,
        message: `${item.rowNumber}行目: PLUコード「${item.pluCode}」 ${barcodeResult.message}`
    });
}
/* =========================================================
   Row DOM
   ========================================================= */
/**
 * 商品行内部の必須要素を取得する。
 */
function getInventoryRowElements(row) {
    return {
        nameText: requireChildElement(row, ".inventory-row__name-text"),
        quantityValue: requireChildElement(row, ".inventory-row__quantity-value"),
        barcode: requireChildElement(row, ".inventory-row__barcode"),
        pluText: requireChildElement(row, ".inventory-row__plu-text"),
        barcodeError: requireChildElement(row, ".inventory-row__barcode-error")
    };
}
/* =========================================================
   Text
   ========================================================= */
/**
 * CSV内に改行や連続空白が含まれていても、
 * 表示用文字列として扱いやすい形へ整える。
 *
 * 商品名そのものの視覚的な2行折返しは
 * CSS側で行う。
 */
function normalizeDisplayText(value) {
    return value
        .replace(/\s+/g, " ")
        .trim();
}
/* =========================================================
   DOM Utility
   ========================================================= */
/**
 * 親要素内の必須DOMを取得する。
 */
function requireChildElement(parent, selector) {
    const element = parent.querySelector(selector);
    if (element ===
        null) {
        throw new Error(`必要な要素が見つかりません: ${selector}`);
    }
    return element;
}
//# sourceMappingURL=render.js.map