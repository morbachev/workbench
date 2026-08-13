/**
 * jan.ts
 *
 * JANコードの入力値を正規化・検証し、
 * JAN-13バーコードをSVGへ描画する処理をまとめたファイル。
 *
 * main.tsからは、基本的にprocessJanInput()だけを呼び出す。
 *
 * 対応する入力:
 * - チェックデジットなしの12桁
 * - チェックデジットありの13桁
 * - 半角数字
 * - 全角数字
 * - 半角空白
 * - 全角空白
 * - タブや改行などの空白文字
 *
 * 正常終了後:
 * - 内部値は空白なしの13桁へ統一する
 * - 入力欄は先頭7桁と残り6桁の間へ空白を入れる
 * - JAN-13バーコードをSVGへ描画する
 * - SVG内にはJANコードの数字を表示しない
 * - productLabel.dataset.janへ空白なし13桁を保存する
 *
 * 例:
 *
 * 入力:
 * ４９０１２３４　５６７８９
 *
 * 内部値:
 * 4901234567894
 *
 * 画面表示:
 * 4901234 567894
 */

/**
 * チェックデジットを含まないJANコードの桁数。
 */
const JAN_BODY_LENGTH = 12;

/**
 * チェックデジットを含むJANコードの桁数。
 */
const JAN_FULL_LENGTH = 13;

/**
 * 画面表示時に空白を挿入する位置。
 *
 * 先頭7桁と残り6桁へ分ける。
 */
const JAN_DISPLAY_SEPARATOR_POSITION = 7;

/**
 * SVG要素を生成するときに使用する名前空間。
 */
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * バーコードSVG全体の横幅。
 */
const SVG_WIDTH = 220;

/**
 * バーコードSVG全体の高さ。
 *
 * 数字をSVG内へ表示しないため、
 * バーだけが収まる高さにしている。
 */
const SVG_HEIGHT = 64;

/**
 * バーコード左側の余白。
 */
const BARCODE_START_X = 15;

/**
 * バーコード1モジュールあたりの横幅。
 *
 * JAN-13のバーコード部分は95モジュールで構成される。
 * 95 × 2 = 190となり、左右15ずつの余白を含めて220になる。
 */
const MODULE_WIDTH = 2;

/**
 * バーの描画開始位置。
 */
const BAR_START_Y = 3;

/**
 * 通常バーの高さ。
 */
const NORMAL_BAR_HEIGHT = 52;

/**
 * ガードバーの高さ。
 *
 * 左端、中央、右端のガードバーのみ、
 * 通常バーより少し長く描画する。
 */
const GUARD_BAR_HEIGHT = 58;

/**
 * JAN-13の左側で使用するLコード。
 */
