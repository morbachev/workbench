/**
 * button.ts
 *
 * ボタンやポップアップメニューなど、
 * 共通UI操作を管理するファイル。
 *
 * 現在の担当:
 * - 複製メニューの開閉
 * - メニュー外クリックで閉じる
 * - Escapeキーで閉じる
 * - メニュー項目選択後にメニューを閉じる
 *
 * 実際の複製処理はduplicate.tsが担当する。
 */
/* =========================================================
   複製メニュー
   ========================================================= */
/**
 * 複製メニューを初期化する。
 *
 * この関数はメニューUIの開閉だけを担当する。
 *
 * 各複製ボタンの実際の処理は、
 * duplicate.ts側で個別に登録する。
 *
 * @param elements 必要なHTML要素
 */
export function initializeCopyMenu(elements) {
    const { menuButton, menu } = elements;
    /* =====================================================
       状態取得
       ===================================================== */
    /**
     * メニューが開いているか判定する。
     */
    function isMenuOpen() {
        return !menu.hidden;
    }
    /* =====================================================
       メニューを開く
       ===================================================== */
    /**
     * 複製メニューを開く。
     */
    function openMenu() {
        menu.hidden =
            false;
        menuButton.setAttribute("aria-expanded", "true");
        /*
         * メニュー内の最初のボタンへ
         * キーボードフォーカスを移動する。
         */
        const firstMenuButton = menu.querySelector("button");
        firstMenuButton?.focus();
    }
    /* =====================================================
       メニューを閉じる
       ===================================================== */
    /**
     * 複製メニューを閉じる。
     *
     * @param restoreFocus trueなら複製ボタンへフォーカスを戻す
     */
    function closeMenu(restoreFocus = false) {
        menu.hidden =
            true;
        menuButton.setAttribute("aria-expanded", "false");
        if (restoreFocus) {
            menuButton.focus();
        }
    }
    /* =====================================================
       メニュー切替
       ===================================================== */
    /**
     * 現在状態に応じてメニューを開閉する。
     */
    function toggleMenu() {
        if (isMenuOpen()) {
            closeMenu();
            return;
        }
        openMenu();
    }
    /* =====================================================
       複製ボタン
       ===================================================== */
    /**
     * 「複製」ボタンを押したときに、
     * メニューを開閉する。
     */
    menuButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu();
    });
    /* =====================================================
       メニュー項目
       ===================================================== */
    /**
     * メニュー内の操作ボタンが押されたら、
     * 実際の処理後にメニューを閉じる。
     *
     * 複製そのものはduplicate.tsが担当する。
     */
    menu.addEventListener("click", (event) => {
        const clickedElement = event.target;
        if (!(clickedElement instanceof Element)) {
            return;
        }
        const selectedButton = clickedElement.closest("button");
        if (!selectedButton ||
            !menu.contains(selectedButton)) {
            return;
        }
        closeMenu();
    });
    /* =====================================================
       メニュー外クリック
       ===================================================== */
    /**
     * メニュー外をクリックしたら閉じる。
     */
    document.addEventListener("click", (event) => {
        if (!isMenuOpen()) {
            return;
        }
        const clickedElement = event.target;
        if (!(clickedElement instanceof Node)) {
            return;
        }
        if (menu.contains(clickedElement) ||
            menuButton.contains(clickedElement)) {
            return;
        }
        closeMenu();
    });
    /* =====================================================
       Escape
       ===================================================== */
    /**
     * Escapeキーでメニューを閉じる。
     *
     * この場合は「複製」ボタンへ
     * キーボードフォーカスを戻す。
     */
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" ||
            !isMenuOpen()) {
            return;
        }
        closeMenu(true);
    });
}
//# sourceMappingURL=button.js.map