/**
 * backup.ts
 *
 * WORKBENCH全体バックアップUIの
 * 制御を担当する。
 *
 * Export:
 *
 * Browser Storage
 *     ↓
 * Snapshot
 *     ↓
 * ZIP
 *     ↓
 * Download
 *
 *
 * Import:
 *
 * ZIP
 *     ↓
 * 全内容検証
 *     ↓
 * ユーザー確認
 *     ↓
 * 現在状態を退避
 *     ↓
 * 完全置換
 *     ↓
 * 失敗時は元データへrollback
 */
import { createBackupArchive, readBackupArchive } from "./backup-zip.js";
import { readWorkbenchSnapshot, replaceWorkbenchSnapshot } from "./backup-storage.js";
/* =========================================================
   Constants
   ========================================================= */
/**
 * JSZipはブラウザメモリ上で処理するため、
 * 極端に大きな入力を避ける。
 *
 * 通常のWORKBENCHバックアップとしては
 * 十分大きな上限。
 */
const MAX_IMPORT_FILE_SIZE = 512 *
    1024 *
    1024;
/* =========================================================
   Setup
   ========================================================= */
export function setupWorkbenchBackup(options) {
    const { exportButton, importButton, importInput, status, onRestored } = options;
    /* =====================================================
       Export
       ===================================================== */
    exportButton.addEventListener("click", () => {
        void handleExport();
    });
    async function handleExport() {
        setBusy(true);
        showStatus("バックアップを作成しています...");
        try {
            const snapshot = await readWorkbenchSnapshot();
            const archive = await createBackupArchive(snapshot);
            downloadBlob(archive, createBackupFileName());
            showStatus(createExportSuccessMessage(snapshot));
        }
        catch (error) {
            console.error("WORKBENCHバックアップを作成できませんでした。", error);
            showStatus([
                "バックアップを作成できませんでした。",
                formatErrorMessage(error)
            ].join(" "));
        }
        finally {
            setBusy(false);
        }
    }
    /* =====================================================
       Import Button
       ===================================================== */
    importButton.addEventListener("click", () => {
        /**
         * 同じZIPを連続で選択しても
         * changeが発火するように一度空にする。
         */
        importInput.value =
            "";
        importInput.click();
    });
    /* =====================================================
       Import File
       ===================================================== */
    importInput.addEventListener("change", () => {
        const file = importInput.files?.[0] ??
            null;
        if (!file) {
            return;
        }
        void handleImport(file);
    });
    async function handleImport(file) {
        if (file.size ===
            0) {
            showStatus("空のバックアップファイルは読み込めません。");
            return;
        }
        if (file.size >
            MAX_IMPORT_FILE_SIZE) {
            showStatus("バックアップファイルが大きすぎます。");
            return;
        }
        setBusy(true);
        showStatus("バックアップファイルを検証しています...");
        try {
            /**
             * ここではまだ現在データを変更しない。
             *
             * ZIP内JSON、PDF、プレビュー画像まで
             * すべて読み込み・検証する。
             */
            const importedSnapshot = await readBackupArchive(file);
            const confirmed = confirmRestore(importedSnapshot);
            if (!confirmed) {
                showStatus("バックアップの復元をキャンセルしました。");
                return;
            }
            showStatus("バックアップを復元しています...");
            await restoreWithRollback(importedSnapshot);
            if (onRestored) {
                await onRestored();
            }
            showStatus(createImportSuccessMessage(importedSnapshot));
        }
        catch (error) {
            console.error("WORKBENCHバックアップを復元できませんでした。", error);
            showStatus([
                "バックアップを復元できませんでした。",
                formatErrorMessage(error)
            ].join(" "));
        }
        finally {
            importInput.value =
                "";
            setBusy(false);
        }
    }
    /* =====================================================
       Busy
       ===================================================== */
    function setBusy(busy) {
        exportButton.disabled =
            busy;
        importButton.disabled =
            busy;
        exportButton.setAttribute("aria-busy", String(busy));
        importButton.setAttribute("aria-busy", String(busy));
    }
    /* =====================================================
       Status
       ===================================================== */
    function showStatus(message) {
        status.textContent =
            message;
        status.hidden =
            false;
    }
}
/* =========================================================
   Restore
   ========================================================= */
/**
 * 完全置換前に現在状態をメモリへ退避する。
 *
 * 復元処理途中で失敗した場合、
 * 元のsnapshotへ戻すことを試みる。
 */
async function restoreWithRollback(importedSnapshot) {
    const originalSnapshot = await readWorkbenchSnapshot();
    try {
        await replaceWorkbenchSnapshot(importedSnapshot);
    }
    catch (restoreError) {
        console.error("バックアップ復元中にエラーが発生しました。元データへ戻します。", restoreError);
        try {
            await replaceWorkbenchSnapshot(originalSnapshot);
        }
        catch (rollbackError) {
            console.error("元データへのロールバックにも失敗しました。", rollbackError);
            throw new Error("復元に失敗し、元の保存データへの復旧にも失敗しました。");
        }
        throw restoreError;
    }
}
/* =========================================================
   Confirm
   ========================================================= */
function confirmRestore(snapshot) {
    const previewCount = snapshot
        .presetDocuments
        .filter((document) => document.previewBlob !==
        null)
        .length;
    return window.confirm([
        "WORKBENCHのバックアップを復元します。",
        "",
        "現在このブラウザに保存されている対象データは、バックアップ内容で完全に置き換えられます。",
        "",
        `文書テンプレート: ${snapshot.documentTemplates.length}件`,
        `RED INDEX: ${snapshot.redIndex ? "あり" : "なし"}`,
        `定型印刷物: ${snapshot.presetDocuments.length}件`,
        `プレビュー画像: ${previewCount}件`,
        "",
        "この操作を実行しますか？"
    ].join("\n"));
}
/* =========================================================
   Download
   ========================================================= */
function downloadBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href =
        objectUrl;
    anchor.download =
        fileName;
    anchor.style.display =
        "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1000);
}
/* =========================================================
   File Name
   ========================================================= */
function createBackupFileName() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() +
        1)
        .padStart(2, "0");
    const day = String(now.getDate())
        .padStart(2, "0");
    const hours = String(now.getHours())
        .padStart(2, "0");
    const minutes = String(now.getMinutes())
        .padStart(2, "0");
    return [
        "WORKBENCH_backup_",
        year,
        month,
        day,
        "_",
        hours,
        minutes,
        ".zip"
    ].join("");
}
/* =========================================================
   Messages
   ========================================================= */
function createExportSuccessMessage(snapshot) {
    return [
        "バックアップを出力しました。",
        `文書テンプレート ${snapshot.documentTemplates.length}件、`,
        `定型印刷物 ${snapshot.presetDocuments.length}件を保存しました。`
    ].join(" ");
}
function createImportSuccessMessage(snapshot) {
    return [
        "バックアップを復元しました。",
        `文書テンプレート ${snapshot.documentTemplates.length}件、`,
        `定型印刷物 ${snapshot.presetDocuments.length}件を復元しました。`
    ].join(" ");
}
function formatErrorMessage(error) {
    if (error instanceof
        Error) {
        return error.message;
    }
    return "不明なエラーが発生しました。";
}
//# sourceMappingURL=backup.js.map