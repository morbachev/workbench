import {
    RED_INDEX_COPY_COUNT,
    RED_INDEX_TITLE,
    getVisibleCategories,
    splitCategories
} from "./model.js";

import type {
    RedIndexCategory,
    RedIndexData
} from "./model.js";


/* =========================================================
   Editor Elements
   ========================================================= */

export type EditorElements = {
    categoryList: HTMLElement;
    categoryEditorTemplate: HTMLTemplateElement;
    categoryItemTemplate: HTMLTemplateElement;
};


/* =========================================================
   Render Editor
   ========================================================= */

export function renderEditor(
    elements: EditorElements,
    data: RedIndexData,
    onChange: () => void
): void {

    elements.categoryList.replaceChildren();


    data.categories.forEach(
        (
            category,
            categoryIndex
        ) => {

            const categoryElement =
                createCategoryEditor(
                    elements,
                    data,
                    category,
                    categoryIndex,
                    onChange
                );


            elements.categoryList.appendChild(
                categoryElement
            );
        }
    );
}


/* =========================================================
   Category Editor
   ========================================================= */

function createCategoryEditor(
    elements: EditorElements,
    data: RedIndexData,
    category: RedIndexCategory,
    categoryIndex: number,
    onChange: () => void
): HTMLElement {

    const fragment =
        elements
            .categoryEditorTemplate
            .content
            .cloneNode(
                true
            );


    if (
        !(fragment instanceof DocumentFragment)
    ) {

        throw new Error(
            "カテゴリテンプレートを生成できませんでした。"
        );
    }


    const root =
        fragment.querySelector(
            ".category-editor"
        );


    const number =
        fragment.querySelector(
            ".category-editor__number"
        );


    const nameInput =
        fragment.querySelector(
            ".category-editor__name-input"
        );


    const deleteButton =
        fragment.querySelector(
            ".category-editor__delete-button"
        );


    const itemList =
        fragment.querySelector(
            ".category-items__list"
        );


    const addItemButton =
        fragment.querySelector(
            ".category-items__add-button"
        );


    if (
        !(root instanceof HTMLElement) ||
        !(number instanceof HTMLElement) ||
        !(nameInput instanceof HTMLInputElement) ||
        !(deleteButton instanceof HTMLButtonElement) ||
        !(itemList instanceof HTMLElement) ||
        !(addItemButton instanceof HTMLButtonElement)
    ) {

        throw new Error(
            "カテゴリテンプレートの構造が正しくありません。"
        );
    }


    number.textContent =
        `CATEGORY ${String(
            categoryIndex + 1
        ).padStart(
            2,
            "0"
        )}`;


    nameInput.value =
        category.category;


    nameInput.addEventListener(
        "input",
        () => {

            category.category =
                nameInput.value;


            onChange();
        }
    );


    deleteButton.addEventListener(
        "click",
        () => {

            removeCategory(
                data,
                categoryIndex
            );


            renderEditor(
                elements,
                data,
                onChange
            );


            onChange();
        }
    );


    itemList.replaceChildren();


    category.items.forEach(
        (
            item,
            itemIndex
        ) => {

            itemList.appendChild(
                createItemEditor(
                    elements,
                    category,
                    item,
                    itemIndex,
                    () => {

                        renderEditor(
                            elements,
                            data,
                            onChange
                        );


                        onChange();
                    },
                    onChange
                )
            );
        }
    );


    addItemButton.addEventListener(
        "click",
        () => {

            category.items.push(
                ""
            );


            renderEditor(
                elements,
                data,
                onChange
            );


            onChange();
        }
    );


    return root;
}


/* =========================================================
   Item Editor
   ========================================================= */

function createItemEditor(
    elements: EditorElements,
    category: RedIndexCategory,
    item: string,
    itemIndex: number,
    onStructureChange: () => void,
    onChange: () => void
): HTMLElement {

    const fragment =
        elements
            .categoryItemTemplate
            .content
            .cloneNode(
                true
            );


    if (
        !(fragment instanceof DocumentFragment)
    ) {

        throw new Error(
            "子要素テンプレートを生成できませんでした。"
        );
    }


    const root =
        fragment.querySelector(
            ".category-item"
        );


    const input =
        fragment.querySelector(
            ".red-index-field__input"
        );


    const removeButton =
        fragment.querySelector(
            ".category-item__remove-button"
        );


    if (
        !(root instanceof HTMLElement) ||
        !(input instanceof HTMLInputElement) ||
        !(removeButton instanceof HTMLButtonElement)
    ) {

        throw new Error(
            "子要素テンプレートの構造が正しくありません。"
        );
    }


    input.value =
        item;


    input.addEventListener(
        "input",
        () => {

            category.items[
                itemIndex
            ] =
                input.value;


            onChange();
        }
    );


    removeButton.addEventListener(
        "click",
        () => {

            if (
                category.items.length <=
                1
            ) {

                category.items[0] =
                    "";

            } else {

                category.items.splice(
                    itemIndex,
                    1
                );
            }


            onStructureChange();
        }
    );


    return root;
}


