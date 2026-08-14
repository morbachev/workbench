import {
    createInitialValues,
    DocumentTemplate,
    DocumentValues,
    getReferencedFields
} from "./template.js";


import {
    deleteTemplate,
    getTemplate,
    getTemplates,
    putTemplate,
    requestPersistentStorage
} from "./template-db.js";


import {
    downloadDocumentJson,
    downloadTemplateJson,
    readDocumentPackageFile
} from "./template-import.js";


import {
    renderDocumentFields
} from "./form-render.js";


import {
    clearBusinessDocument,
    DocumentRenderElements,
    renderBusinessDocument
} from "./document-render.js";


import {
    setupTemplateBuilder,
    TemplateBuilderMode
} from "./template-builder.js";


import {
    DOCUMENT_PDF_FILE_NAME,
    PdfSaveCancelledError,
    saveDocumentPdf
} from "./pdf.js";


/* =========================================================
   Constants
   ========================================================= */

const ACTIVE_TEMPLATE_STORAGE_KEY =
    "workbench-document-builder-active-template";


const TOAST_DURATION_MS =
    3200;


/* =========================================================
   Ribbon
   ========================================================= */

const jsonImportInput =
    requireElement<HTMLInputElement>(
        "#json-import-input"
    );


const jsonImportButton =
    requireElement<HTMLButtonElement>(
        "#json-import-button"
    );


const jsonExportButton =
    requireElement<HTMLButtonElement>(
        "#json-export-button"
    );


const templateSelect =
    requireElement<HTMLSelectElement>(
        "#template-select"
    );


const templateSettingsButton =
    requireElement<HTMLButtonElement>(
        "#template-settings-button"
    );


const printButton =
    requireElement<HTMLButtonElement>(
        "#print-button"
    );


/* =========================================================
   Fields
   ========================================================= */

const documentFieldsEmpty =
    requireElement<HTMLElement>(
        "#document-fields-empty"
    );


const documentFieldsForm =
    requireElement<HTMLFormElement>(
        "#document-fields-form"
    );


const documentFields =
    requireElement<HTMLElement>(
        "#document-fields"
    );


const activeTemplateName =
    requireElement<HTMLElement>(
        "#active-template-name"
    );


/* =========================================================
   Preview
   ========================================================= */

const documentPage =
    requireElement<HTMLElement>(
        "#document-page"
    );


const documentPreviewEmpty =
    requireElement<HTMLElement>(
        "#document-preview-empty"
    );


const documentContent =
    requireElement<HTMLElement>(
        "#document-content"
    );


const documentRenderElements:
    DocumentRenderElements = {

    topLeft:
        requireElement<HTMLElement>(
            "#document-top-left"
        ),

    topRight:
        requireElement<HTMLElement>(
            "#document-top-right"
        ),

    opening:
        requireElement<HTMLElement>(
            "#document-opening"
        ),

    body:
        requireElement<HTMLElement>(
            "#document-body"
        ),

    closing:
        requireElement<HTMLElement>(
            "#document-closing"
        ),

    end:
        requireElement<HTMLElement>(
            "#document-end"
        )
};


/* =========================================================
   Print Flow
   ========================================================= */

const printFlowDialog =
    requireElement<HTMLDialogElement>(
        "#print-flow-dialog"
    );


const printFlowCloseButton =
    requireElement<HTMLButtonElement>(
        "#print-flow-close-button"
    );


const printSavePdfButton =
    requireElement<HTMLButtonElement>(
        "#print-save-pdf-button"
    );


const printFinalButton =
    requireElement<HTMLButtonElement>(
        "#print-final-button"
    );


const printStepOne =
    requireElement<HTMLElement>(
        "#print-step-one"
    );


const printStepTwo =
    requireElement<HTMLElement>(
        "#print-step-two"
    );


const printStepOneStatus =
    requireElement<HTMLElement>(
        "#print-step-one-status"
    );


const printFileName =
    requireElement<HTMLElement>(
        "#print-file-name"
    );


/* =========================================================
   Settings
   ========================================================= */

const templateSettingsDialog =
    requireElement<HTMLDialogElement>(
        "#template-settings-dialog"
    );


const templateDialogCloseButton =
    requireElement<HTMLButtonElement>(
        "#template-dialog-close-button"
    );


const templateDialogDoneButton =
    requireElement<HTMLButtonElement>(
        "#template-dialog-done-button"
    );


