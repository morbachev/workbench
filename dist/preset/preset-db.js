/**
 * preset-db.ts
 *
 * 定型印刷物のIndexedDBアクセスを管理する。
 *
 * PDF / プレビュー画像は
 * Base64化せずBlobのまま保存する。
 */
import { sortPresetDocuments } from "./preset.js";
/* =========================================================
   Database
   ========================================================= */
const DATABASE_NAME = "workbench-preset-documents";
const DATABASE_VERSION = 1;
const STORE_NAME = "documents";
const SORT_ORDER_INDEX = "sortOrder";
let databasePromise = null;
/* =========================================================
   Public API
   ========================================================= */
/**
 * 登録済み定型印刷物を全件取得する。
 */
export async function getPresetDocuments() {
    const database = await openPresetDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    const documents = await requestToPromise(request);
    await waitForTransaction(transaction);
    return sortPresetDocuments(documents);
}
/**
 * ID指定で1件取得する。
 */
export async function getPresetDocument(id) {
    const database = await openPresetDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    const document = await requestToPromise(request);
    await waitForTransaction(transaction);
    return (document ??
        null);
}
/**
 * 新規追加 / 更新。
 *
 * idが同じ場合は洗い替える。
 */
export async function putPresetDocument(document) {
    const database = await openPresetDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(document);
    await requestToPromise(request);
    await completion;
}
/**
 * 定型印刷物を削除する。
 */
export async function deletePresetDocument(id) {
    const database = await openPresetDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    await requestToPromise(request);
    await completion;
}
/**
 * 新規追加時のsortOrderを生成する。
 *
 * 現段階では追加された順番。
 */
export async function getNextPresetSortOrder() {
    const documents = await getPresetDocuments();
    if (documents.length === 0) {
        return 0;
    }
    const maximumSortOrder = documents.reduce((maximum, document) => {
        return Math.max(maximum, document.sortOrder);
    }, -1);
    return (maximumSortOrder +
        1);
}
/**
 * ブラウザに対し、
 * ストレージを可能なら永続化するよう要求する。
 *
 * falseでも保存機能そのものは使用できる。
 */
export async function requestPersistentStorage() {
    if (!navigator.storage ||
        typeof navigator.storage.persist !==
            "function") {
        return false;
    }
    try {
        return await navigator.storage.persist();
    }
    catch {
        return false;
    }
}
/* =========================================================
   Open Database
   ========================================================= */
function openPresetDatabase() {
    if (databasePromise) {
        return databasePromise;
    }
    databasePromise =
        new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            request.onupgradeneeded =
                () => {
                    const database = request.result;
                    if (database
                        .objectStoreNames
                        .contains(STORE_NAME)) {
                        return;
                    }
                    const store = database
                        .createObjectStore(STORE_NAME, {
                        keyPath: "id"
                    });
                    store.createIndex(SORT_ORDER_INDEX, "sortOrder", {
                        unique: false
                    });
                };
            request.onsuccess =
                () => {
                    const database = request.result;
                    /**
                     * 別タブ等でDBバージョンが更新された場合は
                     * 古い接続を閉じる。
                     */
                    database.onversionchange =
                        () => {
                            database.close();
                            databasePromise =
                                null;
                        };
                    resolve(database);
                };
            request.onerror =
                () => {
                    databasePromise =
                        null;
                    reject(request.error ??
                        new Error("IndexedDBを開けませんでした。"));
                };
            request.onblocked =
                () => {
                    console.warn("定型印刷物データベースの更新がブロックされています。");
                };
        });
    return databasePromise;
}
/* =========================================================
   IndexedDB Utility
   ========================================================= */
function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess =
            () => {
                resolve(request.result);
            };
        request.onerror =
            () => {
                reject(request.error ??
                    new Error("IndexedDBの処理に失敗しました。"));
            };
    });
}
function waitForTransaction(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete =
            () => {
                resolve();
            };
        transaction.onerror =
            () => {
                reject(transaction.error ??
                    new Error("IndexedDBトランザクションに失敗しました。"));
            };
        transaction.onabort =
            () => {
                reject(transaction.error ??
                    new Error("IndexedDBトランザクションが中断されました。"));
            };
    });
}
//# sourceMappingURL=preset-db.js.map