const siteRootUrl = new URL("../", import.meta.url);

const barcodeUrl = new URL(
    "gosplan13/",
    siteRootUrl
).href;

const inventoryUrl = new URL(
    "inventory_batch/",
    siteRootUrl
).href;

const discountExclusionUrl = new URL(
    "red_index/",
    siteRootUrl
).href;

const documentBuilderUrl = new URL(
    "document_builder/",
    siteRootUrl
).href;

const COPY_TOOLTIP_DEFAULT = "リンクをコピー";
const COPY_TOOLTIP_SUCCESS = "コピーしました";
const COPY_TOOLTIP_ERROR = "コピーに失敗しました";
const COPY_FEEDBACK_DURATION = 1500;

class SiteHeader extends HTMLElement {

    connectedCallback(): void {
        if (this.childElementCount > 0) {
            return;
        }

        this.innerHTML = `
            <header class="header">
                <div class="header__title-group">
                    <a
                        href="${siteRootUrl.href}"
                        class="header__title-group"
                        aria-label="WORKBENCH ホームへ戻る"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="header__logo"
                            height="24px"
                            width="24px"
                            viewBox="0 -960 960 960"
                            fill="#000"
                            aria-hidden="true"
                        >
                            <path
                                d="M280-280h160v-160H280v160Zm240 0h160v-160H520v160ZM280-520h160v-160H280v160Zm240 0h160v-160H520v160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"
                            />
                        </svg>
                        <div class="header__title-content">
                            <p class="header__eyebrow">
                                A lightweight in-house toolkit built with HTML, CSS, and TypeScript
                            </p>
                            <h1 class="header__title">
                                WORKBENCH
                            </h1>
                        </div>
                    </a>
                </div>
                <div class="header__far-item">
                    <a
                        href="${barcodeUrl}"
                        class="header__nav-link"
                    >
                        バーコード生成
                    </a>
                    <a
                        href="${inventoryUrl}"
                        class="header__nav-link"
                    >
                        棚卸一括出力
                    </a>
                    <a
                        href="${discountExclusionUrl}"
                        class="header__nav-link"
                    >
                        割引不可商品リスト
                    </a>
                    <a
                        href="${documentBuilderUrl}"
                        class="header__nav-link"
                    >
                        ビジネス文書出力
                    </a>
                    <button
                        type="button"
                        class="header__icon-button"
                        aria-label="${COPY_TOOLTIP_DEFAULT}"
                        data-tooltip="${COPY_TOOLTIP_DEFAULT}"
                        data-copy-link
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="header__icon"
                            height="24px"
                            width="24px"
                            viewBox="0 -960 960 960"
                            aria-hidden="true"
                        >
                            <path
                                d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"
                            />
                        </svg>
                    </button>
                </div>

            </header>
        `;
        this.setupCopyLinkButton();
    }


    /**
     * 「リンクをコピー」ボタンのイベントを設定する。
     */
    private setupCopyLinkButton(): void {
        const copyButton =
            this.querySelector<HTMLButtonElement>(
                "[data-copy-link]"
            );

        if (!copyButton) {
            return;
        }

        copyButton.addEventListener(
            "click",
            () => {
                void this.copyCurrentPageUrl(copyButton);
            }
        );
    }


    /**
     * 現在開いているページのURLをコピーする。
     */
    private async copyCurrentPageUrl(
        button: HTMLButtonElement
    ): Promise<void> {

        const url = window.location.href;

        try {

            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {

                await navigator.clipboard.writeText(url);

            } else {

                this.copyTextFallback(url);
            }

            this.showCopyResult(
                button,
                COPY_TOOLTIP_SUCCESS
            );

        } catch (error) {

            console.error(
                "リンクのコピーに失敗しました。",
                error
            );

            this.showCopyResult(
                button,
                COPY_TOOLTIP_ERROR
            );
        }
    }


    /**
     * Clipboard APIが使用できない環境用。
     */
    private copyTextFallback(
        text: string
    ): void {

        const textarea =
            document.createElement("textarea");

        textarea.value = text;

        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";

        document.body.appendChild(textarea);

        textarea.select();

        const success =
            document.execCommand("copy");

        textarea.remove();

        if (!success) {
            throw new Error(
                "フォールバックコピーに失敗しました。"
            );
        }
    }


    /**
     * コピー結果をツールチップとaria-labelへ表示する。
     *
     * 一定時間後に元へ戻す。
     */
    private showCopyResult(
        button: HTMLButtonElement,
        message: string
    ): void {

        button.dataset.tooltip = message;

        button.setAttribute(
            "aria-label",
            message
        );

        window.setTimeout(
            () => {

                button.dataset.tooltip =
                    COPY_TOOLTIP_DEFAULT;

                button.setAttribute(
                    "aria-label",
                    COPY_TOOLTIP_DEFAULT
                );

            },
            COPY_FEEDBACK_DURATION
        );
    }
}


if (!customElements.get("site-header")) {

    customElements.define(
        "site-header",
        SiteHeader
    );
}