const templateBuilderButton =
    requireElement<HTMLButtonElement>(
        "#template-builder-button"
    );


const templateAddInput =
    requireElement<HTMLInputElement>(
        "#template-add-input"
    );


const templateAddButton =
    requireElement<HTMLButtonElement>(
        "#template-add-button"
    );


const templateListEmpty =
    requireElement<HTMLElement>(
        "#template-list-empty"
    );


const templateList =
    requireElement<HTMLElement>(
        "#template-list"
    );


const templateCardTemplate =
    requireElement<HTMLTemplateElement>(
        "#template-card-template"
    );


/* =========================================================
   Delete
   ========================================================= */

const templateDeleteDialog =
    requireElement<HTMLDialogElement>(
        "#template-delete-dialog"
    );


const templateDeleteCancelButton =
    requireElement<HTMLButtonElement>(
        "#template-delete-cancel-button"
    );


const templateDeleteConfirmButton =
    requireElement<HTMLButtonElement>(
        "#template-delete-confirm-button"
    );


/* =========================================================
   Toast
   ========================================================= */

const documentToast =
    requireElement<HTMLElement>(
        "#document-toast"
    );


/* =========================================================
   State
   ========================================================= */

let templates:
    DocumentTemplate[] =
    [];


let activeTemplate:
    DocumentTemplate |
    null =
    null;


let activeValues:
    DocumentValues =
    {};


let pendingDeleteTemplateId:
    string |
    null =
    null;


let toastTimer:
    number |
    null =
    null;


/* =========================================================
   Template Builder
   ========================================================= */

const templateBuilder =
    setupTemplateBuilder({

        onSave:
            saveTemplateFromBuilder,

        onReturnToList:
            () => {

                renderTemplateManagerList();
            }
    });


/* =========================================================
   Initialize
   ========================================================= */

void initialize();


async function initialize():
    Promise<void> {

    wireEvents();


    printFileName.textContent =
        DOCUMENT_PDF_FILE_NAME;


    try {

        await requestPersistentStorage();


        await refreshTemplateCollections();


        restoreInitialTemplate();

    } catch (
    error
    ) {

        console.error(
            "DOCUMENT BUILDERの初期化に失敗しました。",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );


        clearActiveTemplate();
    }
}


/* =========================================================
   Events
   ========================================================= */

function wireEvents():
    void {

    /* -----------------------------------------------------
       JSON import
       ----------------------------------------------------- */

    jsonImportButton.addEventListener(
        "click",
        () => {

            jsonImportInput.value =
                "";


            jsonImportInput.click();
        }
    );


    jsonImportInput.addEventListener(
        "change",
        () => {

            void handleDocumentImport();
        }
    );


    /* -----------------------------------------------------
       JSON export
       ----------------------------------------------------- */

    jsonExportButton.addEventListener(
        "click",
        () => {

            if (
                !activeTemplate
            ) {

                return;
            }


            downloadDocumentJson(
                activeTemplate,
                activeValues
            );


            showToast(
                "現在の文書をJSON出力しました。"
            );
        }
    );


    /* -----------------------------------------------------
       Template
       ----------------------------------------------------- */

    templateSelect.addEventListener(
        "change",
        () => {

            void handleTemplateSelection();
        }
    );


    templateSettingsButton.addEventListener(
        "click",
        () => {

            openTemplateSettings();
        }
    );


    /* -----------------------------------------------------
       Print flow
       ----------------------------------------------------- */

    printButton.addEventListener(
        "click",
        () => {

            openPrintFlow();
        }
    );


    printFlowCloseButton.addEventListener(
        "click",
        () => {

            printFlowDialog.close();
        }
    );


    printFlowDialog.addEventListener(
        "click",
        (
            event
        ) => {

            if (
                event.target ===
                printFlowDialog
            ) {

                printFlowDialog.close();
            }
        }
    );


    /* -----------------------------------------------------
       PDF Save
       ----------------------------------------------------- */

    printSavePdfButton.addEventListener(
        "click",
        () => {

            void runPdfSaveStep();
        }
    );


    /* -----------------------------------------------------
       Final print
       ----------------------------------------------------- */

    printFinalButton.addEventListener(
        "click",
        () => {

            runFinalPrint();
        }
    );


    /* -----------------------------------------------------
       Template settings
       ----------------------------------------------------- */

    templateDialogCloseButton.addEventListener(
        "click",
        () => {

            templateSettingsDialog.close();
        }
    );


    templateDialogDoneButton.addEventListener(
        "click",
        () => {

            templateSettingsDialog.close();
        }
    );


    templateBuilderButton.addEventListener(
        "click",
        () => {

            templateBuilder.openCreate();
        }
    );


    templateAddButton.addEventListener(
        "click",
        () => {

            templateAddInput.value =
                "";


            templateAddInput.click();
        }
    );


    templateAddInput.addEventListener(
        "change",
        () => {

            void handleTemplateAddImport();
        }
    );


    templateSettingsDialog.addEventListener(
        "click",
        (
            event
        ) => {

            if (
                event.target ===
                templateSettingsDialog
            ) {

                templateSettingsDialog.close();
            }
        }
    );


    templateSettingsDialog.addEventListener(
        "close",
        () => {

            templateBuilder.reset();
        }
    );


    /* -----------------------------------------------------
       Delete
       ----------------------------------------------------- */

    templateDeleteCancelButton.addEventListener(
        "click",
        () => {

            pendingDeleteTemplateId =
                null;


            templateDeleteDialog.close();
        }
    );


    templateDeleteConfirmButton.addEventListener(
        "click",
        () => {

            void confirmTemplateDelete();
        }
    );


    templateDeleteDialog.addEventListener(
        "click",
        (
            event
        ) => {

            if (
                event.target ===
                templateDeleteDialog
            ) {

                pendingDeleteTemplateId =
                    null;


                templateDeleteDialog.close();
            }
        }
    );
}


