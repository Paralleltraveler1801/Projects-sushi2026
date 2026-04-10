// ============================================================
// 管理画面専用
// ============================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzZdvg1RYMFYOcq2EonTxLZdzEJ7SrVbrpuiJ_7zXOHZI50pqhpUPI1PG7LxN7Fejb6Ng/exec";

// ============================================================
// 認証管理
// ============================================================
function getAdminToken() {
    return sessionStorage.getItem("admin_token") || "";
}

// 管理者専用のGAS GETリクエストURLにトークンを付与するヘルパー
function adminUrl(base, params = {}) {
    const url = new URL(base);
    url.searchParams.set("token", getAdminToken());
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
}

// GASレスポンスが unauthorized の場合に再ログインを促す
function isUnauthorized(data) {
    return data && typeof data === "object" && data.error === "unauthorized";
}

function handleUnauthorized() {
    sessionStorage.removeItem("admin_token");
    showLoginOverlay("セッションが切れました。再ログインしてください。");
}

function showLoginOverlay(msg = "") {
    const overlay = document.getElementById("login-overlay");
    const errEl   = document.getElementById("login-error");
    if (overlay) overlay.style.display = "flex";
    if (errEl)   { errEl.textContent = msg; errEl.style.display = msg ? "block" : "none"; }
    const pwEl = document.getElementById("login-password");
    if (pwEl)  { pwEl.value = ""; pwEl.focus(); }
}

function hideLoginOverlay() {
    const overlay = document.getElementById("login-overlay");
    if (overlay) overlay.style.display = "none";
}

async function handleLogin() {
    const pwEl = document.getElementById("login-password");
    const pw   = pwEl ? pwEl.value.trim() : "";
    if (!pw) return;

    const errEl = document.getElementById("login-error");
    if (errEl) errEl.style.display = "none";

    try {
        const url = new URL(GAS_URL);
        url.searchParams.set("action", "verifyToken");
        url.searchParams.set("token", pw);
        const res  = await fetch(url.toString());
        const data = await res.json();
        if (data.ok) {
            sessionStorage.setItem("admin_token", pw);
            hideLoginOverlay();
            initAdmin();
        } else {
            if (errEl) { errEl.textContent = "パスワードが違います"; errEl.style.display = "block"; }
        }
    } catch(e) {
        if (errEl) { errEl.textContent = "通信エラーが発生しました"; errEl.style.display = "block"; }
    }
}

// 管理機能の初期化（ログイン後に呼ぶ）
function initAdmin() {
    if (document.getElementById("calendar")) loadData();

    setInterval(pollDeliveryOrders, 30000);
    setTimeout(pollDeliveryOrders, 5000);
    setInterval(pollReservations, 30000);
    setTimeout(pollReservations, 7000);

    requestNotificationPermission();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    }

    document.getElementById("tab-btn-calendar")?.addEventListener("click", () => switchTab("calendar"));
    document.getElementById("tab-btn-reservations")?.addEventListener("click", () => switchTab("reservations"));
    document.getElementById("admin-refresh-btn")?.addEventListener("click", loadData);
    document.getElementById("toggle-kaiten-track")?.addEventListener("click", toggleKaitenOnly);
    document.getElementById("toggle-demae-only-track")?.addEventListener("click", toggleDemaeOnlyFilter);
    document.getElementById("toggle-today-track")?.addEventListener("click", toggleTodayOnly);
    document.getElementById("demae-banner")?.addEventListener("click", dismissDeliveryBanner);
    document.getElementById("demae-alert-confirm-btn")?.addEventListener("click", dismissFullscreenAlertAndSwitch);
    document.getElementById("demae-fullscreen-alert")?.addEventListener("click", dismissFullscreenAlert);
    document.querySelector(".demae-alert-box")?.addEventListener("click", e => e.stopPropagation());
    document.getElementById("modal-btn-circle")?.addEventListener("click", () => update("○"));
    document.getElementById("modal-btn-triangle")?.addEventListener("click", () => update("△"));
    document.getElementById("modal-btn-cross")?.addEventListener("click", () => update("×"));
    document.getElementById("modal-btn-cancel")?.addEventListener("click", closeModal);
}

// DOMContentLoaded でトークン確認 → ログイン画面 or 管理画面初期化
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-btn")?.addEventListener("click", handleLogin);
    document.getElementById("login-password")?.addEventListener("keydown", e => {
        if (e.key === "Enter") handleLogin();
    });
    document.getElementById("logout-btn")?.addEventListener("click", () => {
        sessionStorage.removeItem("admin_token");
        showLoginOverlay();
    });

    if (getAdminToken()) {
        initAdmin();
    } else {
        showLoginOverlay();
    }
});

let calendarData = [];
let selectedDate = null;

// ============================================================
// 予約一覧用グローバル変数
// ============================================================
let editingTimestamp = null;
let originalReservation = null;
let savedScrollY = 0;

// ============================================================
// 予約一覧フィルター状態
// ============================================================
let _showKaitenOnly      = false;   // 来店予約のみ
let _showDemaeOnlyFilter = false;   // 出前注文のみ
let _showTodayOnly       = false;   // 今日のみ
let _reservationCache    = null;    // 来店予約キャッシュ

