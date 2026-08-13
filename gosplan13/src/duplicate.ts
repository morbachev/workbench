/**
 * duplicate.ts
 *
 * GOSPLAN13のラベル複製機能を管理する。
 *
 * 複製方法:
 *
 * 1. 左上を全体へ複製
 *    - 1番目の内容を対象ラベルすべてへ複製する。
 *
 * 2. 1行目を下へ複製
 *    - 1〜6番目の内容を、
 *      横位置を維持したまま下の各行へ複製する。
 *
 *
 * 画像ありモード:
 * - 商品名
 * - JAN
 * - 商品画像
 * を複製する。
 *
 * 画像なしモード:
 * - 商品名
 * - JAN
 * のみ複製する。
 *
 * 非表示になっている画像データには触らない。
 *
 *
 * 空欄も1つの状態としてそのまま複製する。
 * コピー元が空欄の場合、
 * コピー先の既存内容は削除される。
 */


/* =========================================================
   定数
   ========================================================= */

/**
 * GOSPLAN13は横6列固定。
 */
const COLUMN_COUNT = 6;


/**
 * 画像ありモードでは24面。
 */
const IMAGE_MODE_LABEL_COUNT = 24;


/**
 * 画像なしモードでは48面。
 */
const NO_IMAGE_MODE_LABEL_COUNT = 48;


/* =========================================================
   型
   ========================================================= */

export type DuplicateElements = {
    preview: HTMLElement;

    imageModeToggle:
    HTMLInputElement;

    /**
     * 「左上を全体へ複製」
     */
    duplicateAllButton:
    HTMLButtonElement;

    /**
     * 「1行目を下へ複製」
     */
    duplicateRowButton:
    HTMLButtonElement;
};


type LabelData = {
    name: string;
    jan: string;
    image: string | null;
};


/* =========================================================
   ラベル取得
   ========================================================= */

function getProductLabels(
    preview: HTMLElement,
): HTMLElement[] {
    return Array.from(
        preview.querySelectorAll<HTMLElement>(
            ".product-label",
        ),
    );
}


/**
 * 現在のモードで操作対象となるラベルだけ取得する。
 *
 * 画像あり:
 * 1〜24
 *
 * 画像なし:
 * 1〜48
 */
function getActiveLabels(
    preview: HTMLElement,
    imageMode: boolean,
): HTMLElement[] {
    const labels =
        getProductLabels(preview);

    const count =
        imageMode
            ? IMAGE_MODE_LABEL_COUNT
            : NO_IMAGE_MODE_LABEL_COUNT;

    return labels.slice(
        0,
        count,
    );
}


/* =========================================================
   DOM取得
   ========================================================= */

function getNameInput(
    label: HTMLElement,
): HTMLInputElement {
    const input =
        label.querySelector<HTMLInputElement>(
            ".product-label__name-input",
        );

    if (!input) {
        throw new Error(
            "商品名入力欄が見つかりません。",
        );
    }

    return input;
}


function getJanInput(
    label: HTMLElement,
): HTMLInputElement {
    const input =
        label.querySelector<HTMLInputElement>(
            ".product-label__jan-input",
        );

    if (!input) {
        throw new Error(
            "JAN入力欄が見つかりません。",
        );
    }

    return input;
}


function getImageInput(
    label: HTMLElement,
): HTMLInputElement {
    const input =
        label.querySelector<HTMLInputElement>(
            ".product-label__image-input",
        );

    if (!input) {
        throw new Error(
            "商品画像入力欄が見つかりません。",
        );
    }

    return input;
}


function getImagePreview(
    label: HTMLElement,
): HTMLImageElement {
    const image =
        label.querySelector<HTMLImageElement>(
            ".product-label__image-preview",
        );

    if (!image) {
        throw new Error(
            "商品画像プレビューが見つかりません。",
        );
    }

    return image;
}


function getImagePlaceholder(
    label: HTMLElement,
): HTMLElement {
    const placeholder =
        label.querySelector<HTMLElement>(
            ".product-label__image-placeholder",
        );

    if (!placeholder) {
        throw new Error(
            "商品画像プレースホルダーが見つかりません。",
        );
    }

    return placeholder;
}


/* =========================================================
   入力変更通知
   ========================================================= */

/**
 * プログラムからvalueを書き換えても、
 * 通常のユーザー入力と同じように
 * JAN描画やstorage.tsへ変更を通知する。
 */
function notifyInputChanged(
    input: HTMLInputElement,
): void {
    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true,
            },
        ),
    );

    input.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true,
            },
        ),
    );

    input.dispatchEvent(
        new FocusEvent(
            "focusout",
            {
                bubbles: true,
            },
        ),
    );
}


/* =========================================================
   ラベル内容取得
   ========================================================= */

function readLabelData(
    label: HTMLElement,
): LabelData {
    const nameInput =
        getNameInput(label);

    const janInput =
        getJanInput(label);

    const imagePreview =
        getImagePreview(label);

    const imageSource =
        imagePreview.getAttribute(
            "src",
        );

    return {
        name:
            nameInput.value,

        jan:
            janInput.value,

        image:
            imageSource
                && imageSource.trim() !== ""
                ? imageSource
                : null,
    };
}


/* =========================================================
   商品名複製
   ========================================================= */

function writeName(
    label: HTMLElement,
    name: string,
): void {
    const input =
        getNameInput(label);

    input.value =
        name;

    notifyInputChanged(
        input,
    );
}


/* =========================================================
   JAN複製
   ========================================================= */

