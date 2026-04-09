import admin from "firebase-admin";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
const TMDB_PROFILE_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
const TITLES_COLLECTION = "moviemate_titles";
const PEOPLE_COLLECTION = "moviemate_people";
const ALLOWED_LANGUAGE_CODES = new Set(["en", "hi", "ja", "ko", "ne", "ta", "te", "ml", "kn"]);
const WATCH_PROVIDER_REGIONS = ["IN", "US", "GB"];
const UPCOMING_PAGE_COUNT = 3;
const BOLLYWOOD_PAGE_COUNT = 3;
const SOUTH_PAGE_COUNT = 3;
const POPULAR_PAGE_COUNT = 4;
const TRENDING_PAGE_COUNT = 4;
const TITLE_BATCH_SIZE = 80;
const PEOPLE_BATCH_SIZE = 20;
const MAX_TITLES_TO_SYNC = 220;
const MAX_PEOPLE_TO_SYNC = 60;

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
  ml: "Malayalam",
  kn: "Kannada",
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

function buildProfileUrl(path) {
  return path ? `${TMDB_PROFILE_IMAGE_BASE}${path}` : "";
}

function buildTrailerSearchUrl(item, type) {
  const title = item.title || item.name || "movie trailer";
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`;
}

function buildYouTubeWatchUrl(key) {
  return key ? `https://www.youtube.com/watch?v=${key}` : "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFirestoreError(error) {
  const code = String(error?.code || "");
  const details = String(error?.details || error?.message || "").toLowerCase();
  return (
    code === "4" ||
    code === "8" ||
    details.includes("deadline exceeded") ||
    details.includes("quota exceeded") ||
    details.includes("resource_exhausted")
  );
}

async function commitBatchWithRetry(batch, label) {
  const delays = [1500, 4000, 8000];

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      if (attempt === delays.length || !isTransientFirestoreError(error)) {
        throw error;
      }

      console.warn(`${label} commit failed, retrying in ${delays[attempt]}ms: ${error.message}`);
      await wait(delays[attempt]);
    }
  }
}

function normalizePlatformName(name) {
  const value = String(name || "").trim();
  const lower = value.toLowerCase();

  if (!value) {
    return "";
  }

  if (lower.includes("netflix")) {
    return "Netflix";
  }

  if (
    lower.includes("jiohotstar") ||
    lower.includes("hotstar") ||
    lower.includes("disney+ hotstar") ||
    lower.includes("disney plus hotstar") ||
    lower.includes("disney hotstar")
  ) {
    return "JioHotstar";
  }

  if (
    lower.includes("prime video") ||
    lower.includes("amazon prime") ||
    lower.includes("amazon video")
  ) {
    return "Prime Video";
  }

  if (lower.includes("crunchyroll")) {
    return "Crunchyroll";
  }

  if (lower.includes("zee5")) {
    return "ZEE5";
  }

  if (lower.includes("sony liv") || lower.includes("sonyliv")) {
    return "SonyLIV";
  }

  if (lower.includes("apple tv")) {
    return "Apple TV+";
  }

  if (lower.includes("theatre") || lower.includes("theater") || lower.includes("cinema")) {
    return "Theatres";
  }

  return value;
}

