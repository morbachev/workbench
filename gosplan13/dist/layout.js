/**
 * layout.ts
 *
 * A4プレビューや画面UIの表示状態を管理するファイル。
 *
 * このファイルが担当するもの:
 * - 画像あり／画像なしモードの切り替え
 * - モード切替用UIとプレビュー状態の同期
 * - プレビュー集中表示の切り替え
 * - 集中表示ボタンと解除ボタンの状態同期
 * - Escapeキーによる集中表示の解除
 * - 将来的なプレビュー倍率変更など
 *
 * 画像の圧縮やBase64変換はimage.ts、
 * JANコード処理はjan.tsが担当する。
 */
/**
 * 画像ありモード時に、
 * A4プレビューへ付与するCSSクラス。
 */
const IMAGE_MODE_CLASS = "a4-preview--with-images";
/**
 * プレビュー集中表示時に、
 * bodyへ付与するCSSクラス。
 *
 * ヘッダー、リボン、フッターなどの表示変更は、
 * このクラスを基準にCSS側で行う。
 */
const PREVIEW_ONLY_MODE_CLASS = "is-preview-only";
/**
 * レイアウト関連の処理を初期化する。
 *
 * main.tsからは、この関数を一度呼び出すだけでよい。
 *
 * @param elements レイアウト制御に必要なHTML要素
 * @returns レイアウト状態を外部から操作するためのコントローラー
 */
export function initializeLayout(elements) {
    const { preview, imageModeToggle, previewFocusButton, previewFocusExitButton } = elements;
    /*
     * HTML側で指定されている現在のクラス状態を基準にして、
     * チェックボックスの初期状態を同期する。
     *
     * これにより、
     * HTMLのchecked属性とプレビュー側のクラスが
     * 食い違っていても表示状態を統一できる。
     */
    imageModeToggle.checked =
        preview.classList.contains(IMAGE_MODE_CLASS);
    /**
     * 画像ありモードを切り替える。
     *
     * @param enabled trueなら画像あり、falseなら画像なし
     */
    function setImageMode(enabled) {
        preview.classList.toggle(IMAGE_MODE_CLASS, enabled);
        /*
         * 外部処理からモードを変更した場合でも、
         * チェックボックス表示を同じ状態に保つ。
         */
        imageModeToggle.checked = enabled;
    }
    /**
     * 現在、画像ありモードかどうかを返す。
     */
    function isImageModeEnabled() {
        return preview.classList.contains(IMAGE_MODE_CLASS);
    }
    /**
     * プレビュー集中表示を切り替える。
     *
     * bodyへクラスを付け外しするだけにしているため、
     * 実際にどの要素を非表示にするかはCSS側で管理できる。
     *
     * @param enabled trueならプレビュー集中表示
     */
    function setPreviewOnlyMode(enabled) {
        document.body.classList.toggle(PREVIEW_ONLY_MODE_CLASS, enabled);
        /*
         * スクリーンリーダーなどへ、
         * 現在の押下状態を伝える。
         */
        previewFocusButton.setAttribute("aria-pressed", String(enabled));
        previewFocusExitButton.setAttribute("aria-pressed", String(enabled));
        /*
         * 集中表示へ切り替えた場合は、
         * 戻すボタンへフォーカスを移動する。
         *
         * 通常表示へ戻した場合は、
         * リボン内の集中表示ボタンへフォーカスを戻す。
         */
        if (enabled) {
            previewFocusExitButton.focus();
        }
        else {
            previewFocusButton.focus();
        }
    }
    /**
     * 現在、プレビュー集中表示かどうかを返す。
     */
    function isPreviewOnlyModeEnabled() {
        return document.body.classList.contains(PREVIEW_ONLY_MODE_CLASS);
    }
    /**
     * プレビュー集中表示を反転させる。
     */
    function togglePreviewOnlyMode() {
        setPreviewOnlyMode(!isPreviewOnlyModeEnabled());
    }
    /*
     * 初期表示時のARIA状態を、
     * bodyの現在状態と同期する。
     */
    const initialPreviewOnlyMode = isPreviewOnlyModeEnabled();
    previewFocusButton.setAttribute("aria-pressed", String(initialPreviewOnlyMode));
    previewFocusExitButton.setAttribute("aria-pressed", String(initialPreviewOnlyMode));
    /*
     * チェックボックスの変更時に、
     * A4プレビューの画像モードを切り替える。
     */
    imageModeToggle.addEventListener("change", () => {
        setImageMode(imageModeToggle.checked);
    });
    /*
     * リボン内の集中表示ボタンを押したら、
     * プレビュー集中表示へ切り替える。
     */
    previewFocusButton.addEventListener("click", () => {
        setPreviewOnlyMode(true);
    });
    /*
     * 画面左下などに固定した解除ボタンを押したら、
     * 通常表示へ戻す。
     */
    previewFocusExitButton.addEventListener("click", () => {
        setPreviewOnlyMode(false);
    });
    /*
     * 集中表示中にEscapeキーを押したら、
     * 通常表示へ戻す。
     */
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" ||
            !isPreviewOnlyModeEnabled()) {
            return;
        }
        setPreviewOnlyMode(false);
    });
    return {
        isImageModeEnabled,
        setImageMode,
        isPreviewOnlyModeEnabled,
        setPreviewOnlyMode,
        togglePreviewOnlyMode
    };
}
//# sourceMappingURL=layout.js.map