/* =========================================================
   Required Validation
   ========================================================= */

function validateRequiredFields():
    boolean {

    if (
        !activeTemplate
    ) {

        return false;
    }


    const missingField =
        getReferencedFields(
            activeTemplate
        ).find(
            (
                field
            ) => {

                if (
                    !field.required
                ) {

                    return false;
                }


                const value =
                    activeValues[
                    field.id
                    ] ??
                    "";


                return (
                    value.trim().length ===
                    0
                );
            }
        );


    if (
        !missingField
    ) {

        return true;
    }


    showToast(
        `必須項目「${missingField.label}」を入力してください。`
    );


    const control =
        document.getElementById(
            `document-field-${missingField.id}`
        );


    if (
        control instanceof
        HTMLInputElement ||
        control instanceof
        HTMLTextAreaElement
    ) {

        control.focus();


        control.reportValidity();
    }


    return false;
}


/* =========================================================
   Open Print Flow
   ========================================================= */

function openPrintFlow():
    void {

    if (
        !activeTemplate
    ) {

        return;
    }


    if (
        !validateRequiredFields()
    ) {

        return;
    }


    resetPrintFlow();


    if (
        !printFlowDialog.open
    ) {

        printFlowDialog.showModal();
    }
}


/* =========================================================
   Reset Print Flow
   ========================================================= */

function resetPrintFlow():
    void {

    printSavePdfButton.disabled =
        false;


    printSavePdfButton.textContent =
        "PDFを保存";


    printFinalButton.disabled =
        true;


    printStepOne.classList.remove(
        "print-flow-step--complete"
    );


    printStepTwo.classList.add(
        "print-flow-step--disabled"
    );


    printStepOneStatus.textContent =
        "";


    printStepOneStatus.hidden =
        true;
}


/* =========================================================
   STEP 1
   PDF Save
   ========================================================= */

async function runPdfSaveStep():
    Promise<void> {

    if (
        !activeTemplate
    ) {

        return;
    }


    if (
        !validateRequiredFields()
    ) {

        printFlowDialog.close();

        return;
    }


    printSavePdfButton.disabled =
        true;


    printSavePdfButton.textContent =
        "PDFを作成中...";


    try {

        const result =
            await saveDocumentPdf(
                documentPage
            );


        printStepOne.classList.add(
            "print-flow-step--complete"
        );


        printStepTwo.classList.remove(
            "print-flow-step--disabled"
        );


        printFinalButton.disabled =
            false;


        printStepOneStatus.hidden =
            false;


        if (
            result.method ===
            "file-picker"
        ) {

            printStepOneStatus.textContent =
                "PDFを保存しました。";

        } else {

            printStepOneStatus.textContent =
                "PDFのダウンロードを開始しました。";
        }


        showToast(
            `${result.fileName} を作成しました。`
        );

    } catch (
    error
    ) {

        if (
            error instanceof
            PdfSaveCancelledError
        ) {

            showToast(
                "PDF保存をキャンセルしました。"
            );


            return;
        }


        console.error(
            "PDF保存に失敗しました。",
            error
        );


        showToast(
            `PDFを保存できませんでした。${getErrorMessage(
                error
            )}`
        );

    } finally {

        printSavePdfButton.disabled =
            false;


        printSavePdfButton.textContent =
            "PDFを保存";
    }
}


