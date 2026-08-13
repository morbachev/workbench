/**
 * barcode.ts
 *
 * INVENTORY BATCH のEAN-13バーコード処理を管理する。
 *
 * このファイルでは以下を担当する。
 *
 * - PLUコードの正規化
 * - EAN-13形式の検証
 * - Excel等による指数表記変換の検出
 * - チェックディジットの計算
 * - SVGバーコードの描画
 *
 * CSV解析や画面全体のDOM描画は担当しない。
 */


/* =========================================================
   定数
   ========================================================= */

/**
 * SVG名前空間。
 */
const SVG_NAMESPACE =
    "http://www.w3.org/2000/svg";


/**
 * EAN-13の開始・中央・終了ガード。
 */
const START_GUARD =
    "101";

const MIDDLE_GUARD =
    "01010";

const END_GUARD =
    "101";


/**
 * 左側6桁のLパターン。
 */
const LEFT_ODD_PATTERNS:
    Readonly<Record<string, string>> = {

    "0": "0001101",
    "1": "0011001",
    "2": "0010011",
    "3": "0111101",
    "4": "0100011",
    "5": "0110001",
    "6": "0101111",
    "7": "0111011",
    "8": "0110111",
    "9": "0001011"
};


/**
 * 左側6桁のGパターン。
 */
const LEFT_EVEN_PATTERNS:
    Readonly<Record<string, string>> = {

    "0": "0100111",
    "1": "0110011",
    "2": "0011011",
    "3": "0100001",
    "4": "0011101",
    "5": "0111001",
    "6": "0000101",
    "7": "0010001",
    "8": "0001001",
    "9": "0010111"
};


/**
 * 右側6桁のRパターン。
 */
const RIGHT_PATTERNS:
    Readonly<Record<string, string>> = {

    "0": "1110010",
    "1": "1100110",
    "2": "1101100",
    "3": "1000010",
    "4": "1011100",
    "5": "1001110",
    "6": "1010000",
    "7": "1000100",
    "8": "1001000",
    "9": "1110100"
};


/**
 * EAN-13先頭1桁によって決まる、
 * 左側6桁のL/Gパターン構成。
 */
const LEFT_PARITY_PATTERNS:
    Readonly<Record<string, string>> = {

    "0": "LLLLLL",
    "1": "LLGLGG",
    "2": "LLGGLG",
    "3": "LLGGGL",
    "4": "LGLLGG",
    "5": "LGGLLG",
    "6": "LGGGLL",
    "7": "LGLGLG",
    "8": "LGLGGL",
    "9": "LGGLGL"
};


/* =========================================================
   EAN-13 モジュール
   ========================================================= */

/**
 * EAN-13本体は95モジュール。
 */
const EAN13_MODULE_COUNT =
    95;


/**
 * 左右Quiet Zone。
 *
 * EAN-13本体の外側へ配置する。
 */
const LEFT_QUIET_ZONE_MODULES =
    11;

const RIGHT_QUIET_ZONE_MODULES =
    7;


/**
 * Quiet Zone込みの総モジュール数。
 *
 * 11 + 95 + 7 = 113
 */
const TOTAL_MODULE_COUNT =
    LEFT_QUIET_ZONE_MODULES +
    EAN13_MODULE_COUNT +
    RIGHT_QUIET_ZONE_MODULES;


/* =========================================================
   ガード位置
   ========================================================= */

/**
 * 左右それぞれの商品データは、
 *
 * 6桁 × 7モジュール
 *
 * で42モジュール。
 */
const SIDE_DATA_MODULE_COUNT =
    6 * 7;


/**
 * 中央ガード開始位置。
 *
 * START 3
 * +
 * 左側データ 42
 *
 * = 45
 */
const MIDDLE_GUARD_START_INDEX =
    START_GUARD.length +
    SIDE_DATA_MODULE_COUNT;


/**
 * 終了ガード開始位置。
 *
 * 95 - 3 = 92
 */
const END_GUARD_START_INDEX =
    EAN13_MODULE_COUNT -
    END_GUARD.length;


/* =========================================================
   SVG高さ
   ========================================================= */

/**
 * SVG内部の最大高さ。
 *
 * ガードバーがこの高さまで伸びる。
 */
const GUARD_BAR_HEIGHT =
    40;


/**
 * 通常のデータバー。
 *
 * ガードより少し短くし、
 * EAN-13らしい外観にする。
 */
