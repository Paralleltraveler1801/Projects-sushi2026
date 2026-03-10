// ============================================================
// お知らせセクション: news.json を読み込んでリスト表示する
// ============================================================
const newsList = document.getElementById('news-list');
if (newsList) {
    fetch('./news.json')
        .then(res => res.json())
        .then(data => {
            // 各ニュースアイテムをリスト要素として追加
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
            // 読み込み失敗時はフォールバックメッセージを表示
            newsList.innerHTML = '<li class="news-empty">現在お知らせはありません。</li>';
        });
}

// ============================================================
// ハンバーガーメニュー: SP表示時のナビ開閉制御
// ============================================================
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger && navLinks) {
    // ハンバーガーボタンクリックでメニュー開閉
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });

    // ナビリンクをクリックしたらメニューを閉じる
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });
}

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

  // 前月ボタン：今月より前は非活性
  const now = new Date();
  document.getElementById("prev-month").disabled =
    (year === now.getFullYear() && month <= now.getMonth());

  // 次月ボタン：2ヶ月先以上は非活性
  document.getElementById("next-month").disabled =
    (year > now.getFullYear() || month >= now.getMonth() + 1);

  calendar.querySelectorAll(".day, .empty").forEach(el => el.remove());

  const firstDay = new Date(year, month, 1).getDay();
  const adjust = (firstDay === 0) ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < adjust; i++) {
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

// ボタンのイベント
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

// ===== 初回データ取得 =====
fetch(GAS_URL)
  .then(res => res.json())
  .then(data => {
    publicCalendarData = data;
    renderPublicCalendar(data, currentYear, currentMonth);
  });

async function refreshCalendar() {
  const btn = document.getElementById("refresh-btn");
  const loading = document.getElementById("calendar-loading");
  const wrap = document.getElementById("calendar-wrap");

  // ぐるぐる表示・カレンダー非表示
  btn.disabled = true;
  wrap.style.display = "none";
  loading.style.display = "flex";

  const res = await fetch(GAS_URL);
  const data = await res.json();
  publicCalendarData = data;
  renderPublicCalendar(data, currentYear, currentMonth);

  // ぐるぐる消してカレンダー表示
  loading.style.display = "none";
  wrap.style.display = "block";
  btn.disabled = false;
}
fetch(GAS_URL)
  .then(res => res.json())
  .then(data => {
    publicCalendarData = data;
    renderPublicCalendar(data, currentYear, currentMonth);

    // ↓ これがないとぐるぐるが消えない！
    document.getElementById("calendar-loading").style.display = "none";
    document.getElementById("calendar-wrap").style.display = "block";
  });


