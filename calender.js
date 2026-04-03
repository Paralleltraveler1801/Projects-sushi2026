// ============================================================
// ハンバーガーメニュー
// ============================================================
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });
}

// ============================================================
// 公開カレンダー
// ============================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxI7DGvBG1k1RdEoEyjsYt4Wc8Iec5croDi4e_85vt4QtKBn3-5F07RZgHJzdrngsMMtA/exec";
const CALENDAR_URL = GAS_URL;
let publicCalendarData = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function renderPublicCalendar(data, year, month) {
    const calendar = document.getElementById("calendar-grid");
    if (!calendar) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(today.getDate() + 30);

    document.getElementById("month-label").textContent = `${year}年${month + 1}月`;

    const now = new Date();
    document.getElementById("prev-month").disabled =
        (year === now.getFullYear() && month <= now.getMonth());
    document.getElementById("next-month").disabled =
        (year > now.getFullYear() || month >= now.getMonth() + 1);

    calendar.querySelectorAll(".day, .empty").forEach(el => el.remove());

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "day empty";
        calendar.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const found = data.find(item => item.date.trim() === dateStr);
        const status = found ? found.status : "";
        const thisDate = new Date(year, month, d);
        const isPast = thisDate <= today;
        const isOver = thisDate > limit;

        const div = document.createElement("div");
        div.className = `day${(isPast || isOver) ? " past" : ""}`;
        div.innerHTML = `
            <div class="num">${d}</div>
            <div class="status ${(isPast || isOver) ? "" : "status-" + status}">
                ${(isPast || isOver) ? "-" : status}
            </div>`;

        // カレンダーの日付クリックでフォームの日付をセット
        if (!isPast && !isOver) {
            div.style.cursor = "pointer";
            div.addEventListener("click", () => {
                setFormDate(dateStr);
            });
        }
        calendar.appendChild(div);
    }
}

// カレンダーの日付クリック → フォームに日付をセット
function setFormDate(dateStr) {
    const dateInput = document.getElementById("f-date");
    if (!dateInput) return;

    // フォームが閉じていたら開く
    const wrap = document.getElementById("inline-form-wrap");
    if (wrap && wrap.style.display === "none") {
        toggleForm();
    }

    dateInput.value = dateStr;
    onDateChange(dateStr);

    // フォームセクションにスクロール
    document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("prev-month")?.addEventListener("click", () => {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; }
    else currentMonth--;
    renderPublicCalendar(publicCalendarData, currentYear, currentMonth);
});

document.getElementById("next-month")?.addEventListener("click", () => {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; }
    else currentMonth++;
    renderPublicCalendar(publicCalendarData, currentYear, currentMonth);
});

fetch(CALENDAR_URL)
    .then(res => res.json())
    .then(data => {
        publicCalendarData = data;
        renderPublicCalendar(data, currentYear, currentMonth);
        const loading = document.getElementById("calendar-loading");
        const wrap = document.getElementById("calendar-wrap");
        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
    });

async function refreshCalendar() {
    const btn = document.getElementById("refresh-btn");
    const loading = document.getElementById("calendar-loading");
    const wrap = document.getElementById("calendar-wrap");

    btn.disabled = true;
    wrap.style.display = "none";
    loading.style.display = "flex";

    const res = await fetch(CALENDAR_URL);
    const data = await res.json();
    publicCalendarData = data;
    renderPublicCalendar(data, currentYear, currentMonth);

    loading.style.display = "none";
    wrap.style.display = "block";
    btn.disabled = false;
}

// フラグ方式自動更新
let lastTimestamp = null;

async function checkForUpdates() {
    try {
        const res = await fetch(CALENDAR_URL + "?action=getTimestamp");
        const { timestamp } = await res.json();
        if (lastTimestamp !== null && timestamp !== lastTimestamp) {
            const dataRes = await fetch(CALENDAR_URL);
            const data = await dataRes.json();
            publicCalendarData = data;
            renderPublicCalendar(data, currentYear, currentMonth);
        }
        lastTimestamp = timestamp;
    } catch (e) {
        console.error("更新チェック失敗:", e);
    }
}

setInterval(checkForUpdates, 30 * 1000);

// ============================================================
// インライン予約フォーム
// ============================================================

// フォーム開閉
function toggleForm() {
    const wrap = document.getElementById("inline-form-wrap");
    const btn = document.getElementById("form-open-btn");
    if (!wrap) return;

    if (wrap.style.display === "none" || wrap.style.display === "") {
        wrap.style.display = "block";
        btn.textContent = "フォームを閉じる";

        // 日付の最小値を明日、最大値を30日後に設定
        const dateInput = document.getElementById("f-date");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        dateInput.min = tomorrow.toISOString().split("T")[0];
        dateInput.max = maxDate.toISOString().split("T")[0];

        wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        wrap.style.display = "none";
        btn.textContent = "フォームで予約する";
    }
}

