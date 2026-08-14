export const DOCUMENT_PACKAGE_VERSION = 1 as const;


export type TemplateFieldType =
    | "text"
    | "textarea"
    | "date";


export type TemplateField = {
    id: string;
    label: string;
    type: TemplateFieldType;
    required?: boolean;
    defaultValue?: string;
    placeholder?: string;
};


export type BusinessDocumentLayout = {
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
    fields: TemplateField[];
    document: BusinessDocumentLayout;
};


export type DocumentValues =
    Record<string, string>;


export type DocumentPackage = {
    version: typeof DOCUMENT_PACKAGE_VERSION;
    template: DocumentTemplate;
    values?: DocumentValues;
};


/* =========================================================
   Validation patterns
   ========================================================= */

const TEMPLATE_ID_PATTERN =
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;


const FIELD_ID_PATTERN =
    /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;


const PLACEHOLDER_PATTERN =
    /\{([A-Za-z][A-Za-z0-9_-]{0,63})\}/g;


/* =========================================================
   Public API
   ========================================================= */

export function parseDocumentPackage(
    value: unknown
): DocumentPackage {

    const root =
        requireRecord(
            value,
            "JSONの最上位はオブジェクトである必要があります。"
        );


    if (
        root.version !==
        DOCUMENT_PACKAGE_VERSION
    ) {

        throw new Error(
            `version は ${DOCUMENT_PACKAGE_VERSION} である必要があります。`
        );
    }


    const template =
        parseDocumentTemplate(
            root.template
        );


    const values =
        parseValues(
            root.values,
            template
        );


    if (
        values
    ) {

        return {
            version:
                DOCUMENT_PACKAGE_VERSION,

            template,

            values
        };
    }


    return {
        version:
            DOCUMENT_PACKAGE_VERSION,

        template
    };
}


export function createTemplatePackage(
    template: DocumentTemplate
): DocumentPackage {

    return {
        version:
            DOCUMENT_PACKAGE_VERSION,

        template:
            cloneTemplate(
                template
            )
    };
}


export function createDocumentPackage(
    template: DocumentTemplate,
    values: DocumentValues
): DocumentPackage {

    return {
        version:
            DOCUMENT_PACKAGE_VERSION,

        template:
            cloneTemplate(
                template
            ),

        values:
            normalizeValues(
                template,
                values
            )
    };
}


export function createInitialValues(
    template: DocumentTemplate,
    suppliedValues: DocumentValues = {}
): DocumentValues {

    const values:
        DocumentValues =
        {};


    for (
        const field
        of template.fields
    ) {

        const suppliedValue =
            suppliedValues[
            field.id
            ];


        if (
            typeof suppliedValue ===
            "string"
        ) {

            values[
                field.id
            ] =
                suppliedValue;

            continue;
        }


        values[
            field.id
        ] =
            resolveDefaultValue(
                field
            );
    }


    return values;
}


export function normalizeValues(
    template: DocumentTemplate,
    values: DocumentValues
): DocumentValues {

    const normalized:
        DocumentValues =
        {};


    for (
        const field
        of template.fields
    ) {

        normalized[
            field.id
        ] =
            typeof values[
                field.id
            ] ===
                "string"
                ? values[
                field.id
                ]
                : "";
    }


    return normalized;
}


export function getReferencedFields(
    template: DocumentTemplate
): TemplateField[] {

    const referencedIds =
        getReferencedFieldIds(
            template
        );


    return template.fields.filter(
        (field) =>
            referencedIds.has(
                field.id
            )
    );
}


/**
 * テンプレート文字列へ入力値を差し込む。
 *
 * テンプレートビルダー上で入力された
 * "\n" という文字列も実際の改行として扱う。
 *
 * values側の "\n" は変換しない。
 */
export function interpolateTemplateText(
    text: string,
    values: DocumentValues
): string {

    const normalizedText =
        text.replace(
            /\\n/g,
            "\n"
        );


    return normalizedText.replace(
        PLACEHOLDER_PATTERN,
        (
            _match,
            fieldId: string
        ) =>
            values[fieldId] ??
            ""
    );
}


