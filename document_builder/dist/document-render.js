import { interpolateTemplateText } from "./template.js";
/* =========================================================
   Render
   ========================================================= */
export function renderBusinessDocument(elements, template, values) {
    setText(elements.topLeft, interpolateTemplateText(template
        .document
        .topLeft, values));
    setText(elements.topRight, interpolateTemplateText(template
        .document
        .topRight, values));
    setText(elements.opening, interpolateTemplateText(template
        .document
        .opening, values));
    setText(elements.body, interpolateTemplateText(template
        .document
        .body, values));
    setText(elements.closing, interpolateTemplateText(template
        .document
        .closing, values));
    setText(elements.end, interpolateTemplateText(template
        .document
        .end, values));
}
/* =========================================================
   Clear
   ========================================================= */
export function clearBusinessDocument(elements) {
    for (const element of Object.values(elements)) {
        element.textContent =
            "";
        element.hidden =
            false;
    }
}
/* =========================================================
   Internal
   ========================================================= */
function setText(element, text) {
    element.textContent =
        text;
    /*
     * 空セクションは余白ごと消す。
     */
    element.hidden =
        text.length ===
            0;
}
//# sourceMappingURL=document-render.js.map