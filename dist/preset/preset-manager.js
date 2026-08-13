/**
 * preset-manager.ts
 *
 * 定型印刷物の管理UIを担当する。
 *
 * - 管理モーダル
 * - 登録済み一覧
 * - 新規追加
 * - 編集
 * - プレビュー画像差し替え
 * - 削除
 *
 * Editorには2つの入口がある。
 *
 * direct:
 *   メイン画面最後尾の「新規追加」カード
 *
 * manager:
 *   管理一覧内の「新規追加」または「編集」
 */
import { createPresetDocumentId, getPresetOrientationLabel, isPdfFile, isPreviewImageFile } from "./preset.js";
import { deletePresetDocument, getNextPresetSortOrder, getPresetDocuments, putPresetDocument, requestPersistentStorage } from "./preset-db.js";
/* =========================================================
   Setup
   ========================================================= */
export function setupPresetManager(options) {
    /* -----------------------------------------------------
       Dialog
       ----------------------------------------------------- */
    const settingsButton = requireElement("#preset-settings-button");
    const dialog = requireElement("#preset-manager-dialog");
    /* -----------------------------------------------------
       List View
       ----------------------------------------------------- */
    const listView = requireElement("#preset-manager-list-view");
    const addButton = requireElement("#preset-manager-add-button");
    const managerList = requireElement("#preset-manager-list");
    /* -----------------------------------------------------
       Editor View
       ----------------------------------------------------- */
    const editorView = requireElement("#preset-editor-view");
    const editorBackButton = requireElement("#preset-editor-back-button");
    const editorHeadingTitle = requireElement("#preset-editor-title");
    const editorForm = requireElement("#preset-editor-form");
    const editorIdInput = requireElement("#preset-editor-id");
    const titleInput = requireElement("#preset-title-input");
    const descriptionInput = requireElement("#preset-description-input");
    const portraitInput = requireElement("#preset-orientation-portrait");
    const landscapeInput = requireElement("#preset-orientation-landscape");
    const pdfInput = requireElement("#preset-pdf-input");
    const currentPdf = requireElement("#preset-current-pdf");
    const previewInput = requireElement("#preset-preview-input");
    const currentPreview = requireElement("#preset-current-preview");
    const editorError = requireElement("#preset-editor-error");
    const cancelButton = requireElement("#preset-editor-cancel-button");
    const saveButton = requireElement("#preset-editor-save-button");
    /* -----------------------------------------------------
       State
       ----------------------------------------------------- */
    let editingDocument = null;
    let editorOrigin = "direct";
    let managerPreviewObjectUrls = [];
    /* =====================================================
       View
       ===================================================== */
    function showListView() {
        listView.hidden =
            false;
        editorView.hidden =
            true;
    }
    function showEditorView() {
        listView.hidden =
            true;
        editorView.hidden =
            false;
    }
    /* =====================================================
       Dialog
       ===================================================== */
    async function openManager() {
        showListView();
        if (!dialog.open) {
            dialog.showModal();
        }
        try {
            await refreshManagerList();
        }
        catch (error) {
            console.error("定型印刷物の管理一覧を読み込めませんでした。", error);
            renderManagerListError();
        }
    }
    /**
     * メイン画面最後尾の
     * 「新規追加」カードから開く。
     *
     * 管理一覧を経由していないため、
     * 戻るボタンは表示しない。
     */
    function openCreateEditor() {
        editorOrigin =
            "direct";
        resetEditor();
        editorBackButton.hidden =
            true;
        editorHeadingTitle.textContent =
            "定型印刷物を追加";
        saveButton.textContent =
            "追加";
        showEditorView();
        if (!dialog.open) {
            dialog.showModal();
        }
        focusLater(titleInput);
    }
    /**
     * 管理一覧内の
     * 「新規追加」から開く。
     *
     * 管理一覧へ戻れるようにする。
     */
    function openCreateEditorFromManager() {
        editorOrigin =
            "manager";
        resetEditor();
        editorBackButton.hidden =
            false;
        editorHeadingTitle.textContent =
            "定型印刷物を追加";
        saveButton.textContent =
            "追加";
        showEditorView();
        focusLater(titleInput);
    }
    /* =====================================================
       Editor
       ===================================================== */
    function resetEditor() {
        editingDocument =
            null;
        editorForm.reset();
        editorIdInput.value =
            "";
        portraitInput.checked =
            true;
        landscapeInput.checked =
            false;
        pdfInput.value =
            "";
        previewInput.value =
            "";
        currentPdf.textContent =
            "PDFが選択されていません。";
        currentPreview.textContent =
            "指定しない場合はPDFアイコンを表示します。";
        hideEditorError();
    }
    /**
     * 管理一覧から既存データを編集する。
     */
    function openEditEditor(presetDocument) {
        editorOrigin =
            "manager";
        editingDocument =
            presetDocument;
        editorForm.reset();
        editorIdInput.value =
            presetDocument.id;
        titleInput.value =
            presetDocument.title;
        descriptionInput.value =
            presetDocument.description;
        portraitInput.checked =
            presetDocument.orientation ===
                "portrait";
        landscapeInput.checked =
            presetDocument.orientation ===
                "landscape";
        pdfInput.value =
            "";
        previewInput.value =
            "";
        currentPdf.textContent =
            [
                "現在:",
                presetDocument.pdfFileName,
                `(${formatBytes(presetDocument.pdfBlob.size)})`
            ].join(" ");
        if (presetDocument.previewBlob &&
            presetDocument.previewFileName) {
            currentPreview.textContent =
                [
                    "現在:",
                    presetDocument.previewFileName,
                    `(${formatBytes(presetDocument.previewBlob.size)})`
                ].join(" ");
        }
        else {
            currentPreview.textContent =
                "プレビュー画像は設定されていません。";
        }
        editorBackButton.hidden =
            false;
        editorHeadingTitle.textContent =
            "定型印刷物を編集";
        saveButton.textContent =
            "保存";
        hideEditorError();
        showEditorView();
        if (!dialog.open) {
            dialog.showModal();
        }
        focusLater(titleInput);
    }
    /**
     * Editorを離れる。
     *
     * directならdialogを閉じる。
     * managerなら管理一覧へ戻る。
     */
    function leaveEditor() {
        if (editorOrigin ===
            "manager") {
            resetEditor();
            showListView();
            return;
        }
        dialog.close();
    }
    /* =====================================================
       Orientation
       ===================================================== */
    function getSelectedOrientation() {
        if (landscapeInput.checked) {
            return "landscape";
        }
        return "portrait";
    }
    /* =====================================================
       Manager List
       ===================================================== */
    async function refreshManagerList() {
        revokeManagerPreviewObjectUrls();
        managerList.replaceChildren();
        const documents = await getPresetDocuments();
        if (documents.length === 0) {
            renderManagerEmpty();
            return;
        }
        for (const presetDocument of documents) {
            managerList.appendChild(createManagerItem(presetDocument));
        }
    }
    function renderManagerEmpty() {
        const empty = document.createElement("div");
        empty.className =
            "preset-manager-empty";
        empty.textContent =
            "定型印刷物はまだ登録されていません。";
        managerList.appendChild(empty);
    }
    function renderManagerListError() {
        revokeManagerPreviewObjectUrls();
        managerList.replaceChildren();
        const error = document.createElement("div");
        error.className =
            "preset-manager-empty";
        error.textContent =
            "保存データを読み込めませんでした。";
        managerList.appendChild(error);
    }
    /* =====================================================
       Manager Item
       ===================================================== */
    function createManagerItem(presetDocument) {
        const item = document.createElement("article");
        item.className =
            "preset-manager-item";
        item.appendChild(createManagerPreview(presetDocument));
        item.appendChild(createManagerBody(presetDocument));
        item.appendChild(createManagerActions(presetDocument));
        return item;
    }
    function createManagerPreview(presetDocument) {
        const preview = document.createElement("div");
        preview.className =
            "preset-manager-item__preview";
        if (presetDocument.previewBlob) {
            const objectUrl = URL.createObjectURL(presetDocument.previewBlob);
            managerPreviewObjectUrls.push(objectUrl);
            const image = document.createElement("img");
            image.src =
                objectUrl;
            image.alt =
                `${presetDocument.title}のプレビュー`;
            preview.appendChild(image);
            return preview;
        }
        preview.innerHTML = `
            <svg
                viewBox="0 -960 960 960"
                aria-hidden="true"
            >
                <path
                    d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80Zm-80 280q-33 0-56.5-23.5T160-200v-560q0-33 23.5-56.5T240-840h320l240 240v400q0 33-23.5 56.5T720-120H240Zm280-440h160L520-720v160Z"
                />
            </svg>
        `;
        return preview;
    }
    function createManagerBody(presetDocument) {
        const body = document.createElement("div");
        body.className =
            "preset-manager-item__body";
        const titleRow = document.createElement("div");
        titleRow.className =
            "preset-manager-item__title-row";
        const title = document.createElement("h3");
        title.className =
            "preset-manager-item__title";
        title.textContent =
            presetDocument.title;
        const orientation = document.createElement("span");
        orientation.className =
            "preset-manager-item__orientation";
        orientation.textContent =
            getPresetOrientationLabel(presetDocument.orientation);
        titleRow.append(title, orientation);
        const file = document.createElement("p");
        file.className =
            "preset-manager-item__file";
        file.textContent =
            [
                presetDocument.pdfFileName,
                formatBytes(presetDocument.pdfBlob.size)
            ].join(" · ");
        body.append(titleRow, file);
        return body;
    }
    function createManagerActions(presetDocument) {
        const actions = document.createElement("div");
        actions.className =
            "preset-manager-item__actions";
        /* -------------------------------------------------
           編集
           ------------------------------------------------- */
        const editButton = createActionButton("編集");
        editButton.addEventListener("click", () => {
            openEditEditor(presetDocument);
        });
        /* -------------------------------------------------
           削除
           ------------------------------------------------- */
        const deleteButton = createActionButton("削除");
        deleteButton.addEventListener("click", () => {
            void handleDelete(presetDocument);
        });
        actions.append(editButton, deleteButton);
        return actions;
    }
    function createActionButton(label) {
        const button = document.createElement("button");
        button.type =
            "button";
        button.className =
            "glass-button";
        button.textContent =
            label;
        return button;
    }
    /* =====================================================
       Delete
       ===================================================== */
    async function handleDelete(presetDocument) {
        const confirmed = window.confirm(`「${presetDocument.title}」を削除しますか？\n\nこのPCに保存されているPDFも削除されます。`);
        if (!confirmed) {
            return;
        }
        try {
            await deletePresetDocument(presetDocument.id);
            await notifyChanged();
            await refreshManagerList();
        }
        catch (error) {
            console.error("定型印刷物を削除できませんでした。", error);
            window.alert("定型印刷物を削除できませんでした。");
        }
    }
    /* =====================================================
       Submit
       ===================================================== */
    async function handleSubmit(event) {
        event.preventDefault();
        hideEditorError();
        const title = titleInput.value.trim();
        const description = descriptionInput
            .value
            .trim();
        const orientation = getSelectedOrientation();
        if (title.length === 0) {
            showEditorError("タイトルを入力してください。");
            titleInput.focus();
            return;
        }
        const selectedPdf = pdfInput.files?.[0] ??
            null;
        const selectedPreview = previewInput.files?.[0] ??
            null;
        /* -------------------------------------------------
           PDF
           ------------------------------------------------- */
        if (!editingDocument &&
            !selectedPdf) {
            showEditorError("PDFを選択してください。");
            pdfInput.focus();
            return;
        }
        if (selectedPdf &&
            !isPdfFile(selectedPdf)) {
            showEditorError("PDFファイルを選択してください。");
            pdfInput.focus();
            return;
        }
        /* -------------------------------------------------
           Preview
           ------------------------------------------------- */
        if (selectedPreview &&
            !isPreviewImageFile(selectedPreview)) {
            showEditorError("プレビュー画像はPNG、JPEG、WebPのいずれかを選択してください。");
            previewInput.focus();
            return;
        }
        /* -------------------------------------------------
           保存開始
           ------------------------------------------------- */
        saveButton.disabled =
            true;
        const originalButtonText = saveButton.textContent;
        saveButton.textContent =
            "保存中...";
        try {
            const now = Date.now();
            let presetDocument;
            /* -------------------------------------------------
               更新
               ------------------------------------------------- */
            if (editingDocument) {
                presetDocument = {
                    ...editingDocument,
                    title,
                    description,
                    orientation,
                    pdfFileName: selectedPdf
                        ? selectedPdf.name
                        : editingDocument.pdfFileName,
                    pdfMimeType: selectedPdf
                        ? (selectedPdf.type ||
                            "application/pdf")
                        : editingDocument.pdfMimeType,
                    pdfBlob: selectedPdf ??
                        editingDocument.pdfBlob,
                    previewFileName: selectedPreview
                        ? selectedPreview.name
                        : editingDocument.previewFileName,
                    previewMimeType: selectedPreview
                        ? (selectedPreview.type ||
                            null)
                        : editingDocument.previewMimeType,
                    previewBlob: selectedPreview ??
                        editingDocument.previewBlob,
                    updatedAt: now
                };
            }
            /* -------------------------------------------------
               新規追加
               ------------------------------------------------- */
            else {
                if (!selectedPdf) {
                    throw new Error("PDFが選択されていません。");
                }
                const sortOrder = await getNextPresetSortOrder();
                presetDocument = {
                    id: createPresetDocumentId(),
                    title,
                    description,
                    orientation,
                    pdfFileName: selectedPdf.name,
                    pdfMimeType: selectedPdf.type ||
                        "application/pdf",
                    pdfBlob: selectedPdf,
                    previewFileName: selectedPreview
                        ? selectedPreview.name
                        : null,
                    previewMimeType: selectedPreview
                        ? (selectedPreview.type ||
                            null)
                        : null,
                    previewBlob: selectedPreview,
                    sortOrder,
                    createdAt: now,
                    updatedAt: now
                };
            }
            /* -------------------------------------------------
               IndexedDB
               ------------------------------------------------- */
            await putPresetDocument(presetDocument);
            /**
             * 保存後に永続ストレージを要求する。
             *
             * falseでも保存処理自体は成功。
             */
            void requestPersistentStorage();
            editingDocument =
                null;
            /**
             * メイン画面のカードを更新する。
             */
            await notifyChanged();
            /* -------------------------------------------------
               保存後の遷移
               ------------------------------------------------- */
            if (editorOrigin ===
                "manager") {
                await refreshManagerList();
                resetEditor();
                showListView();
            }
            else {
                dialog.close();
            }
        }
        catch (error) {
            console.error("定型印刷物を保存できませんでした。", error);
            showEditorError("定型印刷物を保存できませんでした。");
        }
        finally {
            saveButton.disabled =
                false;
            saveButton.textContent =
                originalButtonText;
        }
    }
    /* =====================================================
       Change Notification
       ===================================================== */
    async function notifyChanged() {
        await options.onChanged();
    }
    /* =====================================================
       Editor Error
       ===================================================== */
    function showEditorError(message) {
        editorError.textContent =
            message;
        editorError.hidden =
            false;
    }
    function hideEditorError() {
        editorError.textContent =
            "";
        editorError.hidden =
            true;
    }
    /* =====================================================
       Focus
       ===================================================== */
    function focusLater(element) {
        window.setTimeout(() => {
            element.focus();
        }, 0);
    }
    /* =====================================================
       Events
       ===================================================== */
    /**
     * ⚙
     *
     * 管理一覧を開く。
     */
    settingsButton.addEventListener("click", () => {
        void openManager();
    });
    /**
     * 管理一覧内の「新規追加」。
     *
     * directではなくmanager起点。
     */
    addButton.addEventListener("click", () => {
        openCreateEditorFromManager();
    });
    /**
     * Editor左上の戻るボタン。
     *
     * manager起点でのみ表示される。
     */
    editorBackButton.addEventListener("click", () => {
        leaveEditor();
    });
    /**
     * キャンセル。
     *
     * direct:
     *   dialogを閉じる
     *
     * manager:
     *   一覧へ戻る
     */
    cancelButton.addEventListener("click", () => {
        leaveEditor();
    });
    /**
     * 保存。
     */
    editorForm.addEventListener("submit", (event) => {
        void handleSubmit(event);
    });
    /**
     * × やEscなどでdialog自体が閉じられた場合。
     */
    dialog.addEventListener("close", () => {
        revokeManagerPreviewObjectUrls();
        resetEditor();
        editorOrigin =
            "direct";
        editorBackButton.hidden =
            true;
        showListView();
    });
    /* =====================================================
       Controller
       ===================================================== */
    return {
        openManager,
        openCreateEditor
    };
    /* =====================================================
       Local helpers
       ===================================================== */
    function revokeManagerPreviewObjectUrls() {
        for (const objectUrl of managerPreviewObjectUrls) {
            URL.revokeObjectURL(objectUrl);
        }
        managerPreviewObjectUrls =
            [];
    }
}
/* =========================================================
   DOM Utility
   ========================================================= */
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`必要な要素が見つかりません: ${selector}`);
    }
    return element;
}
/* =========================================================
   Format
   ========================================================= */
function formatBytes(bytes) {
    if (bytes <
        1024) {
        return `${bytes} B`;
    }
    const kilobytes = bytes /
        1024;
    if (kilobytes <
        1024) {
        return `${kilobytes.toFixed(1)} KB`;
    }
    const megabytes = kilobytes /
        1024;
    if (megabytes <
        1024) {
        return `${megabytes.toFixed(1)} MB`;
    }
    const gigabytes = megabytes /
        1024;
    return `${gigabytes.toFixed(2)} GB`;
}
//# sourceMappingURL=preset-manager.js.map