const DATA_BAR_HEIGHT =
    34;


/**
 * SVG viewBoxの高さ。
 */
const VIEWBOX_HEIGHT =
    GUARD_BAR_HEIGHT;


/* =========================================================
   型定義
   ========================================================= */

/**
 * EAN-13検証エラー。
 */
export type Ean13ValidationError =
    | "EMPTY"
    | "SCIENTIFIC_NOTATION"
    | "INVALID_LENGTH"
    | "INVALID_CHARACTER"
    | "INVALID_CHECK_DIGIT";


/**
 * EAN-13検証結果。
 */
export type Ean13ValidationResult =
    | {
        valid: true;
        value: string;
    }
    | {
        valid: false;
        value: string;
        error: Ean13ValidationError;
        message: string;
    };


/**
 * SVG描画結果。
 */
export type BarcodeRenderResult =
    | {
        success: true;
        value: string;
    }
    | {
        success: false;
        value: string;
        error: Ean13ValidationError;
        message: string;
    };


/* =========================================================
   公開関数
   ========================================================= */

/**
 * PLUコードをEAN-13検証用に正規化する。
 *
 * 対応:
 *
 * - 前後空白削除
 * - 全角数字を半角数字へ変換
 *
 * 桁数補完やチェックディジット修正、
 * 指数表記からの復元は行わない。
 */
export function normalizeEan13(
    rawValue: string
): string {

    return rawValue
        .trim()
        .replace(
            /[０-９]/g,
            (character) =>
                String.fromCharCode(
                    character.charCodeAt(0) -
                    0xFEE0
                )
        );
}


/**
 * PLUコードが正しいEAN-13か検証する。
 */
export function validateEan13(
    rawValue: string
): Ean13ValidationResult {

    const value =
        normalizeEan13(
            rawValue
        );


    /* -----------------------------------------------------
       空文字
       ----------------------------------------------------- */

    if (
        value ===
        ""
    ) {

        return {
            valid: false,
            value,
            error:
                "EMPTY",
            message:
                "PLUコードが空です。"
        };
    }


    /* -----------------------------------------------------
       指数表記
       ----------------------------------------------------- */

    /**
     * Excel等でCSVを開いた際、
     *
     * 実際のJAN
     *
     * が
     *
     * 4.944E+12
     *
     * のような指数表記へ変換される場合がある。
     *
     * この時点で元の桁が丸められている可能性があり、
     * 正しいPLUコードを復元できる保証がない。
     *
     * そのため数値への変換・補正は行わず、
     * 明示的なエラーとする。
     */
    if (
        isScientificNotation(
            value
        )
    ) {

        return {
            valid: false,
            value,
            error:
                "SCIENTIFIC_NOTATION",
            message:
                "PLUコードが指数表記になっています。Excel等で値が変換された可能性があります。元のCSVを使用してください。"
        };
    }


    /* -----------------------------------------------------
       数字以外
       ----------------------------------------------------- */

    if (
        !/^\d+$/.test(
            value
        )
    ) {

        return {
            valid: false,
            value,
            error:
                "INVALID_CHARACTER",
            message:
                "PLUコードに数字以外の文字が含まれています。"
        };
    }


    /* -----------------------------------------------------
       桁数
       ----------------------------------------------------- */

    if (
        value.length !==
        13
    ) {

        return {
            valid: false,
            value,
            error:
                "INVALID_LENGTH",
            message:
                `PLUコードは13桁である必要があります。現在は${value.length}桁です。`
        };
    }


    /* -----------------------------------------------------
       チェックディジット
       ----------------------------------------------------- */

    const expectedCheckDigit =
        calculateEan13CheckDigit(
            value.slice(
                0,
                12
            )
        );


    const actualCheckDigit =
        Number(
            value[12]
        );


    if (
        actualCheckDigit !==
        expectedCheckDigit
    ) {

        return {
            valid: false,
            value,
            error:
                "INVALID_CHECK_DIGIT",
            message:
                `チェックディジットが不正です。期待値は${expectedCheckDigit}です。`
        };
    }


    return {
        valid: true,
        value
    };
}


/**
 * EAN-13のチェックディジットを計算する。
 *
 * 引数には12桁の数字文字列を指定する。
 */
