/**
 * preset.ts
 *
 * 定型印刷物機能の
 * 型定義・定数・純粋関数を管理する。
 */


/* =========================================================
   用紙方向
   ========================================================= */

export type PresetOrientation =
    | "portrait"
    | "landscape";


/* =========================================================
   定型印刷物
   ========================================================= */

export type PresetDocument = {

    /**
     * レコード固有ID。
     *
     * タイトルやファイル名とは独立させる。
     */
    id: string;


    /**
     * カードに表示するタイトル。
     */
    title: string;


    /**
     * カードに表示する説明。
     */
    description: string;


    /**
     * A4縦 / A4横。
     */
    orientation: PresetOrientation;


    /**
     * PDFの元ファイル名。
     */
    pdfFileName: string;


    /**
     * PDF MIME Type。
     *
     * 基本的には application/pdf。
     */
    pdfMimeType: string;


    /**
     * PDF本体。
     *
     * Base64へ変換せず
     * BlobのままIndexedDBへ保存する。
     */
    pdfBlob: Blob;


    /**
     * プレビュー画像の元ファイル名。
     *
     * プレビュー未設定ならnull。
     */
    previewFileName: string | null;


    /**
     * プレビュー画像のMIME Type。
     */
    previewMimeType: string | null;


    /**
     * プレビュー画像本体。
     *
     * 未設定ならnull。
     */
    previewBlob: Blob | null;


    /**
     * カードの並び順。
     *
     * 現段階では追加順。
     */
    sortOrder: number;


    /**
     * 作成日時。
     *
     * Unix time milliseconds。
     */
    createdAt: number;


    /**
     * 最終更新日時。
     */
    updatedAt: number;
};


/* =========================================================
   定数
   ========================================================= */

export const PRESET_PDF_MIME_TYPE =
    "application/pdf";


export const PRESET_PREVIEW_MIME_TYPES =
    [
        "image/png",
        "image/jpeg",
        "image/webp"
    ] as const;


/* =========================================================
   Orientation
   ========================================================= */

export function isPresetOrientation(
    value: string
): value is PresetOrientation {

    return (
        value === "portrait" ||
        value === "landscape"
    );
}


export function getPresetOrientationLabel(
    orientation: PresetOrientation
): string {

    switch (orientation) {

        case "portrait":
            return "A4縦";

        case "landscape":
            return "A4横";
    }
}


/* =========================================================
   Sort
   ========================================================= */

export function sortPresetDocuments(
    documents: readonly PresetDocument[]
): PresetDocument[] {

    return [
        ...documents
    ].sort(
        (
            first,
            second
        ) => {

            if (
                first.sortOrder !==
                second.sortOrder
            ) {

                return (
                    first.sortOrder -
                    second.sortOrder
                );
            }


            return (
                first.createdAt -
                second.createdAt
            );
        }
    );
}


/* =========================================================
   File validation
   ========================================================= */

export function isPdfFile(
    file: File
): boolean {

    if (
        file.type ===
        PRESET_PDF_MIME_TYPE
    ) {
        return true;
    }


    /**
     * OSやブラウザによって
     * File.typeが空になる場合があるため、
     * 拡張子も確認する。
     */
    return /\.pdf$/i.test(
        file.name
    );
}


export function isPreviewImageFile(
    file: File
): boolean {

    if (
        PRESET_PREVIEW_MIME_TYPES.includes(
            file.type as
            typeof PRESET_PREVIEW_MIME_TYPES[number]
        )
    ) {
        return true;
    }


    /**
     * MIME Typeが空の場合への保険。
     */
    return /\.(png|jpe?g|webp)$/i.test(
        file.name
    );
}


/* =========================================================
   ID
   ========================================================= */

export function createPresetDocumentId(): string {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {

        return crypto.randomUUID();
    }


    /**
     * randomUUID非対応環境用。
     *
     * 現行ブラウザでは基本的に
     * randomUUID側が使用される。
     */
    return [
        "preset",
        Date.now(),
        Math.random()
            .toString(16)
            .slice(2)
    ].join("-");
}