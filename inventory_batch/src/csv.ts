/**
 * csv.ts
 *
 * INVENTORY BATCH のCSV読込・解析を管理する。
 *
 * このファイルでは以下を担当する。
 *
 * - CSVファイルの読み込み
 * - UTF-8 / Shift_JIS の判定
 * - CSV構文の解析
 * - 必要ヘッダーの検証
 * - 必要な3列のみ抽出
 * - InventoryItem[] への変換
 * - CSV由来のエラー生成
 *
 * 数量によるフィルタリングや、
 * DOMへの描画は担当しない。
 */

import type {
    InventoryItem
} from "./inventory.js";


/* =========================================================
   必須ヘッダー
   ========================================================= */

/**
 * INVENTORY BATCH が使用するCSV列。
 *
 * これ以外の列は読み込んでも使用しない。
 */
export const INVENTORY_CSV_HEADERS = {
    pluCode: "ＰＬＵコード",
    productName: "商品名称",
    quantity: "理論在庫数量"
} as const;


/* =========================================================
   型定義
   ========================================================= */

/**
 * 対応するCSV文字コード。
 */
export type CsvEncoding =
    | "utf-8"
    | "shift_jis";


/**
 * CSV上の1行に対する警告・エラー。
 *
 * 行自体を破棄するとは限らない。
 */
export type CsvRowError = {
    rowNumber: number;

    type:
    | "invalid-quantity";

    message: string;

    rawValue?: string;
};


/**
 * CSV読込結果。
 */
export type CsvImportResult = {
    /**
     * InventoryItemへ変換された商品一覧。
     */
    items: InventoryItem[];

    /**
     * CSV読込時に検出された行単位エラー。
     */
    errors: CsvRowError[];

    /**
     * 実際に採用した文字コード。
     */
    encoding: CsvEncoding;

    /**
     * CSVに存在したヘッダー一覧。
     */
    headers: string[];

    /**
     * ヘッダーより後に存在した、
     * 空行を除くデータ行数。
     */
    sourceRowCount: number;

    /**
     * 読み飛ばした空行数。
     */
    skippedEmptyRowCount: number;
};


/**
 * CSV読込そのものを継続できない場合のエラーコード。
 */
export type InventoryCsvErrorCode =
    | "EMPTY_FILE"
    | "UNSUPPORTED_ENCODING"
    | "INVALID_CSV"
    | "MISSING_HEADERS";


/**
 * CSV読込そのものを継続できない場合に使用するエラー。
 */
export class InventoryCsvError extends Error {

    readonly code: InventoryCsvErrorCode;

    readonly details?: readonly string[];

    constructor(
        code: InventoryCsvErrorCode,
        message: string,
        details?: readonly string[]
    ) {
        super(message);

        this.name = "InventoryCsvError";
        this.code = code;
        this.details = details;
    }
}


/**
 * デコード済みCSV候補。
 */
type DecodedCsvCandidate = {
    encoding: CsvEncoding;
    rows: string[][];
    headerRowIndex: number;
    headers: string[];
};


/**
 * 必要列のインデックス。
 */
type RequiredColumnIndexes = {
    pluCode: number;
    productName: number;
    quantity: number;
};


/* =========================================================
   公開関数
   ========================================================= */

/**
 * CSVファイルを読み込み、
 * INVENTORY BATCH用データへ変換する。
 *
 * UTF-8とShift_JISの両方を試し、
 * 必須ヘッダーを正常に取得できた方を採用する。
 */
export async function parseInventoryCsv(
    file: File
): Promise<CsvImportResult> {

    const buffer = await file.arrayBuffer();

    if (buffer.byteLength === 0) {
        throw new InventoryCsvError(
            "EMPTY_FILE",
            "CSVファイルが空です。"
        );
    }

    const bytes = new Uint8Array(buffer);

    /*
     * UTF-8 / Shift_JIS をそれぞれ試す。
     *
     * 単純な文字コード推測ではなく、
     * 「必須ヘッダーを正しく取得できるか」を
     * 判定材料として使用する。
     */
    const candidates = [
        createDecodedCandidate(
            bytes,
            "utf-8"
        ),
        createDecodedCandidate(
            bytes,
            "shift_jis"
        )
    ].filter(
        (
            candidate
        ): candidate is DecodedCsvCandidate =>
            candidate !== null
    );

    if (candidates.length === 0) {
        throw new InventoryCsvError(
            "UNSUPPORTED_ENCODING",
            "CSVファイルをUTF-8またはShift_JISとして読み込めませんでした。"
        );
    }

    /*
     * 必須ヘッダーがすべて揃っている候補を優先する。
     */
    const candidate =
        candidates.find((item) =>
            hasRequiredHeaders(item.headers)
        )
        ?? candidates[0];

    const missingHeaders =
        getMissingRequiredHeaders(
            candidate.headers
        );

    if (missingHeaders.length > 0) {
        throw new InventoryCsvError(
            "MISSING_HEADERS",
            `必要なCSV列が見つかりません: ${missingHeaders.join(", ")}`,
            missingHeaders
        );
    }

    const columnIndexes =
        getRequiredColumnIndexes(
            candidate.headers
        );

    return convertRowsToInventoryItems(
        candidate.rows,
        candidate.headerRowIndex,
        columnIndexes,
        candidate.encoding,
        candidate.headers
    );
}