export function calculateEan13CheckDigit(
    firstTwelveDigits: string
): number {

    if (
        !/^\d{12}$/.test(
            firstTwelveDigits
        )
    ) {

        throw new TypeError(
            "EAN-13チェックディジット計算には12桁の数字を指定してください。"
        );
    }


    let sum =
        0;


    for (
        let index = 0;
        index <
        firstTwelveDigits.length;
        index += 1
    ) {

        const digit =
            Number(
                firstTwelveDigits[
                index
                ]
            );


        /**
         * EAN-13では左から数えて、
         *
         * 奇数位置 × 1
         * 偶数位置 × 3
         *
         * で合計する。
         */
        const weight =
            index %
                2 ===
                0
                ? 1
                : 3;


        sum +=
            digit *
            weight;
    }


    return (
        10 -
        (
            sum %
            10
        )
    ) %
        10;
}


/**
 * 指定SVGへEAN-13バーコードを描画する。
 *
 * 検証に失敗した場合はSVGを空にし、
 * エラー情報を返す。
 */
export function renderEan13Barcode(
    svg: SVGSVGElement,
    rawValue: string
): BarcodeRenderResult {

    const validation =
        validateEan13(
            rawValue
        );


    /**
     * 前回描画内容を必ず削除する。
     */
    svg.replaceChildren();


    if (
        !validation.valid
    ) {

        svg.removeAttribute(
            "viewBox"
        );


        svg.removeAttribute(
            "aria-label"
        );


        return {
            success: false,
            value:
                validation.value,
            error:
                validation.error,
            message:
                validation.message
        };
    }


    const value =
        validation.value;


    const pattern =
        createEan13Pattern(
            value
        );


    configureBarcodeSvg(
        svg,
        value
    );


    drawBarcodePattern(
        svg,
        pattern
    );


    return {
        success: true,
        value
    };
}


/**
 * EAN-13として有効かだけを簡単に判定する。
 */
export function isValidEan13(
    rawValue: string
): boolean {

    return validateEan13(
        rawValue
    ).valid;
}


/* =========================================================
   指数表記判定
   ========================================================= */

/**
 * Excel等で生成される可能性がある
 * 指数表記かどうかを判定する。
 *
 * 例:
 *
 * 4.944E+12
 * 4.944e+12
 * 4944E9
 * 1E+12
 */
function isScientificNotation(
    value: string
): boolean {

    return /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(
        value
    );
}


/* =========================================================
   EAN-13ビット列生成
   ========================================================= */

/**
 * 13桁EANから95モジュールの
 * バーコードパターンを生成する。
 *
 * 1:
 *   黒バー
 *
 * 0:
 *   白スペース
 */
function createEan13Pattern(
    value: string
): string {

    const firstDigit =
        value[0];


    const leftDigits =
        value.slice(
            1,
            7
        );


    const rightDigits =
        value.slice(
            7,
            13
        );


    const parityPattern =
        LEFT_PARITY_PATTERNS[
        firstDigit
        ];


    if (
        parityPattern ===
        undefined
    ) {

        throw new Error(
            "EAN-13左側パリティの生成に失敗しました。"
        );
    }


    let pattern =
        START_GUARD;


    /* -----------------------------------------------------
       左側6桁
       ----------------------------------------------------- */

    for (
        let index = 0;
        index <
        leftDigits.length;
        index += 1
    ) {

        const digit =
            leftDigits[
            index
            ];


        const parity =
            parityPattern[
            index
            ];


        const digitPattern =
            parity ===
                "L"
                ? LEFT_ODD_PATTERNS[
                digit
                ]
                : LEFT_EVEN_PATTERNS[
                digit
                ];


        if (
            digitPattern ===
            undefined
        ) {

            throw new Error(
                "EAN-13左側パターンの生成に失敗しました。"
            );
        }


        pattern +=
            digitPattern;
    }


    /* -----------------------------------------------------
       中央ガード
       ----------------------------------------------------- */

    pattern +=
        MIDDLE_GUARD;


    /* -----------------------------------------------------
       右側6桁
       ----------------------------------------------------- */

    for (
        const digit
        of rightDigits
    ) {

        const digitPattern =
            RIGHT_PATTERNS[
            digit
            ];


        if (
            digitPattern ===
            undefined
        ) {

            throw new Error(
                "EAN-13右側パターンの生成に失敗しました。"
            );
        }


        pattern +=
            digitPattern;
    }


    /* -----------------------------------------------------
       終了ガード
       ----------------------------------------------------- */

    pattern +=
        END_GUARD;


    /**
     * EAN-13標準の
     * 95モジュールを確認する。
     */
    if (
        pattern.length !==
        EAN13_MODULE_COUNT
    ) {

        throw new Error(
            `EAN-13パターン長が不正です: ${pattern.length}`
        );
    }


    return pattern;
}


