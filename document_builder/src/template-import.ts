import {
    createDocumentPackage,
    createTemplatePackage,
    DocumentPackage,
    DocumentTemplate,
    DocumentValues,
    parseDocumentPackage
} from "./template.js";


/* =========================================================
   Limits
   ========================================================= */

const MAX_JSON_FILE_SIZE =
    1024 * 1024;


/* =========================================================
   Import
   ========================================================= */

/**
 * JSONファイルを読み、
 * 構造まで検証する。
 */
export async function readDocumentPackageFile(
    file: File
): Promise<DocumentPackage> {

    if (
        file.size >
        MAX_JSON_FILE_SIZE
    ) {

        throw new Error(
            "JSONファイルが大きすぎます。1MB以下のファイルを使用してください。"
        );
    }


    const text =
        await file.text();


    let parsed:
        unknown;


    try {

        parsed =
            JSON.parse(
                text
            ) as unknown;

    } catch {

        throw new Error(
            "JSONファイルを解析できませんでした。"
        );
    }


    return parseDocumentPackage(
        parsed
    );
}


/* =========================================================
   Template export
   ========================================================= */

/**
 * A:
 * テンプレートだけを書き出す。
 *
 * 設定モーダル用。
 */
export function downloadTemplateJson(
    template: DocumentTemplate
): void {

    downloadJson(
        createTemplatePackage(
            template
        ),
        `${sanitizeFileName(
            template.name
        )}_template.json`
    );
}


/* =========================================================
   Current document export
   ========================================================= */

/**
 * B:
 * テンプレート +
 * 現在入力中の値を書き出す。
 *
 * リボン用。
 */
export function downloadDocumentJson(
    template: DocumentTemplate,
    values: DocumentValues
): void {

    downloadJson(
        createDocumentPackage(
            template,
            values
        ),
        `${sanitizeFileName(
            template.name
        )}_document.json`
    );
}


/* =========================================================
   Download
   ========================================================= */

function downloadJson(
    data: DocumentPackage,
    fileName: string
): void {

    const json =
        JSON.stringify(
            data,
            null,
            2
        );


    const blob =
        new Blob(
            [
                json
            ],
            {
                type:
                    "application/json;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        url;

    anchor.download =
        fileName;

    anchor.hidden =
        true;


    document.body.appendChild(
        anchor
    );


    try {

        anchor.click();

    } finally {

        anchor.remove();


        URL.revokeObjectURL(
            url
        );
    }
}


/* =========================================================
   File name
   ========================================================= */

function sanitizeFileName(
    value: string
): string {

    const sanitized =
        value
            .trim()
            .replace(
                /[\\/:*?"<>|]/g,
                "_"
            )
            .replace(
                /\s+/g,
                "_"
            )
            .slice(
                0,
                80
            );


    return (
        sanitized ||
        "document"
    );
}