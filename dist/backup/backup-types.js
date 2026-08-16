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
/* =========================================================
   Constants
   ========================================================= */
export const WORKBENCH_BACKUP_VERSION = 1;
export const DOCUMENT_TEMPLATES_VERSION = 1;
export const PRESET_DOCUMENTS_VERSION = 1;
export const RED_INDEX_VERSION = 1;
/* =========================================================
   Manifest Parser
   ========================================================= */
export function parseWorkbenchBackupManifest(value) {
    const record = requireRecord(value, "manifest.json");
    if (record.format !==
        "workbench-backup") {
        throw new Error("WORKBENCHバックアップではありません。");
    }
    if (record.version !==
        WORKBENCH_BACKUP_VERSION) {
        throw new Error("対応していないバックアップバージョンです。");
    }
    requireString(record.createdAt, "manifest.createdAt", 128);
    const contents = requireRecord(record.contents, "manifest.contents");
    const documentBuilder = requireRecord(contents.documentBuilder, "manifest.contents.documentBuilder");
    const redIndex = requireRecord(contents.redIndex, "manifest.contents.redIndex");
    const presetDocuments = requireRecord(contents.presetDocuments, "manifest.contents.presetDocuments");
    requireNonNegativeInteger(documentBuilder.templateCount, "manifest.contents.documentBuilder.templateCount");
    if (typeof redIndex.present !==
        "boolean") {
        throw new Error("manifest.contents.redIndex.present が不正です。");
    }
    requireNonNegativeInteger(presetDocuments.documentCount, "manifest.contents.presetDocuments.documentCount");
    requireNonNegativeInteger(presetDocuments.pdfCount, "manifest.contents.presetDocuments.pdfCount");
    requireNonNegativeInteger(presetDocuments.previewImageCount, "manifest.contents.presetDocuments.previewImageCount");
    return value;
}
/* =========================================================
   Document Templates Parser
   ========================================================= */
export function parseDocumentTemplatesArchive(value) {
    const record = requireRecord(value, "document_builder/templates.json");
    if (record.version !==
        DOCUMENT_TEMPLATES_VERSION) {
        throw new Error("文書テンプレートのバックアップバージョンが不正です。");
    }
    const templates = parseDocumentTemplates(record.templates);
    return {
        version: DOCUMENT_TEMPLATES_VERSION,
        templates
    };
}
export function parseDocumentTemplates(value) {
    if (!Array.isArray(value)) {
        throw new Error("文書テンプレート一覧が不正です。");
    }
    if (value.length >
        10000) {
        throw new Error("文書テンプレート件数が多すぎます。");
    }
    const templates = value.map((template, index) => parseDocumentTemplate(template, index));
    requireUniqueIds(templates, "文書テンプレート");
    return templates;
}
function parseDocumentTemplate(value, index) {
    const record = requireRecord(value, `templates[${index}]`);
    requireString(record.id, `templates[${index}].id`, 256, true);
    requireString(record.name, `templates[${index}].name`, 512, true);
    if (!Array.isArray(record.fields)) {
        throw new Error(`templates[${index}].fields が不正です。`);
    }
    if (record.fields.length >
        1000) {
        throw new Error(`templates[${index}].fields の件数が多すぎます。`);
    }
    record.fields.forEach((field, fieldIndex) => {
        parseDocumentTemplateField(field, index, fieldIndex);
    });
    const document = requireRecord(record.document, `templates[${index}].document`);
    const documentKeys = [
        "topLeft",
        "topRight",
        "opening",
        "body",
        "closing",
        "end"
    ];
    for (const key of documentKeys) {
        requireString(document[key], `templates[${index}].document.${key}`, 1000000);
    }
    return value;
}
function parseDocumentTemplateField(value, templateIndex, fieldIndex) {
    const path = `templates[${templateIndex}].fields[${fieldIndex}]`;
    const record = requireRecord(value, path);
    const id = requireString(record.id, `${path}.id`, 64, true);
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/
        .test(id)) {
        throw new Error(`${path}.id が不正です。`);
    }
    requireString(record.label, `${path}.label`, 512, true);
    if (record.type !==
        "text" &&
        record.type !==
            "textarea" &&
        record.type !==
            "date") {
        throw new Error(`${path}.type が不正です。`);
    }
    if (record.required !==
        undefined &&
        typeof record.required !==
            "boolean") {
        throw new Error(`${path}.required が不正です。`);
    }
    if (record.defaultValue !==
        undefined) {
        requireString(record.defaultValue, `${path}.defaultValue`, 1000000);
    }
    if (record.placeholder !==
        undefined) {
        requireString(record.placeholder, `${path}.placeholder`, 10000);
    }
}
/* =========================================================
   RED INDEX Parser
   ========================================================= */
export function parseRedIndexData(value) {
    const record = requireRecord(value, "red_index/data.json");
    if (record.version !==
        RED_INDEX_VERSION) {
        throw new Error("RED INDEXのバックアップバージョンが不正です。");
    }
    if (!Array.isArray(record.categories)) {
        throw new Error("RED INDEXのcategoriesが不正です。");
    }
    if (record.categories.length >
        10000) {
        throw new Error("RED INDEXのカテゴリ件数が多すぎます。");
    }
    let itemCount = 0;
    record.categories.forEach((category, index) => {
        const categoryRecord = requireRecord(category, `categories[${index}]`);
        requireString(categoryRecord.category, `categories[${index}].category`, 10000);
        if (!Array.isArray(categoryRecord.items)) {
            throw new Error(`categories[${index}].items が不正です。`);
        }
        for (const item of categoryRecord.items) {
            requireString(item, `categories[${index}].items`, 10000);
            itemCount +=
                1;
            if (itemCount >
                100000) {
                throw new Error("RED INDEXの商品件数が多すぎます。");
            }
        }
    });
    return value;
}
/* =========================================================
   Preset Documents Parser
   ========================================================= */
