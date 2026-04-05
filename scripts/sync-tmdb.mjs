import admin from "firebase-admin";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
const TITLES_COLLECTION = "moviemate_titles";
const ALLOWED_LANGUAGE_CODES = new Set(["en", "hi", "ja", "ko", "ne"]);
const UPCOMING_PAGE_COUNT = 6;
const POPULAR_PAGE_COUNT = 10;
const TRENDING_PAGE_COUNT = 10;

const requiredEnv = ["TMDB_TOKEN", "FIREBASE_SERVICE_ACCOUNT"];

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const LANGUAGE_MAP = {
  en: "English",
  hi: "Hindi",
  ja: "Japanese",
  ne: "Nepali",
  ko: "Korean",
  ta: "Tamil",
  te: "Telugu",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  zh: "Chinese"
};

function toLanguageList(code) {
  return [LANGUAGE_MAP[code] || code?.toUpperCase() || "English"];
}

function formatGenre(genreIds, genreMap) {
  const names = genreIds.map((id) => genreMap.get(id)).filter(Boolean);
  return names.length ? names.join(", ") : "Drama";
}

function buildPosterUrl(item) {
  if (item.poster_path) {
    return `${TMDB_IMAGE_BASE}${item.poster_path}`;
  }

  if (item.backdrop_path) {
    return `${TMDB_IMAGE_BASE}${item.backdrop_path}`;
  }

  return "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80";
}

async function fetchTmdb(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDb request failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchGenres(type) {
  const endpoint = type === "Movie" ? "/genre/movie/list" : "/genre/tv/list";
  const payload = await fetchTmdb(endpoint, { language: "en-US" });
  return new Map((payload.genres || []).map((genre) => [genre.id, genre.name]));
}

async function fetchPagedResults(path, params, pages) {
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1);
  const results = await Promise.all(
    pageNumbers.map((page) =>
      fetchTmdb(path, {
        ...params,
        page
      })
    )
  );

  return results.flatMap((page) => page.results || []);
}

async function fetchUpcomingMovies() {
  return fetchPagedResults(
    "/movie/upcoming",
    {
      language: "en-US",
      region: "IN"
    },
    UPCOMING_PAGE_COUNT
  );
}

async function fetchUpcomingSeries() {
  const today = new Date().toISOString().slice(0, 10);
  return fetchPagedResults(
    "/discover/tv",
    {
      language: "en-US",
      sort_by: "first_air_date.asc",
      first_air_date_gte: today,
      include_null_first_air_dates: "false",
      vote_count_gte: 20
    },
    UPCOMING_PAGE_COUNT
  );
}

async function fetchPopularMovies() {
  return fetchPagedResults(
    "/movie/popular",
    {
      language: "en-US",
      region: "IN"
    },
    POPULAR_PAGE_COUNT
  );
}

async function fetchPopularSeries() {
  return fetchPagedResults(
    "/tv/popular",
    {
      language: "en-US"
    },
    POPULAR_PAGE_COUNT
  );
}

async function fetchTrendingMovies() {
  return fetchPagedResults("/trending/movie/week", {}, TRENDING_PAGE_COUNT);
}

async function fetchTrendingSeries() {
  return fetchPagedResults("/trending/tv/week", {}, TRENDING_PAGE_COUNT);
}

function isAllowedLanguage(item) {
  return ALLOWED_LANGUAGE_CODES.has(item.original_language);
}

function normalizeTmdbItem(item, type, genreMap, bucket) {
  const releaseDate = type === "Movie" ? item.release_date : item.first_air_date;
  const today = new Date().toISOString().slice(0, 10);
  const isUpcoming = releaseDate ? releaseDate >= today : true;

  return {
    id: `tmdb-${type.toLowerCase()}-${item.id}`,
    title: type === "Movie" ? item.title : item.name,
    type,
    status: isUpcoming ? "Upcoming" : "Released",
    releaseDate: releaseDate || "",
    genre: formatGenre(item.genre_ids || [], genreMap),
    language: toLanguageList(item.original_language),
    description:
      item.overview?.trim() ||
      "Freshly synced from TMDb. Add your own review and reactions on MovieMate.",
    image: buildPosterUrl(item),
    approved: true,
    pinned: false,
    trending: false,
    source: "tmdb",
    tmdbId: item.id,
    tmdbPopularity: Number(item.popularity || 0),
    importBuckets: [bucket]
  };
}

async function upsertTitles(items) {
  let batch = db.batch();
  let operationCount = 0;

  for (const item of items) {
    const ref = db.collection(TITLES_COLLECTION).doc(item.id);
    const existing = await ref.get();
    const existingData = existing.exists ? existing.data() : {};

    batch.set(
      ref,
      {
        ...item,
        likes: Number(existingData.likes || 0),
        dislikes: Number(existingData.dislikes || 0),
        comments: Array.isArray(existingData.comments) ? existingData.comments : [],
        pinned: Boolean(existingData.pinned ?? item.pinned),
        trending: Boolean(existingData.trending ?? item.trending),
        approved: existingData.approved ?? item.approved,
        importBuckets: Array.isArray(item.importBuckets) ? item.importBuckets : [],
        tmdbPopularity: Number(item.tmdbPopularity || 0),
        createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
}

async function cleanupImportedTitles() {
  // Keep imported TMDb titles stored on the website even after release
  // or after they fall out of the current TMDb lists. This lets the site
  // grow into a longer-term library instead of replacing older imports.
  return Promise.resolve();
}

async function run() {
  console.log("Sync started...");

  const [
    movieGenres,
    tvGenres,
    upcomingMovies,
    upcomingSeries,
    popularMovies,
    popularSeries,
    trendingMovies,
    trendingSeries
  ] = await Promise.all([
    fetchGenres("Movie"),
    fetchGenres("Series"),
    fetchUpcomingMovies(),
    fetchUpcomingSeries(),
    fetchPopularMovies(),
    fetchPopularSeries(),
    fetchTrendingMovies(),
    fetchTrendingSeries()
  ]);

  const normalizedUpcomingMovies = upcomingMovies
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres, "upcoming"));
  const normalizedUpcomingSeries = upcomingSeries
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Series", tvGenres, "upcoming"));
  const normalizedPopularMovies = popularMovies
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres, "popular"));
  const normalizedPopularSeries = popularSeries
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Series", tvGenres, "popular"));
  const normalizedTrendingMovies = trendingMovies
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres, "trending"));
  const normalizedTrendingSeries = trendingSeries
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Series", tvGenres, "trending"));

  const grouped = new Map();

  [
    ...normalizedUpcomingMovies,
    ...normalizedUpcomingSeries,
    ...normalizedPopularMovies,
    ...normalizedPopularSeries,
    ...normalizedTrendingMovies,
    ...normalizedTrendingSeries
  ].forEach((item) => {
    const existing = grouped.get(item.id);

    if (!existing) {
      grouped.set(item.id, item);
      return;
    }

    grouped.set(item.id, {
      ...existing,
      ...item,
      status:
        existing.importBuckets.includes("upcoming") || item.importBuckets.includes("upcoming")
          ? "Upcoming"
          : existing.status,
      importBuckets: [...new Set([...(existing.importBuckets || []), ...(item.importBuckets || [])])]
    });
  });

  const merged = [...grouped.values()];

  await upsertTitles(merged);
  await cleanupImportedTitles();

  console.log(`Sync complete. Updated ${merged.length} titles.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
