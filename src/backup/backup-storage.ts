/**
 * backup-storage.ts
 *
 * WORKBENCH内の保存領域との読み書きを担当する。
 *
 * 対象:
 *
 * DOCUMENT BUILDER
 *   IndexedDB
 *
 * RED INDEX
 *   localStorage
 *
 * PRESET DOCUMENTS
 *   IndexedDB
 *
 * GOSPLAN13 / INVENTORY BATCHは
 * バックアップ対象外。
 */

import {
    deletePresetDocument,
    getPresetDocuments,
    putPresetDocument,
    requestPersistentStorage
} from "../preset/preset-db.js";


import {
    parseDocumentTemplates,
    parseRedIndexData,
    type DocumentTemplate,
    type RedIndexData,
    type WorkbenchBackupSnapshot
} from "./backup-types.js";


/* =========================================================
   DOCUMENT BUILDER Database
   ========================================================= */

const DOCUMENT_DATABASE_NAME =
    "workbench-document-builder";


const DOCUMENT_DATABASE_VERSION =
    1;


const DOCUMENT_STORE_NAME =
    "templates";


/* =========================================================
   RED INDEX
   ========================================================= */

const RED_INDEX_STORAGE_KEY =
    "workbench.red-index.v1";


/* =========================================================
   Snapshot
   ========================================================= */

/**
 * 現在のWORKBENCH保存状態を取得する。
 */
export async function readWorkbenchSnapshot():
    Promise<WorkbenchBackupSnapshot> {

    const [
        documentTemplates,
        presetDocuments
    ] =
        await Promise.all(
            [
                readDocumentTemplates(),
                getPresetDocuments()
            ]
        );


    const redIndex =
        readRedIndexData();


    return {

        documentTemplates,

        redIndex,

        presetDocuments
    };
}


/**
 * 現在の保存内容を
 * snapshotの内容へ完全置換する。
 *
 * この関数自身はrollbackを担当しない。
 * rollback制御はbackup.ts側で行う。
 */
export async function replaceWorkbenchSnapshot(
    snapshot: WorkbenchBackupSnapshot
): Promise<void> {

    await replaceDocumentTemplates(
        snapshot.documentTemplates
    );


    await replacePresetDocuments(
        snapshot.presetDocuments
    );


    replaceRedIndexData(
        snapshot.redIndex
    );


    /**
     * origin全体のストレージ永続化を
     * 可能なら要求する。
     *
     * falseでも復元自体は成功。
     */
    void requestPersistentStorage();
}


/* =========================================================
   DOCUMENT BUILDER
   ========================================================= */

async function readDocumentTemplates():
    Promise<DocumentTemplate[]> {

    const database =
        await openDocumentDatabase();


    try {

        const transaction =
            database.transaction(
                DOCUMENT_STORE_NAME,
                "readonly"
            );


        const completion =
            waitForTransaction(
                transaction
            );


        const store =
            transaction.objectStore(
                DOCUMENT_STORE_NAME
            );


        const request =
            store.getAll();


        const result =
            await requestToPromise<
                unknown[]
            >(
                request
            );


        await completion;


        return parseDocumentTemplates(
            result
        );

    } finally {

        database.close();
    }
}


async function replaceDocumentTemplates(
    templates: DocumentTemplate[]
): Promise<void> {

    /**
     * 念のため、
     * 書き込み前にもう一度構造検証する。
     */
    const validatedTemplates =
        parseDocumentTemplates(
            templates
        );


    const database =
        await openDocumentDatabase();


    try {

        const transaction =
            database.transaction(
                DOCUMENT_STORE_NAME,
                "readwrite"
            );


        const completion =
            waitForTransaction(
                transaction
            );


        const store =
            transaction.objectStore(
                DOCUMENT_STORE_NAME
            );


        /**
         * clearとputを同一transactionへ
         * まとめてキューする。
         *
         * 途中で失敗すれば、
         * IndexedDB transaction全体がabortされる。
         */
        store.clear();


        for (
            const template
            of validatedTemplates
        ) {

            store.put(
                template
            );
        }


        await completion;

    } finally {

        database.close();
    }
}


/* =========================================================
   RED INDEX
   ========================================================= */

function readRedIndexData():
    RedIndexData |
    null {

    const raw =
        localStorage.getItem(
            RED_INDEX_STORAGE_KEY
        );


    if (
        raw ===
        null
    ) {

        return null;
    }


    let parsed:
        unknown;


    try {

        parsed =
            JSON.parse(
                raw
            );

    } catch {

        throw new Error(
            "保存されているRED INDEXデータがJSONとして不正です。"
        );
    }


    return parseRedIndexData(
        parsed
    );
}


function replaceRedIndexData(
    data:
        RedIndexData |
        null
): void {

    if (
        data ===
        null
    ) {

        localStorage.removeItem(
            RED_INDEX_STORAGE_KEY
        );


        return;
    }


    const validated =
        parseRedIndexData(
            data
        );


    localStorage.setItem(
        RED_INDEX_STORAGE_KEY,
        JSON.stringify(
            validated
        )
    );
}


/* =========================================================
   PRESET DOCUMENTS
   ========================================================= */

async function replacePresetDocuments(
    documents:
        WorkbenchBackupSnapshot[
        "presetDocuments"
        ]
): Promise<void> {

    const currentDocuments =
        await getPresetDocuments();


    /**
     * 現在の定型印刷物を全件削除。
     */
    for (
        const document
        of currentDocuments
    ) {

        await deletePresetDocument(
            document.id
        );
    }


    /**
     * バックアップ内容をそのまま復元。
     *
     * id / sortOrder / createdAt / updatedAtも
     * 元の値を保持する。
     */
    for (
        const document
        of documents
    ) {

        await putPresetDocument(
            document
        );
    }
}


/* =========================================================
   DOCUMENT BUILDER Database Open
   ========================================================= */

function openDocumentDatabase():
    Promise<IDBDatabase> {

    return new Promise<IDBDatabase>(
        (
            resolve,
            reject
        ) => {

            const request =
                indexedDB.open(
                    DOCUMENT_DATABASE_NAME,
                    DOCUMENT_DATABASE_VERSION
                );


            request.onupgradeneeded =
                () => {

                    const database =
                        request.result;


                    if (
                        database
                            .objectStoreNames
                            .contains(
                                DOCUMENT_STORE_NAME
                            )
                    ) {

                        return;
                    }


                    database
                        .createObjectStore(
                            DOCUMENT_STORE_NAME,
                            {
                                keyPath:
                                    "id"
                            }
                        );
                };


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
                            "DOCUMENT BUILDERのデータベースを開けませんでした。"
                        )
                    );
                };


            request.onblocked =
                () => {

                    console.warn(
                        "DOCUMENT BUILDERのデータベース処理がブロックされています。"
                    );
                };
        }
    );
}


/* =========================================================
   IndexedDB Utilities
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