function writeJan(
    label: HTMLElement,
    jan: string,
): void {
    const input =
        getJanInput(label);

    input.value =
        jan;

    /*
     * JAN入力後にイベントを発火することで、
     * jan.ts側のバーコード再描画も行わせる。
     */
    notifyInputChanged(
        input,
    );
}


/* =========================================================
   画像複製
   ========================================================= */

function writeImage(
    label: HTMLElement,
    imageDataUrl: string | null,
): void {
    const imageInput =
        getImageInput(label);

    const imagePreview =
        getImagePreview(label);

    const placeholder =
        getImagePlaceholder(label);

    /*
     * file inputにはプログラムから
     * ファイルそのものを設定できないため、
     * 選択状態はクリアする。
     *
     * 実際の画像情報はBase64化された
     * img.src側で保持する。
     */
    imageInput.value = "";

    /*
     * コピー元に画像がない場合は、
     * コピー先の画像も削除する。
     *
     * 空欄もコピー対象という仕様のため。
     */
    if (
        imageDataUrl === null
        || imageDataUrl === ""
    ) {
        imagePreview.removeAttribute(
            "src",
        );

        imagePreview.hidden =
            true;

        placeholder.hidden =
            false;

        return;
    }

    imagePreview.src =
        imageDataUrl;

    imagePreview.hidden =
        false;

    placeholder.hidden =
        true;
}


/* =========================================================
   ラベルへ書き込み
   ========================================================= */

function writeLabelData(
    label: HTMLElement,
    data: LabelData,
    copyImage: boolean,
): void {
    writeName(
        label,
        data.name,
    );

    writeJan(
        label,
        data.jan,
    );

    /*
     * 画像なしモードでは、
     * 隠れている画像データへ一切触れない。
     */
    if (copyImage) {
        writeImage(
            label,
            data.image,
        );
    }
}


/* =========================================================
   左上を全体へ複製
   ========================================================= */

/**
 * 1番目の入力内容を、
 * 現在のモードで使用するすべての面へ複製する。
 */
export function duplicateFirstToAll(
    preview: HTMLElement,
    imageMode: boolean,
): void {
    const labels =
        getActiveLabels(
            preview,
            imageMode,
        );

    if (labels.length === 0) {
        throw new Error(
            "複製対象のラベルが見つかりません。",
        );
    }

    const source =
        labels[0];

    const sourceData =
        readLabelData(source);

    /*
     * コピー元自身は変更不要なので、
     * 2番目以降へ複製する。
     */
    for (
        let index = 1;
        index < labels.length;
        index++
    ) {
        writeLabelData(
            labels[index],
            sourceData,
            imageMode,
        );
    }
}


/* =========================================================
   1行目を下へ複製
   ========================================================= */

/**
 * 1〜6番目の内容を、
 * 横位置を維持したまま下のすべての行へ複製する。
 *
 *
 * 例:
 *
 * A B C D E F
 * G H I J K L
 * M N O P Q R
 *
 * ↓
 *
 * A B C D E F
 * A B C D E F
 * A B C D E F
 *
 *
 * 空欄もそのまま複製する。
 */
export function duplicateFirstRowDown(
    preview: HTMLElement,
    imageMode: boolean,
): void {
    const labels =
        getActiveLabels(
            preview,
            imageMode,
        );

    if (
        labels.length
        < COLUMN_COUNT
    ) {
        throw new Error(
            "1行目のラベルが不足しています。",
        );
    }

    /*
     * 最初の6面をコピー元として、
     * 先に値を退避しておく。
     *
     * DOMを順番に直接コピーすると、
     * 書き換えた内容を次のコピー元として
     * 誤って使う可能性があるため。
     */
    const firstRowData:
        LabelData[] =
        labels
            .slice(
                0,
                COLUMN_COUNT,
            )
            .map(
                readLabelData,
            );

    /*
     * 2行目以降だけ処理する。
     */
    for (
        let index = COLUMN_COUNT;
        index < labels.length;
        index++
    ) {
        /*
         * 6列ごとにコピー元を循環させる。
         *
         * index 6  → source 0
         * index 7  → source 1
         * ...
         * index 11 → source 5
         * index 12 → source 0
         */
        const sourceIndex =
            index % COLUMN_COUNT;

        const sourceData =
            firstRowData[
            sourceIndex
            ];

        writeLabelData(
            labels[index],
            sourceData,
            imageMode,
        );
    }
}


/* =========================================================
   初期化
   ========================================================= */

/**
 * 複製メニューの2つのボタンへ
 * イベントを登録する。
 *
 * main.tsから1回だけ呼ぶ。
 */
export function initializeDuplicate(
    elements: DuplicateElements,
): void {
    const {
        preview,
        imageModeToggle,
        duplicateAllButton,
        duplicateRowButton,
    } = elements;


    /* =====================================================
       左上を全体へ複製
       ===================================================== */

    duplicateAllButton.addEventListener(
        "click",
        () => {
            try {
                duplicateFirstToAll(
                    preview,
                    imageModeToggle.checked,
                );
            } catch (error) {
                console.error(
                    "全体への複製に失敗しました。",
                    error,
                );
            }
        },
    );


    /* =====================================================
       1行目を下へ複製
       ===================================================== */

    duplicateRowButton.addEventListener(
        "click",
        () => {
            try {
                duplicateFirstRowDown(
                    preview,
                    imageModeToggle.checked,
                );
            } catch (error) {
                console.error(
                    "1行目の複製に失敗しました。",
                    error,
                );
            }
        },
    );
}