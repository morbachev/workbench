/**
 * backup-zip.ts
 *
 * WORKBENCHバックアップZIPの
 * 生成と読み込みを担当する。
 *
 * ZIP構造:
 *
 * manifest.json
 *
 * document_builder/
 *   templates.json
 *
 * red_index/
 *   data.json
 *
 * preset_documents/
 *   documents.json
 *   pdf/
 *     ...
 *   images/
 *     ...
 */

import JSZip from "jszip";


import type {
    PresetDocument
} from "../preset/preset.js";


import {
    DOCUMENT_TEMPLATES_VERSION,
    PRESET_DOCUMENTS_VERSION,
    WORKBENCH_BACKUP_VERSION,
    parseDocumentTemplatesArchive,
    parsePresetDocumentsArchive,
    parseRedIndexData,
    parseWorkbenchBackupManifest,
    type PresetDocumentArchiveMetadata,
    type PresetDocumentsArchive,
    type WorkbenchBackupManifest,
    type WorkbenchBackupSnapshot
} from "./backup-types.js";


/* =========================================================
   Paths
   ========================================================= */

const MANIFEST_PATH =
    "manifest.json";


const DOCUMENT_TEMPLATES_PATH =
    "document_builder/templates.json";


const RED_INDEX_PATH =
    "red_index/data.json";


const PRESET_DOCUMENTS_PATH =
    "preset_documents/documents.json";


/* =========================================================
   Limits
   ========================================================= */

const MAX_JSON_TEXT_LENGTH =
    20_000_000;


/* =========================================================
   Export
   ========================================================= */

export async function createBackupArchive(
    snapshot: WorkbenchBackupSnapshot
): Promise<Blob> {

    const zip =
        new JSZip();


    /* -----------------------------------------------------
       DOCUMENT BUILDER
       ----------------------------------------------------- */

    zip.file(
        DOCUMENT_TEMPLATES_PATH,
        stringifyJson(
            {
                version:
                    DOCUMENT_TEMPLATES_VERSION,

                templates:
                    snapshot.documentTemplates
            }
        )
    );


    /* -----------------------------------------------------
       RED INDEX
       ----------------------------------------------------- */

    zip.file(
        RED_INDEX_PATH,
        stringifyJson(
            snapshot.redIndex
        )
    );


    /* -----------------------------------------------------
       PRESET DOCUMENTS
       ----------------------------------------------------- */

    const presetMetadata:
        PresetDocumentArchiveMetadata[] =
        [];


    let previewImageCount =
        0;


    for (
        let index = 0;
        index <
        snapshot.presetDocuments.length;
        index += 1
    ) {

        const document =
            snapshot.presetDocuments[
            index
            ];


        const sequence =
            String(
                index + 1
            )
                .padStart(
                    3,
                    "0"
                );


        const safeTitle =
            sanitizeFileName(
                document.title
            );


        /* -------------------------------------------------
           PDF
           ------------------------------------------------- */

        const pdfPath =
            [
                "preset_documents/pdf/",
                sequence,
                "_",
                safeTitle,
                ".pdf"
            ].join("");


        zip.file(
            pdfPath,
            document.pdfBlob
        );


        /* -------------------------------------------------
           Preview
           ------------------------------------------------- */

        let previewPath:
            string |
            null =
            null;


        if (
            document.previewBlob &&
            document.previewFileName &&
            document.previewMimeType
        ) {

            const extension =
                getImageExtension(
                    document.previewMimeType
                );


            previewPath =
                [
                    "preset_documents/images/",
                    sequence,
                    "_",
                    safeTitle,
                    ".",
                    extension
                ].join("");


            zip.file(
                previewPath,
                document.previewBlob
            );


            previewImageCount +=
                1;
        }


        presetMetadata.push(
            {
                id:
                    document.id,

                title:
                    document.title,

                description:
                    document.description,

                orientation:
                    document.orientation,

                pdfFileName:
                    document.pdfFileName,

                pdfMimeType:
                    document.pdfMimeType,

                pdfPath,

                previewFileName:
                    document.previewFileName,

                previewMimeType:
                    document.previewMimeType,

                previewPath,

                sortOrder:
                    document.sortOrder,

                createdAt:
                    document.createdAt,

                updatedAt:
                    document.updatedAt
            }
        );
    }


    const presetArchive:
        PresetDocumentsArchive =
    {

        version:
            PRESET_DOCUMENTS_VERSION,

        documents:
            presetMetadata
    };


    zip.file(
        PRESET_DOCUMENTS_PATH,
        stringifyJson(
            presetArchive
        )
    );


    /* -----------------------------------------------------
       Manifest
       ----------------------------------------------------- */

    const manifest:
        WorkbenchBackupManifest =
    {

        format:
            "workbench-backup",

        version:
            WORKBENCH_BACKUP_VERSION,

        createdAt:
            new Date()
                .toISOString(),

        contents: {

            documentBuilder: {

                templateCount:
                    snapshot
                        .documentTemplates
                        .length
            },

            redIndex: {

                present:
                    snapshot.redIndex !==
                    null
            },

            presetDocuments: {

                documentCount:
                    snapshot
                        .presetDocuments
                        .length,

                pdfCount:
                    snapshot
                        .presetDocuments
                        .length,

                previewImageCount
            }
        }
    };


    zip.file(
        MANIFEST_PATH,
        stringifyJson(
            manifest
        )
    );


    /**
     * PDF / PNG / JPEG / WebPは既に圧縮済みなので、
     * ZIP側では再圧縮せずSTOREする。
     *
     * CPU負荷と待ち時間を抑える。
     */
    return zip.generateAsync(
        {
            type:
                "blob",

            compression:
                "STORE",

            mimeType:
                "application/zip"
        }
    );
}


