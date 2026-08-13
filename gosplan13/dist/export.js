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
   ラベルDOM取得
   ========================================================= */
/**
 * A4プレビュー内に存在する全ラベルを取得する。
 *
 * 画像ありモードで25〜48面が非表示になっていても、
 * DOM上には存在するため全件取得する。
 */
function getProductLabels(preview) {
    return Array.from(preview.querySelectorAll(".product-label"));
}
/* =========================================================
   商品名取得
   ========================================================= */
function getLabelName(label) {
    const input = label.querySelector(".product-label__name-input");
    if (!input) {
        throw new Error("商品名入力欄が見つかりません。");
    }
    return input.value;
}
/* =========================================================
   JAN取得
   ========================================================= */
function getLabelJan(label) {
    const input = label.querySelector(".product-label__jan-input");
    if (!input) {
        throw new Error("JAN入力欄が見つかりません。");
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
function getLabelImage(label) {
    const image = label.querySelector(".product-label__image-preview");
    if (!image) {
        throw new Error("商品画像プレビューが見つかりません。");
    }
    const source = image.getAttribute("src");
    if (!source
        || source.trim() === "") {
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
        console.warn("Base64 Data URLではない画像が検出されました。", source);
    }
    return source;
}
/* =========================================================
   1面分のデータ生成
   ========================================================= */
function createLabelData(label) {
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
export function createExportData(preview, imageModeToggle) {
    const labels = getProductLabels(preview);
    if (labels.length === 0) {
        throw new Error("保存対象のラベルが見つかりません。");
    }
    return {
        app: "GOSPLAN13",
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        settings: {
            imageMode: imageModeToggle.checked,
        },
        /*
         * 空欄を含めて全件保存する。
         *
         * filter()などで空欄を削除してはいけない。
         * 配列位置がそのままラベル位置になる。
         */
        labels: labels.map(createLabelData),
    };
}
/* =========================================================
   ファイル名生成
   ========================================================= */
/**
 * 例:
 * gosplan13_20260808_090501.json
 */
function createExportFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return (`${EXPORT_FILE_PREFIX}_`
        + `${year}${month}${day}_`
        + `${hours}${minutes}${seconds}`
        + ".json");
}
/* =========================================================
   JSON生成
   ========================================================= */
/**
 * 保存データを読みやすいJSON文字列へ変換する。
 *
 * 2スペースインデントを使用する。
 */
export function stringifyExportData(data) {
    return JSON.stringify(data, null, 2);
}
/* =========================================================
   JSONダウンロード
   ========================================================= */
function downloadJson(json, fileName) {
    const blob = new Blob([json], {
        type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
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
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 0);
}
/* =========================================================
   Export実行
   ========================================================= */
/**
 * 現在の入力状態を取得し、
 * JSONファイルとしてダウンロードする。
 */
export function exportToJson(preview, imageModeToggle) {
    const data = createExportData(preview, imageModeToggle);
    const json = stringifyExportData(data);
    const fileName = createExportFileName();
    downloadJson(json, fileName);
}
/* =========================================================
   初期化
   ========================================================= */
/**
 * JSON出力ボタンへExport処理を登録する。
 *
 * main.tsから1回だけ呼び出す。
 */
export function initializeExport(elements) {
    const { preview, imageModeToggle, exportButton, } = elements;
    exportButton.addEventListener("click", () => {
        try {
            exportToJson(preview, imageModeToggle);
        }
        catch (error) {
            console.error("JSONの出力に失敗しました。", error);
        }
    });
}
//# sourceMappingURL=export.js.map