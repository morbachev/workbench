/**
 * export.ts
 *
 * GOSPLAN13の入力内容をJSONファイルとして出力する。
 *
 * 保存するもの:
 * - データ形式のバージョン
 * - 出力日時
 * - 画像あり / 画像なしモード
 * - 全ラベルの商品名
 * - 全ラベルのJANコード
 * - 全ラベルの商品画像（Base64 Data URL）
 *
 * 空欄のラベルも削除せず保存する。
 * labels配列の位置 = 画面上のラベル位置として扱う。
 *
 * 将来的には、このデータ構造をそのまま
 * ImportやlocalStorageでも利用する想定。
 */


/* =========================================================
   定数
   ========================================================= */

const EXPORT_VERSION = 1;

const EXPORT_FILE_PREFIX = "gosplan13";


/* =========================================================
   型
   ========================================================= */

/**
 * 1面分の商品情報。
 *
 * 配列内の位置そのものがラベル位置を表すため、
 * indexは保存しない。
 */
export type ExportLabelData = {
    name: string;
    jan: string;
    image: string | null;
};


/**
 * 画面設定。
 */
export type ExportSettings = {
    imageMode: boolean;
};


/**
 * GOSPLAN13の保存データ全体。
 */
export type Gosplan13ExportData = {
    app: "GOSPLAN13";
    version: number;
    exportedAt: string;

    settings: ExportSettings;

    labels: ExportLabelData[];
};


/**
 * Export機能に必要なHTML要素。
 */
export type ExportElements = {
    preview: HTMLElement;
    imageModeToggle: HTMLInputElement;
    exportButton: HTMLButtonElement;
};


/* =========================================================
   ラベルDOM取得
   ========================================================= */

/**
 * A4プレビュー内に存在する全ラベルを取得する。
 *
 * 画像ありモードで25〜48面が非表示になっていても、
 * DOM上には存在するため全件取得する。
 */
function getProductLabels(
    preview: HTMLElement,
): HTMLElement[] {
    return Array.from(
        preview.querySelectorAll<HTMLElement>(
            ".product-label",
        ),
    );
}


/* =========================================================
   商品名取得
   ========================================================= */

function getLabelName(
    label: HTMLElement,
): string {
    const input =
        label.querySelector<HTMLInputElement>(
            ".product-label__name-input",
        );

    if (!input) {
        throw new Error(
            "商品名入力欄が見つかりません。",
        );
    }

    return input.value;
}


/* =========================================================
   JAN取得
   ========================================================= */

function getLabelJan(
    label: HTMLElement,
): string {
    const input =
        label.querySelector<HTMLInputElement>(
            ".product-label__jan-input",
        );

    if (!input) {
        throw new Error(
            "JAN入力欄が見つかりません。",
        );
    }

    /*
     * 入力内容をそのまま保存する。
     *
     * Export時にはJANの再検証や正規化を行わない。
     * ユーザーが画面に入力している状態を
     * そのまま復元できることを優先する。
     */
    return input.value;
}


/* =========================================================
   商品画像取得
   ========================================================= */

/**
 * 画像プレビューへ設定されている
 * Base64 Data URLを取得する。
 *
 * 画像がない場合はnullを返す。
 */
function getLabelImage(
    label: HTMLElement,
): string | null {
    const image =
        label.querySelector<HTMLImageElement>(
            ".product-label__image-preview",
        );

    if (!image) {
        throw new Error(
            "商品画像プレビューが見つかりません。",
        );
    }

    const source =
        image.getAttribute("src");

    if (
        !source
        || source.trim() === ""
    ) {
        return null;
    }

    /*
     * 現在のGOSPLAN13では画像処理後の画像を
     * Data URLとして保持する前提。
     *
     * ImportやlocalStorageでもそのまま
     * img.srcへ戻せる形式となる。
     */
    if (!source.startsWith("data:image/")) {
        console.warn(
            "Base64 Data URLではない画像が検出されました。",
            source,
        );
    }

    return source;
}


/* =========================================================
   1面分のデータ生成
   ========================================================= */

function createLabelData(
    label: HTMLElement,
): ExportLabelData {
    return {
        name: getLabelName(label),
        jan: getLabelJan(label),
        image: getLabelImage(label),
    };
}