/* =========================================================
   文字コード
   ========================================================= */

/**
 * 指定した文字コードでCSVをデコードし、
 * CSV候補を生成する。
 *
 * デコードまたはCSV解析に失敗した場合はnullを返す。
 */
function createDecodedCandidate(
    bytes: Uint8Array,
    encoding: CsvEncoding
): DecodedCsvCandidate | null {

    try {

        const decoder = new TextDecoder(
            encoding,
            {
                fatal: true
            }
        );

        const text = decoder.decode(bytes);

        const rows = parseCsvText(text);

        const headerRowIndex =
            findHeaderRowIndex(rows);

        if (headerRowIndex === -1) {
            return null;
        }

        const headers =
            rows[headerRowIndex]
                .map(normalizeHeader);

        return {
            encoding,
            rows,
            headerRowIndex,
            headers
        };

    } catch {
        return null;
    }
}


/* =========================================================
   CSVパーサー
   ========================================================= */

/**
 * CSV文字列を二次元配列へ変換する。
 *
 * 対応:
 *
 * - カンマ区切り
 * - CRLF
 * - LF
 * - CR
 * - ダブルクォート囲み
 * - クォート内部のカンマ
 * - クォート内部の改行
 * - "" によるダブルクォートのエスケープ
 *
 * 単純な split(",") は使用しない。
 */
function parseCsvText(
    text: string
): string[][] {

    const rows: string[][] = [];

    let row: string[] = [];
    let field = "";

    let inQuotes = false;

    for (
        let index = 0;
        index < text.length;
        index += 1
    ) {

        const char = text[index];

        /*
         * ダブルクォート。
         */
        if (char === "\"") {

            if (inQuotes) {

                /*
                 * "" はフィールド内の
                 * ダブルクォート1文字として扱う。
                 */
                if (text[index + 1] === "\"") {
                    field += "\"";
                    index += 1;

                    continue;
                }

                /*
                 * クォートフィールド終了。
                 */
                inQuotes = false;

                continue;
            }

            /*
             * フィールド先頭の " は
             * クォート開始として扱う。
             */
            if (field.length === 0) {
                inQuotes = true;

                continue;
            }

            /*
             * 非クォートフィールド途中に現れた "
             * は通常文字として保持する。
             */
            field += char;

            continue;
        }

        /*
         * クォート内では、
         * カンマ・改行も通常文字。
         */
        if (inQuotes) {

            /*
             * CRLFは内部的にLFへ統一する。
             */
            if (
                char === "\r" &&
                text[index + 1] === "\n"
            ) {
                field += "\n";
                index += 1;

                continue;
            }

            field += char;

            continue;
        }

        /*
         * フィールド区切り。
         */
        if (char === ",") {

            row.push(field);

            field = "";

            continue;
        }

        /*
         * CRLF / CR。
         */
        if (char === "\r") {

            row.push(field);
            rows.push(row);

            row = [];
            field = "";

            if (text[index + 1] === "\n") {
                index += 1;
            }

            continue;
        }

        /*
         * LF。
         */
        if (char === "\n") {

            row.push(field);
            rows.push(row);

            row = [];
            field = "";

            continue;
        }

        field += char;
    }

    /*
     * クォートが閉じられていないCSVは不正。
     */
    if (inQuotes) {
        throw new InventoryCsvError(
            "INVALID_CSV",
            "CSV内に閉じられていないダブルクォートがあります。"
        );
    }

    /*
     * 最終行を追加。
     *
     * ファイル末尾が改行の場合は
     * 空行が1つ生成されるが、
     * 後続処理で空行として除外する。
     */
    row.push(field);
    rows.push(row);

    return rows;
}


/* =========================================================
   ヘッダー
   ========================================================= */

/**
 * CSV内の最初の空でない行を
 * ヘッダー行として使用する。
 */
function findHeaderRowIndex(
    rows: readonly string[][]
): number {

    return rows.findIndex(
        (row) => !isEmptyRow(row)
    );
}


/**
 * ヘッダー文字列を正規化する。
 *
 * - UTF-8 BOM削除
 * - 前後空白削除
 *
 * 列名そのものは勝手に変換しない。
 */
function normalizeHeader(
    value: string
): string {

    return value
        .replace(
            /^\uFEFF/,
            ""
        )
        .trim();
}


/**
 * 必須ヘッダーがすべて存在するか判定する。
 */