const LEFT_ODD_PATTERNS: Readonly<Record<string, string>> = {
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
 * JAN-13の左側で使用するGコード。
 */
const LEFT_EVEN_PATTERNS: Readonly<Record<string, string>> = {
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
 * JAN-13の右側で使用するRコード。
 */
const RIGHT_PATTERNS: Readonly<Record<string, string>> = {
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
 * JANコード先頭1桁に対応する、
 * 左側6桁のLコード・Gコードの組み合わせ。
 *
 * LはLEFT_ODD_PATTERNS、
 * GはLEFT_EVEN_PATTERNSを使用する。
 */
const LEFT_PARITY_PATTERNS: Readonly<Record<string, string>> = {
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

/**
 * JANコード処理が成功した場合の結果。
 */
export type JanSuccessResult = {
    success: true;

    /**
     * 空白を含まない13桁のJANコード。
     *
     * JSON保存やバーコード生成ではこちらを使用する。
     */
    jan: string;

    /**
     * 先頭7桁と残り6桁の間へ空白を入れた表示用JANコード。
     */
    displayJan: string;

    /**
     * 入力時点でチェックデジットが付いていたかを示す。
     *
     * 12桁入力ならfalse、
     * 13桁入力ならtrueとなる。
     */
    hadCheckDigit: boolean;

    /**
     * 計算または検証されたチェックデジット。
     */
    checkDigit: number;
};

/**
 * JANコードが空欄だった場合の結果。
 *
 * 空欄は入力エラーとはせず、
 * JANコード未設定として正常に扱う。
 */
export type JanEmptyResult = {
    success: true;
    jan: "";
    displayJan: "";
    hadCheckDigit: false;
    checkDigit: null;
};

/**
 * JANコード処理が失敗した場合の結果。
 */
export type JanErrorResult = {
    success: false;

    /**
     * 利用者へ表示するエラーメッセージ。
     */
    errorMessage: string;
};

/**
 * JANコード処理全体の戻り値。
 */
export type JanResult =
    | JanSuccessResult
    | JanEmptyResult
    | JanErrorResult;

/**
 * JANコード入力欄を正規化・検証し、
 * 正常であれば入力欄とバーコードSVGへ反映する。
 *
 * main.tsからは基本的にこの関数だけを呼び出す。
 *
 * 正常な場合:
 * - 入力欄を7桁区切りの表示へ変換する
 * - JAN-13バーコードをSVGへ描画する
 * - productLabel.dataset.janへ13桁JANを保存する
 *
 * 空欄の場合:
 * - バーコードを消去する
 * - dataset.janを削除する
 *
 * 入力エラーの場合:
 * - バーコードを消去する
 * - dataset.janを削除する
 * - ブラウザ標準の入力エラーを表示する
 *
 * @param productLabel 処理対象の商品ラベル
 * @param janInput 処理対象のJANコード入力欄
 * @returns JANコードの処理結果
 */
export function processJanInput(
    productLabel: HTMLElement,
    janInput: HTMLInputElement
): JanResult {
    const barcodeSvg =
        productLabel.querySelector<SVGSVGElement>(
            ".product-label__barcode"
        );

    if (!barcodeSvg) {
        throw new Error(
            "商品ラベル内にJANバーコード表示用SVGが見つかりません。"
        );
    }

    const barcodePlaceholder =
        productLabel.querySelector<HTMLElement>(
            ".product-label__barcode-placeholder"
        );

    if (!barcodePlaceholder) {
        throw new Error(
            "商品ラベル内にJANバーコード案内表示が見つかりません。"
        );
    }

    /*
     * 前回の入力エラー状態を解除する。
     */
    janInput.setCustomValidity("");

    const result = normalizeJan(janInput.value);

    /*
     * 入力内容に問題がある場合は、
     * 前回描画したバーコードを消去する。
     */
    if (!result.success) {
        clearJanBarcode(barcodeSvg);

        barcodePlaceholder.hidden = false;

        /*
         * 不正なJANコードを内部値として残さない。
         */
        delete productLabel.dataset.jan;

        janInput.setCustomValidity(result.errorMessage);
        janInput.reportValidity();

        return result;
    }

    /*
     * 空欄の場合は、
     * JANコード未設定としてバーコードを消去する。
     */
    if (result.jan === "") {
        janInput.value = "";
        clearJanBarcode(barcodeSvg);
        barcodePlaceholder.hidden = false;
        delete productLabel.dataset.jan;

        return result;
    }

    /*
     * 入力欄へ、
     * 先頭7桁と残り6桁を空白で分けた値を反映する。
     */
    janInput.value = result.displayJan;

    /*
     * JSON保存や今後の処理で利用できるよう、
     * 空白なしの13桁JANコードを商品ラベルへ保存する。
     */
    productLabel.dataset.jan = result.jan;

    barcodePlaceholder.hidden = true;

    /*
     * 正常な13桁JANコードから
     * バーコードを生成してSVGへ描画する。
     */
    drawJan13Barcode(barcodeSvg, result.jan);

    return result;
}

/**
 * JANコード文字列を正規化・検証する。
 *
 * この関数はDOMを操作せず、
 * 渡された文字列から処理結果だけを返す。
 *
 * 処理順:
 * 1. すべての空白文字を除去する
 * 2. 空欄か確認する
 * 3. 全角数字を半角数字へ変換する
 * 4. 数字以外が含まれていないか確認する
 * 5. 12桁または13桁か確認する
 * 6. チェックデジットを追加または検証する
 * 7. 表示用の7桁区切り文字列を生成する
 *
 * @param input 入力されたJANコード
 * @returns JANコードの処理結果
 */
export function normalizeJan(input: string): JanResult {
    /*
     * 半角空白、全角空白、タブ、改行など、
     * JavaScriptが空白として扱う文字をすべて除去する。
     */
    const valueWithoutWhitespace =
        removeAllWhitespace(input);

    /*
     * 空白を取り除いた結果が空文字なら、
     * JANコード未設定として正常終了する。
     */
    if (valueWithoutWhitespace === "") {
        return {
            success: true,
            jan: "",
            displayJan: "",
            hadCheckDigit: false,
            checkDigit: null
        };
    }

    /*
     * 全角数字を半角数字へ変換する。
     */
    const normalizedValue =
        convertFullWidthDigitsToHalfWidth(
            valueWithoutWhitespace
        );

    /*
     * 半角数字以外が含まれている場合はエラーとする。
     *
     * ハイフンやアルファベットなどを
     * 勝手に削除して補正することはしない。
     */
    if (!isHalfWidthDigitsOnly(normalizedValue)) {
        return {
            success: false,
            errorMessage:
                "JANコードには数字だけを入力してください。"
        };
    }

    /*
     * JANコードは、
     * チェックデジットなしの12桁または
     * チェックデジットありの13桁だけを受け付ける。
     */
    if (
        normalizedValue.length !== JAN_BODY_LENGTH &&
        normalizedValue.length !== JAN_FULL_LENGTH
    ) {
        return {
            success: false,
            errorMessage:
                "JANコードは12桁または13桁で入力してください。"
        };
    }

    /*
     * 12桁の場合は、
     * チェックデジットが省略されているものとして
     * 13桁目を自動計算して追加する。
     */
    if (normalizedValue.length === JAN_BODY_LENGTH) {
        const checkDigit =
            calculateJanCheckDigit(normalizedValue);

        const completedJan =
            normalizedValue + String(checkDigit);

        return {
            success: true,
            jan: completedJan,
            displayJan:
                formatJanForDisplay(completedJan),
            hadCheckDigit: false,
            checkDigit
        };
    }

    /*
     * 13桁の場合は、
     * 最後の1桁を入力されたチェックデジットとして扱う。
     */
    const janBody =
        normalizedValue.slice(0, JAN_BODY_LENGTH);

    const inputCheckDigit =
        Number(normalizedValue.slice(-1));

    const calculatedCheckDigit =
        calculateJanCheckDigit(janBody);

    /*
     * 入力されたチェックデジットと
     * 計算したチェックデジットが一致するか確認する。
     */
    if (inputCheckDigit !== calculatedCheckDigit) {
        return {
            success: false,
            errorMessage:
                "JANコードのチェックデジットが正しくありません。"
        };
    }

    return {
        success: true,
        jan: normalizedValue,
        displayJan:
            formatJanForDisplay(normalizedValue),
        hadCheckDigit: true,
        checkDigit: calculatedCheckDigit
    };
}

/**
 * 文字列中の空白文字をすべて除去する。
 *
 * 対象:
 * - 半角空白
 * - 全角空白
 * - タブ
 * - 改行
 * - その他JavaScriptが空白として認識する文字
 *
 * @param value 対象文字列
 * @returns 空白を除去した文字列
 */
function removeAllWhitespace(value: string): string {
    return value.replace(/\s+/g, "");
}

/**
 * 全角数字を半角数字へ変換する。
 *
 * 対象:
 * ０１２３４５６７８９
 *
 * 数字以外の文字は変更しない。
 * 数字以外の検証は後続処理で行う。
 *
 * @param value 対象文字列
 * @returns 全角数字を半角化した文字列
 */
function convertFullWidthDigitsToHalfWidth(
    value: string
): string {
    return value.replace(/[０-９]/g, (character) => {
        const digit =
            character.charCodeAt(0) -
            "０".charCodeAt(0);

        return String(digit);
    });
}

/**
 * 文字列が半角数字だけで構成されているか判定する。
 *
 * @param value 対象文字列
 * @returns 半角数字だけならtrue
 */
function isHalfWidthDigitsOnly(
    value: string
): boolean {
    return /^[0-9]+$/.test(value);
}

/**
 * JANコード12桁からチェックデジットを計算する。
 *
 * 計算方法:
 * - 左から奇数番目の数字をそのまま加算する
 * - 左から偶数番目の数字を3倍して加算する
 * - 合計を次の10の倍数にするために必要な値を求める
 *
 * @param janBody チェックデジットを除いた12桁
 * @returns 0から9までのチェックデジット
 */
export function calculateJanCheckDigit(
    janBody: string
): number {
    if (janBody.length !== JAN_BODY_LENGTH) {
        throw new Error(
            "チェックデジットの計算には12桁の数字が必要です。"
        );
    }

    if (!isHalfWidthDigitsOnly(janBody)) {
        throw new Error(
            "チェックデジットの計算対象には半角数字だけを指定してください。"
        );
    }

    let sum = 0;

    for (
        let index = 0;
        index < janBody.length;
        index++
    ) {
        const digit = Number(janBody[index]);

        /*
         * 配列のindexは0から始まるため、
         * indexが偶数ならJAN上では左から奇数番目となる。
         */
        const isOddPosition = index % 2 === 0;

        if (isOddPosition) {
            sum += digit;
        } else {
            sum += digit * 3;
        }
    }

    /*
     * 合計がすでに10の倍数なら0となる。
     */
    return (10 - (sum % 10)) % 10;
}

/**
 * 13桁のJANコードを画面表示用に整形する。
 *
 * 先頭7桁と残り6桁の間へ半角空白を挿入する。
 *
 * 例:
 * 4901234567894
 * ↓
 * 4901234 567894
 *
 * @param jan 空白なしの13桁JANコード
 * @returns 7桁区切りの表示用JANコード
 */
export function formatJanForDisplay(
    jan: string
): string {
    if (jan === "") {
        return "";
    }

    if (
        jan.length !== JAN_FULL_LENGTH ||
        !isHalfWidthDigitsOnly(jan)
    ) {
        throw new Error(
            "画面表示用の整形には13桁のJANコードが必要です。"
        );
    }

    return [
        jan.slice(0, JAN_DISPLAY_SEPARATOR_POSITION),
        jan.slice(JAN_DISPLAY_SEPARATOR_POSITION)
    ].join(" ");
}

/**
 * 13桁のJANコードから、
 * JAN-13バーコードの95モジュール分のビット列を生成する。
 *
 * 構造:
 * - 左ガード: 101
 * - 左側6桁: 各7モジュール
 * - 中央ガード: 01010
 * - 右側6桁: 各7モジュール
 * - 右ガード: 101
 *
 * 合計:
 * 3 + 42 + 5 + 42 + 3 = 95モジュール
 *
 * @param jan 13桁のJANコード
 * @returns 95文字の0と1で構成されたビット列
 */
export function encodeJan13(jan: string): string {
    if (
        jan.length !== JAN_FULL_LENGTH ||
        !isHalfWidthDigitsOnly(jan)
    ) {
        throw new Error(
            "バーコード生成には13桁のJANコードが必要です。"
        );
    }

    const firstDigit = jan[0];

    const parityPattern =
        LEFT_PARITY_PATTERNS[firstDigit];

    if (!parityPattern) {
        throw new Error(
            "JANコード先頭桁のパリティ情報が見つかりません。"
        );
    }

    /*
     * 左端のガードパターン。
     */
    let encoded = "101";

    /*
     * JANコードの2桁目から7桁目までを
     * LコードまたはGコードで符号化する。
     */
    for (let index = 0; index < 6; index++) {
        const digit = jan[index + 1];
        const parity = parityPattern[index];

        const pattern =
            parity === "L"
                ? LEFT_ODD_PATTERNS[digit]
                : LEFT_EVEN_PATTERNS[digit];

        if (!pattern) {
            throw new Error(
                "JANコード左側の符号化に失敗しました。"
            );
        }

        encoded += pattern;
    }

    /*
     * 中央のガードパターン。
     */
    encoded += "01010";

    /*
     * JANコードの8桁目から13桁目までを
     * Rコードで符号化する。
     */
    for (let index = 7; index < JAN_FULL_LENGTH; index++) {
        const digit = jan[index];
        const pattern = RIGHT_PATTERNS[digit];

        if (!pattern) {
            throw new Error(
                "JANコード右側の符号化に失敗しました。"
            );
        }

        encoded += pattern;
    }

    /*
     * 右端のガードパターン。
     */
    encoded += "101";

    if (encoded.length !== 95) {
        throw new Error(
            "JAN-13バーコードのビット数が正しくありません。"
        );
    }

    return encoded;
}

/**
 * JAN-13バーコードをSVGへ描画する。
 *
 * SVGにはバーのみを描画し、
 * JANコードの数字は表示しない。
 *
 * @param barcodeSvg 描画先のSVG要素
 * @param jan 空白なし13桁のJANコード
 */
export function drawJan13Barcode(
    barcodeSvg: SVGSVGElement,
    jan: string
): void {
    /*
     * 新しいバーコードを描画する前に、
     * 前回の描画内容をすべて削除する。
     */
    clearJanBarcode(barcodeSvg);

    const encoded = encodeJan13(jan);

    barcodeSvg.setAttribute(
        "viewBox",
        `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`
    );

    barcodeSvg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );

    barcodeSvg.setAttribute(
        "shape-rendering",
        "crispEdges"
    );

    /*
     * 目には表示しないが、
     * スクリーンリーダー向けの説明には
     * JANコードを設定する。
     */
    barcodeSvg.setAttribute(
        "aria-label",
        `JANバーコード ${formatJanForDisplay(jan)}`
    );

    /*
     * バーコード背景を白くする。
     *
     * 印刷時や背景色が設定された場合でも、
     * バーコード部分を読み取りやすくする。
     */
    const background =
        document.createElementNS(
            SVG_NAMESPACE,
            "rect"
        );

    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute(
        "width",
        String(SVG_WIDTH)
    );
    background.setAttribute(
        "height",
        String(SVG_HEIGHT)
    );
    background.setAttribute("fill", "#ffffff");

    barcodeSvg.append(background);

    /*
     * ビット列の1となっている部分へ、
     * 黒い縦棒を描画する。
     */
    for (
        let moduleIndex = 0;
        moduleIndex < encoded.length;
        moduleIndex++
    ) {
        if (encoded[moduleIndex] !== "1") {
            continue;
        }

        const rect =
            document.createElementNS(
                SVG_NAMESPACE,
                "rect"
            );

        const x =
            BARCODE_START_X +
            moduleIndex * MODULE_WIDTH;

        const isGuardModule =
            isGuardBarModule(moduleIndex);

        const barHeight =
            isGuardModule
                ? GUARD_BAR_HEIGHT
                : NORMAL_BAR_HEIGHT;

        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(BAR_START_Y));
        rect.setAttribute(
            "width",
            String(MODULE_WIDTH)
        );
        rect.setAttribute(
            "height",
            String(barHeight)
        );
        rect.setAttribute("fill", "#000000");

        barcodeSvg.append(rect);
    }
}

/**
 * 指定されたモジュール位置が、
 * JAN-13のガードバー部分か判定する。
 *
 * ガードバー:
 * - 左端: 0〜2
 * - 中央: 45〜49
 * - 右端: 92〜94
 *
 * @param moduleIndex 0から始まるモジュール位置
 * @returns ガードバー部分ならtrue
 */
function isGuardBarModule(
    moduleIndex: number
): boolean {
    const isLeftGuard =
        moduleIndex >= 0 && moduleIndex <= 2;

    const isCenterGuard =
        moduleIndex >= 45 && moduleIndex <= 49;

    const isRightGuard =
        moduleIndex >= 92 && moduleIndex <= 94;

    return (
        isLeftGuard ||
        isCenterGuard ||
        isRightGuard
    );
}

/**
 * バーコードSVG内の描画内容をすべて削除する。
 *
 * @param barcodeSvg 消去対象のSVG要素
 */
export function clearJanBarcode(
    barcodeSvg: SVGSVGElement
): void {
    barcodeSvg.replaceChildren();

    barcodeSvg.setAttribute(
        "aria-label",
        "JANバーコード未設定"
    );
}