import { load, text, attr, each, num, lastPage, currentPage } from '../../utils/dom.js';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function parseEpisodes($, ctx) {
  return {
    sub: num($(ctx).find('span.sub').text().trim()) || null,
    dub: num($(ctx).find('span.dub').text().trim()) || null,
  };
}

function parseAitem($, el) {
  const href   = attr($, 'a.poster', 'href', el) || attr($, 'a', 'href', el);
  const id     = href ? href.replace('/watch/', '').trim() : null;
  const name   = attr($, 'a.title', 'title', el) || text($, 'a.title', el) || text($, 'h6.title', el);
  const jname  = attr($, 'a.title, h6.title', 'data-jp', el) || null;
  const poster = attr($, 'img.lazyload', 'data-src', el) || attr($, 'img', 'src', el);
  const spans  = $(el).find('.info span b');
  const type   = spans.last().text().trim() || null;
  const eps    = parseEpisodes($, el);
  return { id, name, jname, poster, type, episodes: eps };
}

function parseGenreList($) {
  return each($, 'header .nav-menu ul li ul.c4 li a', el => el.text().trim()).filter(Boolean);
}

// ─── Home page ────────────────────────────────────────────────────────────────

export function parseHome(html) {
  const $ = load(html);

  const genres = each($, 'header .nav-menu ul li ul.c4 li a', el => el.text().trim()).filter(Boolean);

  const spotlightAnimes = each($, '#featured .swiper-wrapper .swiper-slide', (el) => {
    const href = attr($, 'a.watch-btn', 'href', el);
    const id   = href ? href.replace('/watch/', '') : null;
    const name = text($, 'p.title', el);
    const jname = attr($, 'p.title', 'data-jp', el);
    const description = text($, 'p.desc', el);
    const poster = el.attr('style')?.match(/url\(([^)]+)\)/)?.[1] || null;
    const rating = text($, '.mics div:nth-child(1) span', el);
    const eps    = parseEpisodes($, el);
    const type   = text($, '.info span b', el);
    const otherInfo = [
      text($, '.mics div:nth-child(2) span', el),
      text($, '.mics div:nth-child(3) span', el),
      type,
    ].filter(Boolean);
    return { id, name, jname, poster, description, rating, otherInfo, episodes: eps };
  });

  const latestEpisodeAnimes = each($, '#latest-updates .aitem', (el) => {
    const href   = attr($, 'a.poster', 'href', el);
    const id     = href?.replace('/watch/', '').split('#')[0] || null;
    const name   = attr($, 'a.title', 'title', el) || text($, 'a.title', el);
    const poster = attr($, 'img.lazyload', 'data-src', el);
    const spans  = $(el).find('.info span b');
    const type   = spans.last().text().trim() || null;
    const eps    = parseEpisodes($, el);
    return { id, name, poster, type, episodes: eps };
  });

  // New Releases  (first .swiper-slide inside .alist-group)
  const newReleases = each($, '.alist-group .swiper-slide:nth-child(1) .aitem', (el) => {
    const href  = el.attr('href');
    const id    = href ? href.replace('/watch/', '') : null;
    const name  = attr($, 'h6.title', 'title', el) || text($, 'h6.title', el);
    const jname = attr($, 'h6.title', 'data-jp', el);
    const poster = attr($, 'img.lazyload', 'data-src', el);
    const eps   = parseEpisodes($, el);
    const type  = text($, '.info span b', el);
    return { id, name, jname, poster, type, episodes: eps };
  });

  // Top Trending (now / day / week / month tabs)
  function parseTopAnimes(tabId) {
    return each($, `.aitem-col.top-anime[data-id="${tabId}"] .aitem`, (el) => {
      const href   = el.attr('href');
      const id     = href ? href.replace('/watch/', '') : null;
      const rank   = num(text($, '.num', el));
      const name   = text($, '.title', el);
      const poster = el.css ? null : el.attr('style')?.match(/url\(([^)]+)\)/)?.[1] || null;
      const eps    = parseEpisodes($, el);
      return { id, name, poster: el.attr('style')?.match(/url\(([^)]+)\)/)?.[1] || null, rank, episodes: eps };
    });
  }

  const top10Animes = {
    today: parseTopAnimes('trending'),
    day:   parseTopAnimes('day'),
    week:  parseTopAnimes('week'),
    month: parseTopAnimes('month'),
  };

  return {
    genres,
    spotlightAnimes,
    latestEpisodeAnimes,
    newReleases,
    top10Animes,
  };
}

// ─── Search / Browser (sreach.html, az_a.html, genre_action.html, type_ova.html) ──