/* =========================================================
   Category Delete
   ========================================================= */

function removeCategory(
    data: RedIndexData,
    categoryIndex: number
): void {

    if (
        data.categories.length <=
        1
    ) {

        data.categories[0] = {
            category:
                "",

            items: [
                ""
            ]
        };


        return;
    }


    data.categories.splice(
        categoryIndex,
        1
    );
}


/* =========================================================
   Preview
   ========================================================= */

export function renderPreview(
    container: HTMLElement,
    data: RedIndexData
): void {

    container.replaceChildren();


    const categories =
        getVisibleCategories(
            data
        );


    const [
        leftCategories,
        rightCategories
    ] =
        splitCategories(
            categories
        );


    const date =
        formatCurrentDate();


    for (
        let copyIndex = 0;
        copyIndex < RED_INDEX_COPY_COUNT;
        copyIndex += 1
    ) {

        container.appendChild(
            createOutputCopy(
                leftCategories,
                rightCategories,
                date
            )
        );
    }
}


/* =========================================================
   Output Copy
   ========================================================= */

function createOutputCopy(
    leftCategories: RedIndexCategory[],
    rightCategories: RedIndexCategory[],
    date: string
): HTMLElement {

    const output =
        document.createElement(
            "section"
        );


    output.className =
        "red-index-output";


    /* ---------------------------------------------------------
       Header
       --------------------------------------------------------- */

    const header =
        document.createElement(
            "header"
        );


    header.className =
        "red-index-output__header";


    const title =
        document.createElement(
            "span"
        );


    title.className =
        "red-index-output__title";


    title.textContent =
        RED_INDEX_TITLE;


    const time =
        document.createElement(
            "time"
        );


    time.className =
        "red-index-output__date";


    time.textContent =
        date;


    time.dateTime =
        formatCurrentIsoDate();


    header.append(
        title,
        time
    );


    /* ---------------------------------------------------------
       Columns
       --------------------------------------------------------- */

    const columns =
        document.createElement(
            "div"
        );


    columns.className =
        "red-index-output__columns";


    columns.append(
        createOutputColumn(
            leftCategories
        ),

        createOutputColumn(
            rightCategories
        )
    );


    output.append(
        header,
        columns
    );


    return output;
}


/* =========================================================
   Output Column
   ========================================================= */

function createOutputColumn(
    categories: RedIndexCategory[]
): HTMLElement {

    const column =
        document.createElement(
            "div"
        );


    column.className =
        "red-index-output__column";


    for (
        const category
        of categories
    ) {

        column.appendChild(
            createOutputCategory(
                category
            )
        );
    }


    return column;
}


/* =========================================================
   Output Category
   ========================================================= */

function createOutputCategory(
    category: RedIndexCategory
): HTMLElement {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "red-index-output__category";


    const categoryName =
        document.createElement(
            "strong"
        );


    categoryName.className =
        "red-index-output__category-name";


    if (
        category.category.length >
        0
    ) {

        categoryName.textContent =
            `【${category.category}】`;

    } else {

        categoryName.textContent =
            "【未分類】";
    }


    const items =
        document.createElement(
            "span"
        );


    items.className =
        "red-index-output__items";


    items.textContent =
        category.items.join(
            "、"
        );


    row.append(
        categoryName,
        items
    );


    return row;
}


/* =========================================================
   Date
   ========================================================= */

function formatCurrentDate(): string {

    const now =
        new Date();


    const year =
        String(
            now.getFullYear()
        );


    const month =
        String(
            now.getMonth() +
            1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}.${month}.${day}`
    );
}


function formatCurrentIsoDate(): string {

    const now =
        new Date();


    const year =
        String(
            now.getFullYear()
        );


    const month =
        String(
            now.getMonth() +
            1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-${day}`
    );
}