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
        if (!str) return "";
        // yyyy年M月d日
        const m1 = String(str).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (m1) return `${m1[1]}-${String(m1[2]).padStart(2,'0')}-${String(m1[3]).padStart(2,'0')}`;
        // yyyy/MM/dd
        const m2 = String(str).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (m2) return `${m2[1]}-${String(m2[2]).padStart(2,'0')}-${String(m2[3]).padStart(2,'0')}`;
        // ISO形式
        const m3 = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
        // Dateオブジェクト変換
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth()+1).padStart(2,'0')}-${String(jst.getUTCDate()).padStart(2,'0')}`;
        }
        return "";
        }

        function parseTime(val) {
        if (!val) return "未選択";
        
        // 👇 新形式「17時00分」「17時15分」対応
        const timeMatch = val.match(/(\d{1,2})時(\d{2})分/);
        if (timeMatch) {
            return `${String(timeMatch[1]).padStart(2,'0')}:${timeMatch[2]}`;
        }
        
        // すでに HH:mm 形式ならそのまま
        if (/^\d{2}:\d{2}$/.test(val)) return val;
        
        // "17 時" → "17:00"
        if (/^\d{1,2}\s*時$/.test(val)) {
            const hour = val.match(/(\d{1,2})/)?.[1];
            return hour ? `${String(hour).padStart(2,'0')}:00` : val;
        }
        
        // ISO・Date文字列
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return `${String(jst.getUTCHours()).padStart(2,'0')}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
        }
        
        console.log("parseTime未対応:", val);
        return val;
        }

        let savedScrollY = 0;
        function openEditModal(r) {
        editingTimestamp = r["タイムスタンプ"];

        const s = "width:100%; padding:10px 8px; margin-top:4px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; font-size:1rem; box-sizing:border-box;";

        const currentAllergy = (r["アレルギー製品の選択"] || "").split(",").map(v => v.trim());
        const fixedItems = ["えび","かに","卵","小麦","そば","乳製品","落花生・くるみ"];
        const otherItem = currentAllergy.find(v => !fixedItems.includes(v)) || "";

        const checkboxesHTML = fixedItems.map(item => `
            <label style="display:flex; align-items:center; gap:10px; color:#ddd; margin-bottom:10px; cursor:pointer; font-size:1rem;">
            <input type="checkbox" value="${item}" class="allergy-check"
                ${currentAllergy.includes(item) ? "checked" : ""}
                style="width:18px; height:18px; accent-color:#c8a882; flex-shrink:0;">
            ${item}
            </label>`).join("");

        const plansHTML = ["フリープラン","6000円コース","7000円コース","8000円コース"].map(p =>
            `<option value="${p}" ${r["ご利用プラン"]===p?"selected":""}>${p}</option>`).join("");

        document.getElementById("edit-fields").innerHTML = `
            <label style="display:block;margin-bottom:12px;color:#ddd;">お名前<br>
            <input id="e-name" type="text" value="${r["お名前"]||""}" style="${s}"></label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">電話番号<br>
            <input id="e-tel" type="tel" value="${r["電話番号"]||""}" style="${s}"></label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">来店日<br>
            <input id="e-date" type="date" value="${parseJapaneseDate(r["来店日時"])}" style="${s}"></label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">来店時刻<br>
                <select id="e-time" style="${s}">
                <option value="">時刻を選択</option>
                <option value="17時00分" ${r["来店時刻"] === "17時00分" ? "selected" : ""}>17時00分</option>
                <option value="17時15分" ${r["来店時刻"] === "17時15分" ? "selected" : ""}>17時15分</option>
                <option value="17時30分" ${r["来店時刻"] === "17時30分" ? "selected" : ""}>17時30分</option>
                <option value="17時45分" ${r["来店時刻"] === "17時45分" ? "selected" : ""}>17時45分</option>
                <option value="18時00分" ${r["来店時刻"] === "18時00分" ? "selected" : ""}>18時00分</option>
                <option value="18時15分" ${r["来店時刻"] === "18時15分" ? "selected" : ""}>18時15分</option>
                <option value="18時30分" ${r["来店時刻"] === "18時30分" ? "selected" : ""}>18時30分</option>
                <option value="18時45分" ${r["来店時刻"] === "18時45分" ? "selected" : ""}>18時45分</option>
                <option value="19時00分" ${r["来店時刻"] === "19時00分" ? "selected" : ""}>19時00分</option>
                <option value="19時15分" ${r["来店時刻"] === "19時15分" ? "selected" : ""}>19時15分</option>
                <option value="19時30分" ${r["来店時刻"] === "19時30分" ? "selected" : ""}>19時30分</option>
                <option value="19時45分" ${r["来店時刻"] === "19時45分" ? "selected" : ""}>19時45分</option>
                <option value="20時00分" ${r["来店時刻"] === "20時00分" ? "selected" : ""}>20時00分</option>
                </select>
                </label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">来店人数<br>
            <input id="e-count" type="text" value="${r["来店人数"]||""}" style="${s}"></label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">ご利用プラン<br>
            <select id="e-plan" style="${s}">${plansHTML}</select></label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">アレルギー<br>
            <select id="e-allergy" style="${s}">
                <option value="なし" ${r["食品アレルギーの確認"]!=="あり"?"selected":""}>なし</option>
                <option value="あり" ${r["食品アレルギーの確認"]==="あり"?"selected":""}>あり</option>
            </select></label>
            <div id="e-allergy-items-wrap" style="${r["食品アレルギーの確認"]!=="あり"?"display:none;":""}margin-bottom:12px;">
            <p style="color:#ddd;margin-bottom:8px;">アレルギー品目</p>
            ${checkboxesHTML}
            <labe style="display:flex; align-items:center; gap:10px; color:#ddd; cursor:pointer; flex-wrap:wrap;">
                <input type="checkbox" id="allergy-other-check" class="allergy-check" value="__other__"
                ${otherItem?"checked":""} style="width:18px;height:18px;accent-color:#c8a882;flex-shrink:0;">
                その他：
                <input type="text" id="allergy-other-text" value="${otherItem}" placeholder="自由入力"
                style="flex:1; min-width:100px; padding:6px 8px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:4px;">
            </label>
            <label style="display:block;margin-bottom:12px;color:#ddd;">編集メモ（任意）<br>
            <textarea id="editMemo" placeholder="例：人数を3名→5名に変更" maxlength="100" 
            style="width:100%; padding:10px 8px; margin-top:4px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; font-size:1rem; box-sizing:border-box; height:60px;"></textarea>
            </label>
            </div>
        `;

        document.getElementById("e-allergy").addEventListener("change", function() {
            document.getElementById("e-allergy-items-wrap").style.display = this.value==="あり"?"block":"none";
        });

        // 背景スクロールをロック（iOS Safari対応）
        savedScrollY = window.scrollY || window.pageYOffset;
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.width = "100%";

        // モーダル表示
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
        }

        async function saveEdit() {
        const dateVal = document.getElementById("e-date").value;
        const d = new Date(dateVal + "T00:00:00+09:00");
        const formattedDate = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

        const fields = [
            { label: "お名前",     old: originalReservation["お名前"],     now: document.getElementById("e-name").value },
            { label: "電話番号",   old: originalReservation["電話番号"],   now: document.getElementById("e-tel").value },
            { label: "来店日",     old: parseJapaneseDate(originalReservation["来店日時"]), now: dateVal },
            { label: "来店時刻",   old: originalReservation["来店時刻"],   now: document.getElementById("e-time").value },
            { label: "来店人数",   old: originalReservation["来店人数"],   now: document.getElementById("e-count").value },
            { label: "プラン",     old: originalReservation["ご利用プラン"], now: document.getElementById("e-plan").value },
        ];
        const diffs = fields
            .filter(f => String(f.old).trim() !== String(f.now).trim())
            .map(f => `${f.label}: ${f.old}→${f.now}`);

        const manualMemo = document.getElementById("editMemo").value.trim();
        const autoLog = diffs.length > 0 ? diffs.join("、") : "内容変更なし";
        const editMemo = manualMemo ? `${autoLog}（${manualMemo}）` : autoLog;
        
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
            editMemo: editMemo,
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

window.openEditModal = openEditModal;
