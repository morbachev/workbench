/**
 * storage.ts
 *
 * GOSPLAN13の作業内容をlocalStorageへ自動保存し、
 * 次回アクセス時に自動復元する。
 *
 * 保存するもの:
 * - 画像あり / 画像なしモード
 * - 全ラベルの商品名
 * - 全ラベルのJANコード
 * - 全ラベルの商品画像（Base64 Data URL）
 *
 * 保存データは常に同じキーへ上書きするため、
 * 編集するたびにデータが増えていくことはない。
 *
 * 保存形式はexport.tsと共通。
 * 復元処理はimport.tsと共通。
 *
 *
 * 自動保存に失敗した場合:
 *
 * 1. そのページを開いてから最初の失敗時のみ、
 *    ユーザーへ確認ダイアログを表示する。
 *
 * 2. JSON保存を選択した場合は、
 *    export.tsのexportToJson()を使用して
 *    現在の作業内容をファイルとして保存する。
 *
 * 3. localStorageの既存データを削除する。
 *
 * 4. 現在の内容を1回だけ再保存する。
 *
 * 5. 再保存にも失敗した場合、
 *    それ以降は確認ダイアログを表示しない。
 */


import {
    createExportData,
    exportToJson,
} from "./export.js";

import type {
    ExportLabelData,
    Gosplan13ExportData,
} from "./export.js";

import {
    restoreImportData,
} from "./import.js";


/* =========================================================
   定数
   ========================================================= */

/**
 * localStorage内では常にこの1件だけを使用する。
 */
const STORAGE_KEY =
    "gosplan13.autosave.v1";


/**
 * 入力停止から自動保存するまでの時間。
 */
const SAVE_DELAY_MS =
    800;


/**
 * 現在対応している保存形式。
 */
const SUPPORTED_APP_NAME =
    "GOSPLAN13";

const SUPPORTED_VERSION =
    1;


/**
 * 自動保存失敗時の案内。
 *
 * window.confirm()を使用するため、
 * 実際のボタン表示はブラウザによって
 * 「OK / キャンセル」等になる。
 */
const SAVE_FAILURE_MESSAGE =
    "自動保存に失敗しました。\n\n"
    + "現在の作業内容をJSON形式で保存しますか？\n\n"
    + "時間を空けてから再度編集したい場合は「OK」を、\n"
    + "保存が不要な場合は「キャンセル」を選択してください。\n\n"
    + "現在画面に表示されているデータが、"
    + "すぐに消えることはありません。";


/* =========================================================
   型
   ========================================================= */

export type StorageElements = {
    preview: HTMLElement;
    imageModeToggle: HTMLInputElement;
};


export type StorageController = {
    /**
     * 現在の状態を即座に保存する。
     */
    saveNow: () => boolean;

    /**
     * 自動保存データを削除する。
     *
     * 画面上の入力内容は変更しない。
     */
    clearStorage: () => void;

    /**
     * 自動保存データが存在するか確認する。
     */
    hasStoredData: () => boolean;

    /**
     * イベント監視を解除する。
     */
    destroy: () => void;
};


/* =========================================================
   汎用型判定
   ========================================================= */

function isObject(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object"
        && value !== null
        && !Array.isArray(value)
    );
}


/* =========================================================
   ラベルデータ判定
   ========================================================= */