/* =========================================================
   Import
   ========================================================= */

export async function readBackupArchive(
    file:
        Blob |
        ArrayBuffer |
        Uint8Array
): Promise<WorkbenchBackupSnapshot> {

    let zip:
        JSZip;


    try {

        zip =
            await JSZip.loadAsync(
                file
            );

    } catch {

        throw new Error(
            "ZIPファイルを読み込めませんでした。"
        );
    }


    /* -----------------------------------------------------
       Manifest
       ----------------------------------------------------- */

    const manifest =
        parseWorkbenchBackupManifest(
            await readJsonFile(
                zip,
                MANIFEST_PATH
            )
        );


    /* -----------------------------------------------------
       DOCUMENT BUILDER
       ----------------------------------------------------- */

    const documentArchive =
        parseDocumentTemplatesArchive(
            await readJsonFile(
                zip,
                DOCUMENT_TEMPLATES_PATH
            )
        );


    /* -----------------------------------------------------
       RED INDEX
       ----------------------------------------------------- */

    const redIndexRaw =
        await readJsonFile(
            zip,
            RED_INDEX_PATH
        );


    const redIndex =
        redIndexRaw ===
            null
            ? null
            : parseRedIndexData(
                redIndexRaw
            );


    /* -----------------------------------------------------
       PRESET DOCUMENTS metadata
       ----------------------------------------------------- */

    const presetArchive =
        parsePresetDocumentsArchive(
            await readJsonFile(
                zip,
                PRESET_DOCUMENTS_PATH
            )
        );


    /* -----------------------------------------------------
       Manifest整合性
       ----------------------------------------------------- */

    if (
        manifest
            .contents
            .documentBuilder
            .templateCount !==
        documentArchive
            .templates
            .length
    ) {

        throw new Error(
            "文書テンプレート件数がmanifestと一致しません。"
        );
    }


    if (
        manifest
            .contents
            .redIndex
            .present !==
        (
            redIndex !==
            null
        )
    ) {

        throw new Error(
            "RED INDEXのmanifest情報が一致しません。"
        );
    }


    if (
        manifest
            .contents
            .presetDocuments
            .documentCount !==
        presetArchive
            .documents
            .length
    ) {

        throw new Error(
            "定型印刷物件数がmanifestと一致しません。"
        );
    }


    if (
        manifest
            .contents
            .presetDocuments
            .pdfCount !==
        presetArchive
            .documents
            .length
    ) {

        throw new Error(
            "定型印刷物PDF件数がmanifestと一致しません。"
        );
    }


    const expectedPreviewCount =
        presetArchive
            .documents
            .filter(
                (
                    document
                ) =>
                    document.previewPath !==
                    null
            )
            .length;


    if (
        manifest
            .contents
            .presetDocuments
            .previewImageCount !==
        expectedPreviewCount
    ) {

        throw new Error(
            "プレビュー画像件数がmanifestと一致しません。"
        );
    }


    /* -----------------------------------------------------
       PDF / Preview
       ----------------------------------------------------- */

    const presetDocuments:
        PresetDocument[] =
        [];


    for (
        const metadata
        of presetArchive.documents
    ) {

        const pdfBytes =
            await readBinaryFile(
                zip,
                metadata.pdfPath
            );


        validatePdfBytes(
            pdfBytes,
            metadata.pdfPath
        );


        const pdfBlob =
            createBlob(
                pdfBytes,
                "application/pdf"
            );


        let previewBlob:
            Blob |
            null =
            null;


        if (
            metadata.previewPath &&
            metadata.previewMimeType
        ) {

            const previewBytes =
                await readBinaryFile(
                    zip,
                    metadata.previewPath
                );


            validatePreviewBytes(
                previewBytes,
                metadata.previewMimeType,
                metadata.previewPath
            );


            previewBlob =
                createBlob(
                    previewBytes,
                    metadata.previewMimeType
                );
        }


        presetDocuments.push(
            {
                id:
                    metadata.id,

                title:
                    metadata.title,

                description:
                    metadata.description,

                orientation:
                    metadata.orientation,

                pdfFileName:
                    metadata.pdfFileName,

                pdfMimeType:
                    metadata.pdfMimeType,

                pdfBlob,

                previewFileName:
                    metadata.previewFileName,

                previewMimeType:
                    metadata.previewMimeType,

                previewBlob,

                sortOrder:
                    metadata.sortOrder,

                createdAt:
                    metadata.createdAt,

                updatedAt:
                    metadata.updatedAt
            }
        );
    }


    return {

        documentTemplates:
            documentArchive.templates,

        redIndex,

        presetDocuments
    };
}