/* =========================================================
   Template parser
   ========================================================= */

function parseDocumentTemplate(
    value: unknown
): DocumentTemplate {

    const source =
        requireRecord(
            value,
            "template はオブジェクトである必要があります。"
        );


    const id =
        requireString(
            source.id,
            "template.id"
        );


    if (
        !TEMPLATE_ID_PATTERN.test(
            id
        )
    ) {

        throw new Error(
            "template.id は英数字・ピリオド・ハイフン・アンダースコアで指定してください。"
        );
    }


    const name =
        requireNonEmptyString(
            source.name,
            "template.name"
        );


    if (
        !Array.isArray(
            source.fields
        )
    ) {

        throw new Error(
            "template.fields は配列である必要があります。"
        );
    }


    const fields =
        source.fields.map(
            (
                field,
                index
            ) =>
                parseField(
                    field,
                    index
                )
        );


    validateUniqueFieldIds(
        fields
    );


    const documentLayout =
        parseDocumentLayout(
            source.document
        );


    const template:
        DocumentTemplate = {

        id,

        name,

        fields,

        document:
            documentLayout
    };


    validatePlaceholders(
        template
    );


    return template;
}


/* =========================================================
   Field parser
   ========================================================= */

function parseField(
    value: unknown,
    index: number
): TemplateField {

    const source =
        requireRecord(
            value,
            `template.fields[${index}] はオブジェクトである必要があります。`
        );


    const id =
        requireString(
            source.id,
            `template.fields[${index}].id`
        );


    if (
        !FIELD_ID_PATTERN.test(
            id
        )
    ) {

        throw new Error(
            `template.fields[${index}].id の形式が正しくありません。`
        );
    }


    const label =
        requireNonEmptyString(
            source.label,
            `template.fields[${index}].label`
        );


    const type =
        parseFieldType(
            source.type,
            index
        );


    const field:
        TemplateField = {

        id,

        label,

        type
    };


    if (
        source.required !==
        undefined
    ) {

        if (
            typeof source.required !==
            "boolean"
        ) {

            throw new Error(
                `template.fields[${index}].required は boolean である必要があります。`
            );
        }


        field.required =
            source.required;
    }


    if (
        source.defaultValue !==
        undefined
    ) {

        field.defaultValue =
            requireString(
                source.defaultValue,
                `template.fields[${index}].defaultValue`
            );
    }


    if (
        source.placeholder !==
        undefined
    ) {

        field.placeholder =
            requireString(
                source.placeholder,
                `template.fields[${index}].placeholder`
            );
    }


    return field;
}


/* =========================================================
   Field type
   ========================================================= */

function parseFieldType(
    value: unknown,
    index: number
): TemplateFieldType {

    if (
        value === "text" ||
        value === "textarea" ||
        value === "date"
    ) {

        return value;
    }


    throw new Error(
        `template.fields[${index}].type は text / textarea / date のいずれかである必要があります。`
    );
}


/* =========================================================
   Document parser
   ========================================================= */

function parseDocumentLayout(
    value: unknown
): BusinessDocumentLayout {

    const source =
        requireRecord(
            value,
            "template.document はオブジェクトである必要があります。"
        );


    return {

        topLeft:
            requireString(
                source.topLeft,
                "template.document.topLeft"
            ),

        topRight:
            requireString(
                source.topRight,
                "template.document.topRight"
            ),

        opening:
            requireString(
                source.opening,
                "template.document.opening"
            ),

        body:
            requireString(
                source.body,
                "template.document.body"
            ),

        closing:
            requireString(
                source.closing,
                "template.document.closing"
            ),

        end:
            requireString(
                source.end,
                "template.document.end"
            )
    };
}


/* =========================================================
   Values parser
   ========================================================= */

