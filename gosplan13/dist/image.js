/**
 * image.ts
 *
 * 商品画像をブラウザ上で軽量化し、
 * 常に JPEG の Base64 へ変換して扱うためのユーティリティ群やにゃ。
 *
 * 方針:
 * - 入力は png / jpg / jpeg / webp / gif を受け付ける
 * - 出力は常に image/jpeg の Base64
 * - 長辺は 800px 以内へ縮小する
 * - 縦横比は維持する
 * - 透過部分は白背景へ合成する
 * - GIF は先頭フレームのみを画像として扱う
 * - できるだけ 600KB 以下へ圧縮する
 */
/**
 * 受け付ける画像の MIME タイプ一覧やにゃ。
 */
const SUPPORTED_IMAGE_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
];
/**
 * 画像圧縮の設定値やにゃ。
 * 必要になればここだけ触ればええように分離してあるにゃ。
 */
const DEFAULT_OPTIONS = {
    /**
     * 出力画像の最大幅やにゃ。
     */
    maxWidth: 800,
    /**
     * 出力画像の最大高さやにゃ。
     */
    maxHeight: 800,
    /**
     * JPEG 本体の目標最大サイズやにゃ。
     * 600KB 以下を狙うにゃ。
     */
    maxBytes: 600 * 1024,
    /**
     * 最初に試す JPEG 品質やにゃ。
     * 0〜1 の範囲で、1 に近いほど高品質やにゃ。
     */
    initialQuality: 0.8,
    /**
     * これ以上は画質を落とさない下限やにゃ。
     */
    minQuality: 0.4,
    /**
     * 容量が大きい場合に、何段階ずつ品質を下げるかやにゃ。
     */
    qualityStep: 0.1,
    /**
     * 品質だけではサイズが収まらない場合に、
     * 画像寸法をどれくらいずつ縮小するかやにゃ。
     */
    downscaleRatio: 0.85,
    /**
     * これ以上は画像寸法を小さくしない下限やにゃ。
     */
    minWidth: 100,
    /**
     * これ以上は画像寸法を小さくしない下限やにゃ。
     */
    minHeight: 100,
    /**
     * 透過画像を JPEG 化するときの背景色やにゃ。
     */
    backgroundColor: "#ffffff"
};
/**
 * 選択された画像ファイルを読み込み、
 * 長辺 800px 以内・JPEG・軽量化済みの Base64 へ変換するメイン関数やにゃ。
 *
 * @param file 元画像ファイル
 * @param customOptions 必要に応じて上書きする圧縮設定
 * @returns 圧縮済み画像情報
 */
export async function compressImageToJpeg(file, customOptions = {}) {
    const options = {
        ...DEFAULT_OPTIONS,
        ...customOptions
    };
    validateImageFile(file);
    const image = await loadImageFile(file);
    /*
     * 元画像の縦横比を保ったまま、
     * maxWidth × maxHeight の枠内へ収める寸法を計算するにゃ。
     */
    let { width, height } = calculateContainSize(image.naturalWidth, image.naturalHeight, options.maxWidth, options.maxHeight);
    /*
     * まずは現在の寸法で描画した Canvas を作るにゃ。
     */
    let canvas = drawImageToCanvas(image, width, height, options.backgroundColor);
    /*
     * まずは品質調整だけで目標サイズ以下になるか試すにゃ。
     */
    let blob = await compressCanvasByQuality(canvas, options);
    /*
     * 品質だけではサイズが収まらない場合は、
     * 画像寸法自体を段階的に縮小して再試行するにゃ。
     */
    while (blob.size > options.maxBytes &&
        (width > options.minWidth || height > options.minHeight)) {
        width = Math.max(options.minWidth, Math.round(width * options.downscaleRatio));
        height = Math.max(options.minHeight, Math.round(height * options.downscaleRatio));
        canvas = drawImageToCanvas(image, width, height, options.backgroundColor);
        blob = await compressCanvasByQuality(canvas, options);
        /*
         * 寸法がこれ以上縮められない場合はループを抜けるにゃ。
         */
        if (width <= options.minWidth &&
            height <= options.minHeight) {
            break;
        }
    }
    const base64 = await blobToBase64(blob);
    return {
        blob,
        base64,
        width,
        height,
        mimeType: "image/jpeg",
        originalFileName: file.name,
        originalFileType: file.type,
        originalBytes: file.size,
        compressedBytes: blob.size
    };
}
/**
 * 入力ファイルがサポート対象の画像かを検証するにゃ。
 *
 * @param file チェック対象ファイル
 */
