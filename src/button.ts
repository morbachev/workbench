/**
 * button.ts
 *
 * サイト全体で共有するボタン操作を管理する。
 *
 * 特定のツールに依存する処理は置かない。
 *
 * 現在の担当:
 * - 現在表示しているページURLのコピー
 */


/**
 * 初期化済みのリンクコピーボタン。
 *
 * 同じボタンへイベントリスナーが
 * 二重登録されることを防ぐ。
 */
const initializedCopyLinkButtons =
    new WeakSet<HTMLButtonElement>();


/**
 * リンクコピーボタンを初期化する。
 *
 * root配下に存在する
 * data-action="copy-link"
 * を持つbuttonを対象とする。
 *
 * @param root 検索対象となるDOM
 */
export function initializeCopyLinkButtons(
    root: ParentNode = document
): void {

    const buttons =
        root.querySelectorAll<HTMLButtonElement>(
            'button[data-action="copy-link"]'
        );

    buttons.forEach((button) => {

        if (
            initializedCopyLinkButtons.has(button)
        ) {
            return;
        }

        initializedCopyLinkButtons.add(button);

        button.addEventListener(
            "click",
            () => {
                void copyCurrentPageUrl(button);
            }
        );
    });
}


/**
 * 現在表示しているページのURLを
 * クリップボードへコピーする。
 *
 * @param button 操作されたボタン
 */
async function copyCurrentPageUrl(
    button: HTMLButtonElement
): Promise<void> {

    const originalTooltip =
        button.dataset.tooltip ??
        "リンクをコピー";

    try {

        await navigator.clipboard.writeText(
            window.location.href
        );

        button.dataset.tooltip =
            "コピーしました";

    } catch (error) {

        console.error(
            "URLのコピーに失敗しました。",
            error
        );

        button.dataset.tooltip =
            "コピーに失敗しました";
    }


    /*
     * 一定時間後に
     * 元のツールチップへ戻す。
     */
    window.setTimeout(
        () => {

            button.dataset.tooltip =
                originalTooltip;
        },
        1200
    );
}