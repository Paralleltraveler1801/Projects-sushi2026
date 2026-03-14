// ============================================================
// 管理画面専用
// ============================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycby-G5Gh2tPQkcgsPnakXn4MyPQDIEfFE2Dtzb0M4mVvnsHiROSxY7yHbr2Mrn_R2Tbn/exec";

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
    const btn = document.getElementById("admin-refresh-btn");
    const loading = document.getElementById("calendar-loading");
    const wrap = document.getElementById("calendar-wrap");

    if (btn) btn.disabled = true;

    // 予約一覧タブが表示中なら予約一覧を更新
    const isReservations = document.getElementById("tab-reservations").style.display !== "none";
    if (isReservations) {
        loadReservations();
        if (btn) btn.disabled = false;
        return;
    }

    // カレンダータブの更新
    if (wrap) wrap.style.display = "none";
    if (loading) loading.style.display = "flex";

    fetch(GAS_URL)
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
// タブ切り替え・予約一覧
// ============================================================
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

    container.innerHTML = `
        <div style="display:flex; justify-content:center; padding:40px;">
        <div class="spinner"></div>
        </div>`;

    const res = await fetch(GAS_URL + "?action=getReservations");
    const data = await res.json();

    // ISO文字列を日本語に変換する関数
    // 日付フォーマット
    function formatDate(val) {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    // ← UTC+9に補正
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
    }

    function formatTime(val) {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    // ← UTC+9に補正
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
    }



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

    Object.keys(grouped).sort().forEach(date => {
        const dateEl = document.createElement("div");
        dateEl.className = "reservation-date";
        dateEl.textContent = date;
        container.appendChild(dateEl);

        grouped[date].forEach(r => {
        const card = document.createElement("div");
        card.className = "reservation-card";

        // onclickは使わない！
        card.innerHTML = `
            <p>👤 <strong>${r["お名前"]}</strong> 様</p>
            <p>🕐 ${formatTime(r["来店時刻"])}　👥 ${r["来店人数"]}</p>
            <p>🍣 ${r["ご利用プラン"]}</p>
            <p>📞 ${r["電話番号"]}</p>
            <p>⚠️ アレルギー：${r["食品アレルギーの確認"] === "あり"
            ? `あり（${r["アレルギー製品の選択"] || "未選択"}）`
            : "なし"}
            </p>
        `;

        // ボタンはJSで作ってaddEventListenerをつける
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "cancel-btn";
        cancelBtn.textContent = "キャンセル";
        cancelBtn.addEventListener("click", () => cancelReservation(r["タイムスタンプ"], cancelBtn));
        card.appendChild(cancelBtn);

        container.appendChild(card);
        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "編集";
        editBtn.addEventListener("click", () => openEditModal(r));
        card.appendChild(editBtn);
        });


        });
        async function cancelReservation(timestamp, btn) {
        if (!confirm("この予約をキャンセル（削除）しますか？")) return;

        console.log("送信するタイムスタンプ:", timestamp); // ← 追加

        btn.disabled = true;
        btn.textContent = "処理中...";

        const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ action: "cancelReservation", timestamp: timestamp })
        });

        const text = await res.text();
        console.log("GASの返答:", text); // ← 追加

        if (text === "OK") {
            alert("予約をキャンセルしました。");
            loadReservations();
        }
        }
        let editingTimestamp = null;

        function parseJapaneseDate(str) {
        const m = String(str).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (!m) return "";
        return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        }

        function openEditModal(r) {
        editingTimestamp = r["タイムスタンプ"];

        const s = "width:100%; padding:8px; margin-top:4px; background:#222; color:#fff; border:1px solid #555; border-radius:6px;";

        // アレルギー品目の現在値をカンマ分割して配列化
        const currentAllergy = (r["アレルギー製品の選択"] || "").split(",").map(v => v.trim());

        // その他のテキスト部分を抽出
        const otherItem = currentAllergy.find(v => !["えび","かに","卵","小麦","そば","乳製品","落花生・くるみ"].includes(v)) || "";

        const allergyItems = ["えび", "かに", "卵", "小麦", "そば", "乳製品", "落花生・くるみ"];

        const checkboxesHTML = allergyItems.map(item => `
            <label style="display:flex; align-items:center; gap:8px; color:#ddd; margin-bottom:6px; cursor:pointer;">
            <input type="checkbox" value="${item}" class="allergy-check"
                ${currentAllergy.includes(item) ? "checked" : ""}
                style="width:16px; height:16px; accent-color:#c8a882;">
            ${item}
            </label>
        `).join("");

        const plansHTML = ["フリープラン", "6000円コース", "7000円コース", "8000円コース"].map(p =>
        `<option value="${p}" ${r["ご利用プラン"] === p ? "selected" : ""}>${p}</option>`
        ).join("");


        document.getElementById("edit-fields").innerHTML = `
            <label style="display:block;margin-bottom:10px;color:#ddd;">お名前<br>
            <input id="e-name" type="text" value="${r["お名前"]||""}" style="${s}"></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">電話番号<br>
            <input id="e-tel" type="tel" value="${r["電話番号"]||""}" style="${s}"></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">来店日<br>
            <input id="e-date" type="date" value="${parseJapaneseDate(r["来店日時"])}" style="${s}"></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">来店時刻<br>
            <input id="e-time" type="time" value="${r["来店時刻"]||""}" style="${s}"></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">来店人数<br>
            <input id="e-count" type="text" value="${r["来店人数"]||""}" style="${s}"></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">ご利用プラン<br>
            <select id="e-plan" style="${s}">${plansHTML}</select></label>

            <label style="display:block;margin-bottom:10px;color:#ddd;">アレルギー<br>
            <select id="e-allergy" style="${s}">
                <option value="なし" ${r["食品アレルギーの確認"] !== "あり" ? "selected" : ""}>なし</option>
                <option value="あり" ${r["食品アレルギーの確認"] === "あり" ? "selected" : ""}>あり</option>
            </select></label>

            <div id="e-allergy-items-wrap" style="margin-bottom:10px; ${r["食品アレルギーの確認"] !== "あり" ? "display:none;" : ""}">
            <p style="color:#ddd; margin-bottom:8px;">アレルギー品目</p>
            ${checkboxesHTML}
            <label style="display:flex; align-items:center; gap:8px; color:#ddd; cursor:pointer; margin-bottom:6px;">
                <input type="checkbox" id="allergy-other-check" class="allergy-check" value="__other__"
                ${otherItem ? "checked" : ""}
                style="width:16px; height:16px; accent-color:#c8a882;">
                その他：
                <input type="text" id="allergy-other-text" value="${otherItem}"
                placeholder="自由入力"
                style="flex:1; padding:4px 8px; background:#222; color:#fff; border:1px solid #555; border-radius:4px;">
            </label>
            </div>
        `;

        // アレルギーあり/なし切り替え
        document.getElementById("e-allergy").addEventListener("change", function() {
            document.getElementById("e-allergy-items-wrap").style.display =
            this.value === "あり" ? "block" : "none";
        });

        document.getElementById("edit-modal").style.display = "flex";
        document.getElementById("edit-save-btn").onclick = saveEdit;
        document.getElementById("edit-close-btn").onclick = closeEditModal;
        }


        function closeEditModal() {
        document.getElementById("edit-modal").style.display = "none";
        editingTimestamp = null;
        }

        async function saveEdit() {
        const dateVal = document.getElementById("e-date").value;
        const d = new Date(dateVal + "T00:00:00+09:00");
        const formattedDate = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

        // チェックされた品目を収集
        const checked = [...document.querySelectorAll(".allergy-check:checked")]
            .map(cb => {
            if (cb.value === "__other__") {
                return document.getElementById("allergy-other-text").value.trim();
            }
            return cb.value;
            })
            .filter(v => v !== "");

        const payload = {
            action: "updateReservation",
            timestamp: editingTimestamp,
            "お名前": document.getElementById("e-name").value,
            "電話番号": document.getElementById("e-tel").value,
            "来店日時": formattedDate,
            "来店時刻": document.getElementById("e-time").value,
            "来店人数": document.getElementById("e-count").value,
            "ご利用プラン": document.getElementById("e-plan").value,
            "食品アレルギーの確認": document.getElementById("e-allergy").value,
            "アレルギー製品の選択": checked.join(", "),
        };

        const btn = document.querySelector("#edit-modal button");
        btn.disabled = true; btn.textContent = "保存中...";
        try {
            const res = await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
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
            btn.disabled = false; btn.textContent = "保存";
        }
        }



}
