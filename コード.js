// ===== 設定 =====
const SHOP_EMAIL = 'sushidokoro.hishita@gmail.com';
const SHOP_NAME  = '鮨処ひし田';
const SHOP_TEL   = '011-827-0537';

// ===== お客さんへの確認メール =====
function sendToCustomer(email, name, date, time, count, plan, seat) {
  const subject = `【予約受付完了】${SHOP_NAME} ご予約確認`;
  const body = `${name} 様

この度はご予約いただきありがとうございます。
以下の内容で承りました。

━━━━━━━━━━━━━━━━━━
来店日時  ：${date}  ${time}
人  数  ：${count}
ご利用プラン：${plan}
座席タイプ：${seat}
━━━━━━━━━━━━━━━━━━

ご確認のうえ、予約の変更・キャンセルは
前日までにお電話にてご連絡ください。

${SHOP_NAME}
TEL：${SHOP_TEL}

※本メールは送信専用のため、返信いただいてもお答えできません。
`;
  MailApp.sendEmail({ to: email, subject: subject, body: body });
}

// ===== お店への通知メール =====
function sendToShop(name, email, tel, date, time, count, plan, seat, now) {
  const subject = `【予約申込】${name} 様 / ${date} ${time}`;
  const body = `新しい予約申込が届きました。

━━━━━━━━━━━━━━━━━━
お名前      ：${name} 様
電話番号    ：${tel}
メール      ：${email}
来店日時    ：${date}  ${time}
人  数  ：${count}
ご利用プラン：${plan}
座席タイプ  ：${seat}
受信時刻    ：${now}
━━━━━━━━━━━━━━━━━━
`;
  MailApp.sendEmail({ to: SHOP_EMAIL, subject: subject, body: body });
}