function validateImageFile(file) {
    /*
     * ブラウザによっては type が空文字になるケースがあるにゃ。
     * その場合は拡張子でもざっくり許容するにゃ。
     */
    const lowerFileName = file.name.toLowerCase();
    const isSupportedByMimeType = SUPPORTED_IMAGE_MIME_TYPES.includes(file.type);
    const isSupportedByExtension = lowerFileName.endsWith(".png") ||
        lowerFileName.endsWith(".jpg") ||
        lowerFileName.endsWith(".jpeg") ||
        lowerFileName.endsWith(".webp") ||
        lowerFileName.endsWith(".gif");
    if (!isSupportedByMimeType && !isSupportedByExtension) {
        throw new Error("対応していない画像形式です。png / jpg / jpeg / webp / gif を選択してください。");
    }
}
/**
 * File を HTMLImageElement として読み込むにゃ。
 * GIF の場合も、ここでは先頭フレームの画像として読み込まれるにゃ。
 *
 * @param file 読み込む画像ファイル
 * @returns 読み込み済みの HTMLImageElement
 */
function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("画像ファイルの読み込みに失敗しました。"));
        };
        image.src = objectUrl;
    });
}
/**
 * 元画像の縦横比を維持しながら、
 * 指定された最大幅・最大高さの枠内へ収まる寸法を計算するにゃ。
 *
 * 例:
 * - 1600 × 900 → 800 × 450
 * - 900 × 1600 → 450 × 800
 * - 500 × 400 → 500 × 400
 *
 * @param originalWidth 元画像の幅
 * @param originalHeight 元画像の高さ
 * @param maxWidth 最大幅
 * @param maxHeight 最大高さ
 * @returns 縮小後の幅と高さ
 */
function calculateContainSize(originalWidth, originalHeight, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
    return {
        width: Math.max(1, Math.round(originalWidth * scale)),
        height: Math.max(1, Math.round(originalHeight * scale))
    };
}
/**
 * 画像を指定サイズで Canvas へ描画するにゃ。
 * 透過画像に備えて、先に白背景を敷くにゃ。
 *
 * @param image 元画像
 * @param width 描画後の幅
 * @param height 描画後の高さ
 * @param backgroundColor 背景色
 * @returns 描画済み Canvas
 */
function drawImageToCanvas(image, width, height, backgroundColor) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas の初期化に失敗しました。");
    }
    /*
     * JPEG は透過を持てないため、
     * 透過部分が黒くならないよう白背景を先に塗るにゃ。
     */
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas;
}
/**
 * Canvas を JPEG へ変換するにゃ。
 *
 * @param canvas 対象 Canvas
 * @param quality JPEG 品質
 * @returns JPEG の Blob
 */
function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Canvas の JPEG 変換に失敗しました。"));
                return;
            }
            resolve(blob);
        }, "image/jpeg", quality);
    });
}
/**
 * Canvas を品質調整だけで maxBytes 以下へ収めようとするにゃ。
 * 品質を initialQuality から minQuality まで段階的に下げるにゃ。
 *
 * @param canvas 対象 Canvas
 * @param options 圧縮設定
 * @returns 圧縮後 Blob
 */
async function compressCanvasByQuality(canvas, options) {
    let quality = options.initialQuality;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > options.maxBytes &&
        quality - options.qualityStep >= options.minQuality) {
        quality = Math.max(options.minQuality, quality - options.qualityStep);
        blob = await canvasToJpegBlob(canvas, quality);
    }
    return blob;
}
/**
 * Blob を Base64 の Data URL 文字列へ変換するにゃ。
 * 返り値は "data:image/jpeg;base64,..." の形式やにゃ。
 *
 * @param blob 変換対象 Blob
 * @returns Base64 の Data URL
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("Base64 文字列への変換に失敗しました。"));
                return;
            }
            resolve(reader.result);
        };
        reader.onerror = () => {
            reject(new Error("Blob の読み込みに失敗しました。"));
        };
        reader.readAsDataURL(blob);
    });
}
//# sourceMappingURL=image.js.map