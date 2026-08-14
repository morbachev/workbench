import {
    RED_INDEX_VERSION,
    cloneRedIndexData,
    parseRedIndexData
} from "./model.js";

import type {
    RedIndexData
} from "./model.js";


/* =========================================================
   Constants
   ========================================================= */

const MAX_JSON_FILE_SIZE =
    1024 * 1024;


const EXPORT_FILE_NAME_PREFIX =
    "割引不可商品リスト";


/* =========================================================
   Import
   ========================================================= */

export async function importRedIndexJson(
    file: File
): Promise<RedIndexData> {

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
            );

    } catch {

        throw new Error(
            "JSONとして読み込めないファイルです。"
        );
    }


    return parseRedIndexData(
        parsed
    );
}


/* =========================================================
   Export
   ========================================================= */

export function exportRedIndexJson(
    data: RedIndexData
): void {

    const exportData:
        RedIndexData = {

        version:
            RED_INDEX_VERSION,

        categories:
            cloneRedIndexData(
                data
            ).categories
    };


    const json =
        JSON.stringify(
            exportData,
            null,
            4
        );


    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json;charset=utf-8"
            }
        );


    downloadBlob(
        blob,
        createExportFileName()
    );
}


/* =========================================================
   File Name
   ========================================================= */

/**
 * JSON出力時のファイル名を生成する。
 *
 * 例:
 * 8月14日
 * ↓
 * 割引不可商品リスト_0814.json
 */
function createExportFileName(): string {

    const now =
        new Date();


    const month =
        String(
            now.getMonth() +
            1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${EXPORT_FILE_NAME_PREFIX}_${month}${day}.json`
    );
}


/* =========================================================
   Download
   ========================================================= */

function downloadBlob(
    blob: Blob,
    fileName: string
): void {

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


        window.setTimeout(
            () => {

                URL.revokeObjectURL(
                    url
                );

            },
            1000
        );
    }
}