/* =========================================================
   STEP 2
   Print
   ========================================================= */

function runFinalPrint():
    void {

    if (
        printFinalButton.disabled
    ) {

        return;
    }


    if (
        !validateRequiredFields()
    ) {

        printFlowDialog.close();

        return;
    }


    window.print();
}


/* =========================================================
   Ribbon JSON Import
   ========================================================= */

async function handleDocumentImport():
    Promise<void> {

    const file =
        jsonImportInput.files?.[0];


    if (
        !file
    ) {

        return;
    }


    try {

        const packageData =
            await readDocumentPackageFile(
                file
            );


        await putTemplate(
            packageData.template
        );


        await refreshTemplateCollections();


        applyTemplate(
            packageData.template,
            packageData.values
        );


        showToast(
            packageData.values
                ? "文書JSONを読み込みました。"
                : "テンプレートJSONを読み込みました。"
        );

    } catch (
    error
    ) {

        console.error(
            "JSONインポートに失敗しました。",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );

    } finally {

        jsonImportInput.value =
            "";
    }
}


/* =========================================================
   Template Add JSON
   ========================================================= */

async function handleTemplateAddImport():
    Promise<void> {

    const file =
        templateAddInput.files?.[0];


    if (
        !file
    ) {

        return;
    }


    try {

        const packageData =
            await readDocumentPackageFile(
                file
            );


        const existing =
            await getTemplate(
                packageData.template.id
            );


        if (
            existing
        ) {

            throw new Error(
                "同じIDのテンプレートがすでに登録されています。既存テンプレートは「編集」を使用してください。"
            );
        }


        await putTemplate(
            packageData.template
        );


        await refreshTemplateCollections();


        applyTemplate(
            packageData.template
        );


        showToast(
            "テンプレートを追加しました。"
        );

    } catch (
    error
    ) {

        console.error(
            "テンプレート追加に失敗しました。",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );

    } finally {

        templateAddInput.value =
            "";
    }
}


/* =========================================================
   Template Builder Save
   ========================================================= */

async function saveTemplateFromBuilder(
    template: DocumentTemplate,
    mode: TemplateBuilderMode
): Promise<void> {

    if (
        mode ===
        "create"
    ) {

        const existing =
            await getTemplate(
                template.id
            );


        if (
            existing
        ) {

            throw new Error(
                "同じIDのテンプレートがすでに存在します。"
            );
        }


        await putTemplate(
            template
        );


        await refreshTemplateCollections();


        applyTemplate(
            template
        );


        showToast(
            "テンプレートを登録しました。"
        );


        return;
    }


    const existing =
        await getTemplate(
            template.id
        );


    if (
        !existing
    ) {

        throw new Error(
            "編集対象のテンプレートが見つかりません。"
        );
    }


    const editingActiveTemplate =
        activeTemplate?.id ===
        template.id;


    const preservedValues =
        editingActiveTemplate
            ? activeValues
            : undefined;


    await putTemplate(
        template
    );


    await refreshTemplateCollections();


    if (
        editingActiveTemplate
    ) {

        applyTemplate(
            template,
            preservedValues
        );
    }


    showToast(
        "テンプレートを更新しました。"
    );
}


/* =========================================================
   Template Selection
   ========================================================= */

async function handleTemplateSelection():
    Promise<void> {

    const id =
        templateSelect.value;


    if (
        !id
    ) {

        clearActiveTemplate();

        return;
    }


    const template =
        await getTemplate(
            id
        );


    if (
        !template
    ) {

        await refreshTemplateCollections();


        clearActiveTemplate();


        showToast(
            "選択したテンプレートを読み込めませんでした。"
        );


        return;
    }


    applyTemplate(
        template
    );
}


/* =========================================================
   Settings
   ========================================================= */

function openTemplateSettings():
    void {

    templateBuilder.showListView();


    renderTemplateManagerList();


    if (
        !templateSettingsDialog.open
    ) {

        templateSettingsDialog.showModal();
    }
}


/* =========================================================
   Refresh
   ========================================================= */

