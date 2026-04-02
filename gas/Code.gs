// ===== 設定 =====
const SHOP_EMAIL = 'sushidokoro-hishita@gmail.com';
const SHOP_NAME  = '鮨処ひし田';
const SHOP_TEL   = '011-827-0537';

// ===== フォーム送信時のメール処理（旧Googleフォーム用・残しておく） =====
function onFormSubmit(e) {
  const values = e.namedValues;

  const name  = values['お名前'][0];
  const email = values['メールアドレス'][0];
  const tel   = values['電話番号'][0];
  const date  = values['来店日時'][0];
  const time  = values['来店時間'][0];
  const count = values['来店人数'][0];
  const plan  = values['ご利用プラン'][0];
  const seat  = values['座席のタイプ'] ? values['座席のタイプ'][0] : '';

  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');

  checkReservationDeadline(values['来店日時'][0], email);
  sendToCustomer(email, name, date, time, count, plan, seat);
  sendToShop(name, email, tel, date, time, count, plan, seat, now);
}

// ===== 締め切りチェック専用関数 =====
function checkReservationDeadline(dateStr, customerEmail) {
  let reservationDate;
  if (dateStr.match(/\d{4}\/\d{2}\/\d{2}/)) {
    reservationDate = new Date(dateStr.replace(/\//g, '-'));
  } else {
    const m = dateStr.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/);
    if (m) {
      reservationDate = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
    } else return;
  }

  const deadline = new Date(reservationDate);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(20, 0, 0, 0);

  const currentTime = new Date();

  if (currentTime > deadline) {
    if (customerEmail) {
      GmailApp.sendEmail(
        customerEmail,
        '【予約受付不可】締め切りを過ぎています',
        `申し訳ございませんが、${dateStr} のご予約は\n` +
        `前日20:00までのお申し込みが必要です。\n` +
        `${SHOP_NAME}\nTEL：${SHOP_TEL}`
      );
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const flagCell = sheet.getRange(lastRow, lastCol + 1);
    flagCell.setValue('⚠️ 無効（締め切り超過）');
    flagCell.setBackground('#ffcccc');
    flagCell.setFontColor('#cc0000');
  }
}

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

// ===== Webアプリ用エンドポイント =====
function doGet(e) {
  const action = e.parameter.action;
  Logger.log("受信action: " + action);

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
            obj[normalizedKey] = Utilities.formatDate(val, 'Asia/Tokyo', 'HH時mm分');
          } else {
            obj[normalizedKey] = Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy年M月d日');
          }
        } else {
          obj[normalizedKey] = val;
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
    if (dateCol === -1 || seatCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({ booked: false }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const booked = data.slice(1).some(row => {
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
    return ContentService.createTextOutput(JSON.stringify({ booked: booked }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // カレンダーデータ（デフォルト）
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
  const data = sheet.getDataRange().getValues();
  const result = data.slice(1).map(row => ({
    date: row[0],
    status: row[1]
  }));
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== POST受信（インラインフォームからの予約） =====
// フロントエンドはURLSearchParamsでPOST送信するため e.parameter で受け取る
function doPost(e) {
  const params = e.parameter; // ← JSON.parse不要。URLSearchParamsはe.parameterで受け取る

  // 新規予約受付
  if (params.action === "submitReservation") {
    const name  = params.name;
    const email = params.email;
    const tel   = params.tel;
    const date  = params.date;
    const time  = params.time;
    const count = params.count;
    const plan  = params.plan;
    const seat  = params.seat;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 個室の重複チェック
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

        if (alreadyBooked) {
          return ContentService.createTextOutput("PRIVATE_ROOM_FULL");
        }
      }
    }

    // スプレッドシートに書き込み
    const now = new Date();
    const newRow = headers.map(h => {
      const hStr = String(h || "");
      if (hStr === "タイムスタンプ") return now;
      if (hStr === "お名前")         return name  || "";
      if (hStr === "メールアドレス") return email || "";
      if (hStr === "電話番号")       return tel   || "";
      if (hStr === "来店日時")       return date  || "";
      if (hStr.startsWith("来店時間")) return time || "";
      if (hStr === "来店人数")       return count || "";
      if (hStr === "ご利用プラン")   return plan  || "";
      if (hStr === "座席のタイプ")   return seat  || "";
      return "";
    });
    sheet.appendRow(newRow);

    // 来店時間セルをテキスト形式で強制上書き（日付型に変換されるのを防ぐ）
    const lastRow = sheet.getLastRow();
    const timeColIdx = headers.findIndex(h => String(h).startsWith("来店時間"));
    if (timeColIdx !== -1) {
      const cell = sheet.getRange(lastRow, timeColIdx + 1);
      cell.setNumberFormat('@');
      cell.setValue(time);
    }

    // メール送信
    const nowStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy年M月d日 HH:mm");
    sendToCustomer(email, name, date, time, count, plan, seat);
    sendToShop(name, email, tel, date, time, count, plan, seat, nowStr);

    return ContentService.createTextOutput("OK");
  }

  // 予約キャンセル
  if (params.action === "cancelReservation") {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const cellDate = data[i][0];
      const cellStr = cellDate instanceof Date
        ? cellDate.toISOString()
        : new Date(cellDate).toISOString();

      if (cellStr === params.timestamp) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput("OK");
      }
    }
    return ContentService.createTextOutput("OK");
  }

  // 予約更新
  if (params.action === "updateReservation") {
    const formSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
    const data = formSheet.getDataRange().getValues();
    const headers = data[0];

    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      const tsA = data[i][0];
      const tsD = data[i][3];
      const tsStrA = (tsA instanceof Date) ? tsA.toISOString() : String(tsA);
      const tsStrD = (tsD instanceof Date) ? tsD.toISOString() : String(tsD);

      if (tsStrA === params.timestamp || tsStrD === params.timestamp) {
        foundRow = i;
        break;
      }
    }

    if (foundRow === -1) {
      return ContentService.createTextOutput("TIMESTAMP_NOT_FOUND");
    }

    for (let col = 0; col < headers.length; col++) {
      const h = headers[col];
      const hStr = String(h || "");
      let normalizedKey = hStr;
      if (hStr.startsWith("来店時間")) normalizedKey = "来店時刻";
      if (params[normalizedKey] !== undefined) {
        formSheet.getRange(foundRow + 1, col + 1).setValue(params[normalizedKey]);
      }
    }

    let bikoCol = headers.findIndex(h => h === "備考");
    if (bikoCol === -1) {
      bikoCol = headers.length;
      formSheet.getRange(1, bikoCol + 1).setValue("備考");
    }

    const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm");
    const memo = params.editMemo || "編集実行";
    const newLog = "[" + now + "] " + memo;
    const existing = formSheet.getRange(foundRow + 1, bikoCol + 1).getValue() || "";
    const finalLog = existing ? existing + "\n" + newLog : newLog;
    formSheet.getRange(foundRow + 1, bikoCol + 1).setValue(finalLog);

    return ContentService.createTextOutput("OK");
  }

  // カレンダーステータス更新
  const calendarSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
  const calData = calendarSheet.getDataRange().getValues();

  for (let i = 1; i < calData.length; i++) {
    if (calData[i][0] === params.date) {
      calendarSheet.getRange(i + 1, 2).setValue(params.status);
      break;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet()
    .getActiveSheet()
    .getRange("Z1")
    .setValue(new Date().getTime());

  return ContentService.createTextOutput("OK");
}

// ============================================================
// カレンダー・その他ユーティリティ
// ============================================================
function initCalendar() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("calendar");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = {};
  const data = sheet.getDataRange().getValues();
  data.slice(1).forEach(row => {
    if (row[0]) existing[String(row[0]).trim()] = row[1];
  });

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
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("Form_Responses");
  const data = sheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = data.length - 1; i >= 1; i--) {
    const raw = data[i][3];
    if (!raw) continue;

    let d;
    if (raw && typeof raw.getTime === 'function') {
      d = new Date(raw.getTime());
    } else {
      const str = String(raw).trim();
      const m1 = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      const m2 = str.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      const m3 = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      const m = m1 || m2 || m3;
      if (!m) continue;
      d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    }

    d.setHours(0, 0, 0, 0);
    if (d < today) {
      sheet.deleteRow(i + 1);
      Logger.log("削除: " + raw);
    }
  }
}

function testGetReservations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("Form_Responses");
  const data = sheet.getDataRange().getValues();
  Logger.log(typeof data[1][1]);
  Logger.log(data[1][1]);
}

function debugTimeColumn() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form_Responses");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  Logger.log("ヘッダー: " + JSON.stringify(headers));

  if (data.length > 1) {
    headers.forEach((h, i) => {
      const val = data[1][i];
      Logger.log(`[${i}] ${h} → type: ${typeof val}, isDate: ${val instanceof Date}, raw: ${val}`);
    });
  }
}