// ============================================================
// 日付・時刻フォーマット
// ============================================================
function formatDate(val) {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

function formatTime(val) {
    if (!val) return "";
    // 「17時00分」形式はそのまま返す
    if (/^\d{1,2}時\d{2}分$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

function parseJapaneseDate(str) {
    if (!str) return "";
    const m1 = String(str).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m1) return `${m1[1]}-${String(m1[2]).padStart(2,'0')}-${String(m1[3]).padStart(2,'0')}`;
    const m2 = String(str).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (m2) return `${m2[1]}-${String(m2[2]).padStart(2,'0')}-${String(m2[3]).padStart(2,'0')}`;
    const m3 = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth()+1).padStart(2,'0')}-${String(jst.getUTCDate()).padStart(2,'0')}`;
    }
    return "";
}

function parseTime(val) {
    if (!val) return "未選択";
    const timeMatch = val.match(/(\d{1,2})時(\d{2})分/);
    if (timeMatch) return `${String(timeMatch[1]).padStart(2,'0')}:${timeMatch[2]}`;
    if (/^\d{2}:\d{2}$/.test(val)) return val;
    if (/^\d{1,2}\s*時$/.test(val)) {
        const hour = val.match(/(\d{1,2})/)?.[1];
        return hour ? `${String(hour).padStart(2,'0')}:00` : val;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return `${String(jst.getUTCHours()).padStart(2,'0')}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
    }
    return val;
}

// ============================================================
// カレンダー
// ============================================================
function renderCalendar(data) {
    calendarData = data;
    const calendar = document.getElementById("calendar");
    if (!calendar) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const targetMonths = [
        { year: year, month: month },
        { year: month === 11 ? year + 1 : year, month: (month + 1) % 12 }
    ];

    document.getElementById("month-label").textContent =
        `${year}年${month + 1}月 〜 ${targetMonths[1].year}年${targetMonths[1].month + 1}月`;

    calendar.querySelectorAll(".day, .empty, .month-separator").forEach(el => el.remove());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(today.getDate() + 30);

    targetMonths.forEach(({ year: y, month: m }) => {
        const label = document.createElement("div");
        label.className = "month-separator";
        label.style = "grid-column: 1 / -1; text-align:center; padding: 12px 0 4px; font-weight:600; color:#c8a882; letter-spacing:0.1em;";
        label.textContent = `${y}年${m + 1}月`;
        calendar.appendChild(label);

        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement("div");
            empty.className = "day empty";
            calendar.appendChild(empty);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const found = data.find(item => item.date.trim() === dateStr);
            const status = found ? found.status : "";
            const thisDate = new Date(y, m, d);
            const isPast = thisDate <= today;
            const isOver = thisDate > limit;

            const div = document.createElement("div");
            div.className = `day${(isPast || isOver) ? " past" : ""}`;
            div.innerHTML = `
                <div class="num">${d}</div>
                <div class="status ${(isPast || isOver) ? "" : "status-" + status}">
                    ${(isPast || isOver) ? "-" : status}
                </div>`;

            if (!isPast && !isOver && found) {
                div.onclick = () => openModal(dateStr);
            }
            calendar.appendChild(div);
        }
    });
}

function openModal(date) {
    selectedDate = date;
    document.getElementById("modal-date").textContent = `${date} のステータス変更`;
    document.getElementById("modal").classList.add("show");
}

function closeModal() {
    document.getElementById("modal").classList.remove("show");
    selectedDate = null;
}

function update(status) {
    const dateToUpdate = selectedDate;
    closeModal();
    document.getElementById("loading").classList.add("show");

    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ date: dateToUpdate, status: status, token: getAdminToken() })
    })
    .then(res => res.text())
    .then(() => {
        const idx = calendarData.findIndex(item => item.date.trim() === dateToUpdate);
        if (idx !== -1) calendarData[idx].status = status;
        renderCalendar(calendarData);
        document.getElementById("loading").classList.remove("show");
    })
    .catch(err => {
        console.error("更新エラー:", err);
        document.getElementById("loading").classList.remove("show");
    });
}

function loadData() {
    const btn = document.getElementById("admin-refresh-btn");
    const loading = document.getElementById("calendar-loading");
    const wrap = document.getElementById("calendar-wrap");

    if (btn) btn.disabled = true;

    const isReservations = getComputedStyle(document.getElementById("tab-reservations")).display !== "none";
    if (isReservations) {
        loadReservations();
        if (btn) btn.disabled = false;
        return;
    }

    if (wrap) wrap.style.display = "none";
    if (loading) loading.style.display = "flex";

    fetch(GAS_URL + "?action=getCalendarWithSeats")
        .then(res => res.json())
        .then(data => {
            renderCalendar(data);
            if (loading) loading.style.display = "none";
            if (wrap) wrap.style.display = "block";
            if (btn) btn.disabled = false;
        })
        .catch(err => {
            console.error("読み込みエラー:", err);
            if (loading) loading.style.display = "none";
            if (wrap) wrap.style.display = "block";
            if (btn) btn.disabled = false;
        });
}

// ============================================================
// タブ切り替え
// ============================================================
function switchTab(tab) {
    document.getElementById("tab-calendar").style.display     = tab === "calendar"     ? "block" : "none";
    document.getElementById("tab-reservations").style.display = tab === "reservations" ? "block" : "none";
    document.querySelectorAll(".tab-btn").forEach((btn, i) => {
        btn.classList.toggle("active",
            (i === 0 && tab === "calendar") ||
            (i === 1 && tab === "reservations")
        );
    });
    if (tab === "reservations") loadReservations();
}

