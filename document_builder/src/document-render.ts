import {
    DocumentTemplate,
    DocumentValues,
    interpolateTemplateText
} from "./template.js";


/* =========================================================
   Types
   ========================================================= */

export type DocumentRenderElements = {

    topLeft:
    HTMLElement;

    topRight:
    HTMLElement;

    opening:
    HTMLElement;

    body:
    HTMLElement;

    closing:
    HTMLElement;

    end:
    HTMLElement;
};


/* =========================================================
   Render
   ========================================================= */

export function renderBusinessDocument(
    elements: DocumentRenderElements,
    template: DocumentTemplate,
    values: DocumentValues
): void {

    setText(
        elements.topLeft,
        interpolateTemplateText(
            template
                .document
                .topLeft,

            values
        )
    );


    setText(
        elements.topRight,
        interpolateTemplateText(
            template
                .document
                .topRight,

            values
        )
    );


    setText(
        elements.opening,
        interpolateTemplateText(
            template
                .document
                .opening,

            values
        )
    );


    setText(
        elements.body,
        interpolateTemplateText(
            template
                .document
                .body,

            values
        )
    );


    setText(
        elements.closing,
        interpolateTemplateText(
            template
                .document
                .closing,

            values
        )
    );


    setText(
        elements.end,
        interpolateTemplateText(
            template
                .document
                .end,

            values
        )
    );
}


/* =========================================================
   Clear
   ========================================================= */

export function clearBusinessDocument(
    elements: DocumentRenderElements
): void {

    for (
        const element
        of Object.values(
            elements
        )
    ) {

        element.textContent =
            "";

        element.hidden =
            false;
    }
}


/* =========================================================
   Internal
   ========================================================= */

function setText(
    element: HTMLElement,
    text: string
): void {

    element.textContent =
        text;


    /*
     * 空セクションは余白ごと消す。
     */
    element.hidden =
        text.length ===
        0;
}