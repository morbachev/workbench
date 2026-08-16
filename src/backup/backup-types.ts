/**
 * backup-types.ts
 *
 * WORKBENCHバックアップ形式の型定義と
 * インポートデータ検証を担当する。
 *
 * ZIP内部のJSONはすべて外部入力として扱い、
 * IndexedDB / localStorageへ書き込む前に
 * このファイルで構造を検証する。
 */

import type {
    PresetDocument
} from "../preset/preset.js";


/* =========================================================
   Constants
   ========================================================= */

export const WORKBENCH_BACKUP_VERSION =
    1 as const;


export const DOCUMENT_TEMPLATES_VERSION =
    1 as const;


export const PRESET_DOCUMENTS_VERSION =
    1 as const;


export const RED_INDEX_VERSION =
    1 as const;


/* =========================================================
   Document Builder
   ========================================================= */

export type DocumentTemplateFieldType =
    | "text"
    | "textarea"
    | "date";


export type DocumentTemplateField = {

    id: string;

    label: string;

    type:
    DocumentTemplateFieldType;

    required?: boolean;

    defaultValue?: string;

    placeholder?: string;
};


export type DocumentTemplateLayout = {

    topLeft: string;

    topRight: string;

    opening: string;

    body: string;

    closing: string;

    end: string;
};


export type DocumentTemplate = {

    id: string;

    name: string;

    fields:
    DocumentTemplateField[];

    document:
    DocumentTemplateLayout;
};


export type DocumentTemplatesArchive = {

    version:
    typeof DOCUMENT_TEMPLATES_VERSION;

    templates:
    DocumentTemplate[];
};


/* =========================================================
   RED INDEX
   ========================================================= */

export type RedIndexCategory = {

    category: string;

    items: string[];
};


export type RedIndexData = {

    version:
    typeof RED_INDEX_VERSION;

    categories:
    RedIndexCategory[];
};


/* =========================================================
   PRESET DOCUMENTS
   ========================================================= */

/**
 * Blob自体はZIP内の別ファイルとして保持する。
 *
 * documents.jsonには
 * IndexedDBレコードのメタ情報と、
 * ZIP内のBlobパスだけを保持する。
 */
export type PresetDocumentArchiveMetadata = {

    id: string;

    title: string;

    description: string;

    orientation:
    "portrait" |
    "landscape";

    pdfFileName: string;

    pdfMimeType: string;

    pdfPath: string;

    previewFileName:
    string |
    null;

    previewMimeType:
    string |
    null;

    previewPath:
    string |
    null;

    sortOrder: number;

    createdAt: number;

    updatedAt: number;
};


export type PresetDocumentsArchive = {

    version:
    typeof PRESET_DOCUMENTS_VERSION;

    documents:
    PresetDocumentArchiveMetadata[];
};


/* =========================================================
   Manifest
   ========================================================= */

export type WorkbenchBackupManifest = {

    format:
    "workbench-backup";

    version:
    typeof WORKBENCH_BACKUP_VERSION;

    createdAt: string;

    contents: {

        documentBuilder: {

            templateCount:
            number;
        };

        redIndex: {

            present:
            boolean;
        };

        presetDocuments: {

            documentCount:
            number;

            pdfCount:
            number;

            previewImageCount:
            number;
        };
    };
};


/* =========================================================
   Runtime Snapshot
   ========================================================= */

/**
 * バックアップ処理内部で扱う
 * 現在のWORKBENCH保存状態。
 *
 * ZIP用のシリアライズ形式とは別。
 */
export type WorkbenchBackupSnapshot = {

    documentTemplates:
    DocumentTemplate[];

    redIndex:
    RedIndexData |
    null;

    presetDocuments:
    PresetDocument[];
};


/* =========================================================
   Manifest Parser
   ========================================================= */