// ============================================================
// 予約一覧
// ============================================================
async function loadReservations() {
    const container = document.getElementById("reservation-list");
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex; justify-content:center; padding:40px;">
            <div class="spinner"></div>
        </div>`;

    try {
        const [resData, demaeData] = await Promise.all([
            fetch(adminUrl(GAS_URL, { action: "getReservations" })).then(r => r.json()),
            fetch(adminUrl(GAS_URL, { action: "getDeliveryOrders" })).then(r => r.json())
        ]);
        if (isUnauthorized(resData) || isUnauthorized(demaeData)) { handleUnauthorized(); return; }
        _reservationCache = resData;
        _demaeCache = demaeData;
        renderUnifiedList(resData, demaeData);
    } catch(err) {
        container.innerHTML = "<p style='color:#e57373;padding:20px;'>読み込みエラーが発生しました。</p>";
        console.error("予約一覧読み込みエラー:", err);
    }
}

// ============================================================
// フィルタースイッチ UI 更新
// ============================================================
function _updateFilterSwitchUI() {
    const setSwitch = (bgId, thumbId, labelId, isOn) => {
        const bg    = document.getElementById(bgId);
        const thumb = document.getElementById(thumbId);
        const label = document.getElementById(labelId);
        if (bg)    bg.style.background    = isOn ? "#c8a882" : "#555";
        if (thumb) thumb.style.transform  = isOn ? "translateX(20px)" : "translateX(0)";
        if (label) label.style.color      = isOn ? "#c8a882" : "#aaa";
    };
    setSwitch("toggle-kaiten-bg", "toggle-kaiten-thumb", "toggle-kaiten-label", _showKaitenOnly);
    setSwitch("toggle-demae-bg",  "toggle-demae-thumb",  "toggle-demae-label",  _showDemaeOnlyFilter);
    setSwitch("toggle-today-bg",  "toggle-today-thumb",  "toggle-today-label",  _showTodayOnly);
}

function toggleKaitenOnly() {
    _showKaitenOnly = !_showKaitenOnly;
    if (_showKaitenOnly) _showDemaeOnlyFilter = false;
    _updateFilterSwitchUI();
    if (_reservationCache !== null && _demaeCache !== null) {
        renderUnifiedList(_reservationCache, _demaeCache);
    } else {
        loadReservations();
    }
}

function toggleDemaeOnlyFilter() {
    _showDemaeOnlyFilter = !_showDemaeOnlyFilter;
    if (_showDemaeOnlyFilter) _showKaitenOnly = false;
    _updateFilterSwitchUI();
    if (_reservationCache !== null && _demaeCache !== null) {
        renderUnifiedList(_reservationCache, _demaeCache);
    } else {
        loadReservations();
    }
}

function toggleTodayOnly() {
    _showTodayOnly = !_showTodayOnly;
    _updateFilterSwitchUI();
    if (_reservationCache !== null && _demaeCache !== null) {
        renderUnifiedList(_reservationCache, _demaeCache);
    } else {
        loadReservations();
    }
}

// ============================================================
// 統合予約一覧レンダリング
// ============================================================
function renderUnifiedList(reservations, demaeOrders) {
    const container = document.getElementById("reservation-list");
    if (!container) return;
    container.innerHTML = "";

    const showBoth   = !_showKaitenOnly && !_showDemaeOnlyFilter;
    const showKaiten = showBoth || _showKaitenOnly;
    const showDemae  = showBoth || _showDemaeOnlyFilter;

    // 今日の日付（JST）
    const todayJST = new Date(new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
    todayJST.setHours(0, 0, 0, 0);
    const todayStr = `${todayJST.getFullYear()}-${String(todayJST.getMonth()+1).padStart(2,'0')}-${String(todayJST.getDate()).padStart(2,'0')}`;

    // 来店予約アイテム
    const kaitenItems = [];
    if (showKaiten && Array.isArray(reservations)) {
        reservations.forEach(r => {
            const dateKey = parseJapaneseDate(formatDate(r["来店日時"])) || "9999-99-99";
            if (_showTodayOnly && dateKey !== todayStr) return;
            kaitenItems.push({ type: "kaiten", dateKey, data: r });
        });
    }

    // 出前注文アイテム
    const demaeItems = [];
    if (showDemae && Array.isArray(demaeOrders)) {
        demaeOrders.forEach(o => {
            if (o["ステータス"] === "キャンセル") return;
            const deliveryRaw = o["お届け希望日"] || "";
            const dm = deliveryRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dm) {
                const deliveryDate = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
                if (deliveryDate < todayJST) return;
            }
            const dateKey = deliveryRaw.replace(/^(\d{4}-\d{2}-\d{2}).*/, "$1") || "9999-99-99";
            if (_showTodayOnly && !deliveryRaw.startsWith(todayStr)) return;
            demaeItems.push({ type: "demae", dateKey, data: o });
        });
    }

    // 統合・ソート（日付昇順、同日は来店→出前の順）
    const allItems = [...kaitenItems, ...demaeItems].sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
        if (a.type !== b.type) return a.type === "kaiten" ? -1 : 1;
        return 0;
    });

    if (allItems.length === 0) {
        container.innerHTML = "<p style='padding:20px;color:#aaa;'>表示する予約はありません。</p>";
        return;
    }

    let currentDateKey = null;
    allItems.forEach(item => {
        if (item.dateKey !== currentDateKey) {
            currentDateKey = item.dateKey;
            const dateEl = document.createElement("div");
            dateEl.className = "reservation-date";
            const dm = item.dateKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
            dateEl.textContent = dm
                ? `${dm[1]}年${parseInt(dm[2])}月${parseInt(dm[3])}日`
                : item.dateKey;
            container.appendChild(dateEl);
        }
        if (item.type === "kaiten") {
            _renderKaitenCard(container, item.data);
        } else {
            _renderDemaeCard(container, item.data);
        }
    });
}

function _renderKaitenCard(container, r) {
    const card = document.createElement("div");
    card.className = "reservation-card";
    card.style.borderLeft = "4px solid #5b9bd5";

    card.innerHTML = `
        <p style="font-size:0.75rem;color:#5b9bd5;font-weight:700;margin-bottom:6px;letter-spacing:0.05em;">来店予約</p>
        <p><img src="images/icon/person.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> お名前：<strong>${r["お名前"]}</strong> 様</p>
        <p><img src="images/icon/schedule.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 来店時刻：${formatTime(r["来店時刻"])}　<img src="images/icon/group.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 人数：${r["来店人数"]}</p>
        <p><img src="images/icon/restaurant.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> ご利用プラン：${r["ご利用プラン"]}</p>
        <p><img src="images/icon/phone.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 電話番号：${r["電話番号"]}</p>
        <p><img src="images/icon/event_seat.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 座席：${r["座席のタイプ"] || "-"}</p>
        ${r["備考"] ? `<p style="color:#aaa;font-size:0.85rem;margin-top:6px;"><img src="images/icon/description.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 備考：${r["備考"].replace(/\n/g, '<br>')}</p>` : ""}
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "cancel-btn";
    cancelBtn.textContent = "キャンセル";
    cancelBtn.addEventListener("click", () => cancelReservation(r["タイムスタンプ"], cancelBtn));
    card.appendChild(cancelBtn);

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => openEditModal(r));
    card.appendChild(editBtn);

    container.appendChild(card);
}

