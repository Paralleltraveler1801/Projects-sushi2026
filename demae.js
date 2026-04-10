const GAS_URL      = "https://script.google.com/macros/s/AKfycbwUrrgZI6jHzAWyIiaYYEF01dgmBpm3Hf3-lvrcQqUbC-hdw74g2g1zkANt3y8wxEEFfA/exec";
const DELIVERY_FEE = 550;

// ===== 店舗座標（豊平区福住1条2丁目8-21）=====
const SHOP_LAT   = 43.0342;
const SHOP_LNG   = 141.3820;
const MAX_DIST   = 2.5; // km

// ===== メニューマスタ =====
const MENU = [
    {
        category: "お好み（寿司一貫）",
        items: [
            { name: "大トロ",     price: 870 },
            { name: "雲丹",       price: 870 },
            { name: "大牡蠣海老", price: 870 },
            { name: "中トロ",     price: 650 },
            { name: "穴子",       price: 650 },
            { name: "小肌",       price: 540 },
            { name: "平目",       price: 540 },
            { name: "〆サバ",     price: 540 },
            { name: "活ツブ",     price: 540 },
            { name: "いくら",     price: 440 },
            { name: "ずわいがに", price: 440 },
            { name: "活ホタテ",   price: 440 },
            { name: "鮪赤身",     price: 440 },
            { name: "活ホッキ",   price: 440 },
            { name: "中牡丹海老", price: 440 },
            { name: "大タマゴ",   price: 330 },
            { name: "サーモン",   price: 330 },
            { name: "甘エビ",     price: 330 },
            { name: "いか",       price: 330 },
            { name: "たこ",       price: 220 },
            { name: "とびっこ",   price: 220 },
        ]
    },
    {
        category: "握り（1人前）",
        items: [
            { name: "月握り",       price: 2650 },
            { name: "花握り",       price: 3140 },
            { name: "紫陽花握り",   price: 3140 },
            { name: "上握り",       price: 3730 },
            { name: "特上握り",     price: 4130 },
            { name: "極上握り",     price: 4420 },
            { name: "おまかせ握り", price: 4910 },
        ]
    },
    {
        category: "ちらし",
        items: [
            { name: "月ちらし",   price: 2650 },
            { name: "花ちらし",   price: 3140 },
            { name: "上ちらし",   price: 3730 },
            { name: "特上ちらし", price: 4130 },
            { name: "極上ちらし", price: 4420 },
        ]
    },
    {
        category: "お造り",
        items: [
            { name: "刺身八点盛り", price: 2700 },
        ]
    },
    {
        category: "２人前",
        items: [
            { name: "木蓮（もくれん）", price: 3540 },
            { name: "銀杏（いちょう）", price: 4720 }
        ]
    },{
        category: "３人前",
        items: [
            { name: "蘭（らん）",   price: 19150 }
        ]
    },{
        category: "５人前",
        items: [
            { name: "牡丹（ぼたん）", price: 16990 },
            { name: "椿（つばき）",   price: 19450 },
        ]
    },
    {
        category: "巻物",
        items: [
            { name: "海鮮太巻き",     price: 2490 },
            { name: "鉄火巻き",       price: 870  },
            { name: "がり鯖巻き",     price: 540  },
            { name: "トロ鉄火巻き",   price: 1180 },
            { name: "トロタク巻き",   price: 1180 },
            { name: "ネギトロ巻き",   price: 1180 },
            { name: "納豆巻き",       price: 400  },
            { name: "新香巻き",       price: 400  },
            { name: "ごぼう巻き",     price: 400  },
            { name: "たまご巻き",     price: 400  },
            { name: "かっぱ巻き",     price: 400  },
            { name: "梅しそ巻き",     price: 400  },
            { name: "かんぴょう巻き", price: 400  },
        ]
    },
    {
        category: "お料理",
        items: [
            { name: "海鮮茶わん蒸し（※時間がかかります）", price: 970 },
            { name: "牛すじ煮込み", price: 970 },
            { name: "たまご焼き",   price: 890 },
        ]
    },
    {
        category: "揚げ物",
        items: [
            { name: "北海道ザンギ",                     price: 1180 },
            { name: "ぶりぶりタコザンギ",               price: 980  },
            { name: "天ぷら盛り合わせ（海老1本）",      price: 1620 },
            { name: "上天ぷら盛り合わせ（海老2本）",    price: 1950 },
            { name: "海老天ぷら盛り合わせ（海老4本）",  price: 2160 },
        ]
    },
];

// ===== 距離計算（ハーバーサイン公式）=====
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2
            + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===== 住所 → 座標取得（Nominatim）→ 距離チェック =====
