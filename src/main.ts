/**
 * main.ts
 *
 * WORKBENCH 親ポータル画面の起動処理。
 *
 * 定型印刷物:
 *
 * IndexedDB
 *     ↓
 * PresetDocument[]
 *     ↓
 * preset-render
 *     ↓
 * カード生成
 *
 * 管理UIはpreset-managerへ委譲する。
 *
 * バックアップ:
 *
 * DOCUMENT BUILDER
 * RED INDEX
 * PRESET DOCUMENTS
 *     ↓
 * ZIP出力 / 完全復元
 */

import {
    getPresetDocuments
} from "./preset/preset-db.js";


import {
    renderPresetGrid,
    renderPresetGridError
} from "./preset/preset-render.js";


import {
    setupPresetManager
} from "./preset/preset-manager.js";


import {
    setupWorkbenchBackup
} from "./backup/backup.js";


/* =========================================================
   DOM
   ========================================================= */

const presetGrid =
    requireElement<HTMLElement>(
        "#preset-grid"
    );


const backupExportButton =
    requireElement<HTMLButtonElement>(
        "#workbench-backup-export-button"
    );


const backupImportButton =
    requireElement<HTMLButtonElement>(
        "#workbench-backup-import-button"
    );


const backupImportInput =
    requireElement<HTMLInputElement>(
        "#workbench-backup-import-input"
    );


const backupStatus =
    requireElement<HTMLElement>(
        "#workbench-backup-status"
    );


/* =========================================================
   Manager
   ========================================================= */

const presetManager =
    setupPresetManager({

        /**
         * 保存 / 削除などでデータが変わったら
         * メイン画面のカードを再描画する。
         */
        onChanged:
            refreshPresetGrid
    });


/* =========================================================
   Backup
   ========================================================= */

setupWorkbenchBackup({

    exportButton:
        backupExportButton,

    importButton:
        backupImportButton,

    importInput:
        backupImportInput,

    status:
        backupStatus,

    /**
     * バックアップ復元後、
     * ホーム画面の定型印刷物カードを再描画する。
     */
    onRestored:
        refreshPresetGrid
});


/* =========================================================
   Initial Load
   ========================================================= */

void refreshPresetGrid();


/* =========================================================
   Preset Grid
   ========================================================= */

async function refreshPresetGrid():
    Promise<void> {

    presetGrid.setAttribute(
        "aria-busy",
        "true"
    );


    try {

        const documents =
            await getPresetDocuments();


        renderPresetGrid(
            documents,
            presetGrid,
            {
                onAddRequested:
                    () => {

                        presetManager
                            .openCreateEditor();
                    }
            }
        );

    } catch (error) {

        console.error(
            "定型印刷物を読み込めませんでした。",
            error
        );


        renderPresetGridError(
            presetGrid,
            "このブラウザに保存されている定型印刷物を読み込めませんでした。"
        );

    } finally {

        presetGrid.setAttribute(
            "aria-busy",
            "false"
        );
    }
}


/* =========================================================
   DOM Utility
   ========================================================= */

function requireElement<T extends Element>(
    selector: string
): T {

    const element =
        document.querySelector<T>(
            selector
        );


    if (
        !element
    ) {

        throw new Error(
            `必要な要素が見つかりません: ${selector}`
        );
    }


    return element;
}