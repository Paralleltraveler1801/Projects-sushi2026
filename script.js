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
const GAS_URL = "https://script.google.com/macros/s/AKfycbzZdvg1RYMFYOcq2EonTxLZdzEJ7SrVbrpuiJ_7zXOHZI50pqhpUPI1PG7LxN7Fejb6Ng/exec";
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
