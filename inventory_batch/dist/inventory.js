/**
 * inventory.ts
 *
 * INVENTORY BATCH の
 * 純粋な業務ロジックを管理する。
 *
 * このファイルでは以下を担当する。
 *
 * - InventoryItem 型
 * - 数量フィルタ
 * - 並び替え
 * - A4単位へのページ分割
 * - 最終出力データ生成
 *
 * DOM操作・CSV解析・バーコード生成は担当しない。
 */
/* =========================================================
   定数
   ========================================================= */
/**
 * A4 1ページあたりの商品数。
 *
 * 左列:
 * 28件
 *
 * 右列:
 * 28件
 *
 * 合計:
 * 56件
 */
export const INVENTORY_ROWS_PER_PAGE = 56;
/* =========================================================
   Collator
   ========================================================= */
/**
 * 商品名比較。
 *
 * 日本語ロケールを使用する。
 *
 * 漢字の読み仮名を推測するものではないが、
 * 日本語文字列として自然な比較を行う。
 *
 * numeric:
 *   商品2 / 商品10なども数値を意識して比較する。
 */
const productNameCollator = new Intl.Collator("ja", {
    usage: "sort",
    sensitivity: "base",
    numeric: true
});
/**
 * JAN比較。
 *
 * PLUコード自体はstringのまま保持する。
 * Numberへ変換しないため先頭0を破壊しない。
 */
const janCollator = new Intl.Collator("ja", {
    usage: "sort",
    sensitivity: "base",
    numeric: true
});
/* =========================================================
   Filter
   ========================================================= */
/**
 * 数量条件に応じて商品を絞り込む。
 *
 * NaNなど不正数量はここでは除外しない。
 * エラー表示対象として保持する。
 */
export function filterInventoryItems(items, options) {
    return items.filter((item) => {
        if (options.skipNegativeQuantity &&
            item.quantity < 0) {
            return false;
        }
        if (options.skipZeroQuantity &&
            item.quantity === 0) {
            return false;
        }
        return true;
    });
}
/* =========================================================
   Sort
   ========================================================= */
/**
 * 指定された条件で商品を並び替える。
 *
 * 元配列自体は変更しない。
 */
export function sortInventoryItems(items, sortOrder) {
    const sortedItems = [
        ...items
    ];
    switch (sortOrder) {
        /* -------------------------------------------------
           CSV順
           ------------------------------------------------- */
        case "csv":
            /*
             * filter()後も元の順番は維持されているため、
             * コピーだけ返す。
             */
            return sortedItems;
        /* -------------------------------------------------
           数量が少ない順
           ------------------------------------------------- */
        case "quantity-asc":
            sortedItems.sort((first, second) => compareQuantity(first, second, "asc"));
            return sortedItems;
        /* -------------------------------------------------
           数量が多い順
           ------------------------------------------------- */
        case "quantity-desc":
            sortedItems.sort((first, second) => compareQuantity(first, second, "desc"));
            return sortedItems;
        /* -------------------------------------------------
           JAN順
           ------------------------------------------------- */
        case "jan":
            sortedItems.sort((first, second) => {
                const result = janCollator.compare(first.pluCode, second.pluCode);
                if (result !== 0) {
                    return result;
                }
                /*
                 * 同一JANなら
                 * CSV元順序を維持する。
                 */
                return (first.rowNumber -
                    second.rowNumber);
            });
            return sortedItems;
        /* -------------------------------------------------
           商品名順
           ------------------------------------------------- */
        case "product-name":
            sortedItems.sort((first, second) => {
                const result = productNameCollator.compare(first.productName, second.productName);
                if (result !== 0) {
                    return result;
                }
                /*
                 * 同一商品名なら
                 * CSV元順序を維持する。
                 */
                return (first.rowNumber -
                    second.rowNumber);
            });
            return sortedItems;
    }
}
/* =========================================================
   Quantity Sort
   ========================================================= */
/**
 * 数量を比較する。
 *
 * 不正数量 NaN は、
 * 昇順 / 降順のどちらでも最後尾へ送る。
 */
function compareQuantity(first, second, direction) {
    const firstIsFinite = Number.isFinite(first.quantity);
    const secondIsFinite = Number.isFinite(second.quantity);
    /* -----------------------------------------------------
       両方不正数量
       ----------------------------------------------------- */
    if (!firstIsFinite &&
        !secondIsFinite) {
        return (first.rowNumber -
            second.rowNumber);
    }
    /* -----------------------------------------------------
       firstだけ不正
       ----------------------------------------------------- */
    if (!firstIsFinite) {
        return 1;
    }
    /* -----------------------------------------------------
       secondだけ不正
       ----------------------------------------------------- */
    if (!secondIsFinite) {
        return -1;
    }
    /* -----------------------------------------------------
       通常数量比較
       ----------------------------------------------------- */
    const quantityDifference = first.quantity -
        second.quantity;
    if (quantityDifference !== 0) {
        return (direction ===
            "asc")
            ? quantityDifference
            : -quantityDifference;
    }
    /*
     * 同じ数量の場合は
     * CSV元行順を維持する。
     */
    return (first.rowNumber -
        second.rowNumber);
}
/* =========================================================
   Pagination
   ========================================================= */
/**
 * 商品一覧をA4単位へ分割する。
 */
export function paginateInventoryItems(items, rowsPerPage = INVENTORY_ROWS_PER_PAGE) {
    if (rowsPerPage <= 0 ||
        !Number.isInteger(rowsPerPage)) {
        throw new Error("1ページあたりの商品件数が不正です。");
    }
    const pages = [];
    for (let startIndex = 0; startIndex < items.length; startIndex += rowsPerPage) {
        pages.push(items.slice(startIndex, startIndex +
            rowsPerPage));
    }
    return pages;
}
/* =========================================================
   Output
   ========================================================= */
/**
 * 現在の設定から
 * 棚卸出力全体を生成する。
 *
 * 処理順:
 *
 * 1. 数量フィルタ
 * 2. 並び替え
 * 3. 56件ごとにページ分割
 */
export function createInventoryOutput(items, options) {
    const filteredItems = filterInventoryItems(items, options);
    const sortedItems = sortInventoryItems(filteredItems, options.sortOrder);
    const pages = paginateInventoryItems(sortedItems);
    return {
        items: sortedItems,
        pages
    };
}
//# sourceMappingURL=inventory.js.map