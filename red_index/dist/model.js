export const RED_INDEX_VERSION = 1;
export const RED_INDEX_TITLE = "割引不可商品リスト";
export const RED_INDEX_COPY_COUNT = 4;
/* =========================================================
   Initial Data
   ========================================================= */
export function createInitialData() {
    return {
        version: RED_INDEX_VERSION,
        categories: [
            createEmptyCategory()
        ]
    };
}
export function createEmptyCategory() {
    return {
        category: "",
        items: [
            ""
        ]
    };
}
/* =========================================================
   Clone
   ========================================================= */
export function cloneRedIndexData(data) {
    return {
        version: RED_INDEX_VERSION,
        categories: data.categories.map((category) => ({
            category: category.category,
            items: [...category.items]
        }))
    };
}
/* =========================================================
   Normalize
   ========================================================= */
export function normalizeRedIndexData(data) {
    return {
        version: RED_INDEX_VERSION,
        categories: data.categories.map((category) => ({
            category: category.category,
            items: category.items.length > 0
                ? [...category.items]
                : [""]
        }))
    };
}
/* =========================================================
   Validation
   ========================================================= */
export function parseRedIndexData(value) {
    const source = requireRecord(value, "JSONの最上位はオブジェクトである必要があります。");
    if (source.version !==
        RED_INDEX_VERSION) {
        throw new Error(`version は ${RED_INDEX_VERSION} である必要があります。`);
    }
    if (!Array.isArray(source.categories)) {
        throw new Error("categories は配列である必要があります。");
    }
    const categories = source.categories.map((category, index) => parseCategory(category, index));
    return {
        version: RED_INDEX_VERSION,
        categories: categories.length > 0
            ? categories
            : [
                createEmptyCategory()
            ]
    };
}
/* =========================================================
   Category Parser
   ========================================================= */
function parseCategory(value, index) {
    const source = requireRecord(value, `categories[${index}] はオブジェクトである必要があります。`);
    const category = requireString(source.category, `categories[${index}].category`);
    if (!Array.isArray(source.items)) {
        throw new Error(`categories[${index}].items は配列である必要があります。`);
    }
    const items = source.items.map((item, itemIndex) => requireString(item, `categories[${index}].items[${itemIndex}]`));
    return {
        category,
        items: items.length > 0
            ? items
            : [""]
    };
}
/* =========================================================
   Output Filter
   ========================================================= */
/**
 * 印刷・プレビューへ表示するカテゴリだけ返す。
 *
 * カテゴリ名も商品も空の行は無視する。
 */
export function getVisibleCategories(data) {
    return data.categories
        .map((category) => ({
        category: category.category.trim(),
        items: category.items
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    }))
        .filter((category) => category.category.length > 0 ||
        category.items.length > 0);
}
/* =========================================================
   Two Columns
   ========================================================= */
/**
 * カテゴリ単位で左右へ分割する。
 *
 * 5カテゴリの場合:
 *
 * 左 3
 * 右 2
 */
export function splitCategories(categories) {
    const midpoint = Math.ceil(categories.length /
        2);
    return [
        categories.slice(0, midpoint),
        categories.slice(midpoint)
    ];
}
/* =========================================================
   Generic Validation
   ========================================================= */
function requireRecord(value, message) {
    if (typeof value !==
        "object" ||
        value ===
            null ||
        Array.isArray(value)) {
        throw new Error(message);
    }
    return value;
}
function requireString(value, path) {
    if (typeof value !==
        "string") {
        throw new Error(`${path} は文字列である必要があります。`);
    }
    return value;
}
//# sourceMappingURL=model.js.map