// ============================================================
// お知らせセクション
// ============================================================
const newsList = document.getElementById('news-list');
if (newsList) {
    fetch('./news.json')
        .then(res => res.json())
        .then(data => {
            data.forEach(item => {
                const li = document.createElement('li');
                li.className = 'news-item';
                li.innerHTML = `
                    <time class="news-date">${item.date}</time>
                    <div class="news-body">
                        <p class="news-title">${item.title}</p>
                        <p class="news-text">${item.content}</p>
                    </div>`;
                newsList.appendChild(li);
            });
        })
        .catch(() => {
            newsList.innerHTML = '<li class="news-empty">現在お知らせはありません。</li>';
        });
}

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
const GAS_URL = "https://script.google.com/macros/s/AKfycby-G5Gh2tPQkcgsPnakXn4MyPQDIEfFE2Dtzb0M4mVvnsHiROSxY7yHbr2Mrn_R2Tbn/exec";
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
    calendar.appendChild(div);
  }
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

fetch(GAS_URL)
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

  const res = await fetch(GAS_URL);
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
    const res = await fetch(GAS_URL + "?action=getTimestamp");
    const { timestamp } = await res.json();
    if (lastTimestamp !== null && timestamp !== lastTimestamp) {
      const dataRes = await fetch(GAS_URL);
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
// 管理画面専用: カレンダー描画・モーダル・ステータス更新
// ============================================================
let calendarData = [];
let selectedDate = null;

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
    const loading = document.getElementById("calendar-loading");
    const wrap = document.getElementById("calendar-wrap");
    if (loading) loading.style.display = "flex";
    if (wrap) wrap.style.display = "none";

    fetch(GAS_URL)
        .then(res => res.json())
        .then(data => {
            renderCalendar(data);
            if (loading) loading.style.display = "none";
            if (wrap) wrap.style.display = "block";
        });
}

function switchTab(tab) {
    document.getElementById("tab-calendar").style.display = tab === "calendar" ? "block" : "none";
    document.getElementById("tab-reservations").style.display = tab === "reservations" ? "block" : "none";
    document.querySelectorAll(".tab-btn").forEach((btn, i) => {
        btn.classList.toggle("active", (i === 0 && tab === "calendar") || (i === 1 && tab === "reservations"));
    });
    if (tab === "reservations") loadReservations();
}

async function loadReservations() {
    const container = document.getElementById("reservation-list");
    if (!container) return;
    container.innerHTML = "<p>読み込み中...</p>";

    const res = await fetch(GAS_URL + "?action=getReservations");
    const data = await res.json();

    const grouped = {};
    data.forEach(row => {
        const date = row["来店日時"] || "日付不明";
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(row);
    });

    container.innerHTML = "";

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = "<p>予約はまだありません。</p>";
        return;
    }

    Object.keys(grouped).sort().forEach(date => {
        const dateEl = document.createElement("div");
        dateEl.className = "reservation-date";
        dateEl.textContent = date;
        container.appendChild(dateEl);

        grouped[date].forEach(r => {
            const card = document.createElement("div");
            card.className = "reservation-card";
            card.innerHTML = `
                <p>👤 <strong>${r["お名前"]}</strong> 様</p>
                <p>🕐 ${r["来店時刻"]}　👥 ${r["来店人数"]}</p>
                <p>🍣 ${r["ご利用プラン"]}</p>
                <p>📞 ${r["電話番号"]}</p>
                <p>⚠️ アレルギー：${r["食品アレルギーの確認　※ない場合は特になしと記入してください"]}</p>
            `;
            container.appendChild(card);
        });
    });
}

// 管理画面での初期データ取得
if (document.getElementById("calendar")) loadData();
