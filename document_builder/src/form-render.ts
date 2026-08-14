import {
    DocumentTemplate,
    DocumentValues,
    getReferencedFields,
    TemplateField
} from "./template.js";


/* =========================================================
   Types
   ========================================================= */

export type RenderDocumentFieldsOptions = {

    container:
    HTMLElement;

    template:
    DocumentTemplate;

    values:
    DocumentValues;

    onChange: (
        fieldId: string,
        value: string
    ) => void;
};


/* =========================================================
   Render
   ========================================================= */

export function renderDocumentFields(
    options: RenderDocumentFieldsOptions
): void {

    const {
        container,
        template,
        values,
        onChange
    } =
        options;


    container.replaceChildren();


    const fields =
        getReferencedFields(
            template
        );


    if (
        fields.length ===
        0
    ) {

        const message =
            document.createElement(
                "p"
            );


        message.className =
            "document-empty-state__description";


        message.textContent =
            "このテンプレートに入力項目はありません。";


        container.appendChild(
            message
        );


        return;
    }


    for (
        const field
        of fields
    ) {

        const fieldElement =
            createFieldElement(
                field,
                values[
                field.id
                ] ??
                "",
                onChange
            );


        container.appendChild(
            fieldElement
        );
    }
}


/* =========================================================
   Field
   ========================================================= */

function createFieldElement(
    field: TemplateField,
    value: string,
    onChange: (
        fieldId: string,
        value: string
    ) => void
): HTMLElement {

    const htmlTemplate =
        getFieldTemplate(
            field
        );


    const fragment =
        htmlTemplate
            .content
            .cloneNode(
                true
            ) as DocumentFragment;


    const root =
        fragment
            .firstElementChild;


    if (
        !(
            root instanceof
            HTMLElement
        )
    ) {

        throw new Error(
            "入力欄テンプレートを生成できませんでした。"
        );
    }


    const label =
        root
            .querySelector<HTMLLabelElement>(
                ".document-field__label"
            );


    const control =
        root
            .querySelector<
                HTMLInputElement |
                HTMLTextAreaElement
            >(
                "input, textarea"
            );


    if (
        !label ||
        !control
    ) {

        throw new Error(
            "入力欄テンプレートの構造が正しくありません。"
        );
    }


    const controlId =
        `document-field-${field.id}`;


    label.textContent =
        field.label;


    label.htmlFor =
        controlId;


    if (
        field.required
    ) {

        label.dataset.required =
            "true";
    }


    control.id =
        controlId;


    control.name =
        field.id;


    control.required =
        field.required ??
        false;


    control.placeholder =
        field.placeholder ??
        "";


    control.value =
        value;


    control.addEventListener(
        "input",
        () => {

            onChange(
                field.id,
                control.value
            );
        }
    );


    return root;
}


/* =========================================================
   HTML template selector
   ========================================================= */

function getFieldTemplate(
    field: TemplateField
): HTMLTemplateElement {

    switch (
    field.type
    ) {

        case "text":

            return requireTemplate(
                "text-field-template"
            );


        case "textarea":

            return requireTemplate(
                "textarea-field-template"
            );


        case "date":

            return requireTemplate(
                "date-field-template"
            );
    }
}


/* =========================================================
   DOM
   ========================================================= */

function requireTemplate(
    id: string
): HTMLTemplateElement {

    const element =
        document.getElementById(
            id
        );


    if (
        !(
            element instanceof
            HTMLTemplateElement
        )
    ) {

        throw new Error(
            `#${id} が見つかりません。`
        );
    }


    return element;
}