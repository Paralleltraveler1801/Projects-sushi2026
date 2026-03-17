const newsListE1 = document.getElementById('news-list');

if (newsListE1) {
    fetch('./news.json')
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) {
                newsListE1.innerHTML = '<li class="news-empty">現在お知らせはありません。</li>';
                return;
            }

            data.forEach(item => {
                const li = document.createElement('li');
                li.className = 'news-item';

                const inner = `
                    <time class="news-date">${item.date}</time>
                    <div class="news-body">
                        <p class="news-title">${item.title}</p>
                        <p class="news-text">${item.content}</p>
                    </div>
                    ${item.url ? '<span class="news-arrow">›</span>' : ''}
                `;

                if (item.url) {
                    li.innerHTML = `<a href="${item.url}" class="news-link">${inner}</a>`;
                } else {
                    li.innerHTML = `<div class="news-link">${inner}</div>`;
                }

                newsListE1.appendChild(li);
            });
        })
        .catch(() => {
            newsListE1.innerHTML = '<li class="news-empty">現在お知らせはありません。</li>';
        });
}