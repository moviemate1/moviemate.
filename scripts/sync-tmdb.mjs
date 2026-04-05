import admin from "firebase-admin";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
const TITLES_COLLECTION = "moviemate_titles";

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

async function fetchUpcomingMovies() {
  const pages = [1, 2];
  const results = await Promise.all(
    pages.map((page) =>
      fetchTmdb("/movie/upcoming", {
        language: "en-US",
        page,
        region: "IN"
      })
    )
  );

  return results.flatMap((page) => page.results || []);
}

async function fetchUpcomingSeries() {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [1, 2];
  const results = await Promise.all(
    pages.map((page) =>
      fetchTmdb("/discover/tv", {
        language: "en-US",
        page,
        sort_by: "first_air_date.asc",
        first_air_date_gte: today,
        include_null_first_air_dates: "false",
        vote_count_gte: 20
      })
    )
  );

  return results.flatMap((page) => page.results || []);
}

function normalizeTmdbItem(item, type, genreMap) {
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
    tmdbId: item.id
  };
}

async function upsertTitles(items) {
  const batch = db.batch();

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
        createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function run() {
  console.log("Sync started...");

  const [movieGenres, tvGenres, upcomingMovies, upcomingSeries] = await Promise.all([
    fetchGenres("Movie"),
    fetchGenres("Series"),
    fetchUpcomingMovies(),
    fetchUpcomingSeries()
  ]);

  const normalizedMovies = upcomingMovies
    .slice(0, 20)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres));
  const normalizedSeries = upcomingSeries
    .slice(0, 20)
    .map((item) => normalizeTmdbItem(item, "Series", tvGenres));

  const merged = [...normalizedMovies, ...normalizedSeries];

  await upsertTitles(merged);

  console.log(`Sync complete. Updated ${merged.length} titles.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
