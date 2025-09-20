// menu.js
(async function () {
  // ---------- helpers ----------
  const fmtPrice = (n) => (n != null ? `$${Number(n).toFixed(2)}` : "");
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const slug = (s) =>
    String(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  function cardHTML(item) {
    const src =
      item.img && item.img.trim()
        ? item.img
        : "https://picsum.photos/seed/rocket/600/400"; // fallback image
    const alt = item.alt || item.name || "Menu item";
    return `
      <article class="card">
        <div class="thumb"><img src="${src}" alt="${alt}" draggable="false" /></div>
        <div class="card-body">
          <h4>${item.name}</h4>
          <p>${item.desc || ""}</p>
          <span class="price">${fmtPrice(item.price)}</span>
        </div>
      </article>
    `;
  }

  function renderGrid(section) {
    // Section title (kept for non-accordion layout)
    const wrap = el("div", null);
    wrap.appendChild(el("h3", "category", section.title));

    const grid = el("div", "grid");
    grid.innerHTML = (section.items || []).map(cardHTML).join("");
    wrap.appendChild(grid);
    return wrap;
  }

  function renderCarousel(section) {
    const wrap = el("div", null);
    wrap.appendChild(el("h3", "category", section.title));

    const carousel = el("div", "carousel");
    const left = el("button", "arrow arrow-left", "◀");
    left.setAttribute("aria-label", "Previous");
    const right = el("button", "arrow arrow-right", "▶");
    right.setAttribute("aria-label", "Next");

    const viewport = el("div", "viewport");
    const track = el("div", "track");
    track.innerHTML = (section.items || []).map(cardHTML).join("");
    viewport.appendChild(track);

    carousel.appendChild(left);
    carousel.appendChild(viewport);
    carousel.appendChild(right);

    carousel.tabIndex = 0; // focusable for keyboard
    initInfiniteCarousel({ carousel, track, viewport, left, right });

    wrap.appendChild(carousel);
    return wrap;
  }

  // ---------- carousel logic ----------
  function initInfiniteCarousel(ctx) {
    const { carousel, track, viewport, left, right } = ctx;
    let step = 0;
    let isAnimating = false;

    const gapPx = () => parseFloat(getComputedStyle(track).gap || "0");

    function computeStep() {
      const first = track.children[0];
      if (!first) return 0;
      return first.getBoundingClientRect().width + gapPx();
    }
    function setX(px) {
      track.style.transform = `translateX(${px}px)`;
    }
    function measure() {
      step = computeStep();
      track.style.transition = "none";
      setX(0);
      track.getBoundingClientRect(); // reflow
      track.style.transition = "transform .35s ease";
    }

    function goNext() {
      if (isAnimating || !step) return;
      isAnimating = true;
      setX(-step);
      const onEnd = () => {
        track.removeEventListener("transitionend", onEnd);
        track.style.transition = "none";
        if (track.firstElementChild) track.appendChild(track.firstElementChild);
        setX(0);
        track.getBoundingClientRect();
        track.style.transition = "transform .35s ease";
        isAnimating = false;
      };
      track.addEventListener("transitionend", onEnd, { once: true });
    }

    function goPrev() {
      if (isAnimating || !step) return;
      isAnimating = true;
      track.style.transition = "none";
      if (track.lastElementChild)
        track.insertBefore(track.lastElementChild, track.firstElementChild);
      setX(-step);
      track.getBoundingClientRect();
      track.style.transition = "transform .35s ease";
      setX(0);
      track.addEventListener(
        "transitionend",
        () => {
          isAnimating = false;
        },
        { once: true }
      );
    }

    // Buttons
    right.addEventListener("click", goNext);
    left.addEventListener("click", goPrev);

    // Keyboard when focused
    carousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    });

    // Touch swipe
    let startX = 0,
      curX = 0,
      dragging = false;
    const TH = 30;

    function onDown(e) {
      if (isAnimating) return;
      dragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      curX = startX;
      track.style.transition = "none";
    }
    function onMove(e) {
      if (!dragging) return;
      curX = e.touches ? e.touches[0].clientX : e.clientX;
      setX(curX - startX);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      const dx = curX - startX;
      track.style.transition = "transform .35s ease";
      if (dx <= -TH) {
        setX(-step);
        const onEnd = () => {
          track.removeEventListener("transitionend", onEnd);
          track.style.transition = "none";
          if (track.firstElementChild) track.appendChild(track.firstElementChild);
          setX(0);
          track.getBoundingClientRect();
          track.style.transition = "transform .35s ease";
        };
        track.addEventListener("transitionend", onEnd, { once: true });
      } else if (dx >= TH) {
        track.style.transition = "none";
        if (track.lastElementChild)
          track.insertBefore(track.lastElementChild, track.firstElementChild);
        setX(-step);
        track.getBoundingClientRect();
        track.style.transition = "transform .35s ease";
        setX(0);
      } else {
        setX(0);
      }
    }

    viewport.addEventListener("touchstart", onDown, { passive: true });
    viewport.addEventListener("touchmove", onMove, { passive: true });
    viewport.addEventListener("touchend", onUp, { passive: true });
    viewport.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    window.addEventListener("load", measure);
  }

  // ---------- fetch data ----------
  const res = await fetch("menu.json", { cache: "no-store" });
  const data = await res.json();

  // ---------- build header dropdown from sections ----------
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("menuDropdown");
  const ddWrap = toggle?.closest(".dropdown");

  if (toggle && menu && ddWrap) {
    menu.innerHTML = (data.sections || [])
      .map(
        (sec) =>
          `<li role="none"><a role="menuitem" href="#sec-${slug(
            sec.title
          )}">${sec.title}</a></li>`
      )
      .join("");

    // click/touch toggle
    toggle.addEventListener("click", () => {
      const open = ddWrap.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    // close when selecting a link
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        ddWrap.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    // outside click
    document.addEventListener("click", (e) => {
      if (!ddWrap.contains(e.target)) {
        ddWrap.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    // esc
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ddWrap.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // ---------- render sections ----------
  const root = document.getElementById("menu-root");
  root.innerHTML = "";

  for (const section of data.sections || []) {
    const explicit = (section.type || "").toLowerCase();
    const isCarousel =
      explicit === "carousel" ||
      (explicit !== "grid" && (section.items?.length || 0) > 4);
    const block = isCarousel ? renderCarousel(section) : renderGrid(section);

    // anchor id so header dropdown links can jump here
    block.id = `sec-${slug(section.title)}`;

    root.appendChild(block);
  }
})();
