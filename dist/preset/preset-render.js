/**
 * preset-render.ts
 *
 * 親ポータル上の
 * 定型印刷物カードを描画する。
 */
import { getPresetOrientationLabel } from "./preset.js";
/* =========================================================
   Object URL
   ========================================================= */
/**
 * プレビュー画像用Object URL。
 *
 * 再描画時に必ず解放する。
 */
let previewObjectUrls = [];
/* =========================================================
   Public API
   ========================================================= */
/**
 * 定型印刷物カードを全描画する。
 */
export function renderPresetGrid(documents, container, handlers) {
    revokePreviewObjectUrls();
    container.replaceChildren();
    for (const presetDocument of documents) {
        container.appendChild(createPresetCard(presetDocument));
    }
    /**
     * 最後尾には必ず新規追加カード。
     */
    container.appendChild(createAddCard(handlers.onAddRequested));
    container.setAttribute("aria-busy", "false");
}
/**
 * IndexedDB読込失敗時。
 */
export function renderPresetGridError(container, message) {
    revokePreviewObjectUrls();
    container.replaceChildren();
    const error = document.createElement("p");
    /**
     * 既存のnoscript用スタイルを流用する。
     */
    error.className =
        "preset-noscript";
    error.textContent =
        message;
    container.appendChild(error);
    container.setAttribute("aria-busy", "false");
}
/* =========================================================
   Preset Card
   ========================================================= */
function createPresetCard(presetDocument) {
    const card = document.createElement("button");
    card.type =
        "button";
    card.className =
        "preset-card";
    card.setAttribute("aria-label", `${presetDocument.title}を開く`);
    card.appendChild(createPresetPreview(presetDocument));
    card.appendChild(createPresetContent(presetDocument));
    card.addEventListener("click", () => {
        openPresetPdf(presetDocument);
    });
    return card;
}
/* =========================================================
   Preview
   ========================================================= */
function createPresetPreview(presetDocument) {
    const preview = document.createElement("div");
    preview.className =
        "preset-card__preview";
    if (presetDocument.previewBlob) {
        const objectUrl = URL.createObjectURL(presetDocument.previewBlob);
        previewObjectUrls.push(objectUrl);
        const image = document.createElement("img");
        image.src =
            objectUrl;
        image.alt =
            `${presetDocument.title}のプレビュー`;
        preview.appendChild(image);
        return preview;
    }
    preview.classList.add("preset-card__preview--placeholder");
    const placeholder = document.createElement("div");
    placeholder.className =
        "preset-card__preview-placeholder";
    placeholder.innerHTML = `
        <svg
            viewBox="0 -960 960 960"
            aria-hidden="true"
        >
            <path
                d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80Zm-80 280q-33 0-56.5-23.5T160-200v-560q0-33 23.5-56.5T240-840h320l240 240v400q0 33-23.5 56.5T720-120H240Zm280-440h160L520-720v160Z"
            />
        </svg>

        <span>
            PDF
        </span>
    `;
    preview.appendChild(placeholder);
    return preview;
}
/* =========================================================
   Content
   ========================================================= */
function createPresetContent(presetDocument) {
    const content = document.createElement("div");
    content.className =
        "preset-card__content";
    const titleRow = document.createElement("div");
    titleRow.className =
        "preset-card__title-row";
    const title = document.createElement("h3");
    title.className =
        "preset-card__title";
    title.textContent =
        presetDocument.title;
    const orientation = document.createElement("span");
    orientation.className =
        "preset-card__orientation";
    orientation.textContent =
        getPresetOrientationLabel(presetDocument.orientation);
    titleRow.append(title, orientation);
    const description = document.createElement("p");
    description.className =
        "preset-card__description";
    description.textContent =
        presetDocument.description ||
            "定型印刷物を開きます。";
    content.append(titleRow, description);
    return content;
}
/* =========================================================
   Add Card
   ========================================================= */
function createAddCard(onAddRequested) {
    const card = document.createElement("button");
    card.type =
        "button";
    card.className =
        "preset-card preset-card--add";
    card.setAttribute("aria-label", "定型印刷物を新規追加");
    card.innerHTML = `
        <div class="preset-card__add-content">

            <div
                class="preset-card__add-icon"
                aria-hidden="true"
            >
                <svg
                    viewBox="0 -960 960 960"
                >
                    <path
                        d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"
                    />
                </svg>
            </div>

            <p class="preset-card__add-title">
                新規追加
            </p>

            <p class="preset-card__add-description">
                このPCに定型印刷物を追加します。
            </p>

        </div>
    `;
    card.addEventListener("click", onAddRequested);
    return card;
}
/* =========================================================
   PDF
   ========================================================= */
function openPresetPdf(presetDocument) {
    const objectUrl = URL.createObjectURL(presetDocument.pdfBlob);
    const link = document.createElement("a");
    link.href =
        objectUrl;
    link.target =
        "_blank";
    link.rel =
        "noopener noreferrer";
    /**
     * download属性を付けない。
     *
     * ブラウザのPDFビューアで開いて
     * そこから表示 / 印刷する。
     */
    link.click();
    /**
     * 新しいタブがBlob URLを読み込む時間を考慮し、
     * 即座には解放しない。
     */
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 60000);
}
/* =========================================================
   Cleanup
   ========================================================= */
function revokePreviewObjectUrls() {
    for (const objectUrl of previewObjectUrls) {
        URL.revokeObjectURL(objectUrl);
    }
    previewObjectUrls =
        [];
}
//# sourceMappingURL=preset-render.js.map