export function parseWorkbenchBackupManifest(
    value: unknown
): WorkbenchBackupManifest {

    const record =
        requireRecord(
            value,
            "manifest.json"
        );


    if (
        record.format !==
        "workbench-backup"
    ) {

        throw new Error(
            "WORKBENCHバックアップではありません。"
        );
    }


    if (
        record.version !==
        WORKBENCH_BACKUP_VERSION
    ) {

        throw new Error(
            "対応していないバックアップバージョンです。"
        );
    }


    requireString(
        record.createdAt,
        "manifest.createdAt",
        128
    );


    const contents =
        requireRecord(
            record.contents,
            "manifest.contents"
        );


    const documentBuilder =
        requireRecord(
            contents.documentBuilder,
            "manifest.contents.documentBuilder"
        );


    const redIndex =
        requireRecord(
            contents.redIndex,
            "manifest.contents.redIndex"
        );


    const presetDocuments =
        requireRecord(
            contents.presetDocuments,
            "manifest.contents.presetDocuments"
        );


    requireNonNegativeInteger(
        documentBuilder.templateCount,
        "manifest.contents.documentBuilder.templateCount"
    );


    if (
        typeof redIndex.present !==
        "boolean"
    ) {

        throw new Error(
            "manifest.contents.redIndex.present が不正です。"
        );
    }


    requireNonNegativeInteger(
        presetDocuments.documentCount,
        "manifest.contents.presetDocuments.documentCount"
    );


    requireNonNegativeInteger(
        presetDocuments.pdfCount,
        "manifest.contents.presetDocuments.pdfCount"
    );


    requireNonNegativeInteger(
        presetDocuments.previewImageCount,
        "manifest.contents.presetDocuments.previewImageCount"
    );


    return value as
        WorkbenchBackupManifest;
}


/* =========================================================
   Document Templates Parser
   ========================================================= */

export function parseDocumentTemplatesArchive(
    value: unknown
): DocumentTemplatesArchive {

    const record =
        requireRecord(
            value,
            "document_builder/templates.json"
        );


    if (
        record.version !==
        DOCUMENT_TEMPLATES_VERSION
    ) {

        throw new Error(
            "文書テンプレートのバックアップバージョンが不正です。"
        );
    }


    const templates =
        parseDocumentTemplates(
            record.templates
        );


    return {

        version:
            DOCUMENT_TEMPLATES_VERSION,

        templates
    };
}


export function parseDocumentTemplates(
    value: unknown
): DocumentTemplate[] {

    if (
        !Array.isArray(
            value
        )
    ) {

        throw new Error(
            "文書テンプレート一覧が不正です。"
        );
    }


    if (
        value.length >
        10_000
    ) {

        throw new Error(
            "文書テンプレート件数が多すぎます。"
        );
    }


    const templates =
        value.map(
            (
                template,
                index
            ) =>
                parseDocumentTemplate(
                    template,
                    index
                )
        );


    requireUniqueIds(
        templates,
        "文書テンプレート"
    );


    return templates;
}


function parseDocumentTemplate(
    value: unknown,
    index: number
): DocumentTemplate {

    const record =
        requireRecord(
            value,
            `templates[${index}]`
        );


    requireString(
        record.id,
        `templates[${index}].id`,
        256,
        true
    );


    requireString(
        record.name,
        `templates[${index}].name`,
        512,
        true
    );


    if (
        !Array.isArray(
            record.fields
        )
    ) {

        throw new Error(
            `templates[${index}].fields が不正です。`
        );
    }


    if (
        record.fields.length >
        1_000
    ) {

        throw new Error(
            `templates[${index}].fields の件数が多すぎます。`
        );
    }


    record.fields.forEach(
        (
            field,
            fieldIndex
        ) => {

            parseDocumentTemplateField(
                field,
                index,
                fieldIndex
            );
        }
    );


    const document =
        requireRecord(
            record.document,
            `templates[${index}].document`
        );


    const documentKeys:
        Array<
            keyof DocumentTemplateLayout
        > =
        [
            "topLeft",
            "topRight",
            "opening",
            "body",
            "closing",
            "end"
        ];


    for (
        const key
        of documentKeys
    ) {

        requireString(
            document[key],
            `templates[${index}].document.${key}`,
            1_000_000
        );
    }


    return value as
        DocumentTemplate;
}