function hasRequiredHeaders(
    headers: readonly string[]
): boolean {

    return (
        headers.includes(
            INVENTORY_CSV_HEADERS.pluCode
        ) &&
        headers.includes(
            INVENTORY_CSV_HEADERS.productName
        ) &&
        headers.includes(
            INVENTORY_CSV_HEADERS.quantity
        )
    );
}


/**
 * 不足している必須ヘッダーを返す。
 */
function getMissingRequiredHeaders(
    headers: readonly string[]
): string[] {

    const requiredHeaders = [
        INVENTORY_CSV_HEADERS.pluCode,
        INVENTORY_CSV_HEADERS.productName,
        INVENTORY_CSV_HEADERS.quantity
    ];

    return requiredHeaders.filter(
        (header) =>
            !headers.includes(header)
    );
}


/**
 * 必須列のCSV上の位置を取得する。
 *
 * この関数を呼ぶ時点では、
 * 必須ヘッダーが存在することを前提とする。
 */
function getRequiredColumnIndexes(
    headers: readonly string[]
): RequiredColumnIndexes {

    return {
        pluCode:
            headers.indexOf(
                INVENTORY_CSV_HEADERS.pluCode
            ),

        productName:
            headers.indexOf(
                INVENTORY_CSV_HEADERS.productName
            ),

        quantity:
            headers.indexOf(
                INVENTORY_CSV_HEADERS.quantity
            )
    };
}


/* =========================================================
   InventoryItem変換
   ========================================================= */

/**
 * CSV行から必要3列のみを抜き出し、
 * InventoryItem[]へ変換する。
 */
function convertRowsToInventoryItems(
    rows: readonly string[][],
    headerRowIndex: number,
    columnIndexes: RequiredColumnIndexes,
    encoding: CsvEncoding,
    headers: string[]
): CsvImportResult {

    const items: InventoryItem[] = [];
    const errors: CsvRowError[] = [];

    let sourceRowCount = 0;
    let skippedEmptyRowCount = 0;

    for (
        let rowIndex =
            headerRowIndex + 1;

        rowIndex < rows.length;

        rowIndex += 1
    ) {

        const row = rows[rowIndex];

        /*
         * CSV上の実際の行番号。
         *
         * 配列は0始まりなので +1。
         */
        const rowNumber =
            rowIndex + 1;

        /*
         * 完全な空行は使用しない。
         */
        if (isEmptyRow(row)) {
            skippedEmptyRowCount += 1;

            continue;
        }

        sourceRowCount += 1;

        /*
         * 必要な3列だけを取得する。
         *
         * その他のCSV列はここで完全に捨てる。
         */
        const pluCode =
            getColumnValue(
                row,
                columnIndexes.pluCode
            ).trim();

        const productName =
            getColumnValue(
                row,
                columnIndexes.productName
            ).trim();

        const rawQuantity =
            getColumnValue(
                row,
                columnIndexes.quantity
            ).trim();

        const quantity =
            parseQuantity(
                rawQuantity
            );

        /*
         * 数量が不正でも、
         * 商品行自体は出力候補として保持する。
         */
        if (Number.isNaN(quantity)) {

            errors.push({
                rowNumber,
                type:
                    "invalid-quantity",
                rawValue:
                    rawQuantity,
                message:
                    `CSV ${rowNumber}行目: 理論在庫数量「${rawQuantity}」を数値として読み取れません。`
            });
        }

        items.push({
            rowNumber,
            pluCode,
            productName,
            quantity
        });
    }

    return {
        items,
        errors,
        encoding,
        headers,
        sourceRowCount,
        skippedEmptyRowCount
    };
}


/* =========================================================
   値変換
   ========================================================= */

/**
 * CSV行から指定列の値を取得する。
 *
 * 行の列数が不足している場合は
 * 空文字を返す。
 */
function getColumnValue(
    row: readonly string[],
    columnIndex: number
): string {

    return row[columnIndex] ?? "";
}


/**
 * 理論在庫数量をnumberへ変換する。
 *
 * 以下を許容する。
 *
 * 10
 * -1
 * 0
 * 12.5
 * "1,234"
 *
 * 空文字や数値として解釈できない値は
 * Number.NaN を返す。
 */
function parseQuantity(
    rawValue: string
): number {

    const normalized =
        rawValue
            .trim()
            .replace(
                /,/g,
                ""
            );

    if (normalized === "") {
        return Number.NaN;
    }

    const value =
        Number(normalized);

    if (!Number.isFinite(value)) {
        return Number.NaN;
    }

    return value;
}


/* =========================================================
   空行判定
   ========================================================= */

/**
 * CSV行に実質的な値が存在しないか判定する。
 */
function isEmptyRow(
    row: readonly string[]
): boolean {

    return row.every(
        (value) =>
            value.trim() === ""
    );
}