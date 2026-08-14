import {
    DocumentTemplate
} from "./template.js";


/* =========================================================
   Database
   ========================================================= */

const DATABASE_NAME =
    "workbench-document-builder";


const DATABASE_VERSION =
    1;


const STORE_NAME =
    "templates";


let databasePromise:
    Promise<IDBDatabase> |
    null =
    null;


/* =========================================================
   Public API
   ========================================================= */

/**
 * 登録済みテンプレートを
 * 全件取得する。
 */
export async function getTemplates():
    Promise<DocumentTemplate[]> {

    const database =
        await openTemplateDatabase();


    const transaction =
        database.transaction(
            STORE_NAME,
            "readonly"
        );


    const store =
        transaction.objectStore(
            STORE_NAME
        );


    const request =
        store.getAll();


    const templates =
        await requestToPromise<
            DocumentTemplate[]
        >(
            request
        );


    await waitForTransaction(
        transaction
    );


    return sortTemplates(
        templates
    );
}


/**
 * ID指定で1件取得する。
 */
export async function getTemplate(
    id: string
): Promise<DocumentTemplate | null> {

    const database =
        await openTemplateDatabase();


    const transaction =
        database.transaction(
            STORE_NAME,
            "readonly"
        );


    const store =
        transaction.objectStore(
            STORE_NAME
        );


    const request =
        store.get(
            id
        );


    const template =
        await requestToPromise<
            DocumentTemplate |
            undefined
        >(
            request
        );


    await waitForTransaction(
        transaction
    );


    return (
        template ??
        null
    );
}


/**
 * テンプレートを追加 / 更新する。
 *
 * 同じidなら洗い替え。
 */
export async function putTemplate(
    template: DocumentTemplate
): Promise<void> {

    const database =
        await openTemplateDatabase();


    const transaction =
        database.transaction(
            STORE_NAME,
            "readwrite"
        );


    const completion =
        waitForTransaction(
            transaction
        );


    const store =
        transaction.objectStore(
            STORE_NAME
        );


    const request =
        store.put(
            template
        );


    await requestToPromise(
        request
    );


    await completion;
}


/**
 * テンプレート削除。
 */
export async function deleteTemplate(
    id: string
): Promise<void> {

    const database =
        await openTemplateDatabase();


    const transaction =
        database.transaction(
            STORE_NAME,
            "readwrite"
        );


    const completion =
        waitForTransaction(
            transaction
        );


    const store =
        transaction.objectStore(
            STORE_NAME
        );


    const request =
        store.delete(
            id
        );


    await requestToPromise(
        request
    );


    await completion;
}


/**
 * ブラウザ側に対して、
 * 可能ならストレージの永続化を要求する。
 */
export async function requestPersistentStorage():
    Promise<boolean> {

    if (
        !navigator.storage ||

        typeof navigator
            .storage
            .persist !==
        "function"
    ) {

        return false;
    }


    try {

        return await navigator
            .storage
            .persist();

    } catch {

        return false;
    }
}


/* =========================================================
   Sort
   ========================================================= */

function sortTemplates(
    templates: DocumentTemplate[]
): DocumentTemplate[] {

    const collator =
        new Intl.Collator(
            "ja",
            {
                usage: "sort",
                sensitivity: "base",
                numeric: true
            }
        );


    return [
        ...templates
    ].sort(
        (
            left,
            right
        ) => {

            const byName =
                collator.compare(
                    left.name,
                    right.name
                );


            if (
                byName !==
                0
            ) {

                return byName;
            }


            return collator.compare(
                left.id,
                right.id
            );
        }
    );
}


/* =========================================================
   Open database
   ========================================================= */

function openTemplateDatabase():
    Promise<IDBDatabase> {

    if (
        databasePromise
    ) {

        return databasePromise;
    }


    databasePromise =
        new Promise<IDBDatabase>(
            (
                resolve,
                reject
            ) => {

                const request =
                    indexedDB.open(
                        DATABASE_NAME,
                        DATABASE_VERSION
                    );


                request.onupgradeneeded =
                    () => {

                        const database =
                            request.result;


                        if (
                            database
                                .objectStoreNames
                                .contains(
                                    STORE_NAME
                                )
                        ) {

                            return;
                        }


                        database
                            .createObjectStore(
                                STORE_NAME,
                                {
                                    keyPath:
                                        "id"
                                }
                            );
                    };


                request.onsuccess =
                    () => {

                        const database =
                            request.result;


                        database.onversionchange =
                            () => {

                                database.close();

                                databasePromise =
                                    null;
                            };


                        resolve(
                            database
                        );
                    };


                request.onerror =
                    () => {

                        databasePromise =
                            null;


                        reject(
                            request.error ??
                            new Error(
                                "テンプレートデータベースを開けませんでした。"
                            )
                        );
                    };


                request.onblocked =
                    () => {

                        console.warn(
                            "テンプレートデータベースの更新がブロックされています。"
                        );
                    };
            }
        );


    return databasePromise;
}


/* =========================================================
   IndexedDB utilities
   ========================================================= */

function requestToPromise<T>(
    request: IDBRequest<T>
): Promise<T> {

    return new Promise<T>(
        (
            resolve,
            reject
        ) => {

            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );
                };


            request.onerror =
                () => {

                    reject(
                        request.error ??
                        new Error(
                            "IndexedDBの処理に失敗しました。"
                        )
                    );
                };
        }
    );
}


function waitForTransaction(
    transaction: IDBTransaction
): Promise<void> {

    return new Promise<void>(
        (
            resolve,
            reject
        ) => {

            transaction.oncomplete =
                () => {

                    resolve();
                };


            transaction.onerror =
                () => {

                    reject(
                        transaction.error ??
                        new Error(
                            "IndexedDBトランザクションに失敗しました。"
                        )
                    );
                };


            transaction.onabort =
                () => {

                    reject(
                        transaction.error ??
                        new Error(
                            "IndexedDBトランザクションが中断されました。"
                        )
                    );
                };
        }
    );
}