function parseDocumentTemplateField(
    value: unknown,
    templateIndex: number,
    fieldIndex: number
): void {

    const path =
        `templates[${templateIndex}].fields[${fieldIndex}]`;


    const record =
        requireRecord(
            value,
            path
        );


    const id =
        requireString(
            record.id,
            `${path}.id`,
            64,
            true
        );


    if (
        !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/
            .test(
                id
            )
    ) {

        throw new Error(
            `${path}.id が不正です。`
        );
    }


    requireString(
        record.label,
        `${path}.label`,
        512,
        true
    );


    if (
        record.type !==
        "text" &&

        record.type !==
        "textarea" &&

        record.type !==
        "date"
    ) {

        throw new Error(
            `${path}.type が不正です。`
        );
    }


    if (
        record.required !==
        undefined &&

        typeof record.required !==
        "boolean"
    ) {

        throw new Error(
            `${path}.required が不正です。`
        );
    }


    if (
        record.defaultValue !==
        undefined
    ) {

        requireString(
            record.defaultValue,
            `${path}.defaultValue`,
            1_000_000
        );
    }


    if (
        record.placeholder !==
        undefined
    ) {

        requireString(
            record.placeholder,
            `${path}.placeholder`,
            10_000
        );
    }
}


/* =========================================================
   RED INDEX Parser
   ========================================================= */

export function parseRedIndexData(
    value: unknown
): RedIndexData {

    const record =
        requireRecord(
            value,
            "red_index/data.json"
        );


    if (
        record.version !==
        RED_INDEX_VERSION
    ) {

        throw new Error(
            "RED INDEXのバックアップバージョンが不正です。"
        );
    }


    if (
        !Array.isArray(
            record.categories
        )
    ) {

        throw new Error(
            "RED INDEXのcategoriesが不正です。"
        );
    }


    if (
        record.categories.length >
        10_000
    ) {

        throw new Error(
            "RED INDEXのカテゴリ件数が多すぎます。"
        );
    }


    let itemCount =
        0;


    record.categories.forEach(
        (
            category,
            index
        ) => {

            const categoryRecord =
                requireRecord(
                    category,
                    `categories[${index}]`
                );


            requireString(
                categoryRecord.category,
                `categories[${index}].category`,
                10_000
            );


            if (
                !Array.isArray(
                    categoryRecord.items
                )
            ) {

                throw new Error(
                    `categories[${index}].items が不正です。`
                );
            }


            for (
                const item
                of categoryRecord.items
            ) {

                requireString(
                    item,
                    `categories[${index}].items`,
                    10_000
                );


                itemCount +=
                    1;


                if (
                    itemCount >
                    100_000
                ) {

                    throw new Error(
                        "RED INDEXの商品件数が多すぎます。"
                    );
                }
            }
        }
    );


    return value as
        RedIndexData;
}


/* =========================================================
   Preset Documents Parser
   ========================================================= */

export function parsePresetDocumentsArchive(
    value: unknown
): PresetDocumentsArchive {

    const record =
        requireRecord(
            value,
            "preset_documents/documents.json"
        );


    if (
        record.version !==
        PRESET_DOCUMENTS_VERSION
    ) {

        throw new Error(
            "定型印刷物のバックアップバージョンが不正です。"
        );
    }


    if (
        !Array.isArray(
            record.documents
        )
    ) {

        throw new Error(
            "定型印刷物一覧が不正です。"
        );
    }


    if (
        record.documents.length >
        1_000
    ) {

        throw new Error(
            "定型印刷物の件数が多すぎます。"
        );
    }


    const documents =
        record.documents.map(
            (
                document,
                index
            ) =>
                parsePresetDocumentMetadata(
                    document,
                    index
                )
        );


    requireUniqueIds(
        documents,
        "定型印刷物"
    );


    return {

        version:
            PRESET_DOCUMENTS_VERSION,

        documents
    };
}