async function refreshTemplateCollections():
    Promise<void> {

    templates =
        await getTemplates();


    renderTemplateSelect();


    renderTemplateManagerList();
}


/* =========================================================
   Template Select
   ========================================================= */

function renderTemplateSelect():
    void {

    const selectedId =
        activeTemplate?.id ??
        templateSelect.value;


    templateSelect.replaceChildren();


    const placeholder =
        document.createElement(
            "option"
        );


    placeholder.value =
        "";


    placeholder.textContent =
        templates.length ===
            0
            ? "テンプレートがありません"
            : "テンプレートを選択";


    templateSelect.appendChild(
        placeholder
    );


    for (
        const template
        of templates
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            template.id;


        option.textContent =
            template.name;


        templateSelect.appendChild(
            option
        );
    }


    templateSelect.disabled =
        templates.length ===
        0;


    if (
        selectedId &&
        templates.some(
            (
                template
            ) =>
                template.id ===
                selectedId
        )
    ) {

        templateSelect.value =
            selectedId;

    } else {

        templateSelect.value =
            "";
    }
}


/* =========================================================
   Manager List
   ========================================================= */

function renderTemplateManagerList():
    void {

    templateList.replaceChildren();


    const isEmpty =
        templates.length ===
        0;


    templateListEmpty.hidden =
        !isEmpty;


    templateList.hidden =
        isEmpty;


    if (
        isEmpty
    ) {

        return;
    }


    for (
        const template
        of templates
    ) {

        templateList.appendChild(
            createTemplateCard(
                template
            )
        );
    }
}


/* =========================================================
   Manager Card
   ========================================================= */

function createTemplateCard(
    template: DocumentTemplate
): HTMLElement {

    const fragment =
        templateCardTemplate
            .content
            .cloneNode(
                true
            ) as DocumentFragment;


    const card =
        fragment.firstElementChild;


    if (
        !(
            card instanceof
            HTMLElement
        )
    ) {

        throw new Error(
            "テンプレートカードを生成できませんでした。"
        );
    }


    const name =
        requireChild<HTMLElement>(
            card,
            ".template-card__name"
        );


    const meta =
        requireChild<HTMLElement>(
            card,
            ".template-card__meta"
        );


    const exportButton =
        requireChild<HTMLButtonElement>(
            card,
            ".template-card__export-button"
        );


    const editButton =
        requireChild<HTMLButtonElement>(
            card,
            ".template-card__edit-button"
        );


    const deleteButton =
        requireChild<HTMLButtonElement>(
            card,
            ".template-card__delete-button"
        );


    name.textContent =
        template.name;


    meta.textContent =
        [
            `ID: ${template.id}`,

            `入力項目: ${getReferencedFields(
                template
            ).length
            }件`
        ].join(
            " / "
        );


    exportButton.addEventListener(
        "click",
        () => {

            downloadTemplateJson(
                template
            );


            showToast(
                "テンプレートJSONを出力しました。"
            );
        }
    );


    editButton.addEventListener(
        "click",
        () => {

            templateBuilder.openEdit(
                template
            );
        }
    );


    deleteButton.addEventListener(
        "click",
        () => {

            pendingDeleteTemplateId =
                template.id;


            if (
                !templateDeleteDialog.open
            ) {

                templateDeleteDialog.showModal();
            }
        }
    );


    return card;
}


/* =========================================================
   Delete
   ========================================================= */

async function confirmTemplateDelete():
    Promise<void> {

    const id =
        pendingDeleteTemplateId;


    if (
        !id
    ) {

        templateDeleteDialog.close();

        return;
    }


    try {

        const deletingActiveTemplate =
            activeTemplate?.id ===
            id;


        await deleteTemplate(
            id
        );


        pendingDeleteTemplateId =
            null;


        templateDeleteDialog.close();


        await refreshTemplateCollections();


        if (
            deletingActiveTemplate
        ) {

            const nextTemplate =
                templates[0] ??
                null;


            if (
                nextTemplate
            ) {

                applyTemplate(
                    nextTemplate
                );

            } else {

                clearActiveTemplate();
            }
        }


        showToast(
            "テンプレートを削除しました。"
        );

    } catch (
    error
    ) {

        console.error(
            "テンプレート削除に失敗しました。",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );
    }
}


/* =========================================================
   Restore
   ========================================================= */