/* =========================================================
   ZIP Read
   ========================================================= */

async function readJsonFile(
    zip: JSZip,
    path: string
): Promise<unknown> {

    const entry =
        zip.file(
            path
        );


    if (
        !entry
    ) {

        throw new Error(
            `バックアップ内に必要なファイルがありません: ${path}`
        );
    }


    const text =
        await entry.async(
            "string"
        );


    if (
        text.length >
        MAX_JSON_TEXT_LENGTH
    ) {

        throw new Error(
            `バックアップ内のJSONが大きすぎます: ${path}`
        );
    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        throw new Error(
            `バックアップ内のJSONを解析できません: ${path}`
        );
    }
}


async function readBinaryFile(
    zip: JSZip,
    path: string
): Promise<Uint8Array> {

    const entry =
        zip.file(
            path
        );


    if (
        !entry
    ) {

        throw new Error(
            `バックアップ内に必要なファイルがありません: ${path}`
        );
    }


    return entry.async(
        "uint8array"
    );
}


/* =========================================================
   PDF Validation
   ========================================================= */

function validatePdfBytes(
    bytes: Uint8Array,
    path: string
): void {

    if (
        bytes.length <
        5
    ) {

        throw new Error(
            `PDFファイルが不正です: ${path}`
        );
    }


    const signature =
        String.fromCharCode(
            bytes[0],
            bytes[1],
            bytes[2],
            bytes[3],
            bytes[4]
        );


    if (
        signature !==
        "%PDF-"
    ) {

        throw new Error(
            `PDFファイルの形式が不正です: ${path}`
        );
    }
}


/* =========================================================
   Preview Validation
   ========================================================= */

function validatePreviewBytes(
    bytes: Uint8Array,
    mimeType: string,
    path: string
): void {

    switch (
    mimeType
    ) {

        case "image/png":

            if (
                !isPng(
                    bytes
                )
            ) {

                throw new Error(
                    `PNG画像が不正です: ${path}`
                );
            }


            return;


        case "image/jpeg":

            if (
                !isJpeg(
                    bytes
                )
            ) {

                throw new Error(
                    `JPEG画像が不正です: ${path}`
                );
            }


            return;


        case "image/webp":

            if (
                !isWebp(
                    bytes
                )
            ) {

                throw new Error(
                    `WebP画像が不正です: ${path}`
                );
            }


            return;


        default:

            throw new Error(
                `対応していない画像形式です: ${mimeType}`
            );
    }
}


function isPng(
    bytes: Uint8Array
): boolean {

    const signature =
        [
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a
        ];


    if (
        bytes.length <
        signature.length
    ) {

        return false;
    }


    return signature.every(
        (
            byte,
            index
        ) =>
            bytes[index] ===
            byte
    );
}


function isJpeg(
    bytes: Uint8Array
): boolean {

    return (
        bytes.length >=
        3 &&

        bytes[0] ===
        0xff &&

        bytes[1] ===
        0xd8 &&

        bytes[2] ===
        0xff
    );
}


function isWebp(
    bytes: Uint8Array
): boolean {

    if (
        bytes.length <
        12
    ) {

        return false;
    }


    return (
        bytes[0] ===
        0x52 &&

        bytes[1] ===
        0x49 &&

        bytes[2] ===
        0x46 &&

        bytes[3] ===
        0x46 &&

        bytes[8] ===
        0x57 &&

        bytes[9] ===
        0x45 &&

        bytes[10] ===
        0x42 &&

        bytes[11] ===
        0x50
    );
}


/* =========================================================
   Blob
   ========================================================= */

function createBlob(
    bytes: Uint8Array,
    mimeType: string
): Blob {

    /**
     * Uint8Arrayを新規ArrayBufferへコピーする。
     *
     * BlobPartの型互換性を
     * TypeScript環境差で壊さないため。
     */
    const copy =
        new Uint8Array(
            bytes
        );


    return new Blob(
        [
            copy.buffer
        ],
        {
            type:
                mimeType
        }
    );
}


/* =========================================================
   JSON
   ========================================================= */

function stringifyJson(
    value: unknown
): string {

    return JSON.stringify(
        value,
        null,
        2
    );
}


/* =========================================================
   File Name
   ========================================================= */

function sanitizeFileName(
    value: string
): string {

    const normalized =
        value
            .normalize(
                "NFKC"
            )
            .replace(
                /[\\/:*?"<>|\u0000-\u001f]/g,
                "_"
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .replace(
                /\.+$/g,
                ""
            );


    if (
        normalized.length ===
        0
    ) {

        return "document";
    }


    return normalized.slice(
        0,
        80
    );
}


function getImageExtension(
    mimeType: string
): string {

    switch (
    mimeType
    ) {

        case "image/png":

            return "png";


        case "image/jpeg":

            return "jpg";


        case "image/webp":

            return "webp";


        default:

            throw new Error(
                `対応していないプレビュー画像形式です: ${mimeType}`
            );
    }
}