/**
 * clear.ts
 *
 * GOSPLAN13の入力内容をすべて初期化する。
 *
 * クリア対象:
 * - 全48面の商品名
 * - 全48面のJANコード
 * - 全48面の商品画像
 * - JANから生成されたバーコード表示
 * - localStorageの自動保存データ
 *
 * クリアしないもの:
 * - 画像あり / 画像なしモード
 *
 * 実行前に確認ダイアログを表示する。
 */
/* =========================================================
   定数
   ========================================================= */
const CLEAR_CONFIRM_MESSAGE = "入力内容をすべて削除します。\n"
    + "画像と自動保存された内容も削除されます。\n\n"
    + "よろしいですか？";
/* =========================================================
   入力変更通知
   ========================================================= */
/**
 * プログラムからinput.valueを変更した場合でも、
 * JAN描画など既存のイベント処理へ変更を通知する。
 */
function notifyInputChanged(input) {
    input.dispatchEvent(new Event("input", {
        bubbles: true,
    }));
    input.dispatchEvent(new Event("change", {
        bubbles: true,
    }));
    input.dispatchEvent(new FocusEvent("focusout", {
        bubbles: true,
    }));
}
/* =========================================================
   商品名クリア
   ========================================================= */
function clearProductName(label) {
    const input = label.querySelector(".product-label__name-input");
    if (!input) {
        throw new Error("商品名入力欄が見つかりません。");
    }
    input.value = "";
    notifyInputChanged(input);
}
/* =========================================================
   JANクリア
   ========================================================= */
function clearJan(label) {
    const input = label.querySelector(".product-label__jan-input");
    if (!input) {
        throw new Error("JAN入力欄が見つかりません。");
    }
    input.value = "";
    /*
     * 既存のJAN処理へ空文字を通知することで、
     * バーコード表示やエラー表示も
     * 初期状態へ戻す。
     */
    notifyInputChanged(input);
}
/* =========================================================
   商品画像クリア
   ========================================================= */
function clearProductImage(label) {
    const imageInput = label.querySelector(".product-label__image-input");
    const imagePreview = label.querySelector(".product-label__image-preview");
    const imagePlaceholder = label.querySelector(".product-label__image-placeholder");
    if (!imageInput) {
        throw new Error("商品画像入力欄が見つかりません。");
    }
    if (!imagePreview) {
        throw new Error("商品画像プレビューが見つかりません。");
    }
    if (!imagePlaceholder) {
        throw new Error("商品画像プレースホルダーが見つかりません。");
    }
    /*
     * file inputの選択状態を解除。
     */
    imageInput.value = "";
    /*
     * Base64画像を削除。
     */
    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
    /*
     * 初期状態の画像選択UIを表示。
     */
    imagePlaceholder.hidden = false;
}
/* =========================================================
   1面クリア
   ========================================================= */
function clearLabel(label) {
    clearProductName(label);
    clearJan(label);
    clearProductImage(label);
}
/* =========================================================
   全ラベル取得
   ========================================================= */
function getProductLabels(preview) {
    return Array.from(preview.querySelectorAll(".product-label"));
}
/* =========================================================
   全入力内容クリア
   ========================================================= */
/**
 * 画面上の全ラベルを初期状態へ戻す。
 *
 * 画像ありモードの場合でも、
 * CSSで非表示になっている25〜48面を含めて
 * DOM上の全ラベルをクリアする。
 */
export function clearAllLabels(preview) {
    const labels = getProductLabels(preview);
    if (labels.length === 0) {
        throw new Error("クリア対象のラベルが見つかりません。");
    }
    for (const label of labels) {
        clearLabel(label);
    }
}
/* =========================================================
   初期化
   ========================================================= */
/**
 * 「すべてクリア」ボタンへ処理を登録する。
 *
 * main.tsから1回だけ呼び出す。
 */
export function initializeClear(elements) {
    const { preview, clearButton, clearStoredData, } = elements;
    clearButton.addEventListener("click", () => {
        const confirmed = window.confirm(CLEAR_CONFIRM_MESSAGE);
        if (!confirmed) {
            return;
        }
        try {
            /*
             * 先に画面を空にする。
             *
             * JANのイベントなどによって
             * storage.ts側では一時的に
             * 自動保存が予約される可能性がある。
             */
            clearAllLabels(preview);
            /*
             * 最後にstorage.tsへ保存削除を依頼する。
             *
             * storageController.clearStorage()は
             * localStorageだけでなく
             * 予約されている自動保存タイマーも
             * cancelするため、
             *
             * 「消した800ms後に空データが
             *  また自動保存される」
             *
             * という動作も防げる。
             */
            clearStoredData();
        }
        catch (error) {
            console.error("入力内容のクリアに失敗しました。", error);
            window.alert("入力内容を削除できませんでした。");
        }
    });
}
//# sourceMappingURL=clear.js.map