function parseValues(
    value: unknown,
    template: DocumentTemplate
): DocumentValues | undefined {

    if (
        value ===
        undefined
    ) {

        return undefined;
    }


    const source =
        requireRecord(
            value,
            "values はオブジェクトである必要があります。"
        );


    const allowedIds =
        new Set(
            template.fields.map(
                (field) =>
                    field.id
            )
        );


    const values:
        DocumentValues =
        {};


    for (
        const [
            key,
            item
        ]
        of Object.entries(
            source
        )
    ) {

        if (
            !allowedIds.has(
                key
            )
        ) {

            throw new Error(
                `values.${key} に対応する入力項目がありません。`
            );
        }


        if (
            typeof item !==
            "string"
        ) {

            throw new Error(
                `values.${key} は文字列である必要があります。`
            );
        }


        values[key] =
            item;
    }


    return normalizeValues(
        template,
        values
    );
}


/* =========================================================
   Duplicate field validation
   ========================================================= */

function validateUniqueFieldIds(
    fields: TemplateField[]
): void {

    const ids =
        new Set<string>();


    for (
        const field
        of fields
    ) {

        if (
            ids.has(
                field.id
            )
        ) {

            throw new Error(
                `入力項目ID ${field.id} が重複しています。`
            );
        }


        ids.add(
            field.id
        );
    }
}


/* =========================================================
   Placeholder validation
   ========================================================= */

function validatePlaceholders(
    template: DocumentTemplate
): void {

    const fieldIds =
        new Set(
            template.fields.map(
                (field) =>
                    field.id
            )
        );


    for (
        const fieldId
        of getReferencedFieldIds(
            template
        )
    ) {

        if (
            !fieldIds.has(
                fieldId
            )
        ) {

            throw new Error(
                `{${fieldId}} に対応する入力項目が fields にありません。`
            );
        }
    }
}


/* =========================================================
   Referenced fields
   ========================================================= */

function getReferencedFieldIds(
    template: DocumentTemplate
): Set<string> {

    const ids =
        new Set<string>();


    const blocks = [

        template
            .document
            .topLeft,

        template
            .document
            .topRight,

        template
            .document
            .opening,

        template
            .document
            .body,

        template
            .document
            .closing,

        template
            .document
            .end
    ];


    for (
        const block
        of blocks
    ) {

        PLACEHOLDER_PATTERN
            .lastIndex =
            0;


        let match:
            RegExpExecArray |
            null;


        while (
            (
                match =
                PLACEHOLDER_PATTERN
                    .exec(
                        block
                    )
            ) !==
            null
        ) {

            const fieldId =
                match[1];


            if (
                fieldId
            ) {

                ids.add(
                    fieldId
                );
            }
        }
    }


    return ids;
}


/* =========================================================
   Default values
   ========================================================= */

function resolveDefaultValue(
    field: TemplateField
): string {

    if (
        field.type ===
        "date" &&

        field.defaultValue ===
        "today"
    ) {

        return formatLocalDate(
            new Date()
        );
    }


    return (
        field.defaultValue ??
        ""
    );
}


/* =========================================================
   Local date
   ========================================================= */

function formatLocalDate(
    date: Date
): string {

    const year =
        String(
            date.getFullYear()
        );


    const month =
        String(
            date.getMonth() +
            1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-${day}`
    );
}


/* =========================================================
   Clone
   ========================================================= */

function cloneTemplate(
    template: DocumentTemplate
): DocumentTemplate {

    return {

        id:
            template.id,

        name:
            template.name,

        fields:
            template.fields.map(
                (field) => ({
                    ...field
                })
            ),

        document: {
            ...template.document
        }
    };
}


/* =========================================================
   Generic validation
   ========================================================= */

function requireRecord(
    value: unknown,
    message: string
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
            message
        );
    }


    return (
        value as
        Record<string, unknown>
    );
}


function requireString(
    value: unknown,
    path: string
): string {

    if (
        typeof value !==
        "string"
    ) {

        throw new Error(
            `${path} は文字列である必要があります。`
        );
    }


    return value;
}


function requireNonEmptyString(
    value: unknown,
    path: string
): string {

    const text =
        requireString(
            value,
            path
        ).trim();


    if (
        text.length ===
        0
    ) {

        throw new Error(
            `${path} は空にできません。`
        );
    }


    return text;
}