async function checkAddressInRange(address) {
    const query = encodeURIComponent(address);
    const url   = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=jp&accept-language=ja`;
    const res   = await fetch(url);
    const data  = await res.json();
    if (!data.length) return { ok: false, msg: '住所を特定できませんでした。番地まで正確にご入力ください。' };
    const dist = haversineKm(SHOP_LAT, SHOP_LNG, parseFloat(data[0].lat), parseFloat(data[0].lon));
    if (dist > MAX_DIST) {
        return { ok: false, msg: `配達エリア外です（店舗から約${dist.toFixed(1)}km）。配達は店舗から2.5km圏内のみ承っております。` };
    }
    return { ok: true };
}

// ===== 日付バリデーション =====
// お届け予定日の1ヶ月前〜前日20:00まで受付
function validateDate(dateStr) {
    const now    = new Date();
    const nowJst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
    const toStr  = d => d.toISOString().split('T')[0];
    const h = nowJst.getHours();

    // 翌日（20時以降なら明後日が最短）
    const minD = new Date(nowJst);
    minD.setDate(nowJst.getDate() + (h >= 20 ? 2 : 1));
    const minStr = toStr(minD);

    // 最大：1ヶ月後
    const maxD = new Date(nowJst);
    maxD.setMonth(nowJst.getMonth() + 1);
    const maxStr = toStr(maxD);

    if (dateStr < minStr) {
        if (h >= 20) return '20:00を過ぎたため、明後日以降の日付を選択してください。';
        return '翌日以降の日付を選択してください（前日20:00までに要注文）。';
    }
    if (dateStr > maxStr) return '1ヶ月先までの日付を選択してください。';
    return null;
}

// ===== 日付inputのmin/max設定 =====
(function initDateInput() {
    const now    = new Date();
    const nowJst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
    const toStr  = d => d.toISOString().split('T')[0];
    const h = nowJst.getHours();

    // min: 翌日（20時以降なら明後日）
    const minD = new Date(nowJst);
    minD.setDate(nowJst.getDate() + (h >= 20 ? 2 : 1));

    // max: 1ヶ月後
    const maxD = new Date(nowJst);
    maxD.setMonth(nowJst.getMonth() + 1);

    const input = document.getElementById('f-date');
    input.min   = toStr(minD);
    input.max   = toStr(maxD);
    input.value = toStr(minD);
})();

// ===== カート =====
let cart = []; // [{ name, price, qty }]

// ===== 初期化：カテゴリプルダウンを生成 =====
(function initCategorySelect() {
    const sel = document.getElementById('sel-category');
    MENU.forEach((cat, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = cat.category;
        sel.appendChild(opt);
    });
})();

// ===== カテゴリ変更 → 品目プルダウンを更新 =====
function onCategoryChange() {
    const catIdx = document.getElementById('sel-category').value;
    const itemSel = document.getElementById('sel-item');
    itemSel.innerHTML = '<option value="">品目を選択</option>';
    if (catIdx === '') return;
    MENU[parseInt(catIdx)].items.forEach((item, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${item.name}　${item.price.toLocaleString()}円`;
        itemSel.appendChild(opt);
    });
}

// ===== 品目選択時：個数を1にリセット =====
function onItemChange() {
    document.getElementById('inp-qty').value = 1;
}

// ===== カートに追加 =====
function addToCart() {
    const catIdx  = document.getElementById('sel-category').value;
    const itemIdx = document.getElementById('sel-item').value;
    const qty     = parseInt(document.getElementById('inp-qty').value) || 1;

    if (catIdx === '' || itemIdx === '') {
        alert('カテゴリと品目を選択してください。');
        return;
    }

    const item = MENU[parseInt(catIdx)].items[parseInt(itemIdx)];

    // 同じ品目があれば個数を加算
    const existing = cart.find(c => c.name === item.name);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ name: item.name, price: item.price, qty: qty });
    }

    renderCart();

    // 品目・個数をリセット
    document.getElementById('sel-item').value = '';
    document.getElementById('inp-qty').value  = 1;
}

// ===== カートから削除 =====
function removeFromCart(idx) {
    cart.splice(idx, 1);
    renderCart();
}