function parsePresetDocumentMetadata(
    value: unknown,
    index: number
): PresetDocumentArchiveMetadata {

    const path =
        `documents[${index}]`;


    const record =
        requireRecord(
            value,
            path
        );


    requireString(
        record.id,
        `${path}.id`,
        256,
        true
    );


    requireString(
        record.title,
        `${path}.title`,
        512,
        true
    );


    requireString(
        record.description,
        `${path}.description`,
        10_000
    );


    if (
        record.orientation !==
        "portrait" &&

        record.orientation !==
        "landscape"
    ) {

        throw new Error(
            `${path}.orientation が不正です。`
        );
    }


    requireString(
        record.pdfFileName,
        `${path}.pdfFileName`,
        1_024,
        true
    );


    const pdfMimeType =
        requireString(
            record.pdfMimeType,
            `${path}.pdfMimeType`,
            256,
            true
        );


    if (
        pdfMimeType !==
        "application/pdf"
    ) {

        throw new Error(
            `${path}.pdfMimeType が不正です。`
        );
    }


    const pdfPath =
        requireString(
            record.pdfPath,
            `${path}.pdfPath`,
            2_048,
            true
        );


    requireSafeArchivePath(
        pdfPath,
        "preset_documents/pdf/"
    );


    const previewFileName =
        requireNullableString(
            record.previewFileName,
            `${path}.previewFileName`,
            1_024
        );


    const previewMimeType =
        requireNullableString(
            record.previewMimeType,
            `${path}.previewMimeType`,
            256
        );


    const previewPath =
        requireNullableString(
            record.previewPath,
            `${path}.previewPath`,
            2_048
        );


    if (
        previewPath ===
        null
    ) {

        if (
            previewFileName !==
            null ||

            previewMimeType !==
            null
        ) {

            throw new Error(
                `${path} のプレビュー情報が不整合です。`
            );
        }

    } else {

        if (
            previewFileName ===
            null ||

            previewMimeType ===
            null
        ) {

            throw new Error(
                `${path} のプレビュー情報が不整合です。`
            );
        }


        if (
            previewMimeType !==
            "image/png" &&

            previewMimeType !==
            "image/jpeg" &&

            previewMimeType !==
            "image/webp"
        ) {

            throw new Error(
                `${path}.previewMimeType が不正です。`
            );
        }


        requireSafeArchivePath(
            previewPath,
            "preset_documents/images/"
        );
    }


    requireFiniteNumber(
        record.sortOrder,
        `${path}.sortOrder`
    );


    requireNonNegativeInteger(
        record.createdAt,
        `${path}.createdAt`
    );


    requireNonNegativeInteger(
        record.updatedAt,
        `${path}.updatedAt`
    );


    return value as
        PresetDocumentArchiveMetadata;
}


/* =========================================================
   Generic Validation
   ========================================================= */

function requireRecord(
    value: unknown,
    path: string
): Record<string, unknown> {

    if (
        typeof value !==
        "object" ||

        value ===
        null ||

        Array.isArray(
            value
        )
    ) {

        throw new Error(
            `${path} が不正です。`
        );
    }


    return value as
        Record<string, unknown>;
}


function requireString(
    value: unknown,
    path: string,
    maxLength: number,
    required = false
): string {

    if (
        typeof value !==
        "string"
    ) {

        throw new Error(
            `${path} が文字列ではありません。`
        );
    }


    if (
        required &&

        value.length ===
        0
    ) {

        throw new Error(
            `${path} が空です。`
        );
    }


    if (
        value.length >
        maxLength
    ) {

        throw new Error(
            `${path} が長すぎます。`
        );
    }


    return value;
}


function requireNullableString(
    value: unknown,
    path: string,
    maxLength: number
): string | null {

    if (
        value ===
        null
    ) {

        return null;
    }


    return requireString(
        value,
        path,
        maxLength,
        true
    );
}


function requireNonNegativeInteger(
    value: unknown,
    path: string
): number {

    if (
        typeof value !==
        "number" ||

        !Number.isSafeInteger(
            value
        ) ||

        value <
        0
    ) {

        throw new Error(
            `${path} が不正です。`
        );
    }


    return value;
}


function requireFiniteNumber(
    value: unknown,
    path: string
): number {

    if (
        typeof value !==
        "number" ||

        !Number.isFinite(
            value
        )
    ) {

        throw new Error(
            `${path} が不正です。`
        );
    }


    return value;
}


function requireUniqueIds(
    values:
        Array<{
            id: string;
        }>,
    label: string
): void {

    const ids =
        new Set<string>();


    for (
        const value
        of values
    ) {

        if (
            ids.has(
                value.id
            )
        ) {

            throw new Error(
                `${label}に重複したIDがあります: ${value.id}`
            );
        }


        ids.add(
            value.id
        );
    }
}


function requireSafeArchivePath(
    path: string,
    requiredPrefix: string
): void {

    if (
        !path.startsWith(
            requiredPrefix
        ) ||

        path.includes(
            ".."
        ) ||

        path.includes(
            "\\"
        ) ||

        path.startsWith(
            "/"
        )
    ) {

        throw new Error(
            `ZIP内のファイルパスが不正です: ${path}`
        );
    }
}