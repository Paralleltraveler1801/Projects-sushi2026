const GAS_URL = "https://script.google.com/macros/s/AKfycbwUfh6gFXK0VB815XkeB1ahYtVQfYpegawLQpnjpB_rNbbQKOHTE1CWfUx5fzE87XSE/exec";
let calendarData = [];
let selectedDate = null;

function renderCalendar(data) {
  calendarData = data;
  const calendar = document.getElementById("calendar");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  document.getElementById("month-label").textContent =
    `${year}年${month + 1}月`;

  calendar.querySelectorAll(".day, .empty").forEach(el => el.remove());

  const firstDay = new Date(year, month, 1).getDay();
  const adjust = firstDay; // 日曜始まり
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < adjust; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    calendar.appendChild(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const found = data.find(item => item.date === dateStr);
    const status = found ? found.status : "";
    const thisDate = new Date(year, month, d);
    const isPast = thisDate <= today;

    const div = document.createElement("div");
    div.className = `day${isPast ? " past" : ""}`;
    div.innerHTML = `
      <div class="num">${d}</div>
      <div class="status ${isPast ? "" : "status-" + status}">
        ${isPast ? "-" : status}
      </div>`;

    if (!isPast && found) {
      div.onclick = () => openModal(dateStr);
    }
    calendar.appendChild(div);
  }
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
  fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({ date: selectedDate, status: status })
  }).then(() => {
    closeModal();
    loadData();
  });
}

function loadData() {
  fetch(GAS_URL)
    .then(res => res.json())
    .then(data => renderCalendar(data));
}

loadData();