function pickBestVideo(videos = []) {
  if (!Array.isArray(videos) || !videos.length) {
    return null;
  }

  const youtubeVideos = videos.filter((video) => video.site === "YouTube" && video.key);

  if (!youtubeVideos.length) {
    return null;
  }

  const scoring = (video) => {
    let score = 0;

    if (video.official) {
      score += 5;
    }

    if (video.type === "Trailer") {
      score += 4;
    } else if (video.type === "Teaser") {
      score += 2;
    }

    if (video.iso_639_1 === "en") {
      score += 2;
    }

    return score;
  };

  return [...youtubeVideos].sort((left, right) => scoring(right) - scoring(left))[0];
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

async function fetchBollywoodMovies() {
  return fetchPagedResults(
    "/discover/movie",
    {
      language: "en-US",
      region: "IN",
      with_original_language: "hi",
      sort_by: "popularity.desc",
      vote_count_gte: 20,
      include_adult: "false"
    },
    BOLLYWOOD_PAGE_COUNT
  );
}

async function fetchSouthMovies() {
  const southLanguages = ["ta", "te", "ml", "kn"];
  const results = await Promise.all(
    southLanguages.map((languageCode) =>
      fetchPagedResults(
        "/discover/movie",
        {
          language: "en-US",
          region: "IN",
          with_original_language: languageCode,
          sort_by: "popularity.desc",
          vote_count_gte: 20,
          include_adult: "false"
        },
        SOUTH_PAGE_COUNT
      )
    )
  );

  return results.flat();
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

async function fetchTrailerUrl(item, type) {
  const endpoint =
    type === "Movie" ? `/movie/${item.tmdbId}/videos` : `/tv/${item.tmdbId}/videos`;

  const payload = await fetchTmdb(endpoint, {
    language: "en-US"
  });

  const bestVideo = pickBestVideo(payload.results || []);
  return bestVideo ? buildYouTubeWatchUrl(bestVideo.key) : buildTrailerSearchUrl(item, type);
}

async function fetchCredits(item, type) {
  const endpoint =
    type === "Movie"
      ? `/movie/${item.tmdbId}/credits`
      : `/tv/${item.tmdbId}/aggregate_credits`;

  const payload = await fetchTmdb(endpoint, {
    language: "en-US"
  });

  const castList = Array.isArray(payload.cast) ? payload.cast : [];
  const crewList = Array.isArray(payload.crew) ? payload.crew : [];

  const cast = castList.slice(0, 8).map((person) => ({
    tmdbPersonId: Number(person.id || 0),
    name: person.name || "",
    role:
      person.character ||
      (Array.isArray(person.roles) && person.roles[0]?.character) ||
      "Cast",
    image: buildProfileUrl(person.profile_path)
  }));

  const crew = crewList.slice(0, 6).map((person) => ({
    tmdbPersonId: Number(person.id || 0),
    name: person.name || "",
    role:
      person.job ||
      (Array.isArray(person.jobs) && person.jobs[0]?.job) ||
      "Crew",
    image: buildProfileUrl(person.profile_path)
  }));

  const directorPerson =
    crewList.find((person) => person.job === "Director") ||
    crewList.find((person) => Array.isArray(person.jobs) && person.jobs.some((job) => job.job === "Director")) ||
    crewList.find((person) => Array.isArray(person.jobs) && person.jobs.some((job) => job.job === "Creator")) ||
    crewList.find((person) => Array.isArray(person.jobs) && person.jobs.some((job) => job.job === "Executive Producer"));

  const mainLeadPerson = castList[0];
  const heroinePerson = castList.find((person) => person.gender === 1);

  return {
    director: directorPerson?.name || "",
    mainLead: mainLeadPerson?.name || "",
    heroine: heroinePerson?.name || "",
    cast,
    crew
  };
}

async function fetchPersonDetails(personId) {
  if (!personId) {
    return null;
  }

  const payload = await fetchTmdb(`/person/${personId}`, {
    language: "en-US"
  });

  return {
    tmdbPersonId: Number(payload.id || personId),
    name: payload.name || "",
    image: buildProfileUrl(payload.profile_path),
    biography: String(payload.biography || "").trim(),
    birthday: payload.birthday || "",
    birthplace: payload.place_of_birth || "",
    knownForDepartment: payload.known_for_department || ""
  };
}

async function fetchWatchProviders(item, type) {
  const endpoint =
    type === "Movie"
      ? `/movie/${item.tmdbId}/watch/providers`
      : `/tv/${item.tmdbId}/watch/providers`;

  const payload = await fetchTmdb(endpoint);
  const results = payload.results || {};
  const collected = [];

  WATCH_PROVIDER_REGIONS.forEach((region) => {
    const regionResult = results[region];

    if (!regionResult) {
      return;
    }

    ["flatrate", "ads", "buy", "rent"].forEach((groupKey) => {
      const providers = Array.isArray(regionResult[groupKey]) ? regionResult[groupKey] : [];

      providers.forEach((provider) => {
        const normalized = normalizePlatformName(provider.provider_name);

        if (normalized) {
          collected.push(normalized);
        }
      });
    });
  });

  return [...new Set(collected)];
}

async function fetchSeriesDetails(item) {
  if (item.type !== "Series" || !item.tmdbId) {
    return {
      seasonsCount: 0,
      episodesCount: 0,
      seasons: []
    };
  }

  const payload = await fetchTmdb(`/tv/${item.tmdbId}`, {
    language: "en-US"
  });

  const seasons = Array.isArray(payload.seasons)
    ? payload.seasons
        .filter((season) => Number(season.season_number || 0) > 0)
        .map((season) => ({
          number: Number(season.season_number || 0),
          title: season.name || `Season ${season.season_number || ""}`.trim(),
          year: season.air_date ? new Date(`${season.air_date}T00:00:00`).getFullYear() : "",
          episodes: Number(season.episode_count || 0),
          image: buildPosterUrl(season),
          reviewsCount: 0
        }))
    : [];

  return {
    seasonsCount: Number(payload.number_of_seasons || seasons.length || 0),
    episodesCount: Number(payload.number_of_episodes || 0),
    seasons
  };
}

async function safeFetchTrailerUrl(item) {
  try {
    return await fetchTrailerUrl(item, item.type);
  } catch (error) {
    console.warn(`Trailer fetch failed for ${item.id}: ${error.message}`);
    return buildTrailerSearchUrl(item, item.type);
  }
}

async function safeFetchCredits(item) {
  try {
    return await fetchCredits(item, item.type);
  } catch (error) {
    console.warn(`Credits fetch failed for ${item.id}: ${error.message}`);
    return {
      director: "",
      mainLead: "",
      heroine: "",
      cast: [],
      crew: []
    };
  }
}

async function safeFetchWatchProviders(item) {
  try {
    return await fetchWatchProviders(item, item.type);
  } catch (error) {
    console.warn(`Watch providers fetch failed for ${item.id}: ${error.message}`);
    return [];
  }
}

async function safeFetchPersonDetails(personId) {
  try {
    return await fetchPersonDetails(personId);
  } catch (error) {
    console.warn(`Person details fetch failed for ${personId}: ${error.message}`);
    return null;
  }
}

async function safeFetchSeriesDetails(item) {
  try {
    return await fetchSeriesDetails(item);
  } catch (error) {
    console.warn(`Series details fetch failed for ${item.id}: ${error.message}`);
    return {
      seasonsCount: 0,
      episodesCount: 0,
      seasons: []
    };
  }
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
    trailerUrl: buildTrailerSearchUrl(item, type),
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

    batch.set(
      ref,
      {
        ...item,
        importBuckets: Array.isArray(item.importBuckets) ? item.importBuckets : [],
        tmdbPopularity: Number(item.tmdbPopularity || 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    operationCount += 1;

    if (operationCount === TITLE_BATCH_SIZE) {
      await commitBatchWithRetry(batch, "titles");
      await wait(250);
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await commitBatchWithRetry(batch, "titles");
  }
}

async function upsertPeople(people) {
  if (!people.length) {
    return;
  }

  const filteredPeople = people
    .filter((person) => person.tmdbPersonId && (person.name || person.image || person.biography))
    .slice(0, MAX_PEOPLE_TO_SYNC);

  if (!filteredPeople.length) {
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const person of filteredPeople) {
    const ref = db.collection(PEOPLE_COLLECTION).doc(`tmdb-person-${person.tmdbPersonId}`);

    batch.set(
      ref,
      {
        ...person,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    operationCount += 1;

    if (operationCount === PEOPLE_BATCH_SIZE) {
      await commitBatchWithRetry(batch, "people");
      await wait(250);
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await commitBatchWithRetry(batch, "people");
  }
}

async function cleanupImportedTitles() {
  // Keep imported TMDb titles stored on the website even after release
  // or after they fall out of the current TMDb lists. This lets the site
  // grow into a longer-term library instead of replacing older imports.
  return Promise.resolve();
}

async function enrichWithTrailers(items) {
  const concurrency = 4;
  const enriched = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const results = await Promise.all(
      chunk.map(async (item) => ({
        ...item,
        trailerUrl: await safeFetchTrailerUrl(item),
        ...(await safeFetchCredits(item)),
        platforms: await safeFetchWatchProviders(item),
        ...(await safeFetchSeriesDetails(item))
      }))
    );
    enriched.push(...results);
  }

  return enriched;
}

function collectUniquePeople(items) {
  const peopleMap = new Map();

  items.forEach((item) => {
    [...(item.cast || []), ...(item.crew || [])].forEach((person) => {
      const personId = Number(person.tmdbPersonId || 0);

      if (!personId || peopleMap.has(personId)) {
        return;
      }

      peopleMap.set(personId, {
        tmdbPersonId: personId,
        name: person.name || "",
        image: person.image || "",
        biography: "",
        birthday: "",
        birthplace: "",
        knownForDepartment: ""
      });
    });
  });

  return [...peopleMap.values()];
}

async function enrichPeople(people) {
  const concurrency = 3;
  const enriched = [];

  for (let index = 0; index < people.length; index += concurrency) {
    const chunk = people.slice(index, index + concurrency);
    const results = await Promise.all(
      chunk.map(async (person) => {
        const details = await safeFetchPersonDetails(person.tmdbPersonId);
        return {
          ...person,
          ...(details || {})
        };
      })
    );
    enriched.push(...results);
  }

  return enriched;
}

async function run() {
  console.log("Sync started...");

  const [
    movieGenres,
    tvGenres,
    upcomingMovies,
    upcomingSeries,
    bollywoodMovies,
    southMovies,
    popularMovies,
    popularSeries,
    trendingMovies,
    trendingSeries
  ] = await Promise.all([
    fetchGenres("Movie"),
    fetchGenres("Series"),
    fetchUpcomingMovies(),
    fetchUpcomingSeries(),
    fetchBollywoodMovies(),
    fetchSouthMovies(),
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
  const normalizedBollywoodMovies = bollywoodMovies
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres, "bollywood"));
  const normalizedSouthMovies = southMovies
    .filter(isAllowedLanguage)
    .map((item) => normalizeTmdbItem(item, "Movie", movieGenres, "south"));
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
    ...normalizedBollywoodMovies,
    ...normalizedSouthMovies,
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

  const merged = [...grouped.values()].slice(0, MAX_TITLES_TO_SYNC);
  const mergedWithTrailers = await enrichWithTrailers(merged);
  const uniquePeople = collectUniquePeople(mergedWithTrailers);
  const enrichedPeople = await enrichPeople(uniquePeople);

  await upsertTitles(mergedWithTrailers);
  await upsertPeople(enrichedPeople);
  await cleanupImportedTitles();

  console.log(`Sync complete. Updated ${mergedWithTrailers.length} titles.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