/* =========================================================
   現在状態を保存データへ変換
   ========================================================= */

/**
 * 現在のGOSPLAN13の状態を、
 * JSON化可能なオブジェクトへ変換する。
 *
 * この関数はファイル出力を行わない。
 *
 * 将来的にlocalStorageへ保存するときも
 * この関数をそのまま利用できる。
 */
export function createExportData(
    preview: HTMLElement,
    imageModeToggle: HTMLInputElement,
): Gosplan13ExportData {
    const labels =
        getProductLabels(preview);

    if (labels.length === 0) {
        throw new Error(
            "保存対象のラベルが見つかりません。",
        );
    }

    return {
        app: "GOSPLAN13",

        version:
            EXPORT_VERSION,

        exportedAt:
            new Date().toISOString(),

        settings: {
            imageMode:
                imageModeToggle.checked,
        },

        /*
         * 空欄を含めて全件保存する。
         *
         * filter()などで空欄を削除してはいけない。
         * 配列位置がそのままラベル位置になる。
         */
        labels:
            labels.map(
                createLabelData,
            ),
    };
}


/* =========================================================
   ファイル名生成
   ========================================================= */

/**
 * 例:
 * gosplan13_20260808_090501.json
 */
function createExportFileName(
    date: Date = new Date(),
): string {
    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1,
        ).padStart(2, "0");

    const day =
        String(
            date.getDate(),
        ).padStart(2, "0");

    const hours =
        String(
            date.getHours(),
        ).padStart(2, "0");

    const minutes =
        String(
            date.getMinutes(),
        ).padStart(2, "0");

    const seconds =
        String(
            date.getSeconds(),
        ).padStart(2, "0");

    return (
        `${EXPORT_FILE_PREFIX}_`
        + `${year}${month}${day}_`
        + `${hours}${minutes}${seconds}`
        + ".json"
    );
}


/* =========================================================
   JSON生成
   ========================================================= */

/**
 * 保存データを読みやすいJSON文字列へ変換する。
 *
 * 2スペースインデントを使用する。
 */
export function stringifyExportData(
    data: Gosplan13ExportData,
): string {
    return JSON.stringify(
        data,
        null,
        2,
    );
}


/* =========================================================
   JSONダウンロード
   ========================================================= */

function downloadJson(
    json: string,
    fileName: string,
): void {
    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json;charset=utf-8",
            },
        );

    const objectUrl =
        URL.createObjectURL(blob);

    const anchor =
        document.createElement("a");

    anchor.href =
        objectUrl;

    anchor.download =
        fileName;

    /*
     * Firefoxなどを含め、
     * DOMへ追加してからクリックする方が安定する。
     */
    document.body.append(anchor);

    anchor.click();

    anchor.remove();

    /*
     * click直後にrevokeすると、
     * ブラウザによってはダウンロード開始前に
     * URLが破棄される可能性があるため、
     * 次のタスクで解放する。
     */
    window.setTimeout(
        () => {
            URL.revokeObjectURL(
                objectUrl,
            );
        },
        0,
    );
}


/* =========================================================
   Export実行
   ========================================================= */

/**
 * 現在の入力状態を取得し、
 * JSONファイルとしてダウンロードする。
 */
export function exportToJson(
    preview: HTMLElement,
    imageModeToggle: HTMLInputElement,
): void {
    const data =
        createExportData(
            preview,
            imageModeToggle,
        );

    const json =
        stringifyExportData(data);

    const fileName =
        createExportFileName();

    downloadJson(
        json,
        fileName,
    );
}


/* =========================================================
   初期化
   ========================================================= */

/**
 * JSON出力ボタンへExport処理を登録する。
 *
 * main.tsから1回だけ呼び出す。
 */
export function initializeExport(
    elements: ExportElements,
): void {
    const {
        preview,
        imageModeToggle,
        exportButton,
    } = elements;

    exportButton.addEventListener(
        "click",
        () => {
            try {
                exportToJson(
                    preview,
                    imageModeToggle,
                );
            } catch (error) {
                console.error(
                    "JSONの出力に失敗しました。",
                    error,
                );
            }
        },
    );
}