function _renderDemaeCard(container, order) {
    const card = document.createElement("div");
    card.className = "reservation-card";
    card.style.borderLeft = "4px solid #c8a882";

    const ts = order["タイムスタンプ"] ? new Date(order["タイムスタンプ"]) : null;
    const tsStr = ts && !isNaN(ts) ? ts.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "-";

    let itemLines = "－";
    try {
        const items = JSON.parse(order["注文内容"] || "[]");
        if (Array.isArray(items) && items.length) {
            itemLines = items.map(i =>
                `<span style="display:inline-block;margin-right:12px;">${i.name} ×${i.qty}</span>`
            ).join("");
        }
    } catch(e) {}

    const subtotal = isNaN(Number(order["小計"]))    ? null : Number(order["小計"]);
    const delFee   = isNaN(Number(order["配送料"]))  ? 550  : Number(order["配送料"]);
    const total    = isNaN(Number(order["合計金額"])) ? null : Number(order["合計金額"]);
    const priceStr = subtotal !== null && total !== null
        ? `小計 ${subtotal.toLocaleString()}円 ＋ 配送料 ${delFee.toLocaleString()}円 ＝ <strong>合計 ${total.toLocaleString()}円</strong>`
        : "";

    const statusColor = {
        "未対応": "#e53935", "確認中": "#fb8c00",
        "配達中": "#1e88e5", "完了": "#43a047", "キャンセル": "#757575"
    }[order["ステータス"]] || "#888";

    const _nextStatusMap   = { "未対応": "確認中", "確認中": "配達中", "配達中": "完了" };
    const _nextStatusLabel = { "確認中": "確認中にする", "配達中": "配達中にする", "完了": "完了にする" };
    const _nextStatus = _nextStatusMap[order["ステータス"]];
    const _nextBtnColor = { "確認中": "#fb8c00", "配達中": "#1e88e5", "完了": "#43a047" }[_nextStatus] || "#888";

    const progressBtn = _nextStatus
        ? `<button
            class="demae-status-btn"
            data-status="${_nextStatus}"
            data-ordernum="${order["注文番号"]}"
            style="padding:8px 18px;border:none;border-radius:6px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${_nextBtnColor};color:#fff;"
          >${_nextStatusLabel[_nextStatus]}</button>`
        : "";

    const demaeCancel = `<button
        class="demae-cancel-btn cancel-btn"
        data-ordernum="${order["注文番号"]}"
      >キャンセル</button>`;

    card.innerHTML = `
        <p style="font-size:0.75rem;color:#c8a882;font-weight:700;margin-bottom:2px;letter-spacing:0.05em;">出前注文</p>
        <p style="font-size:0.8rem;color:#aaa;margin-bottom:6px;">${tsStr}</p>
        <p><img src="images/icon/assignment.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 注文番号：<strong>${order["注文番号"] || "-"}</strong>
           &nbsp;<span class="demae-status-badge" style="background:${statusColor};color:#fff;border-radius:4px;padding:2px 8px;font-size:0.8rem;">${order["ステータス"] || "-"}</span></p>
        <p><img src="images/icon/person.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> お名前：<strong>${order["氏名"] || "-"}</strong> 様</p>
        <p><img src="images/icon/phone.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 電話番号：${order["電話番号"] || "-"}</p>
        <p><img src="images/icon/location_on.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 住所：${order["住所"] || "-"}</p>
        <p style="margin-top:6px;"><img src="images/icon/restaurant.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> ご注文内容：${itemLines}</p>
        ${priceStr ? `<p>${priceStr}</p>` : ""}
        ${order["備考"] ? `<p style="color:#aaa;font-size:0.85rem;"><img src="images/icon/description.svg" style="width:1.1em;height:1.1em;vertical-align:middle;margin-right:4px;" alt=""> 備考：${order["備考"]}</p>` : ""}
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">${progressBtn}${demaeCancel}<button class="demae-edit-btn edit-btn">編集</button></div>
    `;
    card.querySelector(".demae-edit-btn").addEventListener("click", () => openDemaeEditModal(order));
    container.appendChild(card);
}

