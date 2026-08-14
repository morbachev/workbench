/* =========================================================
   Database
   ========================================================= */
const DATABASE_NAME = "workbench-document-builder";
const DATABASE_VERSION = 1;
const STORE_NAME = "templates";
let databasePromise = null;
/* =========================================================
   Public API
   ========================================================= */
/**
 * 登録済みテンプレートを
 * 全件取得する。
 */
export async function getTemplates() {
    const database = await openTemplateDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    const templates = await requestToPromise(request);
    await waitForTransaction(transaction);
    return sortTemplates(templates);
}
/**
 * ID指定で1件取得する。
 */
export async function getTemplate(id) {
    const database = await openTemplateDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    const template = await requestToPromise(request);
    await waitForTransaction(transaction);
    return (template ??
        null);
}
/**
 * テンプレートを追加 / 更新する。
 *
 * 同じidなら洗い替え。
 */
export async function putTemplate(template) {
    const database = await openTemplateDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(template);
    await requestToPromise(request);
    await completion;
}
/**
 * テンプレート削除。
 */
export async function deleteTemplate(id) {
    const database = await openTemplateDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    await requestToPromise(request);
    await completion;
}
/**
 * ブラウザ側に対して、
 * 可能ならストレージの永続化を要求する。
 */
export async function requestPersistentStorage() {
    if (!navigator.storage ||
        typeof navigator
            .storage
            .persist !==
            "function") {
        return false;
    }
    try {
        return await navigator
            .storage
            .persist();
    }
    catch {
        return false;
    }
}
/* =========================================================
   Sort
   ========================================================= */
function sortTemplates(templates) {
    const collator = new Intl.Collator("ja", {
        usage: "sort",
        sensitivity: "base",
        numeric: true
    });
    return [
        ...templates
    ].sort((left, right) => {
        const byName = collator.compare(left.name, right.name);
        if (byName !==
            0) {
            return byName;
        }
        return collator.compare(left.id, right.id);
    });
}
/* =========================================================
   Open database
   ========================================================= */
function openTemplateDatabase() {
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
                    database
                        .createObjectStore(STORE_NAME, {
                        keyPath: "id"
                    });
                };
            request.onsuccess =
                () => {
                    const database = request.result;
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
                        new Error("テンプレートデータベースを開けませんでした。"));
                };
            request.onblocked =
                () => {
                    console.warn("テンプレートデータベースの更新がブロックされています。");
                };
        });
    return databasePromise;
}
/* =========================================================
   IndexedDB utilities
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
//# sourceMappingURL=template-db.js.map