function restoreInitialTemplate():
    void {

    if (
        templates.length ===
        0
    ) {

        clearActiveTemplate();

        return;
    }


    const savedTemplateId =
        getStoredActiveTemplateId();


    const restored =
        templates.find(
            (
                template
            ) =>
                template.id ===
                savedTemplateId
        ) ??
        templates[0];


    applyTemplate(
        restored
    );
}


/* =========================================================
   Apply
   ========================================================= */

function applyTemplate(
    template: DocumentTemplate,
    suppliedValues?: DocumentValues
): void {

    activeTemplate =
        template;


    activeValues =
        createInitialValues(
            template,
            suppliedValues
        );


    storeActiveTemplateId(
        template.id
    );


    templateSelect.value =
        template.id;


    activeTemplateName.textContent =
        template.name;


    activeTemplateName.hidden =
        false;


    documentFieldsEmpty.hidden =
        true;


    documentFieldsForm.hidden =
        false;


    documentPreviewEmpty.hidden =
        true;


    documentContent.hidden =
        false;


    jsonExportButton.disabled =
        false;


    printButton.disabled =
        false;


    renderDocumentFields({

        container:
            documentFields,

        template,

        values:
            activeValues,

        onChange:
            handleFieldChange
    });


    renderBusinessDocument(
        documentRenderElements,
        template,
        activeValues
    );
}


/* =========================================================
   Clear
   ========================================================= */

function clearActiveTemplate():
    void {

    activeTemplate =
        null;


    activeValues =
        {};


    storeActiveTemplateId(
        null
    );


    templateSelect.value =
        "";


    activeTemplateName.textContent =
        "";


    activeTemplateName.hidden =
        true;


    documentFields.replaceChildren();


    documentFieldsForm.hidden =
        true;


    documentFieldsEmpty.hidden =
        false;


    clearBusinessDocument(
        documentRenderElements
    );


    documentContent.hidden =
        true;


    documentPreviewEmpty.hidden =
        false;


    jsonExportButton.disabled =
        true;


    printButton.disabled =
        true;
}


/* =========================================================
   Field Change
   ========================================================= */

function handleFieldChange(
    fieldId: string,
    value: string
): void {

    if (
        !activeTemplate
    ) {

        return;
    }


    activeValues = {

        ...activeValues,

        [fieldId]:
            value
    };


    renderBusinessDocument(
        documentRenderElements,
        activeTemplate,
        activeValues
    );
}


/* =========================================================
   Local Storage
   ========================================================= */

function getStoredActiveTemplateId():
    string | null {

    try {

        return localStorage.getItem(
            ACTIVE_TEMPLATE_STORAGE_KEY
        );

    } catch {

        return null;
    }
}


function storeActiveTemplateId(
    id: string | null
): void {

    try {

        if (
            id
        ) {

            localStorage.setItem(
                ACTIVE_TEMPLATE_STORAGE_KEY,
                id
            );


            return;
        }


        localStorage.removeItem(
            ACTIVE_TEMPLATE_STORAGE_KEY
        );

    } catch {

        /*
         * localStorage不可でも
         * 文書作成機能自体は継続する。
         */
    }
}


/* =========================================================
   Toast
   ========================================================= */

function showToast(
    message: string
): void {

    if (
        toastTimer !==
        null
    ) {

        window.clearTimeout(
            toastTimer
        );
    }


    documentToast.textContent =
        message;


    documentToast.hidden =
        false;


    toastTimer =
        window.setTimeout(
            () => {

                documentToast.hidden =
                    true;


                toastTimer =
                    null;
            },
            TOAST_DURATION_MS
        );
}


/* =========================================================
   Error
   ========================================================= */

function getErrorMessage(
    error: unknown
): string {

    if (
        error instanceof
        Error &&

        error.message
    ) {

        return error.message;
    }


    return (
        "処理に失敗しました。"
    );
}


/* =========================================================
   DOM
   ========================================================= */

function requireElement<
    T extends Element
>(
    selector: string
): T {

    const element =
        document.querySelector(
            selector
        );


    if (
        !element
    ) {

        throw new Error(
            `${selector} が見つかりません。`
        );
    }


    return (
        element as T
    );
}


function requireChild<
    T extends Element
>(
    parent: Element,
    selector: string
): T {

    const element =
        parent.querySelector(
            selector
        );


    if (
        !element
    ) {

        throw new Error(
            `${selector} が見つかりません。`
        );
    }


    return (
        element as T
    );
}