// ============================================================
// キャンセル
// ============================================================
async function cancelReservation(timestamp, btn) {
    if (!confirm("この予約をキャンセル（削除）しますか？")) return;

    btn.disabled = true;
    btn.textContent = "処理中...";

    const url = new URL(GAS_URL);
    url.searchParams.set("action", "cancelReservation");
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("token", getAdminToken());
    const res = await fetch(url.toString());

    const text = await res.text();
    if (text === "OK") {
        alert("予約をキャンセルしました。");
        loadReservations();
    }
}

// ============================================================
// 編集モーダル
// ============================================================
function openEditModal(r) {
    editingTimestamp = r["タイムスタンプ"];
    originalReservation = r;

    const s = "width:100%; padding:10px 8px; margin-top:4px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; font-size:1rem; box-sizing:border-box;";


    const plansHTML = ["フリープラン","6000円コース","7000円コース","8000円コース"].map(p =>
        `<option value="${p}" ${r["ご利用プラン"]===p?"selected":""}>${p}</option>`).join("");

    const timeOptions = [
        "17時00分","17時30分",
        "18時00分","18時30分",
        "19時00分","19時30分",
        "20時00分"
    ].map(t => `<option value="${t}" ${r["来店時刻"]===t?"selected":""}>${t}</option>`).join("");

    document.getElementById("edit-fields").innerHTML = `
        <label style="display:block;margin-bottom:12px;color:#ddd;">お名前<br>
        <input id="e-name" type="text" value="${r["お名前"]||""}" style="${s}"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">電話番号<br>
        <input id="e-tel" type="tel" value="${r["電話番号"]||""}" style="${s}"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">来店日<br>
        <input id="e-date" type="date" value="${parseJapaneseDate(r["来店日時"])}" style="${s} -webkit-appearance:none; appearance:none; height:44px; line-height:44px;"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">来店時刻<br>
            <select id="e-time" style="${s}">
                <option value="">時刻を選択</option>
                ${timeOptions}
            </select>
        </label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">来店人数<br>
        <select id="e-count" style="${s}">
            <option value="">人数を選択してください</option>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}名" ${r["来店人数"]===n+"名"?"selected":""}>${n}名</option>`).join("")}
        </select></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">ご利用プラン<br>
        <select id="e-plan" style="${s}">${plansHTML}</select></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">座席タイプ<br>
        <select id="e-seat" style="${s}">
            <option value="カウンター" ${r["座席のタイプ"]==="カウンター"?"selected":""}>カウンター</option>
            <option value="小上がり" ${r["座席のタイプ"]==="小上がり"?"selected":""}>小上がり</option>
            <option value="個室" ${r["座席のタイプ"]==="個室"?"selected":""}>個室（+880円）</option>
        </select></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">編集メモ（必須）<br>
        <textarea id="editMemo" placeholder="例：人数を3名→5名に変更" maxlength="100"
            style="width:100%;padding:10px 8px;margin-top:4px;background:#2a2a2a;color:#fff;border:1px solid #555;border-radius:6px;font-size:1rem;box-sizing:border-box;height:60px;"></textarea>
        </label>
    `;

    savedScrollY = window.scrollY || window.pageYOffset;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";

    document.getElementById("edit-overlay").style.display = "block";
    document.getElementById("edit-modal").style.display = "block";

    document.getElementById("edit-save-btn").onclick = saveEdit;
    document.getElementById("edit-close-btn").onclick = closeEditModal;
}

function closeEditModal() {
    document.getElementById("edit-overlay").style.display = "none";
    document.getElementById("edit-modal").style.display = "none";

    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, savedScrollY);

    editingTimestamp = null;
    originalReservation = null;
}

async function saveEdit() {
    console.log("editingTimestamp:", editingTimestamp);
    const memo = document.getElementById("editMemo").value.trim();
    if (!memo) {
        alert("編集メモを入力してください。");
        document.getElementById("editMemo").focus();
        return;
    }

    const dateVal = document.getElementById("e-date").value;
    const d = new Date(dateVal + "T00:00:00+09:00");
    const formattedDate = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

    const fields = [
        { label: "お名前",   old: originalReservation["お名前"],       now: document.getElementById("e-name").value },
        { label: "電話番号", old: originalReservation["電話番号"],     now: document.getElementById("e-tel").value },
        { label: "来店日",   old: parseJapaneseDate(originalReservation["来店日時"]), now: dateVal },
        { label: "来店時刻", old: originalReservation["来店時刻"],     now: document.getElementById("e-time").value },
        { label: "来店人数", old: originalReservation["来店人数"],     now: document.getElementById("e-count").value },
        { label: "プラン",   old: originalReservation["ご利用プラン"], now: document.getElementById("e-plan").value },
        { label: "座席",     old: originalReservation["座席のタイプ"], now: document.getElementById("e-seat").value },
    ];
    const diffs = fields
        .filter(f => String(f.old).trim() !== String(f.now).trim())
        .map(f => `${f.label}: ${f.old}→${f.now}`);

    const autoLog = diffs.length > 0 ? diffs.join("、") : "内容変更なし";
    const editMemo = `${autoLog}（${memo}）`;

    const payload = {
        action: "updateReservation",
        timestamp: editingTimestamp,
        editMemo: editMemo,
        "お名前": document.getElementById("e-name").value,
        "電話番号": document.getElementById("e-tel").value,
        "来店日時": formattedDate,
        "来店時刻": document.getElementById("e-time").value,
        "来店人数": document.getElementById("e-count").value,
        "ご利用プラン": document.getElementById("e-plan").value,
        "座席のタイプ": document.getElementById("e-seat").value,
    };

    // 個室コリジョンチェック
    const newSeat = document.getElementById("e-seat").value;
    if (newSeat === "個室") {
        const origDateStr = parseJapaneseDate(originalReservation["来店日時"]);
        const origSeat = originalReservation["座席のタイプ"];
        // 編集中の予約自身がすでに同じ日付の個室予約である場合はスキップ
        const isSelf = (origSeat === "個室" && origDateStr === dateVal);
        if (!isSelf) {
            try {
                const checkRes = await fetch(`${GAS_URL}?action=checkPrivateRoom&date=${dateVal}`);
                const checkData = await checkRes.json();
                if (checkData.booked) {
                    alert("この日付にはすでに個室の予約があります。他の座席タイプを選択してください。");
                    return;
                }
            } catch (e) {
                alert("個室の空き確認中にエラーが発生しました。");
                return;
            }
        }
    }

    const btn = document.getElementById("edit-save-btn");
    btn.disabled = true;
    btn.textContent = "保存中...";

    try {
        const url = new URL(GAS_URL);
        url.searchParams.set("action", "updateReservation");
        url.searchParams.set("ts", editingTimestamp);
        url.searchParams.set("memo", editMemo);
        url.searchParams.set("name", payload["お名前"]);
        url.searchParams.set("tel", payload["電話番号"]);
        url.searchParams.set("date", payload["来店日時"]);
        url.searchParams.set("time", payload["来店時刻"]);
        url.searchParams.set("count", payload["来店人数"]);
        url.searchParams.set("plan", payload["ご利用プラン"]);
        url.searchParams.set("seat", payload["座席のタイプ"]);
        url.searchParams.set("token", getAdminToken());
        const res = await fetch(url.toString());
        const text = await res.text();
        if (text.trim() === "OK") {
            alert("更新しました！");
            closeEditModal();
            loadReservations();
        } else {
            alert("更新失敗: " + text);
        }
    } catch(e) {
        alert("通信エラーが発生しました");
    } finally {
        btn.disabled = false;
        btn.textContent = "保存";
    }
}

window.openEditModal = openEditModal;

// ============================================================
// 出前注文 編集モーダル
// ============================================================
function openDemaeEditModal(order) {
    const s = "width:100%; padding:10px 8px; margin-top:4px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; font-size:1rem; box-sizing:border-box;";
    const dateVal = order["お届け希望日"] ? String(order["お届け希望日"]).replace(/^(\d{4}-\d{2}-\d{2}).*/, "$1") : "";

    document.getElementById("edit-fields").innerHTML = `
        <label style="display:block;margin-bottom:12px;color:#ddd;">お名前<br>
        <input id="de-name" type="text" value="${order["氏名"] || ""}" style="${s}"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">電話番号<br>
        <input id="de-tel" type="tel" value="${order["電話番号"] || ""}" style="${s}"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">住所<br>
        <input id="de-address" type="text" value="${order["住所"] || ""}" style="${s}"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">お届け希望日<br>
        <input id="de-date" type="date" value="${dateVal}" style="${s} -webkit-appearance:none; appearance:none; height:44px; line-height:44px;"></label>
        <label style="display:block;margin-bottom:12px;color:#ddd;">備考<br>
        <textarea id="de-note" style="width:100%;padding:10px 8px;margin-top:4px;background:#2a2a2a;color:#fff;border:1px solid #555;border-radius:6px;font-size:1rem;box-sizing:border-box;height:80px;">${order["備考"] || ""}</textarea></label>
    `;

    savedScrollY = window.scrollY || window.pageYOffset;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";

    document.getElementById("edit-overlay").style.display = "block";
    document.getElementById("edit-modal").style.display = "block";

    document.getElementById("edit-save-btn").onclick = () => saveDemaeEdit(order["注文番号"]);
    document.getElementById("edit-close-btn").onclick = closeEditModal;
}

async function saveDemaeEdit(orderNum) {
    const btn = document.getElementById("edit-save-btn");
    btn.disabled = true;
    btn.textContent = "保存中...";

    try {
        const url = new URL(GAS_URL);
        url.searchParams.set("action", "updateDemaeOrder");
        url.searchParams.set("orderNum", orderNum);
        url.searchParams.set("name",         document.getElementById("de-name").value);
        url.searchParams.set("tel",          document.getElementById("de-tel").value);
        url.searchParams.set("address",      document.getElementById("de-address").value);
        url.searchParams.set("deliveryDate", document.getElementById("de-date").value);
        url.searchParams.set("note",         document.getElementById("de-note").value);
        url.searchParams.set("token", getAdminToken());
        const res = await fetch(url.toString());
        const text = await res.text();
        if (text.trim() === "OK") {
            alert("更新しました！");
            closeEditModal();
            loadReservations();
        } else {
            alert("更新失敗: " + text);
        }
    } catch(e) {
        alert("通信エラーが発生しました");
    } finally {
        btn.disabled = false;
        btn.textContent = "保存";
    }
}

// ============================================================
// 出前注文一覧
// ============================================================
const DEMAE_STATUSES = ["未対応", "確認中", "配達中", "完了", "キャンセル"];
let _demaeCache = null; // 取得済みデータをキャッシュ

// ステータスボタンのクリックを一度だけ登録（累積防止）
document.getElementById("reservation-list").addEventListener("click", e => {
    const statusBtn = e.target.closest(".demae-status-btn");
    const cancelBtn = e.target.closest(".demae-cancel-btn");
    if (statusBtn) {
        const nextStatus = statusBtn.dataset.status;
        if (!confirm(`ステータスを「${nextStatus}」に変更しますか？`)) return;
        playUpdateSound();
        updateDemaeStatus(statusBtn.dataset.ordernum, nextStatus, statusBtn);
    } else if (cancelBtn) {
        updateDemaeStatus(cancelBtn.dataset.ordernum, "キャンセル", cancelBtn);
    }
});

// ============================================================
// 出前ステータス更新（楽観的UI更新）
// ============================================================
async function updateDemaeStatus(orderNum, status, clickedBtn) {
    const colorMap = { "未対応": "#e53935", "確認中": "#fb8c00", "配達中": "#1e88e5", "完了": "#43a047", "キャンセル": "#757575" };

    // キャンセルは確認ダイアログを挟む
    if (status === "キャンセル") {
        const ok = confirm(`注文 ${orderNum} をキャンセルしますか？\nこの操作は取り消せません。`);
        if (!ok) return;
    }

    const card = clickedBtn ? clickedBtn.closest(".reservation-card") : null;

    // --- 楽観的UI更新（即時反映） ---
    // 現在のステータスを記憶（失敗時のロールバック用）
    let prevStatus = null;
    const badge = card ? card.querySelector(".demae-status-badge") : null;
    if (badge) prevStatus = badge.textContent;

    if (status === "キャンセル") {
        // キャンセルはすぐフェードアウト
        if (card) {
            card.style.transition = "opacity 0.3s";
            card.style.opacity = "0.4";
        }
    } else if (card) {
        // バッジを即時更新
        if (badge) { badge.textContent = status; badge.style.background = colorMap[status] || "#888"; }
        // 進行ボタンを即時更新
        const _nextMap   = { "未対応": "確認中", "確認中": "配達中", "配達中": "完了" };
        const _nextLabel = { "確認中": "確認中にする", "配達中": "配達中にする", "完了": "完了にする" };
        const newNext = _nextMap[status];
        const progressBtn = card.querySelector(".demae-status-btn");
        if (progressBtn) {
            if (newNext) {
                progressBtn.dataset.status = newNext;
                progressBtn.textContent    = _nextLabel[newNext];
                progressBtn.style.background = colorMap[newNext] || "#888";
            } else {
                progressBtn.style.display = "none";
            }
        }
    }

    // ボタンを一時無効化（二重送信防止）
    if (card) card.querySelectorAll(".demae-status-btn, .demae-cancel-btn").forEach(b => b.disabled = true);

    try {
        const url = new URL(GAS_URL);
        url.searchParams.set("action", "updateDemaeStatus");
        url.searchParams.set("orderNum", orderNum);
        url.searchParams.set("status", status);
        url.searchParams.set("token", getAdminToken());
        const res  = await fetch(url.toString());
        const text = await res.text();

        if (text.trim() === "OK") {
            if (status === "キャンセル" && card) {
                card.style.opacity = "0";
                setTimeout(() => card.remove(), 300);
            } else if (card) {
                card.querySelectorAll(".demae-status-btn, .demae-cancel-btn").forEach(b => b.disabled = false);
            }
        } else {
            // 失敗 → ロールバック
            _rollbackStatus(card, badge, prevStatus, colorMap);
            alert("ステータスの更新に失敗しました: " + text);
        }
    } catch(err) {
        // 失敗 → ロールバック
        _rollbackStatus(card, badge, prevStatus, colorMap);
        alert("通信エラーが発生しました。");
        console.error(err);
    }
}

function _rollbackStatus(card, badge, prevStatus, colorMap) {
    if (!card) return;
    if (badge && prevStatus) { badge.textContent = prevStatus; badge.style.background = colorMap[prevStatus] || "#888"; }
    card.style.opacity = "1";

    const _nextMap   = { "未対応": "確認中", "確認中": "配達中", "配達中": "完了" };
    const _nextLabel = { "確認中": "確認中にする", "配達中": "配達中にする", "完了": "完了にする" };
    const origNext = _nextMap[prevStatus];
    const progressBtn = card.querySelector(".demae-status-btn");
    if (progressBtn && origNext) {
        progressBtn.dataset.status   = origNext;
        progressBtn.textContent      = _nextLabel[origNext];
        progressBtn.style.background = colorMap[origNext] || "#888";
        progressBtn.style.display    = "";
        progressBtn.disabled         = false;
    }
    const cancelBtn = card.querySelector(".demae-cancel-btn");
    if (cancelBtn) cancelBtn.disabled = false;
}

// ============================================================
// ポーリング・新着通知
// ============================================================
let _lastDeliveryTimestamp     = null;
let _lastReservationTimestamp  = null;
let _titleBlinkInterval        = null;
const ORIGINAL_TITLE       = document.title;

// ===== 音声 =====
const _alertAudio = new Audio("NSF-279-14.wav");
_alertAudio.preload = "auto";
let _isAlertPlaying = false;

// endedイベントでループ（iOSでloop=trueが信頼できないため）
_alertAudio.addEventListener("ended", () => {
    if (_isAlertPlaying) {
        _alertAudio.currentTime = 0;
        _alertAudio.play().catch(() => {});
    }
});

// iOSアンロック（_alertAudio自体をmuted=trueで無音再生してアンロック）
let _audioUnlocked = false;
function _unlockAudio() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    _alertAudio.muted = true;
    _alertAudio.play().then(() => {
        _alertAudio.pause();
        _alertAudio.currentTime = 0;
        _alertAudio.muted = false;
    }).catch(() => {});
}
document.addEventListener("touchstart", _unlockAudio, { once: true, passive: true });
document.addEventListener("click",      _unlockAudio, { once: true });

function stopAlertRepeat() {
    _isAlertPlaying = false;
    _alertAudio.pause();
    _alertAudio.currentTime = 0;
}

// 新着注文: 確認ボタンを押すまでループ再生
function playAlertSound() {
    if (_isAlertPlaying) return;
    _isAlertPlaying = true;
    _alertAudio.currentTime = 0;
    _alertAudio.play().catch(e => console.warn("play error:", e));
}

// ステータス更新音（アラートループ中は鳴らさない）
const _updateAudio = new Audio("alert.wav");
_updateAudio.preload = "auto";
function playUpdateSound() {
    if (_isAlertPlaying) return;
    _updateAudio.currentTime = 0;
    _updateAudio.play().catch(e => console.warn("play error:", e));
}

// 来店予約通知音（2回鳴らす）
const _reservationAudio = new Audio("sucess_sound.mp3");
_reservationAudio.preload = "auto";
function playReservationSound() {
    _reservationAudio.currentTime = 0;
    _reservationAudio.play().catch(e => console.warn("play error:", e));
    _reservationAudio.onended = () => {
        _reservationAudio.onended = null;
        _reservationAudio.currentTime = 0;
        _reservationAudio.play().catch(e => console.warn("play error:", e));
    };
}

// トースト通知
function showToast(message, duration = 6000) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { toast.classList.add("show"); });
    });
    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

function startTitleBlink() {
    if (_titleBlinkInterval) return;
    let blink = false;
    _titleBlinkInterval = setInterval(() => {
        document.title = blink ? "🔔 新着注文あり" : ORIGINAL_TITLE;
        blink = !blink;
    }, 1000);
}

function stopTitleBlink() {
    if (_titleBlinkInterval) {
        clearInterval(_titleBlinkInterval);
        _titleBlinkInterval = null;
    }
    document.title = ORIGINAL_TITLE;
}

function showDeliveryBanner() {
    const banner = document.getElementById("demae-banner");
    if (banner) banner.style.display = "block";
    const badge = document.getElementById("demae-badge");
    if (badge) badge.style.display = "inline";
    // 全画面アラートも表示
    showFullscreenAlert();
}

function showFullscreenAlert() {
    const el = document.getElementById("demae-fullscreen-alert");
    if (el) el.classList.add("show");
}

function dismissFullscreenAlert() {
    const el = document.getElementById("demae-fullscreen-alert");
    if (el) el.classList.remove("show");
    stopAlertRepeat();
    stopTitleBlink();
}

function dismissFullscreenAlertAndSwitch() {
    dismissFullscreenAlert();
    dismissDeliveryBanner();
}

// ===== ブラウザ通知 =====
function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function showBrowserNotification(title, body) {
    if (!("Notification" in window)) return;
    if (document.hasFocus()) return; // ページが前面にある時はシステム音が被るので出さない
    if (Notification.permission === "granted") {
        const n = new Notification(title, {
            body: body,
            icon: "/images/shop01.jpg",
            tag: "demae-new-order",   // 同じtagは重複しない
            renotify: true
        });
        n.onclick = () => {
            window.focus();
            dismissDeliveryBanner();
            n.close();
        };
    }
}

function dismissDeliveryBanner() {
    const banner = document.getElementById("demae-banner");
    if (banner) banner.style.display = "none";
    stopAlertRepeat();
    stopTitleBlink();
    // 予約一覧タブに切り替え
    switchTab("reservations");
}

async function pollDeliveryOrders() {
    try {
        const res  = await fetch(adminUrl(GAS_URL, { action: "getLastDeliveryTimestamp" }));
        const data = await res.json();
        const ts   = data.timestamp;

        if (!ts) return;

        if (_lastDeliveryTimestamp === null) {
            // 初回ポーリング: 現在の最新タイムスタンプを記録するだけ
            _lastDeliveryTimestamp = ts;
            return;
        }

        if (ts !== _lastDeliveryTimestamp && new Date(ts) > new Date(_lastDeliveryTimestamp)) {
            _lastDeliveryTimestamp = ts;
            playAlertSound();
            showToast("🍣 新しい出前注文が入りました！予約一覧タブを確認してください。");
            showDeliveryBanner();
            startTitleBlink();
            // 予約一覧タブが表示中なら即リロード
            if (getComputedStyle(document.getElementById("tab-reservations")).display !== "none") {
                loadReservations();
            }
        }
    } catch(e) {
        console.warn("ポーリングエラー:", e);
    }
}

async function pollReservations() {
    try {
        const res  = await fetch(adminUrl(GAS_URL, { action: "getLastReservationTimestamp" }));
        const data = await res.json();
        const ts   = data.timestamp;

        if (!ts) return;

        if (_lastReservationTimestamp === null) {
            _lastReservationTimestamp = ts;
            return;
        }

        if (ts !== _lastReservationTimestamp && new Date(ts) > new Date(_lastReservationTimestamp)) {
            _lastReservationTimestamp = ts;
            playReservationSound();
            showReservationBanner();
            if (getComputedStyle(document.getElementById("tab-reservations")).display !== "none") {
                loadReservations();
            }
        }
    } catch(e) {
        console.warn("予約ポーリングエラー:", e);
    }
}

function showReservationBanner() {
    const banner = document.getElementById("reservation-banner");
    if (banner) banner.style.display = "block";
}

function dismissReservationBanner() {
    const banner = document.getElementById("reservation-banner");
    if (banner) banner.style.display = "none";
    switchTab("reservations");
}

// ※ 初期化は initAdmin()（ログイン後に呼ばれる）に移動済み