// ===== Webアプリ用エンドポイント（GET） =====
function doGet(e) {
  const action = e.parameter.action;

  if (action === "getTimestamp") {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const timestamp = sheet.getRange("Z1").getValue();
    return ContentService.createTextOutput(
      JSON.stringify({ timestamp: timestamp })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getReservations") {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const result = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const hStr = String(h || "");
        const normalizedKey = hStr.startsWith("来店時間") ? "来店時刻" : hStr;
        const val = row[i];
        const isDate = val && typeof val.getTime === 'function';
        if (isDate) {
          if (hStr === 'タイムスタンプ') {
            obj[normalizedKey] = val.toISOString();
          } else if (hStr.startsWith('来店時間')) {
            obj[normalizedKey] = String(val.getHours()).padStart(2,'0') + '時' + String(val.getMinutes()).padStart(2,'0') + '分';
          } else {
            obj[normalizedKey] = Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy年M月d日');
          }
        } else {
          obj[normalizedKey] = String(val || '').trim();
        }
      });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "checkPrivateRoom") {
    const date = e.parameter.date;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dateCol = headers.findIndex(h => String(h).startsWith("来店日時"));
    const seatCol = headers.findIndex(h => String(h) === "座席のタイプ");
    let booked = false;
    if (dateCol !== -1 && seatCol !== -1) {
      booked = data.slice(1).some(row => {
        const rawDate = row[dateCol];
        let dateStr = "";
        if (rawDate && typeof rawDate.getTime === "function") {
          dateStr = Utilities.formatDate(rawDate, "Asia/Tokyo", "yyyy-MM-dd");
        } else {
          const m = String(rawDate).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (m) dateStr = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        }
        return dateStr === date && String(row[seatCol]).trim() === "個室";
      });
    }
    // 「個室ブロック」シートも確認
    const blockSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("個室ブロック");
    let blocked = false;
    if (blockSheet && blockSheet.getLastRow() > 1) {
      const blockData = blockSheet.getDataRange().getValues();
      blocked = blockData.slice(1).some(row => String(row[0]).trim() === date);
    }
    return ContentService.createTextOutput(JSON.stringify({ booked: booked || blocked }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getCalendarWithSeats") {
    const calSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
    const calData = calSheet.getDataRange().getValues();

    const formSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const formData = formSheet.getDataRange().getValues();
    const formHeaders = formData[0];
    const dateCol = formHeaders.findIndex(h => String(h).startsWith("来店日時"));
    const seatCol = formHeaders.findIndex(h => String(h) === "座席のタイプ");

    // 日付→予約済み座席タイプのSetを作成
    const bookedSeats = {};
    if (dateCol !== -1 && seatCol !== -1) {
      formData.slice(1).forEach(row => {
        const rawDate = row[dateCol];
        let dateStr = "";
        if (rawDate && typeof rawDate.getTime === "function") {
          dateStr = Utilities.formatDate(rawDate, "Asia/Tokyo", "yyyy-MM-dd");
        } else {
          const m = String(rawDate).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (m) dateStr = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        }
        if (dateStr) {
          if (!bookedSeats[dateStr]) bookedSeats[dateStr] = [];
          bookedSeats[dateStr].push(String(row[seatCol]).trim());
        }
      });
    }

    // 個室ブロック日を取得
    const blockSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("個室ブロック");
    const blockedDates = [];
    if (blockSheet && blockSheet.getLastRow() > 1) {
      blockSheet.getDataRange().getValues().slice(1).forEach(row => {
        if (row[0]) blockedDates.push(String(row[0]).trim());
      });
    }

    const result = calData.slice(1).map(row => {
      const dateStr = String(row[0] || "").trim();
      const status = String(row[1] || "").trim();
      let seatStatus;
      if (status === "×") {
        seatStatus = { "カウンター": "×", "小上がり": "×", "個室": "×" };
      } else {
        const seated = bookedSeats[dateStr] || [];
        const privateUnavailable = blockedDates.includes(dateStr) || seated.includes("個室");
        seatStatus = {
          "カウンター": "○",
          "小上がり": "○",
          "個室": privateUnavailable ? "×" : "○"
        };
      }
      return { date: dateStr, status: status, seatStatus: seatStatus };
    });

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "cancelReservation") {
    const timestamp = e.parameter.timestamp;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = sheet.getDataRange().getValues();
    const paramSec = Math.round(new Date(timestamp).getTime() / 1000);
    for (let i = 1; i < data.length; i++) {
      const tsA = data[i][0];
      const tsDate = (tsA instanceof Date) ? tsA : new Date(String(tsA));
      if (isNaN(tsDate.getTime())) continue;
      if (Math.round(tsDate.getTime() / 1000) === paramSec) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === "updateReservation") {
    const formSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = formSheet.getDataRange().getValues();
    const headers = data[0];
    const paramTs = String(e.parameter.ts || "");
    const paramSec = Math.round(new Date(paramTs).getTime() / 1000);

    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      const tsA = data[i][0];
      const tsDate = (tsA instanceof Date) ? tsA : new Date(String(tsA));
      if (isNaN(tsDate.getTime())) continue;
      if (Math.round(tsDate.getTime() / 1000) === paramSec) { foundRow = i; break; }
    }

    if (foundRow === -1) {
      return ContentService.createTextOutput("TIMESTAMP_NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }

    const keyMap = {
      "お名前": e.parameter.name,
      "電話番号": e.parameter.tel,
      "来店日時": e.parameter.date,
      "来店時刻": e.parameter.time,
      "来店人数": e.parameter.count,
      "ご利用プラン": e.parameter.plan,
      "座席のタイプ": e.parameter.seat,
    };

    for (let col = 0; col < headers.length; col++) {
      const hStr = String(headers[col] || "");
      const key = hStr.startsWith("来店時間") ? "来店時刻" : hStr;
      if (keyMap[key] !== undefined) {
        formSheet.getRange(foundRow + 1, col + 1).setValue(keyMap[key]);
      }
    }

    let bikoCol = headers.findIndex(h => h === "備考");
    if (bikoCol === -1) { bikoCol = headers.length; formSheet.getRange(1, bikoCol + 1).setValue("備考"); }
    const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm");
    const newLog = "[" + now + "] " + (e.parameter.memo || "編集実行");
    const existing = formSheet.getRange(foundRow + 1, bikoCol + 1).getValue() || "";
    formSheet.getRange(foundRow + 1, bikoCol + 1).setValue(existing ? existing + "\n" + newLog : newLog);
    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === "submitReservation") {
    const name  = e.parameter.name;
    const email = e.parameter.email;
    const tel   = e.parameter.tel;
    const date  = e.parameter.date;
    const time  = e.parameter.time;
    const count = e.parameter.count;
    const plan  = e.parameter.plan;
    const seat  = e.parameter.seat;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (seat === "個室") {
      const data = sheet.getDataRange().getValues();
      const dateCol = headers.findIndex(h => String(h).startsWith("来店日時"));
      const seatCol = headers.findIndex(h => String(h) === "座席のタイプ");
      if (dateCol !== -1 && seatCol !== -1) {
        const pm = String(date).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        const paramDateStr = pm ? `${pm[1]}-${String(pm[2]).padStart(2,'0')}-${String(pm[3]).padStart(2,'0')}` : "";
        const alreadyBooked = data.slice(1).some(row => {
          const rawDate = row[dateCol];
          let dateStr = "";
          if (rawDate && typeof rawDate.getTime === "function") {
            dateStr = Utilities.formatDate(rawDate, "Asia/Tokyo", "yyyy-MM-dd");
          } else {
            const m = String(rawDate).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (m) dateStr = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
          }
          return dateStr === paramDateStr && String(row[seatCol]).trim() === "個室";
        });
        const blockSheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("個室ブロック");
        let isBlocked = false;
        if (blockSheet2 && blockSheet2.getLastRow() > 1) {
          const blockData2 = blockSheet2.getDataRange().getValues();
          isBlocked = blockData2.slice(1).some(row => String(row[0]).trim() === paramDateStr);
        }
        if (alreadyBooked || isBlocked) {
          return ContentService.createTextOutput("PRIVATE_ROOM_FULL")
            .setMimeType(ContentService.MimeType.TEXT);
        }
      }
    }

    const now = new Date();
    const newRowNum = sheet.getLastRow() + 1;
    const timeColIdx = headers.findIndex(h => String(h).startsWith("来店時間"));
    if (timeColIdx !== -1) {
      sheet.getRange(newRowNum, timeColIdx + 1).setNumberFormat('@');
      SpreadsheetApp.flush();
    }
    const newRow = headers.map(h => {
      const hStr = String(h || "");
      if (hStr === "タイムスタンプ")   return now;
      if (hStr === "お名前")           return name  || "";
      if (hStr === "メールアドレス")   return email || "";
      if (hStr === "電話番号")         return tel   || "";
      if (hStr === "来店日時")         return date  || "";
      if (hStr.startsWith("来店時間")) return time  || "";
      if (hStr === "来店人数")         return count || "";
      if (hStr === "ご利用プラン")     return plan  || "";
      if (hStr === "座席のタイプ")     return seat  || "";
      return "";
    });
    sheet.getRange(newRowNum, 1, 1, newRow.length).setValues([newRow]);

    const nowStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy年M月d日 HH:mm");
    try { sendToCustomer(email, name, date, time, count, plan, seat); } catch(err) { Logger.log("顧客メールエラー: " + err.message); }
    try { sendToShop(name, email, tel, date, time, count, plan, seat, nowStr); } catch(err) { Logger.log("店舗メールエラー: " + err.message); }
    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  }

  // カレンダーデータ（デフォルト）
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
  const data = sheet.getDataRange().getValues();
  const result = data.slice(1).map(row => ({ date: row[0], status: row[1] }));
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ===== Webアプリ用エンドポイント（POST） =====
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 個室ブロック設定
  if (params.action === "blockPrivateRoom") {
    const date = String(params.date || "").trim();
    if (!date) return ContentService.createTextOutput("INVALID_DATE");
    let blockSheet = ss.getSheetByName("個室ブロック");
    if (!blockSheet) {
      blockSheet = ss.insertSheet("個室ブロック");
      blockSheet.getRange(1, 1).setValue("date");
    }
    const blockData = blockSheet.getLastRow() > 1 ? blockSheet.getDataRange().getValues() : [["date"]];
    const exists = blockData.slice(1).some(row => String(row[0]).trim() === date);
    if (!exists) blockSheet.appendRow([date]);
    ss.getActiveSheet().getRange("Z1").setValue(new Date().getTime());
    return ContentService.createTextOutput("OK");
  }

  // 個室ブロック解除
  if (params.action === "unblockPrivateRoom") {
    const date = String(params.date || "").trim();
    const blockSheet = ss.getSheetByName("個室ブロック");
    if (blockSheet && blockSheet.getLastRow() > 1) {
      const blockData = blockSheet.getDataRange().getValues();
      for (let i = blockData.length - 1; i >= 1; i--) {
        if (String(blockData[i][0]).trim() === date) {
          blockSheet.deleteRow(i + 1);
        }
      }
    }
    ss.getActiveSheet().getRange("Z1").setValue(new Date().getTime());
    return ContentService.createTextOutput("OK");
  }

  // カレンダーステータス更新（既存）
  const calendarSheet = ss.getSheetByName("calendar");
  const calData = calendarSheet.getDataRange().getValues();
  for (let i = 1; i < calData.length; i++) {
    if (calData[i][0] === params.date) {
      calendarSheet.getRange(i + 1, 2).setValue(params.status);
      break;
    }
  }
  ss.getActiveSheet().getRange("Z1").setValue(new Date().getTime());
  return ContentService.createTextOutput("OK");
}

// ============================================================
// ユーティリティ
// ============================================================
function initCalendar() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = {};
  const data = sheet.getDataRange().getValues();
  data.slice(1).forEach(row => { if (row[0]) existing[String(row[0]).trim()] = row[1]; });
  sheet.clearContents();
  sheet.getRange(1, 1).setValue("date");
  sheet.getRange(1, 2).setValue("status");
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    const status = existing[dateStr] ?? (d.getDay() === 1 ? "×" : "○");
    sheet.getRange(i + 1, 1).setValue("'" + dateStr);
    sheet.getRange(i + 1, 2).setValue(status);
  }
}

function deleteOldReservations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = data.length - 1; i >= 1; i--) {
    const raw = data[i][5];
    if (!raw) continue;
    let d;
    if (raw && typeof raw.getTime === 'function') {
      d = new Date(raw.getTime());
    } else {
      const str = String(raw).trim();
      const m = str.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
      if (!m) continue;
      d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    }
    d.setHours(0, 0, 0, 0);
    if (d < today) sheet.deleteRow(i + 1);
  }
}

function testEmail() {
  MailApp.sendEmail({
    to: "syun18hkd@gmail.com",
    subject: "テスト",
    body: "メールテスト"
  });
}