// ===== カート表示更新 =====
function renderCart() {
    const listEl = document.getElementById('order-list');
    const emptyEl = document.getElementById('order-list-empty');

    // 既存アイテム行を削除
    listEl.querySelectorAll('.order-list-item').forEach(el => el.remove());

    if (cart.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        document.getElementById('subtotal-display').textContent = '0円';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    let subtotal = 0;
    cart.forEach((c, i) => {
        const lineTotal = c.price * c.qty;
        subtotal += lineTotal;
        const row = document.createElement('div');
        row.className = 'order-list-item';
        row.innerHTML = `
            <span class="order-item-name">${c.name}</span>
            <span class="order-item-qty">× ${c.qty}</span>
            <span class="order-item-price">${lineTotal.toLocaleString()}円</span>
            <span class="order-item-del" data-idx="${i}" title="削除">✕</span>
        `;
        listEl.appendChild(row);
    });

    document.getElementById('subtotal-display').textContent = subtotal.toLocaleString() + '円';
}

// ===== フォーム通知表示 =====
function showNotice(msg) {
    const el = document.getElementById('form-notice');
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideNotice() {
    document.getElementById('form-notice').style.display = 'none';
}

// ===== フォーム送信（確認画面へ）=====
async function handleSubmit(event) {
    event.preventDefault();
    hideNotice();

    // 日付バリデーション
    const dateStr = document.getElementById('f-date').value;
    const dateErr = validateDate(dateStr);
    if (dateErr) { showNotice(dateErr); return; }

    if (cart.length === 0) {
        showNotice('1品以上ご選択ください。');
        return;
    }

    // 住所の距離チェック
    const submitBtn = document.getElementById('form-submit-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = '住所を確認中...';

    const address = document.getElementById('f-address').value.trim();
    try {
        const check = await checkAddressInRange(address);
        if (!check.ok) {
            showNotice(check.msg);
            return;
        }
    } catch(e) {
        // ネットワークエラー等 → ジオコーディング失敗でも続行（店舗が確認）
        console.warn('ジオコーディングエラー:', e);
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = '注文内容を確認する';
    }

    // 確認モーダルへ
    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const total    = subtotal + DELIVERY_FEE;

    const [y, mo, d] = dateStr.split('-');
    const dateLabel = `${parseInt(y)}年${parseInt(mo)}月${parseInt(d)}日`;

    document.getElementById('c-name').textContent    = document.getElementById('f-name').value.trim();
    document.getElementById('c-tel').textContent     = document.getElementById('f-tel').value.trim();
    document.getElementById('c-address').textContent = address;
    document.getElementById('c-date').textContent    = dateLabel;
    document.getElementById('c-subtotal').textContent = subtotal.toLocaleString() + '円';
    document.getElementById('c-total').textContent    = total.toLocaleString() + '円';

    document.getElementById('c-items').innerHTML = cart.map(c =>
        `<div class="confirm-item-line">
            <span>${c.name} × ${c.qty}</span>
            <span>${(c.price * c.qty).toLocaleString()}円</span>
        </div>`
    ).join('');

    document.getElementById('confirm-modal').classList.add('show');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('show');
}

// ===== 確定送信 =====
async function confirmAndSubmit() {
    const btn = document.getElementById('btn-confirm-submit');
    btn.disabled    = true;
    btn.textContent = '送信中...';

    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const total    = subtotal + DELIVERY_FEE;
    const items    = cart.map(c => ({ name: c.name, price: c.price, qty: c.qty, subtotal: c.price * c.qty }));

    const payload = {
        type:         "demae",
        name:         document.getElementById('f-name').value.trim(),
        tel:          document.getElementById('f-tel').value.trim(),
        address:      document.getElementById('f-address').value.trim(),
        deliveryDate: document.getElementById('f-date').value,
        items:        JSON.stringify(items),
        subtotal:     subtotal,
        total:        total,
        notes:        document.getElementById('f-notes').value.trim()
    };

    try {
        const res  = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();

        if (data.success) {
            closeConfirmModal();
            document.getElementById('demae-form').style.display = 'none';
            const result = document.getElementById('form-result');
            result.className     = 'success';
            result.style.display = 'block';
            result.innerHTML = `
                <strong>ご注文ありがとうございます！</strong><br>
                注文番号：<strong>${data.orderNum}</strong><br>
                30分以内に店舗より確認のお電話をいたします。<br>
                連絡がない場合は <a href="tel:0118270537">011-827-0537</a> までお電話ください。
            `;
            result.scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error(data.error || '送信に失敗しました');
        }
    } catch(err) {
        closeConfirmModal();
        const result = document.getElementById('form-result');
        result.className     = 'error';
        result.style.display = 'block';
        result.textContent   = 'エラーが発生しました。お手数ですがお電話にてご注文ください。（011-827-0537）';
    } finally {
        btn.disabled    = false;
        btn.textContent = 'この内容で注文する';
    }
}

// ===== フォームを開く =====
function openDemaeForm() {
    document.getElementById('form-section').style.display = 'block';
    document.getElementById('form-container').style.display = 'flex';
    document.getElementById('open-form-btn').style.display = 'none';
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== ハンバーガーメニュー =====
const _hamburger = document.getElementById('hamburger');
const _navLinks  = document.querySelector('.nav-links');
_hamburger.addEventListener('click', function() {
    _hamburger.classList.toggle('open');
    _navLinks.classList.toggle('open');
});
_navLinks.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
        _hamburger.classList.remove('open');
        _navLinks.classList.remove('open');
    });
});

// ===== イベントリスナー（インラインハンドラの代替）=====
document.getElementById('open-form-btn').addEventListener('click', openDemaeForm);
document.getElementById('sel-category').addEventListener('change', onCategoryChange);
document.getElementById('sel-item').addEventListener('change', onItemChange);
document.querySelector('.add-btn').addEventListener('click', addToCart);
document.getElementById('demae-form').addEventListener('submit', handleSubmit);
document.querySelector('#confirm-modal .btn-back').addEventListener('click', closeConfirmModal);
document.getElementById('btn-confirm-submit').addEventListener('click', confirmAndSubmit);

// カート削除ボタンのイベント委譲
document.getElementById('order-list').addEventListener('click', function(e) {
    const del = e.target.closest('.order-item-del');
    if (del) removeFromCart(parseInt(del.dataset.idx));
});