function isStoredLabelData(
    value: unknown,
): value is ExportLabelData {
    if (!isObject(value)) {
        return false;
    }

    if (
        typeof value.name
        !== "string"
    ) {
        return false;
    }

    if (
        typeof value.jan
        !== "string"
    ) {
        return false;
    }

    if (
        value.image !== null
        && typeof value.image
        !== "string"
    ) {
        return false;
    }

    if (
        typeof value.image === "string"
        && value.image !== ""
        && !value.image.startsWith(
            "data:image/",
        )
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   保存データ判定
   ========================================================= */

function isStoredData(
    value: unknown,
): value is Gosplan13ExportData {
    if (!isObject(value)) {
        return false;
    }

    if (
        value.app
        !== SUPPORTED_APP_NAME
    ) {
        return false;
    }

    if (
        value.version
        !== SUPPORTED_VERSION
    ) {
        return false;
    }

    if (
        typeof value.exportedAt
        !== "string"
    ) {
        return false;
    }

    if (!isObject(value.settings)) {
        return false;
    }

    if (
        typeof value.settings.imageMode
        !== "boolean"
    ) {
        return false;
    }

    if (!Array.isArray(value.labels)) {
        return false;
    }

    if (
        !value.labels.every(
            isStoredLabelData,
        )
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   保存済みデータ取得
   ========================================================= */

function readStoredData():
    Gosplan13ExportData | null {
    let rawData:
        string | null;

    try {
        rawData =
            localStorage.getItem(
                STORAGE_KEY,
            );
    } catch (error) {
        console.warn(
            "自動保存データを取得できませんでした。",
            error,
        );

        return null;
    }

    if (!rawData) {
        return null;
    }

    let parsedData:
        unknown;

    try {
        parsedData =
            JSON.parse(rawData);
    } catch (error) {
        console.warn(
            "自動保存データのJSONが壊れています。",
            error,
        );

        return null;
    }

    if (!isStoredData(parsedData)) {
        console.warn(
            "自動保存データの形式が現在のGOSPLAN13と一致しません。",
        );

        return null;
    }

    return parsedData;
}


/* =========================================================
   初期化
   ========================================================= */

export function initializeStorage(
    elements: StorageElements,
): StorageController {
    const {
        preview,
        imageModeToggle,
    } = elements;


    /* =====================================================
       状態
       ===================================================== */

    let saveTimer:
        number | null = null;

    let destroyed =
        false;

    /*
     * Importによる復元中に、
     * 復元イベントを自動保存として拾わないためのフラグ。
     */
    let isRestoring =
        false;

    /*
     * 保存失敗後の再試行中かどうか。
     *
     * 再試行にも失敗した場合、
     * 失敗処理を再帰的に呼ばないために使用する。
     */
    let isRetryingAfterFailure =
        false;

    /*
     * このページを開いている間に、
     * 一度でも保存失敗の案内を行ったか。
     *
     * trueになった後は、
     * 保存失敗が続いても確認ダイアログを出さない。
     */
    let hasHandledSaveFailure =
        false;


    /* =====================================================
       保存タイマー解除
       ===================================================== */

    function cancelScheduledSave():
        void {
        if (saveTimer === null) {
            return;
        }

        window.clearTimeout(
            saveTimer,
        );

        saveTimer = null;
    }


    /* =====================================================
       localStorage書き込み
       ===================================================== */

    /**
     * 現在の画面状態を取得し、
     * localStorageへ保存する。
     *
     * この関数自身ではエラー処理を行わず、
     * 呼び出し元へ例外を返す。
     */
    function writeCurrentState():
        void {
        const data =
            createExportData(
                preview,
                imageModeToggle,
            );

        const json =
            JSON.stringify(data);

        /*
         * 毎回同じキーへ上書きする。
         *
         * 保存履歴が増殖することはない。
         */
        localStorage.setItem(
            STORAGE_KEY,
            json,
        );
    }


    /* =====================================================
       保存失敗時の再試行
       ===================================================== */

    function retrySaveAfterFailure():
        void {
        isRetryingAfterFailure =
            true;

        try {
            /*
             * 既存の自動保存データを削除する。
             */
            localStorage.removeItem(
                STORAGE_KEY,
            );

            /*
             * 現在の内容を1回だけ再保存する。
             */
            writeCurrentState();

            console.info(
                "自動保存の再試行に成功しました。",
            );
        } catch (error) {
            /*
             * 再試行にも失敗した場合は、
             * もうダイアログを表示しない。
             *
             * 現在画面上の入力内容には触れない。
             */
            console.warn(
                "自動保存の再試行にも失敗しました。",
                error,
            );
        } finally {
            isRetryingAfterFailure =
                false;
        }
    }


    /* =====================================================
       保存失敗処理
       ===================================================== */

    function handleSaveFailure(
        error: unknown,
    ): void {
        console.warn(
            "GOSPLAN13の自動保存に失敗しました。",
            error,
        );

        /*
         * 再試行中の失敗では、
         * 追加の処理を行わない。
         */
        if (isRetryingAfterFailure) {
            return;
        }

        /*
         * 一度案内済みなら、
         * 同じページではもうダイアログを表示しない。
         */
        if (hasHandledSaveFailure) {
            return;
        }

        /*
         * confirmを表示する前にtrueへする。
         *
         * この後の処理中に何らかの保存処理が走っても、
         * ダイアログが重複しないようにする。
         */
        hasHandledSaveFailure =
            true;

        const shouldExport =
            window.confirm(
                SAVE_FAILURE_MESSAGE,
            );

        /*
         * OKを選択した場合だけ、
         * JSONファイルとして現在内容を保存する。
         */
        if (shouldExport) {
            try {
                exportToJson(
                    preview,
                    imageModeToggle,
                );
            } catch (exportError) {
                console.error(
                    "JSON形式での保存にも失敗しました。",
                    exportError,
                );

                window.alert(
                    "JSON形式で作業内容を保存できませんでした。\n"
                    + "現在画面に表示されている内容は、"
                    + "そのまま残っています。",
                );
            }
        }

        /*
         * OK / キャンセルのどちらを選択した場合でも、
         *
         * 既存のlocalStorageを削除し、
         * 現在状態の保存を1回だけ再試行する。
         */
        retrySaveAfterFailure();
    }


    /* =====================================================
       即時保存
       ===================================================== */

    function saveNow():
        boolean {
        if (
            destroyed
            || isRestoring
        ) {
            return false;
        }

        cancelScheduledSave();

        try {
            writeCurrentState();

            return true;
        } catch (error) {
            handleSaveFailure(
                error,
            );

            return false;
        }
    }


    /* =====================================================
       遅延保存
       ===================================================== */

    function scheduleSave():
        void {
        if (
            destroyed
            || isRestoring
        ) {
            return;
        }

        cancelScheduledSave();

        saveTimer =
            window.setTimeout(
                () => {
                    saveTimer = null;

                    saveNow();
                },
                SAVE_DELAY_MS,
            );
    }


    /* =====================================================
       起動時復元
       ===================================================== */

    function restoreStoredData():
        void {
        const data =
            readStoredData();

        if (!data) {
            return;
        }

        isRestoring =
            true;

        try {
            restoreImportData(
                data,
                preview,
                imageModeToggle,
            );
        } catch (error) {
            console.warn(
                "前回の作業内容を復元できませんでした。",
                error,
            );
        } finally {
            isRestoring =
                false;
        }
    }


    /* =====================================================
       プレビュー内の入力監視
       ===================================================== */

    function handlePreviewInput(
        event: Event,
    ): void {
        const target =
            event.target;

        if (!(target instanceof Element)) {
            return;
        }

        /*
         * 商品ラベル内の入力だけを
         * 自動保存対象とする。
         */
        if (
            !target.closest(
                ".product-label",
            )
        ) {
            return;
        }

        scheduleSave();
    }


    /* =====================================================
       画像モード監視
       ===================================================== */

    function handleImageModeChange():
        void {
        scheduleSave();
    }


    /* =====================================================
       画像Base64変更監視
       ===================================================== */

    /**
     * image.tsによる画像変換完了後、
     * img.srcへBase64 Data URLが設定される。
     *
     * file inputのchangeだけを監視すると、
     * 画像変換完了前に保存される可能性があるため、
     * src属性そのものも監視する。
     */
    const imageObserver =
        new MutationObserver(
            mutations => {
                if (
                    destroyed
                    || isRestoring
                ) {
                    return;
                }

                const hasImageChange =
                    mutations.some(
                        mutation => {
                            if (
                                mutation.type
                                !== "attributes"
                            ) {
                                return false;
                            }

                            if (
                                mutation.attributeName
                                !== "src"
                            ) {
                                return false;
                            }

                            const target =
                                mutation.target;

                            if (
                                !(
                                    target
                                    instanceof
                                    HTMLImageElement
                                )
                            ) {
                                return false;
                            }

                            return target.matches(
                                ".product-label__image-preview",
                            );
                        },
                    );

                if (hasImageChange) {
                    scheduleSave();
                }
            },
        );


    /* =====================================================
       保存データ削除
       ===================================================== */

    function clearStorage():
        void {
        /*
         * 予約中の自動保存も解除する。
         *
         * clear.tsから呼ばれた直後に、
         * 空データが再保存されることを防ぐ。
         */
        cancelScheduledSave();

        try {
            localStorage.removeItem(
                STORAGE_KEY,
            );
        } catch (error) {
            console.warn(
                "自動保存データを削除できませんでした。",
                error,
            );
        }
    }


    /* =====================================================
       保存データ存在確認
       ===================================================== */

    function hasStoredData():
        boolean {
        try {
            return (
                localStorage.getItem(
                    STORAGE_KEY,
                ) !== null
            );
        } catch {
            return false;
        }
    }


    /* =====================================================
       初期処理
       ===================================================== */

    /*
     * イベント監視開始前に復元する。
     *
     * 復元時に発火するinput/changeイベントを
     * 自動保存として拾わないため。
     */
    restoreStoredData();


    /*
     * 商品名・JAN・画像inputなどを
     * イベント委譲でまとめて監視する。
     */
    preview.addEventListener(
        "input",
        handlePreviewInput,
    );

    preview.addEventListener(
        "change",
        handlePreviewInput,
    );


    /*
     * 画像あり / 画像なしモード。
     */
    imageModeToggle.addEventListener(
        "change",
        handleImageModeChange,
    );


    /*
     * Base64画像のsrc変更を監視する。
     */
    imageObserver.observe(
        preview,
        {
            subtree: true,
            attributes: true,

            attributeFilter: [
                "src",
            ],
        },
    );


    /* =====================================================
       外部公開
       ===================================================== */

    return {
        saveNow,

        clearStorage,

        hasStoredData,

        destroy: () => {
            if (destroyed) {
                return;
            }

            destroyed =
                true;

            cancelScheduledSave();

            preview.removeEventListener(
                "input",
                handlePreviewInput,
            );

            preview.removeEventListener(
                "change",
                handlePreviewInput,
            );

            imageModeToggle.removeEventListener(
                "change",
                handleImageModeChange,
            );

            imageObserver.disconnect();
        },
    };
}