export const RED_INDEX_VERSION =
    1 as const;


export const RED_INDEX_TITLE =
    "割引不可商品リスト";


export const RED_INDEX_COPY_COUNT =
    4;


export type RedIndexCategory = {
    category: string;
    items: string[];
};


export type RedIndexData = {
    version: typeof RED_INDEX_VERSION;
    categories: RedIndexCategory[];
};


/* =========================================================
   Initial Data
   ========================================================= */

export function createInitialData(): RedIndexData {

    return {
        version:
            RED_INDEX_VERSION,

        categories: [
            createEmptyCategory()
        ]
    };
}


export function createEmptyCategory(): RedIndexCategory {

    return {
        category:
            "",

        items: [
            ""
        ]
    };
}


/* =========================================================
   Clone
   ========================================================= */

export function cloneRedIndexData(
    data: RedIndexData
): RedIndexData {

    return {
        version:
            RED_INDEX_VERSION,

        categories:
            data.categories.map(
                (category) => ({
                    category:
                        category.category,

                    items:
                        [...category.items]
                })
            )
    };
}


/* =========================================================
   Normalize
   ========================================================= */

export function normalizeRedIndexData(
    data: RedIndexData
): RedIndexData {

    return {
        version:
            RED_INDEX_VERSION,

        categories:
            data.categories.map(
                (category) => ({

                    category:
                        category.category,

                    items:
                        category.items.length > 0
                            ? [...category.items]
                            : [""]
                })
            )
    };
}


/* =========================================================
   Validation
   ========================================================= */

export function parseRedIndexData(
    value: unknown
): RedIndexData {

    const source =
        requireRecord(
            value,
            "JSONの最上位はオブジェクトである必要があります。"
        );


    if (
        source.version !==
        RED_INDEX_VERSION
    ) {

        throw new Error(
            `version は ${RED_INDEX_VERSION} である必要があります。`
        );
    }


    if (
        !Array.isArray(
            source.categories
        )
    ) {

        throw new Error(
            "categories は配列である必要があります。"
        );
    }


    const categories =
        source.categories.map(
            (
                category,
                index
            ) =>
                parseCategory(
                    category,
                    index
                )
        );


    return {
        version:
            RED_INDEX_VERSION,

        categories:
            categories.length > 0
                ? categories
                : [
                    createEmptyCategory()
                ]
    };
}


/* =========================================================
   Category Parser
   ========================================================= */

function parseCategory(
    value: unknown,
    index: number
): RedIndexCategory {

    const source =
        requireRecord(
            value,
            `categories[${index}] はオブジェクトである必要があります。`
        );


    const category =
        requireString(
            source.category,
            `categories[${index}].category`
        );


    if (
        !Array.isArray(
            source.items
        )
    ) {

        throw new Error(
            `categories[${index}].items は配列である必要があります。`
        );
    }


    const items =
        source.items.map(
            (
                item,
                itemIndex
            ) =>
                requireString(
                    item,
                    `categories[${index}].items[${itemIndex}]`
                )
        );


    return {
        category,

        items:
            items.length > 0
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
export function getVisibleCategories(
    data: RedIndexData
): RedIndexCategory[] {

    return data.categories
        .map(
            (category) => ({

                category:
                    category.category.trim(),

                items:
                    category.items
                        .map(
                            (item) =>
                                item.trim()
                        )
                        .filter(
                            (item) =>
                                item.length > 0
                        )
            })
        )
        .filter(
            (category) =>
                category.category.length > 0 ||
                category.items.length > 0
        );
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
export function splitCategories(
    categories: RedIndexCategory[]
): [
        RedIndexCategory[],
        RedIndexCategory[]
    ] {

    const midpoint =
        Math.ceil(
            categories.length /
            2
        );


    return [
        categories.slice(
            0,
            midpoint
        ),

        categories.slice(
            midpoint
        )
    ];
}


/* =========================================================
   Generic Validation
   ========================================================= */

function requireRecord(
    value: unknown,
    message: string
): Record<string, unknown> {

    if (
        typeof value !==
        "object" ||

        value ===
        null ||

        Array.isArray(
            value
        )
    ) {

        throw new Error(
            message
        );
    }


    return value as
        Record<string, unknown>;
}


function requireString(
    value: unknown,
    path: string
): string {

    if (
        typeof value !==
        "string"
    ) {

        throw new Error(
            `${path} は文字列である必要があります。`
        );
    }


    return value;
}