// 日付変更時：個室の空き確認
async function onDateChange(dateStr) {
    if (!dateStr) return;

    const seatSelect = document.getElementById("f-seat");
    const seatNote = document.getElementById("seat-note");
    if (!seatSelect) return;

    // 個室オプションを一旦有効に戻す
    const privateOption = seatSelect.querySelector('option[value="個室"]');
    if (privateOption) {
        privateOption.disabled = false;
        privateOption.textContent = "個室（+880円）";
    }
    if (seatNote) seatNote.classList.remove("show");

    try {
        const res = await fetch(`${GAS_URL}?action=checkPrivateRoom&date=${dateStr}`);
        const data = await res.json();

        if (data.booked) {
            // 個室は満席 → 非活性
            if (privateOption) {
                privateOption.disabled = true;
                privateOption.textContent = "個室（満席）";
            }
            if (seatNote) seatNote.classList.add("show");

            // 個室が選択中なら空に戻す
            if (seatSelect.value === "個室") {
                seatSelect.value = "";
            }
        }
    } catch (e) {
        console.error("個室確認エラー:", e);
    }
}

// フォーム送信 → 確認モーダルを表示
function submitReserveForm(e) {
    e.preventDefault();

    const result = document.getElementById("form-result");
    result.style.display = "none";

    // 締め切りチェック（前日20時）
    const dateVal = document.getElementById("f-date").value;
    const reservationDate = new Date(dateVal + "T00:00:00+09:00");
    const deadline = new Date(reservationDate);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(20, 0, 0, 0);

    if (new Date() > deadline) {
        result.textContent = "申し訳ございません。この日付のご予約は締め切りを過ぎています（前日20:00まで）。";
        result.className = "error";
        result.style.display = "block";
        return;
    }

    // 日付を日本語形式に変換
    const d = new Date(dateVal + "T00:00:00+09:00");
    const formattedDate = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

    // 確認モーダルに値をセット
    document.getElementById("c-name").textContent  = document.getElementById("f-name").value;
    document.getElementById("c-email").textContent = document.getElementById("f-email").value;
    document.getElementById("c-tel").textContent   = document.getElementById("f-tel").value;
    document.getElementById("c-date").textContent  = formattedDate;
    document.getElementById("c-time").textContent  = document.getElementById("f-time").value;
    document.getElementById("c-count").textContent = document.getElementById("f-count").value;
    document.getElementById("c-plan").textContent  = document.getElementById("f-plan").value;
    document.getElementById("c-seat").textContent  = document.getElementById("f-seat").value;

    document.getElementById("confirm-modal").classList.add("show");
}

function closeConfirmModal() {
    document.getElementById("confirm-modal").classList.remove("show");
}

// 確認後の実際の送信
async function confirmAndSubmit() {
    const confirmBtn = document.getElementById("btn-confirm-submit");
    const result = document.getElementById("form-result");

    const dateVal = document.getElementById("f-date").value;
    const d = new Date(dateVal + "T00:00:00+09:00");
    const formattedDate = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

    const payload = {
        action: "submitReservation",
        name:  document.getElementById("f-name").value,
        email: document.getElementById("f-email").value,
        tel:   document.getElementById("f-tel").value,
        date:  formattedDate,
        time:  document.getElementById("f-time").value,
        count: document.getElementById("f-count").value,
        plan:  document.getElementById("f-plan").value,
        seat:  document.getElementById("f-seat").value,
    };

    confirmBtn.disabled = true;
    confirmBtn.textContent = "送信中...";

    try {
        const url = new URL(GAS_URL);
        Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, v));
        const res = await fetch(url.toString());
        const text = await res.text();

        closeConfirmModal();

        if (text.trim() === "OK") {
            result.textContent = "ご予約を受け付けました。確認メールをお送りしましたのでご確認ください。（迷惑メールフォルダに入る場合がございますのでご確認ください）";
            result.className = "success";
            result.style.display = "block";
            document.getElementById("reserve-form").reset();
        } else if (text.trim() === "PRIVATE_ROOM_FULL") {
            result.textContent = "申し訳ございません。選択された日の個室はすでに満席です。他の座席タイプをお選びください。";
            result.className = "error";
            result.style.display = "block";
            onDateChange(dateVal);
        } else {
            result.textContent = "送信に失敗しました。お手数ですがお電話にてご連絡ください。";
            result.className = "error";
            result.style.display = "block";
        }
    } catch (err) {
        closeConfirmModal();
        result.textContent = "通信エラーが発生しました。お手数ですがお電話にてご連絡ください。";
        result.className = "error";
        result.style.display = "block";
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "この内容で予約する";
    }
}