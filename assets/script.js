// Essenza Beauty — catálogo interativo (busca, filtro por marca, WhatsApp CTA)
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "5511915081721";

  // ── INTEGRAÇÃO GOOGLE SHEETS ─────────────────────────────────────────────
  // A planilha é a fonte de verdade. Para adicionar produtos: basta adicionar
  // uma linha na aba "essenzapreços" da planilha.
  var GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/17BitCnPCI8iuJt3QJOOHsBNTX4656WLYbigoGVF1UbI/export?format=csv&gid=921696159";
  // ─────────────────────────────────────────────────────────────────────────

  function normalizeBrand(marca) {
    if (!marca || marca.trim() === "A confirmar") return null;
    var base = marca.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (base === "Marcas mistas") return null;
    return base || null;
  }

  // Parseia uma linha CSV respeitando aspas
  function parseCSVLine(line) {
    var result = [];
    var cur = "";
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  // Regras da loja, aplicadas tanto ao data.js quanto à planilha.
  var REMOVED_SLUGS = [
    "club-de-nuit-intense-man-kit-presente",
    "isabelle-la-belle-victoria-body-splash-300ml"
  ];
  var PRICE_ON_REQUEST_BRANDS = ["armaf"];

  function isPriceOnRequest(product) {
    var brand = String((product.marca || "") + " " + (product.marcaFiltro || "")).toLowerCase();
    var hasRealBrand = brand.trim() && brand.indexOf("a confirmar") === -1;
    var text = hasRealBrand ? brand : brand + " " + String(product.nome || "").toLowerCase();
    return PRICE_ON_REQUEST_BRANDS.some(function (b) { return new RegExp("\\b" + b + "\\b").test(text); });
  }

  // Mantém um cadastro por nome e marca, independentemente do volume.
  // A ordem preserva a prioridade dos preços e dados vindos da planilha.
  function uniqueProducts(products) {
    var seen = new Set();
    function normalize(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[’'`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
        .replace(/\bmaison al hambra\b/g, 'maison alhambra').replace(/\blataffa\b/g, 'lattafa');
    }
    var brands = Array.from(new Set(products.map(function (p) {
      return normalize(String(p.marca || '').replace(/\(.*?\)/g, ''));
    }).filter(function (brand) { return brand && brand !== 'a confirmar'; })))
      .sort(function (a, b) { return b.length - a.length; });
    return products.filter(function (product) {
      if (product.oculto) return false;
      if (REMOVED_SLUGS.indexOf(product.slug) !== -1) return false;
      if (isPriceOnRequest(product)) { product.preco = null; product.aPartirDe = false; }
      if (!product.img || /(?:^|\/)no-image\.[^/]+$/i.test(product.img)) return false;
      var name = normalize(product.nome.replace(/\d+(?:[.,]\d+)?\s*(?:mls?|mililitros?)\b/gi, ' '));
      var brand = normalize(String(product.marca || '').replace(/\(.*?\)/g, ''));
      var namedBrand = brands.find(function (candidate) { return (' ' + name + ' ').includes(' ' + candidate + ' '); });
      if (!brand) brand = namedBrand || '';
      if (brand) name = (' ' + name + ' ').split(' ' + brand + ' ').join(' ').trim();
      name = name.replace(/\b(eau de parfum|edp|perfumes?|arabe|masculino|feminino|unissex|unisex|compartilhavel|fem)\b/g, ' ')
        .replace(/\blion heart\b/g, 'lionheart')
        .replace(/\bfakhar platin\b/g, 'fakhar platinum')
        .replace(/\bla vivacite intensa\b/g, 'la vivacite intense')
        .replace(/\bouf for glory\b/g, 'oud for glory');
      var key = brand + '|' + name.trim().split(/\s+/).sort().join(' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  var allProducts = uniqueProducts(typeof PRODUCTS !== "undefined" ? PRODUCTS : []);

  // ── SLUGS CURADOS POR CATEGORIA ─────────────────────────────────────────
  var REELS = {
    "reel-masc": ["asad","club-de-nuit-intense-man","scuderia-ferrari-black","silver-scent","silver-scent-intense","afnan-9pm","fakhar-black","khamrah","asad-bourbon","hawas-black"],
    "reel-fem":  ["yara","queen-of-arabia","la-vie-est-belle-lancome","good-girl-carolina-herrera","coco-mademoiselle-chanel","libre-ysl","scandal-jean-paul-gaultier","light-blue-dolce-gabbana","olympea-paco-rabanne","jadore-dior","prada-paradoxe","brand-collection-n151-delina"]
  };

  var IMP_SLUGS = [
    "la-vie-est-belle-lancome","good-girl-carolina-herrera","coco-mademoiselle-chanel",
    "libre-ysl","scandal-jean-paul-gaultier","light-blue-dolce-gabbana",
    "my-way-giorgio-armani","olympea-paco-rabanne","jadore-dior","prada-paradoxe","la-bomba",
    "scuderia-ferrari-black","silver-scent","silver-scent-intense"
  ];
  // ─────────────────────────────────────────────────────────────────────────

  function fmtPrice(v) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parsePrice(value) {
    var text = String(value == null ? "" : value).replace(/R\$|\s/g, "");
    if (!text) return NaN;
    if (text.indexOf(",") !== -1) text = text.replace(/\./g, "").replace(",", ".");
    var price = Number(text);
    return Number.isFinite(price) && price > 0 ? price : NaN;
  }

  function waLink(nome) {
    var msg = "Olá vi o perfume " + nome + " eu quero fazer um pedido.";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
  }

  function waIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.02 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.33 5L2 22l5.2-1.36a9.94 9.94 0 0 0 4.82 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.52 2 12.02 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.08.81.82-3-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.55-3.71 8.24-8.27 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.07-.11-.23-.17-.48-.29Z"/></svg>';
  }

  function searchIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>';
  }

  function cardTemplate(p) {
    var priceHtml;
    if (p.preco === null || p.preco === undefined) {
      priceHtml =
        '<div class="card-price"><span class="value consult">Consulte o valor</span></div>';
    } else {
      priceHtml =
        '<div class="card-price">' +
        (p.aPartirDe
          ? '<span class="installment">a partir de</span><span class="value">R$ ' + fmtPrice(p.preco) + '</span>'
          : '<span class="value">R$ ' + fmtPrice(p.preco) + '</span>') +
        '<span class="installment">Em até 3x sem juros</span>' +
        '<span class="pix-note">ou 10% de desconto à vista no Pix</span>' +
        "</div>";
    }
    return (
      '<article class="card" data-name="' + p.nome.toLowerCase() + '" data-brand="' + (p.marcaFiltro || "").toLowerCase() + '">' +
        '<div class="card-media' + (p.consultarFoto ? ' has-overlay' : '') + '">' +
          '<img src="' + p.img + '" alt="' + p.nome + '" loading="lazy" width="440" height="460">' +
          (p.familia ? '<span class="card-family">' + p.familia + "</span>" : "") +
          (p.consultarFoto ? '<div class="media-overlay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg><span>Disponibilidade<br>sob consulta</span></div>' : "") +
        "</div>" +
        '<div class="card-body">' +
          (p.marca ? '<span class="card-brand">' + p.marca + "</span>" : "") +
          '<h3 class="card-name">' + p.nome + "</h3>" +
          '<p class="card-desc">' + (p.descricao || "") + "</p>" +
          (p.fotos ? '<details class="product-photos"><summary>Ver opções de Shower Shake</summary><div class="product-photo-list">' + p.fotos.map(function (src) { return '<img src="' + src + '" alt="Shower Shake Stella Dustin — opção de fragrância" loading="lazy" width="250" height="250">'; }).join('') + '</div></details>' : '') +
          '<div class="card-footer">' +
            priceHtml +
            '<a class="card-cta" target="_blank" rel="noopener" href="' + waLink(p.nome) + '" data-fbq-name="' + p.nome.replace(/"/g, '&quot;') + '"' + (p.preco ? ' data-fbq-price="' + p.preco + '"' : '') + '>' + waIcon() + "<span>Pedir</span></a>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  var grid = document.getElementById("product-grid");
  var searchInput = document.getElementById("search-input");
  var brandSelect = document.getElementById("brand-select");
  var resultCount = document.getElementById("result-count");
  var emptyState = document.getElementById("empty-state");
  var loadMoreWrap = document.getElementById("load-more-wrap");
  var loadMoreBtn = document.getElementById("load-more-btn");
  var sortSelect = document.getElementById("sort-select");
  var priceFilter = document.getElementById("price-filter");
  var genderFilter = document.getElementById("gender-filter");
  var activeFiltersEl = document.getElementById("active-filters");

  var PAGE_SIZE = 24;
  var visibleCount = PAGE_SIZE;
  var currentFiltered = allProducts;

  function populateBrandFilter() {
    var selectedBrand = brandSelect.value;
    while (brandSelect.options.length > 1) brandSelect.remove(1);
    var counts = {};
    allProducts.forEach(function (p) {
      var b = p.marcaFiltro;
      if (!b) return;
      counts[b] = (counts[b] || 0) + 1;
    });
    var brands = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });
    brands.forEach(function (b) {
      var opt = document.createElement("option");
      opt.value = b.toLowerCase();
      opt.textContent = b + " (" + counts[b] + ")";
      brandSelect.appendChild(opt);
    });
    var impOpt = document.createElement("option");
    impOpt.value = "importados";
    impOpt.textContent = "Importados (europeus)";
    brandSelect.appendChild(impOpt);
    brandSelect.value = selectedBrand;
    brandChipsPopulated = false; // reset so panel re-populates with latest brands
    document.querySelector('.catalog-head .section-title').textContent = allProducts.length + ' produtos, sua marca favorita';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Sem acento e minúsculo: "Árabe" e "arabe" casam.
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function readState() {
    return {
      q: searchInput.value,
      brand: brandSelect.value,
      price: priceFilter ? priceFilter.value : '',
      gender: genderFilter ? genderFilter.value : '',
      sort: sortSelect ? sortSelect.value : ''
    };
  }

  function matchesPrice(p, price) {
    if (!price) return true;
    if (p.preco == null) return false;
    if (price === '500+') return p.preco >= 500;
    var pts = price.split('-');
    return p.preco >= Number(pts[0]) && p.preco < Number(pts[1]);
  }

  function byPrice(dir) {
    return function (a, b) {
      if (a.preco == null) return 1;
      if (b.preco == null) return -1;
      return dir * (a.preco - b.preco);
    };
  }

  // Todas as palavras digitadas precisam aparecer em nome, marca, família ou descrição.
  function filterProducts(s) {
    var q = norm(s.q).trim();
    var tokens = q ? q.split(/\s+/) : [];
    var list = allProducts.filter(function (p) {
      if (tokens.length) {
        var hay = norm(p.nome + ' ' + (p.marca || '') + ' ' + (p.marcaFiltro || '') + ' ' + (p.familia || '') + ' ' + (p.descricao || ''));
        for (var i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) === -1) return false;
      }
      if (s.brand && (s.brand === 'importados' ? IMP_SLUGS.indexOf(p.slug) === -1 : (p.marcaFiltro || '').toLowerCase() !== s.brand)) return false;
      if (s.gender && (p.genero || '') !== s.gender) return false;
      return matchesPrice(p, s.price);
    });
    if (s.sort === 'price-asc') list.sort(byPrice(1));
    else if (s.sort === 'price-desc') list.sort(byPrice(-1));
    else if (s.sort === 'name-asc') list.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    else if (q) {
      // nome > marca/família > só na descrição (notas)
      var rank = function (p) {
        var n = norm(p.nome);
        if (n.indexOf(q) === 0) return 0;
        if (n.indexOf(q) !== -1) return 1;
        return norm(p.descricao).indexOf(q) === -1 ? 2 : 3;
      };
      list.sort(function (a, b) { return rank(a) - rank(b); });
    }
    return list;
  }

  function plural(n) { return n + (n === 1 ? ' perfume' : ' perfumes'); }

  function applyFilters() {
    currentFiltered = filterProducts(readState());
    visibleCount = PAGE_SIZE;
    render();
    renderActiveFilters();
    syncCatalogControls();
  }

  function render() {
    var slice = currentFiltered.slice(0, visibleCount);
    grid.innerHTML = slice.map(cardTemplate).join("");
    resultCount.textContent = plural(currentFiltered.length);
    var empty = currentFiltered.length === 0;
    if (empty) {
      var q = searchInput.value.trim();
      emptyState.innerHTML =
        '<p class="empty-title">Nenhum perfume encontrado' + (q ? ' para “' + esc(q) + '”' : '') + '</p>' +
        '<p class="empty-hint">Tente o nome da marca ou uma nota, como “baunilha” ou “oud”. Se não achar, a gente procura pra você.</p>' +
        '<div class="empty-actions">' +
          '<button type="button" class="btn-outline" data-action="clear-all">Limpar busca e filtros</button>' +
          '<a class="btn-outline" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Procurei ' + (q ? '"' + q + '"' : 'um perfume') + ' no catálogo e não encontrei. Vocês têm?') + '">Perguntar no WhatsApp</a>' +
        '</div>';
    }
    emptyState.style.display = empty ? "block" : "none";
    loadMoreWrap.style.display = currentFiltered.length > visibleCount ? "flex" : "none";
  }

  loadMoreBtn.addEventListener("click", function () {
    visibleCount += PAGE_SIZE;
    render();
  });

  var searchTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
  });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && searchInput.value) { searchInput.value = ''; applyFilters(); }
  });
  var searchClear = document.getElementById("search-clear");
  if (searchClear) {
    searchClear.addEventListener("click", function () {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    });
  }
  brandSelect.addEventListener("change", applyFilters);
  if (sortSelect) sortSelect.addEventListener("change", applyFilters);
  if (priceFilter) priceFilter.addEventListener("change", applyFilters);
  if (genderFilter) genderFilter.addEventListener("change", applyFilters);

  function handleFilterAction(e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    if (action === "clear-brand") brandSelect.value = '';
    else if (action === "clear-price") { if (priceFilter) priceFilter.value = ''; }
    else if (action === "clear-sort") { if (sortSelect) sortSelect.value = ''; }
    else if (action === "clear-gender") { if (genderFilter) genderFilter.value = ''; }
    else if (action === "clear-q") searchInput.value = '';
    else if (action === "clear-all") {
      brandSelect.value = '';
      if (priceFilter) priceFilter.value = '';
      if (sortSelect) sortSelect.value = '';
      if (genderFilter) genderFilter.value = '';
      searchInput.value = '';
    } else return;
    applyFilters();
  }
  if (activeFiltersEl) activeFiltersEl.addEventListener("click", handleFilterAction);
  emptyState.addEventListener("click", handleFilterAction);

  function renderActiveFilters() {
    if (!activeFiltersEl) return;
    var chips = [];
    var q = searchInput.value.trim();
    var brand = brandSelect.value;
    var price = priceFilter ? priceFilter.value : '';
    var sort = sortSelect ? sortSelect.value : '';
    var gender = genderFilter ? genderFilter.value : '';

    if (q) chips.push('<span class="filter-chip">“' + esc(q) + '” <button data-action="clear-q" aria-label="Limpar busca">\xD7</button></span>');
    if (brand) {
      var brandLabel = brandSelect.options[brandSelect.selectedIndex].textContent.replace(/\s*\(\d+\).*/, '').trim();
      chips.push('<span class="filter-chip">' + brandLabel + ' <button data-action="clear-brand" aria-label="Remover filtro de marca">\xD7</button></span>');
    }
    if (price) {
      var priceLabel = priceFilter.options[priceFilter.selectedIndex].textContent;
      chips.push('<span class="filter-chip">' + priceLabel + ' <button data-action="clear-price" aria-label="Remover filtro de pre\xE7o">\xD7</button></span>');
    }
    if (sort) {
      var sortLabel = sortSelect.options[sortSelect.selectedIndex].textContent;
      chips.push('<span class="filter-chip filter-chip--sort">↕ ' + sortLabel + ' <button data-action="clear-sort" aria-label="Remover ordena\xE7\xE3o">\xD7</button></span>');
    }
    if (gender) {
      var genderLabel = gender === 'M' ? '♂ Masculino' : '♀ Feminino';
      chips.push('<span class="filter-chip">' + genderLabel + ' <button data-action="clear-gender" aria-label="Remover filtro de g\xEAnero">\xD7</button></span>');
    }

    if (chips.length > 0) {
      activeFiltersEl.innerHTML = '<span class="af-count">' + plural(currentFiltered.length) + '</span>' + chips.join('') + '<button class="btn-clear-filters" data-action="clear-all">Limpar tudo</button>';
      activeFiltersEl.hidden = false;
    } else {
      activeFiltersEl.innerHTML = '';
      activeFiltersEl.hidden = true;
    }
  }

  var backToTopBtn = document.getElementById("back-to-top");
  if (backToTopBtn) {
    window.addEventListener("scroll", function() {
      backToTopBtn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });
    backToTopBtn.addEventListener("click", function() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  populateBrandFilter();
  render();

  // hero / nav quick-jump to brand filter
  var dropdowns = document.querySelectorAll('.nav-dropdown');
  function closeDropdowns() {
    dropdowns.forEach(function (dropdown) {
      dropdown.querySelector('.nav-drop-trigger').setAttribute('aria-expanded', 'false');
    });
  }
  dropdowns.forEach(function (dropdown) {
    var trigger = dropdown.querySelector('.nav-drop-trigger');
    trigger.addEventListener('click', function () {
      var wasOpen = trigger.getAttribute('aria-expanded') === 'true';
      closeDropdowns();
      trigger.setAttribute('aria-expanded', String(!wasOpen));
    });
    dropdown.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeDropdowns();
        trigger.focus();
      }
    });
    dropdown.addEventListener('focusout', function (event) {
      if (!dropdown.contains(event.relatedTarget)) trigger.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.nav-dropdown')) closeDropdowns();
  });

  // Hamburger menu toggle
  var header = document.querySelector('.site-header');
  var navToggle = document.getElementById('nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var isOpen = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    });
    header.querySelector('.main-nav').addEventListener('click', function (e) {
      if (e.target.closest('a') || e.target.closest('[data-jump-brand]')) {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-header') && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
  }
  new ResizeObserver(function () {
    document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
  }).observe(header);

  // ── BARRA DO CATÁLOGO NO MOBILE ──────────────────────────────────────────
  // Fixa abaixo do header, escondida nos banners, some ao rolar para baixo.
  var filtersEl = document.querySelector('.filters');
  var filterSentinel = document.querySelector('.price-disclaimer');
  var wasInCatalog = false;
  var ignoreScrollUntil = 0;

  function isMobile() { return window.innerWidth <= 640; }

  function isBelowCatalog() {
    if (!filterSentinel) return true;
    return filterSentinel.getBoundingClientRect().bottom <= header.offsetHeight + 4;
  }

  function syncFilterHeight() {
    if (isMobile()) {
      document.documentElement.style.setProperty('--filter-height', filtersEl.offsetHeight + 'px');
      if (!isBelowCatalog()) {
        filtersEl.classList.add('filters--hidden');
        wasInCatalog = false;
      }
    } else {
      document.documentElement.style.removeProperty('--filter-height');
      filtersEl.classList.remove('filters--hidden');
      wasInCatalog = false;
    }
  }
  new ResizeObserver(syncFilterHeight).observe(filtersEl);
  syncFilterHeight();

  var lastScrollY = window.scrollY;
  window.addEventListener('scroll', function () {
    if (!isMobile() || document.documentElement.classList.contains('ui-locked')) return;
    var currentY = window.scrollY;
    var nowInCatalog = isBelowCatalog();

    if (Date.now() < ignoreScrollUntil) {
      lastScrollY = currentY;
      wasInCatalog = nowInCatalog;
      return;
    }
    if (!nowInCatalog) {
      filtersEl.classList.add('filters--hidden');
      wasInCatalog = false;
    } else if (!wasInCatalog) {
      filtersEl.classList.remove('filters--hidden');
      wasInCatalog = true;
    } else if (currentY > lastScrollY + 6) {
      filtersEl.classList.add('filters--hidden');
    } else if (currentY < lastScrollY - 6) {
      filtersEl.classList.remove('filters--hidden');
    }
    lastScrollY = Math.max(0, currentY);
  }, { passive: true });

  window.addEventListener('resize', syncFilterHeight, { passive: true });

  // Leva o usuário ao início dos resultados, com a barra visível.
  function scrollToResults() {
    var gridTop = grid.getBoundingClientRect().top + window.scrollY;
    var offset = isMobile() ? header.offsetHeight : header.offsetHeight + filtersEl.offsetHeight + 12;
    ignoreScrollUntil = Date.now() + 400;
    window.scrollTo({ top: Math.max(0, gridTop - offset), behavior: 'instant' });
    filtersEl.classList.remove('filters--hidden');
  }

  // ── OVERLAYS (busca e filtros) ───────────────────────────────────────────
  // Cada overlay ganha uma entrada no histórico: o "voltar" do celular fecha
  // o overlay em vez de sair do site.
  var openOverlay = null;   // { el, hide }
  var afterClose = null;

  function lockUi(lock) {
    document.documentElement.classList.toggle('ui-locked', lock);
  }

  function showOverlay(el, hide) {
    openOverlay = { el: el, hide: hide };
    lockUi(true);
    try { history.pushState({ essenzaOverlay: true }, ''); } catch (err) { /* sem histórico */ }
  }

  function finishClose() {
    if (!openOverlay) return;
    var o = openOverlay;
    openOverlay = null;
    o.hide();
    lockUi(false);
    var cb = afterClose;
    afterClose = null;
    if (cb) setTimeout(cb, 0);
  }

  function closeOverlay(then) {
    if (!openOverlay) { if (then) then(); return; }
    afterClose = then || null;
    if (history.state && history.state.essenzaOverlay) history.back();
    else finishClose();
  }

  window.addEventListener('popstate', finishClose);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openOverlay) closeOverlay();
  });

  // ── TELA DE BUSCA (mobile, estilo Shopee/Mercado Livre) ──────────────────
  var sheet = document.getElementById('search-sheet');
  var ssForm = document.getElementById('ss-form');
  var ssInput = document.getElementById('ss-input');
  var ssClear = document.getElementById('ss-clear');
  var ssBody = document.getElementById('ss-body');
  var searchPill = document.getElementById('search-pill');
  var searchPillText = document.getElementById('search-pill-text');
  var RECENT_KEY = 'essenza-buscas';

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (err) { return []; }
  }
  function saveRecent(q) {
    var list = getRecent().filter(function (x) { return norm(x) !== norm(q); });
    list.unshift(q);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))); } catch (err) { /* modo privado */ }
  }
  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch (err) { /* modo privado */ }
  }

  function brandOptions() {
    return Array.from(brandSelect.options).filter(function (o) { return o.value; }).map(function (o) {
      return { value: o.value, label: o.textContent.replace(/\s*\(\d+\)\s*$/, ''), count: (o.textContent.match(/\((\d+)\)/) || [])[1] };
    });
  }

  function productRow(p) {
    var price = p.preco == null ? 'Consulte o valor' : (p.aPartirDe ? 'a partir de ' : '') + 'R$ ' + fmtPrice(p.preco);
    return '<li><button type="button" class="ss-item" data-q="' + esc(p.nome) + '">' +
      '<img src="' + esc(p.img) + '" alt="" loading="lazy" width="52" height="52">' +
      '<span class="ss-item-text">' +
        (p.marca ? '<span class="ss-item-brand">' + esc(p.marca) + '</span>' : '') +
        '<span class="ss-item-name">' + esc(p.nome) + '</span>' +
        '<span class="ss-item-price">' + price + '</span>' +
      '</span></button></li>';
  }

  function renderSheet() {
    var q = ssInput.value.trim();
    ssClear.hidden = !q;
    var html = '';
    if (!q) {
      var recent = getRecent();
      if (recent.length) {
        html += '<section class="ss-section"><div class="ss-head"><h3>Buscas recentes</h3><button type="button" class="ss-link" data-ss="clear-recent">Limpar</button></div><ul class="ss-recent">' +
          recent.map(function (r) {
            return '<li><button type="button" class="ss-recent-item" data-q="' + esc(r) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + esc(r) + '</button></li>';
          }).join('') + '</ul></section>';
      }
      html += '<section class="ss-section"><h3>Atalhos</h3><div class="ss-chips">' +
        '<button type="button" class="ss-chip" data-gender="M">Masculinos</button>' +
        '<button type="button" class="ss-chip" data-gender="F">Femininos</button>' +
        '<button type="button" class="ss-chip" data-price="0-150">Até R$ 150</button>' +
        '<button type="button" class="ss-chip" data-brand="importados">Importados europeus</button>' +
        '</div></section>';
      html += '<section class="ss-section"><h3>Marcas mais procuradas</h3><div class="ss-chips">' +
        brandOptions().filter(function (b) { return b.value !== 'importados'; }).slice(0, 12).map(function (b) {
          return '<button type="button" class="ss-chip" data-brand="' + esc(b.value) + '">' + esc(b.label) + '</button>';
        }).join('') + '</div></section>';
    } else {
      var nq = norm(q);
      var brands = brandOptions().filter(function (b) { return norm(b.label).indexOf(nq) !== -1; }).slice(0, 3);
      var results = filterProducts({ q: q, brand: '', price: '', gender: '', sort: '' });
      if (brands.length) {
        html += '<section class="ss-section"><h3>Marcas</h3><div class="ss-chips">' + brands.map(function (b) {
          return '<button type="button" class="ss-chip ss-chip--brand" data-brand="' + esc(b.value) + '">Tudo de ' + esc(b.label) + (b.count ? ' <span>(' + b.count + ')</span>' : '') + '</button>';
        }).join('') + '</div></section>';
      }
      if (results.length) {
        html += '<section class="ss-section"><h3>Perfumes</h3><ul class="ss-list">' + results.slice(0, 8).map(productRow).join('') + '</ul></section>' +
          '<div class="ss-all"><button type="submit" form="ss-form" class="ss-all-btn">Ver ' + (results.length === 1 ? 'o resultado' : 'todos os ' + results.length + ' resultados') + '</button></div>';
      } else if (!brands.length) {
        html += '<div class="ss-empty"><p class="ss-empty-title">Nada encontrado para “' + esc(q) + '”</p>' +
          '<p>Confira a escrita ou tente o nome da marca. Também podemos procurar pra você:</p>' +
          '<a class="ss-wa" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Vocês têm o perfume "' + q + '"?') + '">' + waIcon() + 'Perguntar no WhatsApp</a></div>';
      }
    }
    ssBody.innerHTML = html;
    ssBody.scrollTop = 0;
  }

  function openSearchSheet() {
    if (!sheet || openOverlay) return;
    ssInput.value = searchInput.value;
    renderSheet();
    sheet.hidden = false;
    // foco síncrono no clique: necessário para o iOS abrir o teclado
    ssInput.focus();
    void sheet.offsetWidth; // força o layout para a transição de entrada rodar
    sheet.classList.add('is-open');
    showOverlay(sheet, function () {
      sheet.classList.remove('is-open');
      sheet.hidden = true;
      ssInput.blur();
    });
  }

  // Aplica a busca no catálogo; uma busca nova solta o filtro de marca.
  function commitSearch(q) {
    q = q.trim();
    if (q) saveRecent(q);
    searchInput.value = q;
    brandSelect.value = '';
    applyFilters();
    closeOverlay(scrollToResults);
  }

  function commitFilter(field, value) {
    searchInput.value = '';
    if (field === 'brand') brandSelect.value = value;
    if (field === 'gender' && genderFilter) genderFilter.value = value;
    if (field === 'price' && priceFilter) priceFilter.value = value;
    applyFilters();
    closeOverlay(scrollToResults);
  }

  if (sheet) {
    var sheetTimer;
    ssInput.addEventListener('input', function () {
      clearTimeout(sheetTimer);
      sheetTimer = setTimeout(renderSheet, 90);
    });
    ssForm.addEventListener('submit', function (e) {
      e.preventDefault();
      commitSearch(ssInput.value);
    });
    ssClear.addEventListener('click', function () {
      ssInput.value = '';
      renderSheet();
      ssInput.focus();
    });
    document.getElementById('ss-back').addEventListener('click', function () { closeOverlay(); });
    ssBody.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t || t.type === 'submit') return;
      if (t.dataset.ss === 'clear-recent') { clearRecent(); renderSheet(); return; }
      if (t.dataset.q !== undefined) return commitSearch(t.dataset.q);
      if (t.dataset.brand !== undefined) return commitFilter('brand', t.dataset.brand);
      if (t.dataset.gender !== undefined) return commitFilter('gender', t.dataset.gender);
      if (t.dataset.price !== undefined) return commitFilter('price', t.dataset.price);
    });
    // Rolar a lista fecha o teclado, liberando a tela.
    ssBody.addEventListener('touchmove', function () { ssInput.blur(); }, { passive: true });
  }
  if (searchPill) searchPill.addEventListener('click', openSearchSheet);

  var headerSearch = document.getElementById('header-search');
  if (headerSearch) {
    headerSearch.addEventListener('click', function (e) {
      e.preventDefault();
      if (isMobile()) { openSearchSheet(); return; }
      var top = filtersEl.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 16;
      window.scrollTo({ top: top, behavior: 'smooth' });
      searchInput.focus({ preventScroll: true });
    });
  }

  // ── PAINEL DE FILTROS (mobile) ───────────────────────────────────────────
  var filterPanel = document.getElementById('filter-panel');
  var filterBackdrop = document.getElementById('filter-panel-backdrop');
  var btnFiltro = document.getElementById('btn-filtro');
  var btnFiltroCount = document.getElementById('btn-filtro-count');
  var fpSidebar = document.getElementById('filter-panel-sidebar');
  var fpContent = document.getElementById('filter-panel-content');
  var fpChipsBrand = document.getElementById('fp-chips-brand');
  var fpApply = document.getElementById('filter-panel-apply');

  var pending = { brand: '', gender: '', price: '' };
  var brandChipsPopulated = false;

  function populateBrandChips() {
    if (brandChipsPopulated || !fpChipsBrand) return;
    fpChipsBrand.innerHTML = '<button type="button" class="fp-chip" data-filter="brand" data-value="">Todas</button>' +
      brandOptions().map(function (b) {
        return '<button type="button" class="fp-chip" data-filter="brand" data-value="' + esc(b.value) + '">' + esc(b.label) + (b.count ? ' <span class="fp-chip-count">' + b.count + '</span>' : '') + '</button>';
      }).join('');
    brandChipsPopulated = true;
  }

  function syncFpChips() {
    fpContent.querySelectorAll('.fp-chip').forEach(function (c) {
      var on = c.dataset.value === pending[c.dataset.filter];
      c.classList.toggle('fp-chip--active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    fpSidebar.querySelectorAll('.fp-cat').forEach(function (c) {
      c.classList.toggle('has-value', !!pending[c.dataset.category]);
    });
    var s = readState();
    s.brand = pending.brand; s.gender = pending.gender; s.price = pending.price;
    var n = filterProducts(s).length;
    fpApply.textContent = n ? 'Ver ' + plural(n) : 'Nenhum resultado';
    fpApply.disabled = n === 0;
  }

  function openFilterPanel() {
    if (openOverlay) return;
    pending.brand = brandSelect.value;
    pending.gender = genderFilter ? genderFilter.value : '';
    pending.price = priceFilter ? priceFilter.value : '';
    populateBrandChips();
    syncFpChips();
    filterBackdrop.classList.add('fp-open');
    filterPanel.classList.add('fp-open');
    filterPanel.setAttribute('aria-hidden', 'false');
    showOverlay(filterPanel, function () {
      filterPanel.classList.remove('fp-open');
      filterBackdrop.classList.remove('fp-open');
      filterPanel.setAttribute('aria-hidden', 'true');
    });
  }

  if (filterPanel) {
    btnFiltro.addEventListener('click', openFilterPanel);
    document.getElementById('filter-panel-close').addEventListener('click', function () { closeOverlay(); });
    filterBackdrop.addEventListener('click', function () { closeOverlay(); });
    fpSidebar.addEventListener('click', function (e) {
      var cat = e.target.closest('.fp-cat');
      if (!cat) return;
      fpSidebar.querySelectorAll('.fp-cat').forEach(function (c) { c.classList.toggle('fp-cat--active', c === cat); });
      ['brand', 'gender', 'price'].forEach(function (k) {
        document.getElementById('fp-chips-' + k).hidden = k !== cat.dataset.category;
      });
      fpContent.scrollTop = 0;
    });
    fpContent.addEventListener('click', function (e) {
      var chip = e.target.closest('.fp-chip');
      if (!chip) return;
      pending[chip.dataset.filter] = chip.dataset.value;
      syncFpChips();
    });
    document.getElementById('filter-panel-clear').addEventListener('click', function () {
      pending.brand = ''; pending.gender = ''; pending.price = '';
      syncFpChips();
    });
    fpApply.addEventListener('click', function () {
      brandSelect.value = pending.brand;
      if (genderFilter) genderFilter.value = pending.gender;
      if (priceFilter) priceFilter.value = pending.price;
      applyFilters();
      closeOverlay(scrollToResults);
    });
  }

  // ── ABAS DE ORDENAÇÃO ───────────────────────────────────────────────────
  var sortTabsEl = document.getElementById('sort-tabs');
  if (sortTabsEl) {
    sortTabsEl.addEventListener('click', function (e) {
      var tab = e.target.closest('.sort-tab');
      if (!tab || !sortSelect) return;
      sortSelect.value = tab.dataset.sort;
      applyFilters();
      scrollToResults();
    });
  }

  // Reflete o estado atual em pílula de busca, botão Filtro, abas e "×" do campo.
  function syncCatalogControls() {
    var q = searchInput.value.trim();
    if (searchPillText) {
      searchPillText.textContent = q || 'Buscar perfume, marca ou nota';
      searchPill.classList.toggle('has-query', !!q);
    }
    if (searchClear) searchClear.hidden = !searchInput.value;
    if (btnFiltro) {
      var n = (brandSelect.value ? 1 : 0) + (genderFilter && genderFilter.value ? 1 : 0) + (priceFilter && priceFilter.value ? 1 : 0);
      btnFiltro.classList.toggle('has-filters', n > 0);
      btnFiltroCount.hidden = n === 0;
      btnFiltroCount.textContent = n;
    }
    var sort = sortSelect ? sortSelect.value : '';
    document.querySelectorAll('.sort-tab').forEach(function (t) {
      var on = t.dataset.sort === sort;
      t.classList.toggle('sort-tab--active', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  syncCatalogControls();
  // ─────────────────────────────────────────────────────────────────────────

  document.querySelectorAll("[data-jump-brand]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var brand = el.getAttribute("data-jump-brand");
      if (brand) {
        e.preventDefault();
        searchInput.value = '';
        brandSelect.value = brand.toLowerCase();
        applyFilters();
        closeDropdowns();
        document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  document.getElementById("current-year").textContent = new Date().getFullYear();

  // ── REELS DE DESTAQUE ────────────────────────────────────────────────────
  function reelCardTemplate(p) {
    var priceHtml;
    if (p.preco === null || p.preco === undefined) {
      priceHtml = '<span class="reel-card-price">Consulte o valor</span>';
    } else {
      priceHtml = '<span class="reel-card-price"><strong>' + (p.aPartirDe ? 'A partir de ' : '') + 'R$ ' + fmtPrice(p.preco) + '</strong></span>' +
        '<span class="installment">Em até 3x sem juros</span>' +
        '<span class="pix-note">ou 10% de desconto à vista no Pix</span>';
    }
    return (
      '<a class="reel-card" target="_blank" rel="noopener" href="' + waLink(p.nome) + '">' +
        '<img class="reel-card-img" src="' + p.img + '" alt="' + p.nome + '" loading="lazy" width="172" height="172">' +
        '<div class="reel-card-body">' +
          (p.marca ? '<span class="reel-card-brand">' + p.marca + '</span>' : '') +
          '<span class="reel-card-name">' + p.nome + '</span>' +
          priceHtml +
          '<span class="reel-card-cta">' + waIcon() + '<span>Pedir</span></span>' +
        '</div>' +
      '</a>'
    );
  }

  function renderReels(productList) {
    var bySlug = {};
    productList.forEach(function (p) { bySlug[p.slug] = p; });
    Object.keys(REELS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var slugs = REELS[id];
      var html = slugs.map(function (s) {
        return bySlug[s] ? reelCardTemplate(bySlug[s]) : "";
      }).join("");
      el.innerHTML = html;
    });
  }

  renderReels(allProducts);

  // ── SINCRONIZAÇÃO COMPLETA COM GOOGLE SHEETS ─────────────────────────────
  // Se a planilha tiver a coluna "descricao", reconstrói o catálogo inteiro.
  // Caso contrário, apenas atualiza preços (compatibilidade retroativa).
  // Para adicionar um produto: basta inserir uma linha na planilha.
  if (GOOGLE_SHEET_CSV_URL) {
    fetch(GOOGLE_SHEET_CSV_URL)
      .then(function (r) { return r.text(); })
      .then(function (csvText) {
        var lines = csvText.trim().split("\n");
        var header = parseCSVLine(lines[0]).map(function (h) { return h.trim().replace(/^"|"$/g, ""); });

        var idx = {};
        header.forEach(function (h, i) { idx[h] = i; });

        if (idx["slug"] === undefined) return;

        var hasFullData = idx["descricao"] !== undefined;

        if (!hasFullData) {
          // Modo legado: só preços
          var precos = {};
          for (var i = 1; i < lines.length; i++) {
            var cols = parseCSVLine(lines[i]);
            var slug  = (cols[idx["slug"]] || "").trim().replace(/^"|"$/g, "");
            var preco = parsePrice(cols[idx["preco_venda_R$"]]);
            if (slug && !isNaN(preco)) precos[slug] = preco;
          }
          if (typeof PRODUCTS !== "undefined") {
            PRODUCTS.forEach(function (p) { if (precos[p.slug] !== undefined) p.preco = precos[p.slug]; });
          }
          allProducts = uniqueProducts(typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
          populateBrandFilter();
          applyFilters();
          renderReels(allProducts);
          return;
        }

        // Modo completo: reconstrói catálogo a partir da planilha
        var newProducts = [];
        for (var j = 1; j < lines.length; j++) {
          var c = parseCSVLine(lines[j]).map(function (v) { return v.trim().replace(/^"|"$/g, ""); });
          var slug = c[idx["slug"]];
          if (!slug) continue;

          var marcaRaw = idx["marca"] !== undefined ? c[idx["marca"]] : "";
          var marcaDisplay = (marcaRaw && marcaRaw !== "A confirmar") ? marcaRaw : null;
          var precoVal = idx["preco_venda_R$"] !== undefined ? parsePrice(c[idx["preco_venda_R$"]]) : NaN;
          var status = idx["status"] !== undefined ? c[idx["status"]] : "disponivel";

          newProducts.push({
            slug: slug,
            nome: idx["nome_produto"] !== undefined ? c[idx["nome_produto"]] : slug,
            marca: marcaDisplay,
            marcaFiltro: normalizeBrand(marcaRaw),
            familia: idx["familia_olfativa"] !== undefined ? c[idx["familia_olfativa"]] : "",
            descricao: idx["descricao"] !== undefined ? c[idx["descricao"]] : "",
            preco: isNaN(precoVal) ? null : precoVal,
            oculto: status === 'oculto-sem-foto' || status === 'oculto',
            aPartirDe: status === "disponivel-categoria",
            img: "assets/products/" + slug + ".jpg",
            consultarFoto: false,
            categoria: idx["categoria"] !== undefined ? c[idx["categoria"]] : "perfume",
            genero: idx["genero"] !== undefined ? (c[idx["genero"]] || '') : '',
          });
        }

        // Merge: keep marcaFiltro/img from data.js, prices from sheet
        // Products only in data.js are also included
        var dataJsMap = {};
        if (typeof PRODUCTS !== "undefined") {
          PRODUCTS.forEach(function (p) { dataJsMap[p.slug] = p; });
        }
        var sheetSlugsSet = {};
        newProducts.forEach(function (p) { sheetSlugsSet[p.slug] = true; });

        var mergedProducts = newProducts.map(function (p) {
          var base = dataJsMap[p.slug];
          if (base) {
            p.oculto = p.oculto || !!base.oculto;
            p.marcaFiltro = base.marcaFiltro || p.marcaFiltro;
            p.fotos = base.fotos;
            if (base.img && base.img !== "assets/products/no-image.jpg") p.img = base.img;
            if (!p.genero && base.genero !== undefined) p.genero = base.genero;
          }
          return p;
        });

        if (typeof PRODUCTS !== "undefined") {
          PRODUCTS.forEach(function (p) {
            if (!sheetSlugsSet[p.slug]) mergedProducts.push(p);
          });
        }

        allProducts = uniqueProducts(mergedProducts);

        populateBrandFilter();
        applyFilters();
        renderReels(allProducts);
      })
      .catch(function () { /* usa data.js como fallback */ });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Meta Pixel: rastreia cliques nos botões de WhatsApp
  document.addEventListener("click", function (e) {
    var cta = e.target.closest(".card-cta, .btn-whatsapp, .wa-float, .cuidado-card .card-cta");
    if (!cta || typeof fbq === "undefined") return;
    var name = cta.getAttribute("data-fbq-name");
    var price = parseFloat(cta.getAttribute("data-fbq-price") || "0");
    if (name && price) {
      fbq("track", "InitiateCheckout", { content_name: name, value: price, currency: "BRL" });
    } else {
      fbq("track", "Contact");
    }
  });
})();