export function parseSearch(html) {
  const $ = load(html);

  const animes = each($, '.aitem-wrapper.regular .aitem', (el) => parseAitem($, el));

  const totalText = $('.shead.justify span:last-child').text().replace(/[^0-9]/g, '');
  const totalCount = num(totalText);
  const cur  = currentPage($);
  const last = lastPage($);

  return {
    animes,
    currentPage: cur,
    totalPages:  last,
    hasNextPage: cur < last,
    totalCount:  totalCount,
  };
}

// ─── AZ List ─────────────────────────────────────────────────────────────────

export function parseAzList(html) {
  const $ = load(html);

  const sortOption = text($, '#az-filters li a.active') || 'all';
  const animes = each($, '.aitem-wrapper.regular .aitem', (el) => parseAitem($, el));
  const cur  = currentPage($);
  const last = lastPage($);

  return {
    sortOption,
    animes,
    currentPage: cur,
    totalPages:  last,
    hasNextPage: cur < last,
  };
}

// ─── Genre / Type / Category list pages (share same aitem structure) ──────────

export function parseListPage(html) {
  const $ = load(html);
  const title = text($, '.shead.justify .stitle');
  const animes = each($, '.aitem-wrapper.regular .aitem', (el) => parseAitem($, el));
  const cur  = currentPage($);
  const last = lastPage($);

  return {
    title,
    animes,
    currentPage: cur,
    totalPages:  last,
    hasNextPage: cur < last,
  };
}

// ─── Anime detail / watch page ────────────────────────────────────────────────

export function parseAnime(html) {
  const $ = load(html);

  const id = $('link[rel="canonical"]').attr('href')?.replace('https://anikai.to/watch/', '') || null;
  const name  = text($, 'h1.title');
  const jname = text($, 'small.al-title') || attr($, 'h1.title', 'data-jp');
  const poster = attr($, '.poster img[itemprop="image"]', 'src');
  const description = text($, '.desc.text-expand');
  const rating = text($, '.info .rating');
  const type   = text($, '.info span b');
  const malId  = attr($, '#watch-page', 'data-mal-id');
  const alId   = attr($, '#watch-page', 'data-al-id');

  const episodes = {
    sub: num($('.info .sub').first().text().trim()),
    dub: num($('.info .dub').first().text().trim()),
  };

  // Detail rows
  const detailText = (label) => {
    let val = null;
    $('.detail div > div').each((_, el) => {
      if ($(el).text().startsWith(label)) {
        val = $(el).find('span, a').map((i, e) => $(e).text().trim()).get().join(', ') || null;
      }
    });
    return val;
  };

  const genres    = each($, '.detail div div:contains("Genres") a', el => el.text().trim());
  const studios   = each($, '.detail div div:contains("Studios") a', el => el.text().trim());
  const producers = each($, '.detail div div:contains("Producers") a', el => el.text().trim());
  const premiered = detailText('Premiered:');
  const aired     = detailText('Date aired:');
  const status    = detailText('Status:');
  const duration  = detailText('Duration:');
  const score     = detailText('MAL:');
  const synonyms  = jname;
  const japanese  = jname;

  // Related animes (sidebar)
  const related = each($, '#related-anime .aitem-col .aitem', (el) => {
    const href  = el.attr('href');
    const rId   = href ? href.replace('/watch/', '') : null;
    const rName = text($, '.title', el);
    const rPoster = el.attr('style')?.match(/url\('([^']+)'\)/)?.[1] || null;
    const rType = text($, '.info span b', el);
    const rEps  = parseEpisodes($, el);
    return { id: rId, name: rName, poster: rPoster, type: rType, episodes: rEps };
  });

  // Recommended
  const recommended = each($, '.sidebar-section:not(#related-anime) .aitem-col .aitem', (el) => {
    const href   = el.attr('href');
    const rId    = href ? href.replace('/watch/', '') : null;
    const rName  = text($, '.title', el);
    const rPoster = el.attr('style')?.match(/url\('([^']+)'\)/)?.[1] || null;
    const rType  = text($, '.info span b', el);
    const rEps   = parseEpisodes($, el);
    return { id: rId, name: rName, poster: rPoster, type: rType, episodes: rEps };
  });

  // Seasons
  const seasons = each($, '#seasons .swiper-slide.aitem', (el) => {
    const href   = attr($, 'a.poster', 'href', el);
    const sId    = href ? href.replace('/watch/', '') : null;
    const sLabel = text($, '.detail span', el);
    const sEps   = text($, '.detail .btn', el);
    const sPoster = attr($, 'img', 'src', el);
    return { id: sId, label: sLabel, episodes: sEps, poster: sPoster };
  });

  return {
    anime: {
      id, name, jname, synonyms, japanese,
      poster, description, type, rating,
      episodes, duration, premiered, aired, status, score,
      genres, studios, producers,
      malId, alId,
    },
    related,
    recommended,
    seasons,
  };
}