export function parsePresetDocumentsArchive(value) {
    const record = requireRecord(value, "preset_documents/documents.json");
    if (record.version !==
        PRESET_DOCUMENTS_VERSION) {
        throw new Error("定型印刷物のバックアップバージョンが不正です。");
    }
    if (!Array.isArray(record.documents)) {
        throw new Error("定型印刷物一覧が不正です。");
    }
    if (record.documents.length >
        1000) {
        throw new Error("定型印刷物の件数が多すぎます。");
    }
    const documents = record.documents.map((document, index) => parsePresetDocumentMetadata(document, index));
    requireUniqueIds(documents, "定型印刷物");
    return {
        version: PRESET_DOCUMENTS_VERSION,
        documents
    };
}
function parsePresetDocumentMetadata(value, index) {
    const path = `documents[${index}]`;
    const record = requireRecord(value, path);
    requireString(record.id, `${path}.id`, 256, true);
    requireString(record.title, `${path}.title`, 512, true);
    requireString(record.description, `${path}.description`, 10000);
    if (record.orientation !==
        "portrait" &&
        record.orientation !==
            "landscape") {
        throw new Error(`${path}.orientation が不正です。`);
    }
    requireString(record.pdfFileName, `${path}.pdfFileName`, 1024, true);
    const pdfMimeType = requireString(record.pdfMimeType, `${path}.pdfMimeType`, 256, true);
    if (pdfMimeType !==
        "application/pdf") {
        throw new Error(`${path}.pdfMimeType が不正です。`);
    }
    const pdfPath = requireString(record.pdfPath, `${path}.pdfPath`, 2048, true);
    requireSafeArchivePath(pdfPath, "preset_documents/pdf/");
    const previewFileName = requireNullableString(record.previewFileName, `${path}.previewFileName`, 1024);
    const previewMimeType = requireNullableString(record.previewMimeType, `${path}.previewMimeType`, 256);
    const previewPath = requireNullableString(record.previewPath, `${path}.previewPath`, 2048);
    if (previewPath ===
        null) {
        if (previewFileName !==
            null ||
            previewMimeType !==
                null) {
            throw new Error(`${path} のプレビュー情報が不整合です。`);
        }
    }
    else {
        if (previewFileName ===
            null ||
            previewMimeType ===
                null) {
            throw new Error(`${path} のプレビュー情報が不整合です。`);
        }
        if (previewMimeType !==
            "image/png" &&
            previewMimeType !==
                "image/jpeg" &&
            previewMimeType !==
                "image/webp") {
            throw new Error(`${path}.previewMimeType が不正です。`);
        }
        requireSafeArchivePath(previewPath, "preset_documents/images/");
    }
    requireFiniteNumber(record.sortOrder, `${path}.sortOrder`);
    requireNonNegativeInteger(record.createdAt, `${path}.createdAt`);
    requireNonNegativeInteger(record.updatedAt, `${path}.updatedAt`);
    return value;
}
/* =========================================================
   Generic Validation
   ========================================================= */
function requireRecord(value, path) {
    if (typeof value !==
        "object" ||
        value ===
            null ||
        Array.isArray(value)) {
        throw new Error(`${path} が不正です。`);
    }
    return value;
}
function requireString(value, path, maxLength, required = false) {
    if (typeof value !==
        "string") {
        throw new Error(`${path} が文字列ではありません。`);
    }
    if (required &&
        value.length ===
            0) {
        throw new Error(`${path} が空です。`);
    }
    if (value.length >
        maxLength) {
        throw new Error(`${path} が長すぎます。`);
    }
    return value;
}
function requireNullableString(value, path, maxLength) {
    if (value ===
        null) {
        return null;
    }
    return requireString(value, path, maxLength, true);
}
function requireNonNegativeInteger(value, path) {
    if (typeof value !==
        "number" ||
        !Number.isSafeInteger(value) ||
        value <
            0) {
        throw new Error(`${path} が不正です。`);
    }
    return value;
}
function requireFiniteNumber(value, path) {
    if (typeof value !==
        "number" ||
        !Number.isFinite(value)) {
        throw new Error(`${path} が不正です。`);
    }
    return value;
}
function requireUniqueIds(values, label) {
    const ids = new Set();
    for (const value of values) {
        if (ids.has(value.id)) {
            throw new Error(`${label}に重複したIDがあります: ${value.id}`);
        }
        ids.add(value.id);
    }
}
function requireSafeArchivePath(path, requiredPrefix) {
    if (!path.startsWith(requiredPrefix) ||
        path.includes("..") ||
        path.includes("\\") ||
        path.startsWith("/")) {
        throw new Error(`ZIP内のファイルパスが不正です: ${path}`);
    }
}
//# sourceMappingURL=backup-types.js.map