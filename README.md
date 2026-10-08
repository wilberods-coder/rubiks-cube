# Кубик Рубика. Больше, чем игрушка.

Одностраничный лендинг об истории, механике и культурном влиянии кубика Рубика — в духе продуктовых страниц Apple.

**Сайт:** https://wilberods-coder.github.io/rubiks-cube/

## Стек

- HTML5 + CSS3 (без сборки, системные шрифты SF Pro / Inter / Helvetica Neue)
- [GSAP 3.12](https://gsap.com/) + ScrollTrigger — скролл-анимации, sticky-сцены, параллакс
- [Three.js r160](https://threejs.org/) — процедурная 3D-модель кубика (ES-модули через import map)
- [Lenis](https://github.com/darkroomengineering/lenis) — плавный скролл

Все библиотеки подключаются с CDN по точным версиям, все локальные пути относительные (`./style.css`, `./assets/...`) — сайт работает из подпапки репозитория на GitHub Pages.

## Структура

```
index.html       разметка секций: Hero, История, Механика, Культурный код, Footer
style.css        дизайн-токены, mobile-first стили, glassmorphism, sticky-раскладки
script.js        Lenis + ScrollTrigger, SVG-иллюстрации истории, Three.js-сцена
assets/          favicon
.nojekyll        отключает Jekyll на GitHub Pages
```

## Как это устроено

1. **Hero** — 3D-кубик на фиксированном WebGL-холсте следует за мышью, сам поворачивает слои и уплывает при скролле.
2. **История** — трек высотой 420vh с `position: sticky` внутри. Прогресс ScrollTrigger переключает шаг: текст, фон эпохи и изометрическую SVG-схему, которая «рисуется» через `stroke-dashoffset`.
3. **Механика** — такой же sticky-трек. Скраб-таймлайн GSAP управляет состоянием кубика: раскрытие крестовины → разбор на 26 деталей → вращение слоёв → перемешивание.
4. **Культурный код** — fade-in снизу (`y: 50, opacity: 0 → 1`) через `ScrollTrigger.batch`, «перебор» цифр в числе комбинаций, счётчики и график рекордов.

Если WebGL или CDN Three.js недоступны, 3D отключается, а остальная страница продолжает работать. Учитывается `prefers-reduced-motion`.

## Локальный запуск

ES-модули не работают с `file://`, поэтому нужен любой статический сервер:

```bash
python3 -m http.server 8000
```

и открыть http://localhost:8000.

## Деплой

Settings → Pages → Deploy from a branch → `main` / `(root)`.

---

Некоммерческий фан-проект. Rubik’s Cube® — товарный знак Spin Master Ltd.
