// ============================================================
// 管理画面専用
// ============================================================
// ============================================================
// 管理画面専用
// ============================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzZdvg1RYMFYOcq2EonTxLZdzEJ7SrVbrpuiJ_7zXOHZI50pqhpUPI1PG7LxN7Fejb6Ng/exec";

let calendarData = [];
let selectedDate = null;

// ============================================================
// 予約一覧用グローバル変数
// ============================================================
let editingTimestamp = null;
let originalReservation = null;
let savedScrollY = 0;

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
        body: JSON.stringify({ date: dateToUpdate, status: status })
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

    const isReservations = document.getElementById("tab-reservations").style.display !== "none";
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

if (document.getElementById("calendar")) loadData();

// ============================================================
// タブ切り替え
// ============================================================
function switchTab(tab) {
    document.getElementById("tab-calendar").style.display    = tab === "calendar"     ? "block" : "none";
    document.getElementById("tab-reservations").style.display = tab === "reservations" ? "block" : "none";
    document.getElementById("tab-demae").style.display       = tab === "demae"        ? "block" : "none";
    document.querySelectorAll(".tab-btn").forEach((btn, i) => {
        btn.classList.toggle("active",
            (i === 0 && tab === "calendar") ||
            (i === 1 && tab === "reservations") ||
            (i === 2 && tab === "demae")
        );
    });
    if (tab === "reservations") loadReservations();
    if (tab === "demae") loadDemaeOrders();
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

    const res = await fetch(GAS_URL + "?action=getReservations");
    const data = await res.json();

    const grouped = {};
    data.forEach(row => {
        const date = formatDate(row["来店日時"]) || "日付不明";
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(row);
    });

    container.innerHTML = "";

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = "<p>予約はまだありません。</p>";
        return;
    }

    Object.keys(grouped).sort((a, b) => {
        const da = parseJapaneseDate(a);
        const db = parseJapaneseDate(b);
        return da < db ? -1 : da > db ? 1 : 0;
    }).forEach(date => {
        const dateEl = document.createElement("div");
        dateEl.className = "reservation-date";
        dateEl.textContent = date;
        container.appendChild(dateEl);

        grouped[date].forEach(r => {
            const card = document.createElement("div");
            card.className = "reservation-card";

            card.innerHTML = `
                <p>👤 <strong>${r["お名前"]}</strong> 様</p>
                <p>🕐 ${formatTime(r["来店時刻"])}　👥 ${r["来店人数"]}</p>
                <p>🍣 ${r["ご利用プラン"]}</p>
                <p>📞 ${r["電話番号"]}</p>
                <p>🪑 座席：${r["座席のタイプ"] || "-"}</p>
                ${r["備考"] ? `<p style="color:#aaa;font-size:0.85rem;margin-top:6px;">📝 ${r["備考"].replace(/\n/g, '<br>')}</p>` : ""}
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
        });
    });
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
// 出前注文一覧
// ============================================================
const DEMAE_STATUSES = ["未対応", "確認中", "完了", "キャンセル"];
let _demaeCache = null; // 取得済みデータをキャッシュ

// 今日のみトグル
let _demaeShowTodayOnly = false;
function toggleDemaeToday() {
    _demaeShowTodayOnly = !_demaeShowTodayOnly;
    document.getElementById("demae-toggle-bg").style.background   = _demaeShowTodayOnly ? "#c8a882" : "#555";
    document.getElementById("demae-toggle-thumb").style.transform = _demaeShowTodayOnly ? "translateX(20px)" : "translateX(0)";
    document.getElementById("demae-toggle-label").style.color     = _demaeShowTodayOnly ? "#c8a882" : "#aaa";
    // キャッシュがあれば再取得せず即反映
    if (_demaeCache) {
        renderDemaeOrders(_demaeCache);
    } else {
        loadDemaeOrders();
    }
}

async function loadDemaeOrders() {
    const container = document.getElementById("demae-list");
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex; justify-content:center; padding:40px;">
            <div class="spinner"></div>
        </div>`;

    try {
        const res  = await fetch(GAS_URL + "?action=getDeliveryOrders");
        const data = await res.json();
        _demaeCache = data; // キャッシュに保存
        renderDemaeOrders(data);
    } catch(err) {
        container.innerHTML = "<p style='color:#e57373;padding:20px;'>読み込みエラーが発生しました。</p>";
        console.error("出前注文読み込みエラー:", err);
    }
}

function renderDemaeOrders(data) {
    const container = document.getElementById("demae-list");
    if (!container) return;

    container.innerHTML = "";

    if (!data.length) {
        container.innerHTML = "<p style='padding:20px;color:#aaa;'>出前注文はまだありません。</p>";
        return;
    }

    // 今日の日付（JST、時刻なし）
    const todayJST = new Date(new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
    todayJST.setHours(0, 0, 0, 0);

    // 今日の日付文字列（YYYY-MM-DD）
    const todayStr = `${todayJST.getFullYear()}-${String(todayJST.getMonth()+1).padStart(2,'0')}-${String(todayJST.getDate()).padStart(2,'0')}`;

    // キャンセル済み・お届け日翌日以降を除外してお届け希望日順に表示
    const sorted = data
            .filter(o => {
                if (o["ステータス"] === "キャンセル") return false;
                const deliveryRaw = o["お届け希望日"] || "";
                const dm = deliveryRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!dm) return true;
                const deliveryDate = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
                if (deliveryDate < todayJST) return false; // 翌日以降は非表示
                // 今日のみモード
                if (_demaeShowTodayOnly) return deliveryRaw.startsWith(todayStr);
                return true;
            })
            .sort((a, b) => {
                // お届け希望日順（昇順）、同日はタイムスタンプ昇順
                const da = a["お届け希望日"] || "";
                const db = b["お届け希望日"] || "";
                if (da !== db) return da < db ? -1 : 1;
                return new Date(a["タイムスタンプ"]) - new Date(b["タイムスタンプ"]);
            });

        if (!sorted.length) {
            container.innerHTML = "<p style='padding:20px;color:#aaa;'>出前注文はまだありません。</p>";
            return;
        }

        let currentDateKey = null;

        sorted.forEach(order => {
            // お届け希望日（YYYY-MM-DD → YYYY年M月D日）
            const deliveryDateRaw = order["お届け希望日"] || "";
            let deliveryDateStr = deliveryDateRaw;
            const dm = deliveryDateRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dm) deliveryDateStr = `${dm[1]}年${parseInt(dm[2])}月${parseInt(dm[3])}日`;

            // 日付グループヘッダー（日付が変わったら挿入）
            const dateKey = deliveryDateRaw || "日付不明";
            if (dateKey !== currentDateKey) {
                currentDateKey = dateKey;
                const dateEl = document.createElement("div");
                dateEl.className = "reservation-date";
                dateEl.textContent = `📅 お届け日：${deliveryDateStr || "日付不明"}`;
                container.appendChild(dateEl);
            }

            const card = document.createElement("div");
            card.className = "reservation-card";
            card.style.borderLeft = "4px solid #c8a882";
            card.style.marginBottom = "16px";

            // タイムスタンプ
            const ts = order["タイムスタンプ"] ? new Date(order["タイムスタンプ"]) : null;
            const tsStr = ts && !isNaN(ts) ? ts.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "-";

            // 注文内容（JSONパース。失敗時は"－"）
            let itemLines = "－";
            try {
                const items = JSON.parse(order["注文内容"] || "[]");
                if (Array.isArray(items) && items.length) {
                    itemLines = items.map(i =>
                        `<span style="display:inline-block;margin-right:12px;">${i.name} ×${i.qty}</span>`
                    ).join("");
                }
            } catch(e) { /* JSONでなければ非表示 */ }

            // 金額（数値に変換できない場合は"－"）
            const subtotal = isNaN(Number(order["小計"]))    ? null : Number(order["小計"]);
            const delFee   = isNaN(Number(order["配送料"]))  ? 550  : Number(order["配送料"]);
            const total    = isNaN(Number(order["合計金額"])) ? null : Number(order["合計金額"]);
            const priceStr = subtotal !== null && total !== null
                ? `小計 ${subtotal.toLocaleString()}円 ＋ 配送料 ${delFee.toLocaleString()}円 ＝ <strong>合計 ${total.toLocaleString()}円</strong>`
                : "";

            const statusColor = {
                "未対応": "#e53935",
                "確認中": "#fb8c00",
                "完了":   "#43a047",
                "キャンセル": "#757575"
            }[order["ステータス"]] || "#888";

            const statusButtons = DEMAE_STATUSES.map(s => {
                const btnColor = {
                    "未対応":   "#e53935",
                    "確認中":   "#fb8c00",
                    "完了":     "#43a047",
                    "キャンセル": "#757575"
                }[s] || "#888";
                const isCurrent = order["ステータス"] === s;
                return `<button
                    class="demae-status-btn"
                    data-status="${s}"
                    data-ordernum="${order["注文番号"]}"
                    style="
                        padding:6px 12px;
                        border:2px solid ${btnColor};
                        border-radius:6px;
                        font-size:0.85rem;
                        font-weight:700;
                        cursor:pointer;
                        background:${isCurrent ? btnColor : 'transparent'};
                        color:${isCurrent ? '#fff' : btnColor};
                        transition:background 0.15s, color 0.15s;
                    "
                >${s}</button>`;
            }).join("");

            card.innerHTML = `
                <p style="font-size:0.8rem;color:#aaa;margin-bottom:6px;">${tsStr}</p>
                <p>📋 <strong>${order["注文番号"] || "-"}</strong>
                   &nbsp;<span class="demae-status-badge" style="background:${statusColor};color:#fff;border-radius:4px;padding:2px 8px;font-size:0.8rem;">${order["ステータス"] || "-"}</span></p>
                <p>👤 <strong>${order["氏名"] || "-"}</strong> 様</p>
                <p>📞 ${order["電話番号"] || "-"}</p>
                <p>📍 ${order["住所"] || "-"}</p>
                <p style="margin-top:6px;">🍣 ${itemLines}</p>
                ${priceStr ? `<p>${priceStr}</p>` : ""}
                ${order["備考"] ? `<p style="color:#aaa;font-size:0.85rem;">📝 ${order["備考"]}</p>` : ""}
                <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
                    ${statusButtons}
                </div>
            `;
            container.appendChild(card);
        });

    // ステータスボタンのクリックをまとめて処理
    container.addEventListener("click", e => {
        const btn = e.target.closest(".demae-status-btn");
        if (!btn) return;
        const orderNum = btn.dataset.ordernum;
        const status   = btn.dataset.status;
        playUpdateSound();
        updateDemaeStatus(orderNum, status, btn);
    });
}

// ============================================================
// 出前ステータス更新（楽観的UI更新）
// ============================================================
async function updateDemaeStatus(orderNum, status, clickedBtn) {
    const colorMap = { "未対応": "#e53935", "確認中": "#fb8c00", "完了": "#43a047", "キャンセル": "#757575" };

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
        // ボタンを即時切り替え
        card.querySelectorAll(".demae-status-btn").forEach(b => {
            const isCurrent = b.dataset.status === status;
            const c = colorMap[b.dataset.status] || "#888";
            b.style.background = isCurrent ? c : "transparent";
            b.style.color      = isCurrent ? "#fff" : c;
        });
    }

    // ボタンを一時無効化（二重送信防止）
    if (card) card.querySelectorAll(".demae-status-btn").forEach(b => b.disabled = true);

    try {
        const url = new URL(GAS_URL);
        url.searchParams.set("action", "updateDemaeStatus");
        url.searchParams.set("orderNum", orderNum);
        url.searchParams.set("status", status);
        const res  = await fetch(url.toString());
        const text = await res.text();

        if (text.trim() === "OK") {
            if (status === "キャンセル" && card) {
                card.style.opacity = "0";
                setTimeout(() => card.remove(), 300);
            } else if (card) {
                card.querySelectorAll(".demae-status-btn").forEach(b => b.disabled = false);
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
    card.querySelectorAll(".demae-status-btn").forEach(b => {
        const isCurrent = b.dataset.status === prevStatus;
        const c = colorMap[b.dataset.status] || "#888";
        b.style.background = isCurrent ? c : "transparent";
        b.style.color      = isCurrent ? "#fff" : c;
        b.disabled = false;
    });
}

// ============================================================
// ポーリング・新着通知
// ============================================================
let _lastDeliveryTimestamp = null;
let _titleBlinkInterval    = null;
const ORIGINAL_TITLE       = document.title;

// ===== 音声（iOS対応・単一インスタンス方式）=====
// iOSはユーザー操作で一度再生しないと非同期での音声再生がブロックされる
// → 同じAudioインスタンスをアンロック済みのまま使い回す
const _alertAudio = new Audio("NSF-279-14.wav");
_alertAudio.preload = "auto";

let _audioUnlocked = false;
function _unlockAudio() {
    if (_audioUnlocked) return;
    _alertAudio.play().then(() => {
        _alertAudio.pause();
        _alertAudio.currentTime = 0;
        _audioUnlocked = true;
    }).catch(() => {});
}
document.addEventListener("touchstart", _unlockAudio, { once: true, passive: true });
document.addEventListener("click",      _unlockAudio, { once: true });

function stopAlertRepeat() {
    try {
        _alertAudio.loop = false;
        _alertAudio.pause();
        _alertAudio.currentTime = 0;
    } catch(e) {}
}

// 新着注文: ループ再生（確認ボタンを押すまで鳴り続ける）
// すでに再生中なら二重に鳴らさない
function playAlertSound() {
    if (!_alertAudio.paused) return; // 再生中はスキップ
    _alertAudio.loop = true;
    _alertAudio.currentTime = 0;
    _alertAudio.play().catch(e => console.warn("play error:", e));
}

// ステータス更新音（alert.wav・単一インスタンス）
const _updateAudio = new Audio("alert.wav");
_updateAudio.preload = "auto";
function playUpdateSound() {
    _updateAudio.currentTime = 0;
    _updateAudio.play().catch(e => console.warn("play error:", e));
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
    // 出前タブに切り替え
    switchTab("demae");
}

async function pollDeliveryOrders() {
    try {
        const res  = await fetch(GAS_URL + "?action=getLastDeliveryTimestamp");
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
            showToast("🍣 新しい出前注文が入りました！出前タブを確認してください。");
            showDeliveryBanner();
            startTitleBlink();
            showBrowserNotification("🍣 新しい出前注文が入りました", "クリックして確認する");
            // 出前タブが表示中なら即リロード
            if (document.getElementById("tab-demae").style.display !== "none") {
                loadDemaeOrders();
            }
        }
    } catch(e) {
        console.warn("ポーリングエラー:", e);
    }
}

// 30秒ごとにポーリング開始
setInterval(pollDeliveryOrders, 30000);
// 初回は5秒後（ページロード直後の通信負荷を避ける）
setTimeout(pollDeliveryOrders, 5000);

// ページ読み込み時にブラウザ通知の許可を求める
requestNotificationPermission();

// サービスワーカー登録（PWA）
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.warn('SW registration failed:', err));
}
