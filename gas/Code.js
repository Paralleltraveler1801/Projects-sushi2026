// ===== 設定 v2 =====
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

// ===== 出前注文通知メール =====
function sendDemaeNotification(orderNum, name, tel, address, deliveryDate, itemsJson, subtotal, total, notes) {
  const shopEmail = SHOP_EMAIL;
  const subject = `【出前注文】注文番号 ${orderNum}`;
  let itemsArr = [];
  try { itemsArr = JSON.parse(itemsJson); } catch(e) {}
  const itemsText = itemsArr.map(function(item) {
    return '  ' + item.name + ' × ' + item.qty + '個 = ' + item.subtotal + '円';
  }).join('\n');
  const body = `新しい出前注文が届きました。

注文番号：${orderNum}
━━━━━━━━━━━━━━━━━━
注文者  ：${name} 様
電話番号：${tel}
届け先  ：${address}
お届け日：${deliveryDate}
━━━━━━━━━━━━━━━━━━
注文内容：
${itemsText}

小計    ：${subtotal}円
配送料  ：550円
合計    ：${total}円
━━━━━━━━━━━━━━━━━━
備考：${notes || 'なし'}
`;
  MailApp.sendEmail({ to: shopEmail, subject: subject, body: body });
}

// ===== Webアプリ用エンドポイント（GET） =====
function doGet(e) {
  const action = e.parameter.action;

  // 出前注文一覧取得
  if (action === "getDeliveryOrders") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("出前");
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const result = data.slice(1).map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        const key = String(h);
        const val = row[i];
        if (val instanceof Date) {
          // お届け希望日はJSTの日付文字列（YYYY-MM-DD）で返す
          if (key === "お届け希望日") {
            obj[key] = Utilities.formatDate(val, "Asia/Tokyo", "yyyy-MM-dd");
          } else {
            obj[key] = val.toISOString();
          }
        } else {
          obj[key] = String(val === null || val === undefined ? '' : val);
        }
      });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 出前注文最新タイムスタンプ（ポーリング用）
  if (action === "getLastDeliveryTimestamp") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("出前");
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ timestamp: null }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const lastRow = sheet.getLastRow();
    const tsVal = sheet.getRange(lastRow, 1).getValue();
    const ts = tsVal instanceof Date ? tsVal.toISOString() : String(tsVal || '');
    return ContentService.createTextOutput(JSON.stringify({ timestamp: ts }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 出前ステータス更新
  if (action === "updateDemaeStatus") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("出前");
    if (!sheet) {
      return ContentService.createTextOutput("NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }
    const orderNum = String(e.parameter.orderNum || "").trim();
    const status   = String(e.parameter.status   || "").trim();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderNumCol = headers.findIndex(function(h) { return h === "注文番号"; });
    const statusCol   = headers.findIndex(function(h) { return h === "ステータス"; });
    if (orderNumCol === -1 || statusCol === -1) {
      return ContentService.createTextOutput("COLUMN_NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderNumCol]).trim() === orderNum) {
        sheet.getRange(i + 1, statusCol + 1).setValue(status);
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }
    }
    return ContentService.createTextOutput("NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
  }

  // 出前注文内容更新
  if (action === "updateDemaeOrder") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("出前");
    if (!sheet) {
      return ContentService.createTextOutput("NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }
    const orderNum = String(e.parameter.orderNum || "").trim();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderNumCol = headers.findIndex(function(h) { return h === "注文番号"; });
    if (orderNumCol === -1) {
      return ContentService.createTextOutput("COLUMN_NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }
    const rowIdx = data.slice(1).findIndex(function(row) { return String(row[orderNumCol]).trim() === orderNum; });
    if (rowIdx === -1) {
      return ContentService.createTextOutput("NOT_FOUND").setMimeType(ContentService.MimeType.TEXT);
    }
    const fieldMap = { "氏名": "name", "電話番号": "tel", "住所": "address", "お届け希望日": "deliveryDate", "備考": "note", "ステータス": "status" };
    const diffs = [];
    Object.keys(fieldMap).forEach(function(field) {
      const colIdx = headers.findIndex(function(h) { return h === field; });
      const newVal = e.parameter[fieldMap[field]];
      if (colIdx === -1 || newVal === undefined) return;
      const oldVal = String(data[rowIdx + 1][colIdx] || "").trim();
      if (oldVal !== String(newVal).trim()) {
        diffs.push(field + ": " + oldVal + "→" + newVal);
      }
      sheet.getRange(rowIdx + 2, colIdx + 1).setValue(newVal);
    });

    // 編集ログ列に追記
    let logCol = headers.findIndex(function(h) { return h === "編集ログ"; });
    if (logCol === -1) {
      logCol = headers.length;
      sheet.getRange(1, logCol + 1).setValue("編集ログ");
    }
    const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm");
    const logEntry = "[" + now + "] " + (diffs.length > 0 ? diffs.join("、") : "変更なし");
    const existing = String(sheet.getRange(rowIdx + 2, logCol + 1).getValue() || "").trim();
    sheet.getRange(rowIdx + 2, logCol + 1).setValue(existing ? existing + "\n" + logEntry : logEntry);

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  }

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
            obj[normalizedKey] = String(val.getHours()).padStart(2,'00') + '時' + String(val.getMinutes()).padStart(2,'0') + '分';
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

    // 日付→席タイプ別の予約件数・合計人数を集計
    const countCol = formHeaders.findIndex(h => String(h) === "来店人数");
    const bookings = {}; // { "2026-04-10": { "カウンター": {count:1, people:3}, ... } }
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
        if (!dateStr) return;
        const seat = String(row[seatCol]).trim();
        const peopleStr = countCol !== -1 ? String(row[countCol]).trim() : "";
        const peopleMatch = peopleStr.match(/(\d+)/);
        const people = peopleMatch ? parseInt(peopleMatch[1]) : 0;
        if (!bookings[dateStr]) bookings[dateStr] = {};
        if (!bookings[dateStr][seat]) bookings[dateStr][seat] = { count: 0, people: 0 };
        bookings[dateStr][seat].count++;
        bookings[dateStr][seat].people += people;
      });
    }

    const result = calData.slice(1).map(row => {
      const rawDate = row[0];
      const dateStr = (rawDate && typeof rawDate.getTime === "function")
        ? Utilities.formatDate(rawDate, "Asia/Tokyo", "yyyy-MM-dd")
        : String(rawDate || "").trim();
      const status = String(row[1] || "").trim();
      let seatStatus;
      const seatCapacity = {};
      if (status === "×") {
        seatStatus = { "カウンター": "×", "小上がり": "×", "個室": "×" };
        [["カウンター",null],["小上がり",3],["個室",1]].forEach(([s,t]) => {
          seatCapacity[s] = { remainingPeople: 0, remainingTables: t !== null ? 0 : null };
        });
      } else {
        seatStatus = {};
        [["カウンター",7,null],["小上がり",12,3],["個室",6,1]].forEach(([s,p,t]) => {
          const b = (bookings[dateStr] && bookings[dateStr][s]) || { count: 0, people: 0 };
          const peopleFull = b.people >= p;
          const tablesFull = t !== null && b.count >= t;
          seatStatus[s] = (peopleFull || tablesFull) ? "×" : "○";
          seatCapacity[s] = {
            remainingPeople: p - b.people,
            remainingTables: t !== null ? t - b.count : null
          };
        });
      }
      // 全体ステータスを予約状況から自動算出（管理者設定の×は優先）
      let displayStatus;
      if (status === "×") {
        displayStatus = "×";
      } else {
        const allFull = Object.values(seatStatus).every(v => v === "×");
        const hasBooking = ["カウンター", "小上がり"].some(s =>
          bookings[dateStr] && bookings[dateStr][s] && bookings[dateStr][s].count > 0
        );
        displayStatus = allFull ? "×" : hasBooking ? "△" : "○";
      }
      return { date: dateStr, status: displayStatus, seatStatus: seatStatus, seatCapacity: seatCapacity };
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

    // 月曜日（定休日）は受付不可
    const pmMon = String(date).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (pmMon) {
      const d = new Date(`${pmMon[1]}-${String(pmMon[2]).padStart(2,'0')}-${String(pmMon[3]).padStart(2,'0')}T00:00:00+09:00`);
      if (d.getDay() === 1) {
        return ContentService.createTextOutput("CLOSED").setMimeType(ContentService.MimeType.TEXT);
      }
    }

    // カレンダーステータスが×の日は受付不可
    const pmDate = String(date).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (pmDate) {
      const submitDateStr = `${pmDate[1]}-${String(pmDate[2]).padStart(2,'0')}-${String(pmDate[3]).padStart(2,'0')}`;
      const calSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("calendar");
      const calRows = calSheet.getDataRange().getValues();
      const calRow = calRows.slice(1).find(row => {
        const raw = row[0];
        const rowDateStr = (raw && typeof raw.getTime === "function")
          ? Utilities.formatDate(raw, "Asia/Tokyo", "yyyy-MM-dd")
          : String(raw || "").trim();
        return rowDateStr === submitDateStr;
      });
      if (calRow && String(calRow[1]).trim() === "×") {
        return ContentService.createTextOutput("DATE_FULL").setMimeType(ContentService.MimeType.TEXT);
      }
    }

    // 席タイプ上限チェック
    {
      const SEAT_LIMITS = {
        "カウンター": { people: 7,  tables: null },
        "小上がり":   { people: 12, tables: 3    },
        "個室":       { people: 6,  tables: 1    },
      };
      const limit = SEAT_LIMITS[seat];
      if (limit) {
        const data = sheet.getDataRange().getValues();
        const dateCol = headers.findIndex(h => String(h).startsWith("来店日時"));
        const seatCol = headers.findIndex(h => String(h) === "座席のタイプ");
        const countCol = headers.findIndex(h => String(h) === "来店人数");
        const pm = String(date).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        const submitDateStr = pm ? `${pm[1]}-${String(pm[2]).padStart(2,'0')}-${String(pm[3]).padStart(2,'0')}` : "";
        let bookedCount = 0, bookedPeople = 0;
        if (submitDateStr && dateCol !== -1 && seatCol !== -1) {
          data.slice(1).forEach(row => {
            const rawDate = row[dateCol];
            let rowDateStr = "";
            if (rawDate && typeof rawDate.getTime === "function") {
              rowDateStr = Utilities.formatDate(rawDate, "Asia/Tokyo", "yyyy-MM-dd");
            } else {
              const m = String(rawDate).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
              if (m) rowDateStr = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
            }
            if (rowDateStr === submitDateStr && String(row[seatCol]).trim() === seat) {
              bookedCount++;
              const pm2 = String(countCol !== -1 ? row[countCol] : "").match(/(\d+)/);
              bookedPeople += pm2 ? parseInt(pm2[1]) : 0;
            }
          });
        }
        const newPeople = parseInt((String(count).match(/(\d+)/) || [])[1] || 0);
        const peopleFull = bookedPeople + newPeople > limit.people;
        const tablesFull = limit.tables !== null && bookedCount >= limit.tables;
        if (peopleFull || tablesFull) {
          return ContentService.createTextOutput("SEAT_FULL").setMimeType(ContentService.MimeType.TEXT);
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

  // 出前注文
  if (params.type === "demae") {
    // 出前シート取得 or 作成
    let demaeSheet = ss.getSheetByName("出前");
    const DEMAE_HEADERS = [
      "タイムスタンプ", "注文番号", "氏名", "電話番号", "住所",
      "お届け希望日",
      "注文内容", "小計", "配送料", "合計金額", "ステータス", "備考"
    ];

    // シートがなければ作成
    if (!demaeSheet) {
      demaeSheet = ss.insertSheet("出前");
    }

    // ヘッダー行がなければ追加、既存ヘッダーに不足列があれば末尾に追記
    if (demaeSheet.getLastRow() === 0) {
      demaeSheet.getRange(1, 1, 1, DEMAE_HEADERS.length).setValues([DEMAE_HEADERS]);
    } else {
      const existingHeaders = demaeSheet.getRange(1, 1, 1, demaeSheet.getLastColumn()).getValues()[0].map(function(h){ return String(h); });
      DEMAE_HEADERS.forEach(function(h) {
        if (!existingHeaders.includes(h)) {
          const newCol = existingHeaders.length + 1;
          demaeSheet.getRange(1, newCol).setValue(h);
          existingHeaders.push(h);
        }
      });
    }

    // 注文番号生成（D-YYYYMMDD-001 形式）
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMdd");
    let seq = 1;
    if (demaeSheet.getLastRow() > 1) {
      const existingData = demaeSheet.getDataRange().getValues();
      const todayOrders = existingData.slice(1).filter(function(row) {
        return String(row[1] || "").indexOf(dateStr) !== -1;
      });
      seq = todayOrders.length + 1;
    }
    const orderNum = "D-" + dateStr + "-" + String(seq).padStart(3, "0");

    // 各フィールド
    const name         = String(params.name         || "");
    const tel          = String(params.tel          || "");
    const address      = String(params.address      || "");
    const deliveryDate = String(params.deliveryDate || "");
    const items        = String(params.items        || "[]");
    const subtotal     = Number(params.subtotal     || 0);
    const delivery     = 550;
    const total        = Number(params.total        || subtotal + delivery);
    const notes        = String(params.notes        || "");

    // ヘッダー名で列を特定して行データを生成（列順に依存しない）
    const sheetHeaders = demaeSheet.getRange(1, 1, 1, demaeSheet.getLastColumn()).getValues()[0].map(function(h){ return String(h); });
    const dataMap = {
      "タイムスタンプ": now,
      "注文番号":       orderNum,
      "氏名":           name,
      "電話番号":       String(tel),
      "住所":           address,
      "お届け希望日":   deliveryDate,
      "注文内容":       items,
      "小計":           subtotal,
      "配送料":         delivery,
      "合計金額":       total,
      "ステータス":     "未対応",
      "備考":           notes
    };
    const newRow = sheetHeaders.map(function(h) { return dataMap[h] !== undefined ? dataMap[h] : ""; });
    demaeSheet.appendRow(newRow);

    // 電話番号・お届け希望日 列を文字列フォーマットに固定（自動Date変換を防ぐ）
    const lastRow      = demaeSheet.getLastRow();
    const telColIdx    = sheetHeaders.indexOf("電話番号");
    const dateColIdx   = sheetHeaders.indexOf("お届け希望日");
    if (telColIdx  !== -1) demaeSheet.getRange(lastRow, telColIdx  + 1).setNumberFormat('@');
    if (dateColIdx !== -1) demaeSheet.getRange(lastRow, dateColIdx + 1).setNumberFormat('@');

    // 通知メール送信
    try {
      sendDemaeNotification(orderNum, name, tel, address, deliveryDate, items, subtotal, total, notes);
    } catch(err) {
      Logger.log("出前通知メールエラー: " + err.message);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, orderNum: orderNum }))
      .setMimeType(ContentService.MimeType.JSON);
  }

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

function deleteOldDemaeOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("出前");
  if (!sheet || sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const dateCol = headers.findIndex(function(h) { return String(h) === "お届け希望日"; });
  if (dateCol === -1) return;

  const todayJst = new Date(Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd") + "T00:00:00+09:00");

  for (let i = data.length - 1; i >= 1; i--) {
    const raw = data[i][dateCol];
    if (!raw) continue;
    let d;
    if (raw && typeof raw.getTime === 'function') {
      // Date型の場合はJSTで解釈
      d = new Date(Utilities.formatDate(raw, "Asia/Tokyo", "yyyy-MM-dd") + "T00:00:00+09:00");
    } else {
      const m = String(raw).trim().match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
      if (!m) continue;
      d = new Date(m[1] + "-" + String(m[2]).padStart(2,"0") + "-" + String(m[3]).padStart(2,"0") + "T00:00:00+09:00");
    }
    if (d < todayJst) sheet.deleteRow(i + 1);
  }
}

// 予約・出前注文の古いデータをまとめて削除（タイマートリガーから呼ぶ）
function deleteOldData() {
  deleteOldReservations();
  deleteOldDemaeOrders();
}

function testEmail() {
  MailApp.sendEmail({
    to: "syun18hkd@gmail.com",
    subject: "テスト",
    body: "メールテスト"
  });
}
