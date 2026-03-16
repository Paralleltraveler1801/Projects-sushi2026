function switchMenuTab(tab) {
  // タブボタン切り替え
  document.querySelectorAll('.menu-tab').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // セクション切り替え
  const sections = ['nigiri', 'moriawase', 'sashimi', 'ippin', 'drink'];
  sections.forEach(id => {
    const el = document.getElementById('tab-' + id);
    if (el) el.style.display = id === tab ? 'block' : 'none';
  });
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
  document.getElementById('img-modal').style.display = 'flex';
}

function closeImgModal() {
  document.getElementById('img-modal-overlay').style.display = 'none';
  document.getElementById('img-modal').style.display = 'none';

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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.menu-carousel').forEach(carousel => {
    const track = carousel.querySelector('.menu-carousel-track');
    const originalSlides = Array.from(carousel.querySelectorAll('.menu-carousel-slide'));
    const dotsWrap = carousel.querySelector('.menu-carousel-dots');
    const total = originalSlides.length;
    let current = 1; // クローン分で1始まり
    let isTransitioning = false;
    let timer;

    // 先頭に最後のスライドを、末尾に最初のスライドをクローンして追加
    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone  = originalSlides[total - 1].cloneNode(true);
    track.appendChild(firstClone);
    track.insertBefore(lastClone, originalSlides[0]);

    // 初期位置を1枚目（クローン除く）に合わせる
    track.style.transition = 'none';
    track.style.transform  = `translateX(-${current * 100}%)`;

    // ドット生成（オリジナル枚数分）
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

  setTimeout(() => {         // ← この3行を追加するだけ
    isTransitioning = false;
  }, 600);
    }

    // transitionEnd：端のクローンに来たら瞬間ジャンプ
    track.addEventListener('transitionend', () => {
      isTransitioning = false;

      // 末尾クローン（firstClone）まで来たら先頭へジャンプ
      if (current === total + 1) {
        track.style.transition = 'none';
        current = 1;
        track.style.transform = `translateX(-${current * 100}%)`;
      }

      // 先頭クローン（lastClone）まで来たら末尾へジャンプ
      if (current === 0) {
        track.style.transition = 'none';
        current = total;
        track.style.transform = `translateX(-${current * 100}%)`;
      }
    });

    function startTimer() {
      timer = setInterval(() => goTo(current + 1), 5000);
    }


    function resetTimer() {
    clearInterval(timer);
    startTimer();
  }


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
