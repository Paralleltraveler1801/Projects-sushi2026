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

