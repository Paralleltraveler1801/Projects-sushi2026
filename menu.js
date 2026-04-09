function switchMenuTab(tab, clickedBtn) {
    document.querySelectorAll('.menu-tab').forEach(btn => btn.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');

    const sections = ['nigiri', 'moriawase', 'sashimi', 'banquet', 'ippin', 'drink'];
    sections.forEach(id => {
        const el = document.getElementById('tab-' + id);
        if (el) {
            el.classList.toggle('active', id === tab);
        }
    });

    const activeSection = document.getElementById('tab-' + tab);
    if (!activeSection) return;

    const carousel = activeSection.querySelector('.menu-carousel');
    if (!carousel) return;

    // ★ _resetCarouselで内部変数ごとリセット
    if (carousel._resetCarousel) carousel._resetCarousel();
}

// 画像モーダル
let savedScrollY = 0;

function openImgModal(src, caption) {
  document.getElementById('img-modal-img').src = src;
  document.getElementById('img-modal-caption').textContent = caption;

  savedScrollY = window.scrollY || window.pageYOffset;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = '100%';

  document.getElementById('img-modal-overlay').style.display = 'block';
  document.getElementById('img-modal').classList.add('open');
}

function closeImgModal() {
  document.getElementById('img-modal-overlay').style.display = 'none';
  document.getElementById('img-modal').classList.remove('open');

  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, savedScrollY);
}

// ESCキーで閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeImgModal();
});

// ============================================================
// イベントリスナー（インラインハンドラの代替）
// ============================================================
document.querySelectorAll('.menu-tab[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchMenuTab(btn.dataset.tab, btn));
});

document.addEventListener('click', e => {
  const slide = e.target.closest('[data-img]');
  if (slide) openImgModal(slide.dataset.img, slide.dataset.caption || '');
});

document.getElementById('img-modal-overlay')?.addEventListener('click', closeImgModal);
document.getElementById('img-modal-close')?.addEventListener('click', closeImgModal);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.menu-carousel').forEach(carousel => {
        const track = carousel.querySelector('.menu-carousel-track');
        const originalSlides = Array.from(carousel.querySelectorAll('.menu-carousel-slide'));
        const dotsWrap = carousel.querySelector('.menu-carousel-dots');
        const total = originalSlides.length;
        let current = 1;
        let isTransitioning = false;
        let timer;

        const firstClone = originalSlides[0].cloneNode(true);
        const lastClone  = originalSlides[total - 1].cloneNode(true);
        track.appendChild(firstClone);
        track.insertBefore(lastClone, originalSlides[0]);

        track.style.transition = 'none';
        track.style.transform  = `translateX(-${current * 100}%)`;

        originalSlides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'menu-carousel-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => { goTo(i + 1); resetTimer(); });
            dotsWrap.appendChild(dot);
        });

        function updateDots() {
            const dotIndex = (current - 1 + total) % total;
            carousel.querySelectorAll('.menu-carousel-dot').forEach((d, i) => {
                d.classList.toggle('active', i === dotIndex);
            });
        }

        function goTo(index) {
            if (isTransitioning) return;
            isTransitioning = true;
            current = index;
            track.style.transition = 'transform 0.5s ease';
            track.style.transform = `translateX(-${current * 100}%)`;
            updateDots();
            // ← setTimeoutは削除（transitionendに一本化）
        }

        track.addEventListener('transitionend', () => {
            // クローンジャンプ
            if (current === total + 1) {
                track.style.transition = 'none';
                current = 1;
                track.style.transform = `translateX(-${current * 100}%)`;
                track.offsetHeight; // リフロー強制
            } else if (current === 0) {
                track.style.transition = 'none';
                current = total;
                track.style.transform = `translateX(-${current * 100}%)`;
                track.offsetHeight;
            }
            isTransitioning = false; // ← ここだけで解除
        });

        function startTimer() {
            timer = setInterval(() => goTo(current + 1), 5000);
        }

        function resetTimer() {
            clearInterval(timer);
            startTimer();
        }

        // ★ タブ切り替え時のリセット用メソッドをcarousel要素に登録
        carousel._resetCarousel = () => {
            clearInterval(timer);
            isTransitioning = false;
            current = 1;
            track.style.transition = 'none';
            track.style.transform = `translateX(-${current * 100}%)`;
            updateDots();
            startTimer();
        };

        carousel.querySelector('.prev').addEventListener('click', () => { goTo(current - 1); resetTimer(); });
        carousel.querySelector('.next').addEventListener('click', () => { goTo(current + 1); resetTimer(); });

        carousel.addEventListener('mouseenter', () => clearInterval(timer));
        carousel.addEventListener('mouseleave', startTimer);

        startTimer();
    });
});

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // リンクをタップしたらメニューを閉じる
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
});