/* =========================================================
   SVG設定
   ========================================================= */

/**
 * バーコード描画用SVGを設定する。
 *
 * 横方向:
 *   113モジュールをCSS指定幅いっぱいに使う。
 *
 * 縦方向:
 *   CSS指定高さへ独立して合わせる。
 *
 * xMidYMid meet を使用すると
 * viewBox比率とCSS比率の差によって
 * 左右へ大量の未使用領域が発生するため、
 * preserveAspectRatio="none" とする。
 */
function configureBarcodeSvg(
    svg: SVGSVGElement,
    value: string
): void {

    svg.setAttribute(
        "viewBox",
        `0 0 ${TOTAL_MODULE_COUNT} ${VIEWBOX_HEIGHT}`
    );


    svg.setAttribute(
        "preserveAspectRatio",
        "none"
    );


    svg.setAttribute(
        "shape-rendering",
        "crispEdges"
    );


    svg.setAttribute(
        "role",
        "img"
    );


    svg.setAttribute(
        "aria-label",
        `EAN-13バーコード ${value}`
    );
}


/* =========================================================
   ガード判定
   ========================================================= */

/**
 * 指定モジュールが
 *
 * - 開始ガード
 * - 中央ガード
 * - 終了ガード
 *
 * のいずれかに属するか判定する。
 */
function isGuardModule(
    moduleIndex: number
): boolean {

    /* -----------------------------------------------------
       開始ガード
       0 ～ 2
       ----------------------------------------------------- */

    if (
        moduleIndex <
        START_GUARD.length
    ) {

        return true;
    }


    /* -----------------------------------------------------
       中央ガード
       45 ～ 49
       ----------------------------------------------------- */

    if (
        moduleIndex >=
        MIDDLE_GUARD_START_INDEX &&
        moduleIndex <
        MIDDLE_GUARD_START_INDEX +
        MIDDLE_GUARD.length
    ) {

        return true;
    }


    /* -----------------------------------------------------
       終了ガード
       92 ～ 94
       ----------------------------------------------------- */

    if (
        moduleIndex >=
        END_GUARD_START_INDEX
    ) {

        return true;
    }


    return false;
}


/* =========================================================
   SVG描画
   ========================================================= */

/**
 * 95モジュールのEAN-13パターンを
 * SVGのrect要素として描画する。
 *
 * ガードバーのみ通常バーより
 * 少し長く描画する。
 */
function drawBarcodePattern(
    svg: SVGSVGElement,
    pattern: string
): void {

    const fragment =
        document.createDocumentFragment();


    let moduleIndex =
        0;


    while (
        moduleIndex <
        pattern.length
    ) {

        /* -------------------------------------------------
           白スペース
           ------------------------------------------------- */

        if (
            pattern[
            moduleIndex
            ] !==
            "1"
        ) {

            moduleIndex +=
                1;


            continue;
        }


        /* -------------------------------------------------
           黒バー開始位置
           ------------------------------------------------- */

        const startIndex =
            moduleIndex;


        /**
         * 連続した黒モジュールを
         * 1本のrectへまとめる。
         */
        while (
            moduleIndex <
            pattern.length &&
            pattern[
            moduleIndex
            ] ===
            "1"
        ) {

            moduleIndex +=
                1;
        }


        const width =
            moduleIndex -
            startIndex;


        /**
         * ガードバーだけ
         * 少し長くする。
         */
        const height =
            isGuardModule(
                startIndex
            )
                ? GUARD_BAR_HEIGHT
                : DATA_BAR_HEIGHT;


        const rect =
            document.createElementNS(
                SVG_NAMESPACE,
                "rect"
            );


        rect.setAttribute(
            "x",
            String(
                LEFT_QUIET_ZONE_MODULES +
                startIndex
            )
        );


        rect.setAttribute(
            "y",
            "0"
        );


        rect.setAttribute(
            "width",
            String(
                width
            )
        );


        rect.setAttribute(
            "height",
            String(
                height
            )
        );


        rect.setAttribute(
            "fill",
            "currentColor"
        );


        fragment.appendChild(
            rect
        );
    }


    svg.appendChild(
        fragment
    );
}