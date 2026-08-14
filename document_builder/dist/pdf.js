import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
/* =========================================================
   Constants
   ========================================================= */
export const DOCUMENT_PDF_FILE_NAME = "文書.pdf";
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_CAPTURE_SCALE = 2;
/* =========================================================
   Cancel Error
   ========================================================= */
export class PdfSaveCancelledError extends Error {
    constructor() {
        super("PDF保存がキャンセルされました。");
        this.name =
            "PdfSaveCancelledError";
    }
}
/* =========================================================
   Public API
   ========================================================= */
/**
 * 現在のA4プレビューからPDFを生成し、
 * ユーザー端末へ保存する。
 */
export async function saveDocumentPdf(pageElement) {
    const pdfBlob = await createDocumentPdfBlob(pageElement);
    return savePdfBlob(pdfBlob);
}
/**
 * A4プレビューからPDF Blobを生成する。
 */
export async function createDocumentPdfBlob(pageElement) {
    /*
     * Webフォント等があれば、
     * 描画が完了してからキャプチャする。
     */
    if (document.fonts) {
        await document.fonts.ready;
    }
    pageElement.classList.add("document-page--pdf-capture");
    try {
        /*
         * class追加後のレイアウトを
         * ブラウザへ反映させる。
         */
        await waitForNextFrame();
        const canvas = await html2canvas(pageElement, {
            backgroundColor: "#ffffff",
            scale: PDF_CAPTURE_SCALE,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0
        });
        const imageData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });
        /*
         * A4全面へ現在のプレビューを配置。
         */
        pdf.addImage(imageData, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
        return pdf.output("blob");
    }
    finally {
        pageElement.classList.remove("document-page--pdf-capture");
    }
}
/* =========================================================
   Save
   ========================================================= */
async function savePdfBlob(blob) {
    const browserWindow = window;
    /*
     * 対応ブラウザでは保存先をユーザーに選択してもらい、
     * close()完了まで待つ。
     */
    if (typeof browserWindow
        .showSaveFilePicker ===
        "function") {
        try {
            const handle = await browserWindow
                .showSaveFilePicker({
                suggestedName: DOCUMENT_PDF_FILE_NAME,
                types: [
                    {
                        description: "PDFファイル",
                        accept: {
                            "application/pdf": [
                                ".pdf"
                            ]
                        }
                    }
                ]
            });
            const writable = await handle
                .createWritable();
            await writable.write(blob);
            await writable.close();
            return {
                fileName: DOCUMENT_PDF_FILE_NAME,
                method: "file-picker"
            };
        }
        catch (error) {
            if (isAbortError(error)) {
                throw new PdfSaveCancelledError();
            }
            /*
             * File System Access APIが存在していても
             * 書き込み不可の場合は通常ダウンロードへ退避。
             */
            console.warn("File System Access APIによるPDF保存に失敗したため、通常ダウンロードへ切り替えます。", error);
        }
    }
    downloadPdfBlob(blob);
    return {
        fileName: DOCUMENT_PDF_FILE_NAME,
        method: "download"
    };
}
/* =========================================================
   Download fallback
   ========================================================= */
function downloadPdfBlob(blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href =
        url;
    anchor.download =
        DOCUMENT_PDF_FILE_NAME;
    anchor.hidden =
        true;
    document.body.appendChild(anchor);
    try {
        anchor.click();
    }
    finally {
        anchor.remove();
        /*
         * click直後に破棄すると
         * 一部環境で読み込み前に消える可能性を避ける。
         */
        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }
}
/* =========================================================
   Abort
   ========================================================= */
function isAbortError(error) {
    return (error instanceof
        DOMException &&
        error.name ===
            "AbortError");
}
/* =========================================================
   Frame
   ========================================================= */
function waitForNextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            resolve();
        });
    });
}
//# sourceMappingURL=pdf.js.map