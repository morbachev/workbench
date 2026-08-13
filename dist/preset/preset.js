/**
 * preset.ts
 *
 * 定型印刷物機能の
 * 型定義・定数・純粋関数を管理する。
 */
/* =========================================================
   定数
   ========================================================= */
export const PRESET_PDF_MIME_TYPE = "application/pdf";
export const PRESET_PREVIEW_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp"
];
/* =========================================================
   Orientation
   ========================================================= */
export function isPresetOrientation(value) {
    return (value === "portrait" ||
        value === "landscape");
}
export function getPresetOrientationLabel(orientation) {
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
export function sortPresetDocuments(documents) {
    return [
        ...documents
    ].sort((first, second) => {
        if (first.sortOrder !==
            second.sortOrder) {
            return (first.sortOrder -
                second.sortOrder);
        }
        return (first.createdAt -
            second.createdAt);
    });
}
/* =========================================================
   File validation
   ========================================================= */
export function isPdfFile(file) {
    if (file.type ===
        PRESET_PDF_MIME_TYPE) {
        return true;
    }
    /**
     * OSやブラウザによって
     * File.typeが空になる場合があるため、
     * 拡張子も確認する。
     */
    return /\.pdf$/i.test(file.name);
}
export function isPreviewImageFile(file) {
    if (PRESET_PREVIEW_MIME_TYPES.includes(file.type)) {
        return true;
    }
    /**
     * MIME Typeが空の場合への保険。
     */
    return /\.(png|jpe?g|webp)$/i.test(file.name);
}
/* =========================================================
   ID
   ========================================================= */
export function createPresetDocumentId() {
    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {
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
//# sourceMappingURL=preset.js.map