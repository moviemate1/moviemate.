import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const TITLES_COLLECTION = "moviemate_titles";
const SETTINGS_COLLECTION = "moviemate_settings";
const HOMEPAGE_DOC_ID = "homepage";
const REACTIONS_STORAGE_KEY = "moviemate_reactions";
const SAVED_TITLES_STORAGE_KEY = "moviemate_saved_titles";
const OWNER_MODE_KEY = "moviemate_owner_mode";
const USER_NOTIFICATIONS_SEEN_KEY = "moviemate_notifications_seen_at";
const OWNER_PASSCODE = "1A2b3456@";
const OWNER_NOTIFICATION_TOAST_MS = 3200;
const REACTION_OPTIONS = {
  perfect: { label: "Perfect", className: "perfect" },
  goForIt: { label: "Go for it", className: "goforit" },
  timepass: { label: "Timepass", className: "timepass" },
  skip: { label: "Skip", className: "skip" }
};
const DEFAULT_HOMEPAGE_CONTENT = {
  heroEyebrow: "MoviemateHub picks for every mood",
  heroTitle: "Discover movies and series worth your time.",
  heroText:
    "Explore community picks, upcoming releases, and honest reactions across languages and genres in one clean place.",
  featuredTitle: "Top liked picks from the community",
  trendingTitle: "Trending with the community",
  trendingText:
    "A fast shortlist of the movies and series getting the strongest reactions and owner picks.",
  browseTitle: "Search by title, genre, language, or format",
  browseText:
    "Explore community suggestions for movies and series across genres, languages, and platforms with easy filters and quick actions.",
  upcomingTitle: "Upcoming Movies & Series",
  upcomingText:
    "Watch what is releasing next with quick details on title, type, genre, language, release date, and story.",
  suggestTitle: "Share a movie or series with the community",
  suggestText:
    "Add the title, type, genre, language, description, and poster to help others find something great to watch.",
  ownerTitle: "Pending suggestions and homepage control",
  ownerText:
    "Review public suggestions, approve what should go live, and mark standout titles as featured or trending.",
  communityBrowseTitle: "Browse freely",
  communityBrowseText: "Anyone can explore movies and series without creating an account.",
  communitySuggestTitle: "Suggest new titles",
  communitySuggestText: "Help others discover hidden gems across platforms, genres, and languages.",
  communityReviewTitle: "Review and like",
  communityReviewText: "Read public reviews, post your own thoughts, and boost titles you enjoyed.",
  footerText: "A simple public space to explore, review, like, and suggest movies and series."
};

const BASE_TITLES = [
  {
    id: "moonlight-echo",
    title: "Moonlight Echo",
    type: "Movie",
    status: "Released",
    releaseDate: "2025-11-14",
    genre: "Drama",
    language: ["English"],
    description:
      "A grieving radio host forms an unexpected bond with a late-night caller whose secrets reshape both of their lives.",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80",
    likes: 12,
    dislikes: 2,
    approved: true,
    pinned: true,
    trending: true,
    comments: [
      {
        name: "Riya",
        text: "Warm, emotional, and beautifully written.",
        createdAt: "2026-04-05T00:00:00.000Z"
      }
    ]
  },
  {
    id: "neon-run",
    title: "Neon Run",
    type: "Movie",
    status: "Released",
    releaseDate: "2025-08-22",
    genre: "Action",
    language: ["English"],
    description:
      "An ex-getaway driver returns to the city underworld for one final rescue mission racing against sunrise.",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    likes: 18,
    dislikes: 3,
    approved: true,
    pinned: false,
    trending: true,
    comments: []
  },
  {
    id: "orbit-of-us",
    title: "Orbit of Us",
    type: "Movie",
    status: "Released",
    releaseDate: "2026-01-09",
    genre: "Sci-Fi",
    language: ["English", "Japanese"],
    description:
      "Two astronauts stranded near Jupiter unravel a memory-altering signal that may rewrite humanity's future.",
    image:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80",
    likes: 20,
    dislikes: 4,
    approved: true,
    pinned: true,
    trending: false,
    comments: []
  },
  {
    id: "winter-house",
    title: "Winter House",
    type: "Series",
    status: "Released",
    releaseDate: "2025-12-02",
    genre: "Thriller",
    language: ["Hindi"],
    description:
      "A family retreat in the mountains turns sinister when every room begins revealing a different version of the truth.",
    image:
      "https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&w=900&q=80",
    likes: 9,
    dislikes: 1,
    approved: true,
    pinned: false,
    trending: false,
    comments: []
  },
  {
    id: "wildflower-summer",
    title: "Wildflower Summer",
    type: "Series",
    status: "Upcoming",
    releaseDate: "2026-06-18",
    genre: "Romance",
    language: ["Korean"],
    description:
      "A documentary filmmaker revisits her hometown and rediscovers first love while capturing its final harvest festival.",
    image:
      "https://images.unsplash.com/photo-1518131678677-a16a0df1f0cb?auto=format&fit=crop&w=900&q=80",
    likes: 14,
    dislikes: 2,
    approved: true,
    pinned: false,
    trending: true,
    comments: []
  }
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let titlesCache = [];
let homepageContentCache = { ...DEFAULT_HOMEPAGE_CONTENT };
let pendingNotificationState = {
  count: null,
  unsubscribe: null
};

function isOwnerMode() {
  return localStorage.getItem(OWNER_MODE_KEY) === "true";
}

function setOwnerMode(enabled) {
  localStorage.setItem(OWNER_MODE_KEY, enabled ? "true" : "false");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizePersonEntry(person, fallbackRole) {
  if (!person) {
    return null;
  }

  if (typeof person === "string") {
    const trimmed = person.trim();
    return trimmed ? { name: trimmed, role: fallbackRole, image: "" } : null;
  }

  const name = String(person.name || "").trim();

  if (!name) {
    return null;
  }

  return {
    name,
    role: String(person.role || fallbackRole || "").trim(),
    image: String(person.image || "").trim()
  };
}

function normalizePeopleList(list, fallbackRole) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((person) => normalizePersonEntry(person, fallbackRole))
    .filter(Boolean);
}

function parseNameList(value, fallbackRole) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name, role: fallbackRole, image: "" }));
}

function parseCrewText(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, role] = entry.split("-").map((item) => item?.trim());
      if (!name) {
        return null;
      }

      return {
        name,
        role: role || "Crew",
        image: ""
      };
    })
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "Just now";
  }

  const date =
    typeof timestamp?.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function normalizeHomepageContent(data = {}) {
  return {
    heroEyebrow: data.heroEyebrow || DEFAULT_HOMEPAGE_CONTENT.heroEyebrow,
    heroTitle: data.heroTitle || DEFAULT_HOMEPAGE_CONTENT.heroTitle,
    heroText: data.heroText || DEFAULT_HOMEPAGE_CONTENT.heroText,
    featuredTitle: data.featuredTitle || DEFAULT_HOMEPAGE_CONTENT.featuredTitle,
    trendingTitle: data.trendingTitle || DEFAULT_HOMEPAGE_CONTENT.trendingTitle,
    trendingText: data.trendingText || DEFAULT_HOMEPAGE_CONTENT.trendingText,
    browseTitle: data.browseTitle || DEFAULT_HOMEPAGE_CONTENT.browseTitle,
    browseText: data.browseText || DEFAULT_HOMEPAGE_CONTENT.browseText,
    upcomingTitle: data.upcomingTitle || DEFAULT_HOMEPAGE_CONTENT.upcomingTitle,
    upcomingText: data.upcomingText || DEFAULT_HOMEPAGE_CONTENT.upcomingText,
    suggestTitle: data.suggestTitle || DEFAULT_HOMEPAGE_CONTENT.suggestTitle,
    suggestText: data.suggestText || DEFAULT_HOMEPAGE_CONTENT.suggestText,
    ownerTitle: data.ownerTitle || DEFAULT_HOMEPAGE_CONTENT.ownerTitle,
    ownerText: data.ownerText || DEFAULT_HOMEPAGE_CONTENT.ownerText,
    communityBrowseTitle:
      data.communityBrowseTitle || DEFAULT_HOMEPAGE_CONTENT.communityBrowseTitle,
    communityBrowseText:
      data.communityBrowseText || DEFAULT_HOMEPAGE_CONTENT.communityBrowseText,
    communitySuggestTitle:
      data.communitySuggestTitle || DEFAULT_HOMEPAGE_CONTENT.communitySuggestTitle,
    communitySuggestText:
      data.communitySuggestText || DEFAULT_HOMEPAGE_CONTENT.communitySuggestText,
    communityReviewTitle:
      data.communityReviewTitle || DEFAULT_HOMEPAGE_CONTENT.communityReviewTitle,
    communityReviewText:
      data.communityReviewText || DEFAULT_HOMEPAGE_CONTENT.communityReviewText,
    footerText: data.footerText || DEFAULT_HOMEPAGE_CONTENT.footerText
  };
}

function normalizeTitle(docLike) {
  const data = typeof docLike.data === "function" ? docLike.data() : docLike;
  const languages = Array.isArray(data.language)
    ? data.language
    : data.language
      ? [data.language]
      : ["English"];

  return {
    id: data.id || docLike.id,
    title: data.title || "",
    type: data.type || "Movie",
    status: data.status || "Released",
    releaseDate: data.releaseDate || "",
    genre: data.genre || "",
    language: languages,
    description: data.description || "",
    image: data.image || "",
    trailerUrl: data.trailerUrl || "",
    director: data.director || "",
    mainLead: data.mainLead || "",
    heroine: data.heroine || "",
    cast: normalizePeopleList(data.cast, "Cast"),
    crew: normalizePeopleList(data.crew, "Crew"),
    createdAt: data.createdAt || null,
    votePerfect: Number(data.votePerfect || 0),
    voteGoForIt:
      Number(data.voteGoForIt || 0) || (!("voteGoForIt" in data) ? Number(data.likes || 0) : 0),
    voteTimepass: Number(data.voteTimepass || 0),
    voteSkip:
      Number(data.voteSkip || 0) || (!("voteSkip" in data) ? Number(data.dislikes || 0) : 0),
    likes: Number(data.likes || 0),
    dislikes: Number(data.dislikes || 0),
    approved: data.approved !== false,
    pinned: Boolean(data.pinned),
    trending: Boolean(data.trending),
    source: data.source || "",
    tmdbId: data.tmdbId || "",
    tmdbPopularity: Number(data.tmdbPopularity || 0),
    importBuckets: Array.isArray(data.importBuckets) ? data.importBuckets : [],
    comments: Array.isArray(data.comments)
      ? data.comments.map((comment, index) => ({
          id: comment.id || `${data.id || docLike.id}-comment-${index}`,
          name: comment.name || "Anonymous",
          text: comment.text || "",
          createdAt: comment.createdAt || null,
          reports: Array.isArray(comment.reports) ? comment.reports : []
        }))
      : []
  };
}

function getVisibleTitles(titles) {
  return titles.filter((title) => title.approved);
}

function getPendingTitles(titles) {
  return titles.filter((title) => !title.approved);
}

function getStoredReactions() {
  try {
    return JSON.parse(localStorage.getItem(REACTIONS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getSavedTitles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_TITLES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSavedTitle(titleId) {
  return getSavedTitles().includes(titleId);
}

function toggleSavedTitle(titleId) {
  const saved = new Set(getSavedTitles());

  if (saved.has(titleId)) {
    saved.delete(titleId);
  } else {
    saved.add(titleId);
  }

  localStorage.setItem(SAVED_TITLES_STORAGE_KEY, JSON.stringify([...saved]));
}

function getCreatedAtMs(value) {
  if (!value) {
    return 0;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getReaction(titleId) {
  const reactions = getStoredReactions();
  return reactions[titleId] || "";
}

function setReaction(titleId, reaction) {
  const reactions = getStoredReactions();

  if (reaction) {
    reactions[titleId] = reaction;
  } else {
    delete reactions[titleId];
  }

  localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(reactions));
}

function clearReaction(titleId) {
  setReaction(titleId, "");
}

function getReactionStats(title) {
  const perfect = Number(title.votePerfect || 0);
  const goForIt = Number(title.voteGoForIt || 0);
  const timepass = Number(title.voteTimepass || 0);
  const skip = Number(title.voteSkip || 0);
  const total = perfect + goForIt + timepass + skip;
  const perfectPercent = total ? Math.round((perfect / total) * 100) : 0;
  const goForItPercent = total ? Math.round((goForIt / total) * 100) : 0;
  const timepassPercent = total ? Math.round((timepass / total) * 100) : 0;
  const skipPercent = total ? Math.round((skip / total) * 100) : 0;
  const recommendedPercent = perfectPercent + goForItPercent;

  return {
    perfect,
    goForIt,
    timepass,
    skip,
    total,
    perfectPercent,
    goForItPercent,
    timepassPercent,
    skipPercent,
    recommendedPercent
  };
}

function formatReleaseDate(value) {
  if (!value) {
    return "Release date not added";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function reactionButtonsTemplate(title) {
  const currentReaction = getReaction(title.id);
  const stats = getReactionStats(title);
  const saved = isSavedTitle(title.id);

  return `
    <div class="reaction-panel">
      <div class="reaction-buttons">
        ${Object.entries(REACTION_OPTIONS)
          .map(
            ([value, option]) => `
              <button class="reaction-btn reaction-btn-${option.className} ${currentReaction === value ? `active ${option.className}` : ""}" data-id="${title.id}" data-reaction="${value}" type="button">
                ${option.label}
              </button>
            `
          )
          .join("")}
      </div>
      <p class="reaction-summary">${stats.total} votes • ${stats.recommendedPercent}% recommend</p>
    </div>
  `;
}

function toYouTubeSearchUrl(title) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`;
}

function getTrailerLink(title) {
  return title.trailerUrl || toYouTubeSearchUrl(title.title);
}

function getYouTubeEmbedUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return "";
  }

  return "";
}

function playTrailerInline(embedUrl, title) {
  const section = document.querySelector("#trailerSection");

  if (!section || !embedUrl) {
    return;
  }

  section.innerHTML = `
    <iframe
      class="trailer-frame"
      src="${embedUrl}?autoplay=1"
      title="${escapeHtml(title || "MovieMate trailer")}"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>
  `;
}

function formatLargeNumber(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

function buildGenreSegments(title) {
  const genres = title.genre
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!genres.length) {
    return [{ label: "Drama", percent: 100, color: "#d09a7b" }];
  }

  const colors = ["#d09a7b", "#7e46ff", "#1f5fff", "#18cf9b", "#ff8a38"];
  const basePercent = Math.floor(100 / genres.length);

  return genres.map((genre, index) => ({
    label: genre,
    percent: index === genres.length - 1 ? 100 - basePercent * (genres.length - 1) : basePercent,
    color: colors[index % colors.length]
  }));
}

function genreChartStyle(segments) {
  let start = 0;
  const parts = segments.map((segment) => {
    const end = start + segment.percent;
    const result = `${segment.color} ${start}% ${end}%`;
    start = end;
    return result;
  });

  return `background: conic-gradient(${parts.join(", ")});`;
}

function reactionMeterTemplate(title) {
  const stats = getReactionStats(title);
  const total = Math.max(stats.total, 1);
  const perfectPercent = stats.perfectPercent;
  const goForItPercent = stats.goForItPercent;
  const timepassPercent = stats.timepassPercent;
  const skipPercent = stats.skipPercent;
  const recommendedPercent = stats.recommendedPercent;

  return `
    <article class="insight-card">
      <div class="insight-header">
        <div>
          <p class="eyebrow">MovieMate Meter</p>
          <h3>${recommendedPercent}% recommend</h3>
        </div>
        <span class="insight-pill">${formatLargeNumber(total)} votes</span>
      </div>
      <div class="meter-visual" style="background: conic-gradient(#9a5cff 0 ${perfectPercent}%, #18cf9b ${perfectPercent}% ${perfectPercent + goForItPercent}%, #ffbf47 ${perfectPercent + goForItPercent}% ${perfectPercent + goForItPercent + timepassPercent}%, #ff6b6b ${perfectPercent + goForItPercent + timepassPercent}% 100%);">
        <div class="meter-core">
          <strong>${recommendedPercent}%</strong>
          <span>${stats.goForIt + stats.perfect}/${total} recommend</span>
        </div>
      </div>
      <div class="meter-list">
        <div class="meter-row"><span class="meter-dot dot-perfect"></span><span>Perfect</span><strong>${perfectPercent}%</strong></div>
        <div class="meter-row"><span class="meter-dot dot-love"></span><span>Go for it</span><strong>${goForItPercent}%</strong></div>
        <div class="meter-row"><span class="meter-dot dot-timepass"></span><span>Timepass</span><strong>${timepassPercent}%</strong></div>
        <div class="meter-row"><span class="meter-dot dot-skip"></span><span>Skip</span><strong>${skipPercent}%</strong></div>
      </div>
    </article>
  `;
}

function vibeChartTemplate(title) {
  const segments = buildGenreSegments(title);

  return `
    <article class="insight-card">
      <div class="insight-header">
        <div>
          <p class="eyebrow">Vibe Chart</p>
          <h3>${escapeHtml(title.genre || "Story mix")}</h3>
        </div>
      </div>
      <div class="genre-chart" style="${genreChartStyle(segments)}">
        <div class="genre-chart-core">
          <span>${segments.length} moods</span>
        </div>
      </div>
      <div class="meter-list">
        ${segments
          .map(
            (segment) =>
              `<div class="meter-row"><span class="meter-dot" style="background:${segment.color}"></span><span>${escapeHtml(segment.label)}</span><strong>${segment.percent}%</strong></div>`
          )
          .join("")}
      </div>
    </article>
  `;
}

function trailerPanelTemplate(title) {
  const trailerLink = getTrailerLink(title);
  const embedUrl = getYouTubeEmbedUrl(title.trailerUrl);

  if (embedUrl) {
    return `
      <section class="trailer-stage" id="trailerSection">
        <img class="trailer-poster" src="${title.image}" alt="${escapeHtml(title.title)} trailer preview" />
        <button
          class="trailer-stage-button"
          type="button"
          data-open-trailer="true"
          data-embed-url="${embedUrl}"
          data-trailer-title="${escapeHtml(title.title)} trailer"
          aria-label="Play ${escapeHtml(title.title)} trailer"
        ></button>
        <button
          class="trailer-play-button"
          type="button"
          data-open-trailer="true"
          data-embed-url="${embedUrl}"
          data-trailer-title="${escapeHtml(title.title)} trailer"
          aria-label="Play ${escapeHtml(title.title)} trailer"
        >
          <span class="trailer-play-badge" aria-hidden="true">▶</span>
        </button>
        <div class="trailer-overlay">
          <p class="eyebrow">Trailer</p>
          <h2>Preview the story before you watch</h2>
          <button
            class="primary-btn trailer-btn"
            type="button"
            data-open-trailer="true"
            data-embed-url="${embedUrl}"
            data-trailer-title="${escapeHtml(title.title)} trailer"
          >
            Play Trailer
          </button>
        </div>
      </section>
    `;
  }

  return `
    <section class="trailer-stage" id="trailerSection">
      <img class="trailer-poster" src="${title.image}" alt="${escapeHtml(title.title)} trailer preview" />
      <div class="trailer-overlay">
        <p class="eyebrow">Trailer</p>
        <h2>Preview the story before you watch</h2>
        <a class="primary-btn trailer-btn" href="${trailerLink}" target="_blank" rel="noreferrer">Watch Trailer</a>
      </div>
    </section>
  `;
}

function ownerNotificationTemplate(title) {
  return `
    <article class="notification-card">
      <div>
        <p class="notification-title">${escapeHtml(title.title)}</p>
        <p class="notification-meta">${escapeHtml(title.type)} • ${escapeHtml(title.genre)} • ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
      </div>
      <span class="status-pill status-pending">Needs approval</span>
    </article>
  `;
}

function personCardTemplate(person) {
  const avatar = person.image
    ? `<img class="person-avatar" src="${person.image}" alt="${escapeHtml(person.name)}" />`
    : `<div class="person-avatar person-avatar-fallback">${escapeHtml(person.name.charAt(0).toUpperCase())}</div>`;

  return `
    <article class="person-card">
      ${avatar}
      <h4>${escapeHtml(person.name)}</h4>
      <p>${escapeHtml(person.role || "")}</p>
    </article>
  `;
}

function peopleSectionTemplate(title) {
  const cast = title.cast || [];
  const crew = title.crew || [];
  const mainPeople = [
    title.director ? { name: title.director, role: "Director", image: "" } : null,
    title.mainLead ? { name: title.mainLead, role: "Main Lead", image: "" } : null,
    title.heroine ? { name: title.heroine, role: "Heroine", image: "" } : null
  ].filter(Boolean);

  if (!cast.length && !crew.length && !mainPeople.length) {
    return "";
  }

  return `
    <section class="people-section">
      ${
        mainPeople.length
          ? `
            <div class="people-block">
              <div class="section-heading compact-heading">
                <div>
                  <p class="eyebrow">Main team</p>
                  <h2>Key credits</h2>
                </div>
              </div>
              <div class="people-grid people-rail">
                ${mainPeople.map(personCardTemplate).join("")}
              </div>
            </div>
          `
          : ""
      }
      ${
        cast.length
          ? `
            <div class="people-block">
              <div class="section-heading compact-heading">
                <div>
                  <p class="eyebrow">Cast</p>
                  <h2>Actors and characters</h2>
                </div>
              </div>
              <div class="people-grid people-rail">
                ${cast.map(personCardTemplate).join("")}
              </div>
            </div>
          `
          : ""
      }
      ${
        crew.length
          ? `
            <div class="people-block">
              <div class="section-heading compact-heading">
                <div>
                  <p class="eyebrow">Crew</p>
                  <h2>Behind the scenes</h2>
                </div>
              </div>
              <div class="people-grid people-rail">
                ${crew.map(personCardTemplate).join("")}
              </div>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function ownerActionButton(label, action, titleId, active = false) {
  return `<button class="owner-action-btn ${active ? "active" : ""}" data-action="${action}" data-id="${titleId}" type="button">${label}</button>`;
}

async function seedTitlesIfNeeded() {
  const snapshot = await getDocs(collection(db, TITLES_COLLECTION));

  if (!snapshot.empty) {
    return;
  }

  await Promise.all(
    BASE_TITLES.map((title) =>
      setDoc(doc(db, TITLES_COLLECTION, title.id), {
        ...title,
        createdAt: serverTimestamp()
      })
    )
  );
}

async function fetchTitles() {
  await seedTitlesIfNeeded();
  const snapshot = await getDocs(collection(db, TITLES_COLLECTION));
  titlesCache = snapshot.docs.map(normalizeTitle);
  return titlesCache;
}

async function fetchHomepageContent() {
  const homepageRef = doc(db, SETTINGS_COLLECTION, HOMEPAGE_DOC_ID);
  const snapshot = await getDoc(homepageRef);

  if (!snapshot.exists()) {
    homepageContentCache = { ...DEFAULT_HOMEPAGE_CONTENT };
    await setDoc(homepageRef, homepageContentCache);
    return homepageContentCache;
  }

  homepageContentCache = normalizeHomepageContent(snapshot.data());
  return homepageContentCache;
}

function getCardLabel(title) {
  if (title.importBuckets.includes("trending")) {
    return "Trending Now";
  }

  if (title.importBuckets.includes("popular")) {
    return `Popular ${title.type}`;
  }

  if (title.status === "Upcoming") {
    return title.type === "Series" ? "New Show" : "New Movie";
  }

  return `New ${title.type}`;
}

function movieCardTemplate(title) {
  const saved = isSavedTitle(title.id);
  const ownerControls = isOwnerMode()
    ? `
        <div class="owner-actions">
          ${ownerActionButton("Edit", "edit", title.id)}
          ${ownerActionButton(title.pinned ? "Pinned" : "Pin", "pin", title.id, title.pinned)}
          ${ownerActionButton(title.trending ? "Trending" : "Trend", "trend", title.id, title.trending)}
        </div>
        <button class="danger-btn delete-title-btn" data-id="${title.id}" type="button">Delete Title</button>
      `
    : "";

  const badges = `
    ${title.status === "Upcoming" ? '<span class="status-pill status-upcoming">Upcoming</span>' : '<span class="status-pill status-released">Released</span>'}
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
    ${title.source === "tmdb" ? '<span class="status-pill status-source">TMDb</span>' : ""}
  `;
  const stats = getReactionStats(title);
  const cardLabel = getCardLabel(title);

  return `
    <article class="movie-card movie-card-compact">
      <a class="movie-card-link" href="details.html?id=${title.id}">
        <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
        <div class="movie-content">
          <div class="movie-card-summary">
            <div class="movie-header">
              <div>
                <h3>${escapeHtml(title.title)}</h3>
                <p class="movie-meta">${escapeHtml(cardLabel)}</p>
                <p class="movie-meta subtle-line">${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
              </div>
              <span class="rating-pill"><strong>${stats.recommendedPercent}%</strong> recommend</span>
            </div>
            <div class="status-row">${badges}</div>
          </div>
        </div>
      </a>
      <div class="movie-actions movie-actions-compact">
        <a class="details-link" href="details.html?id=${title.id}">Open Details →</a>
        <button class="owner-action-btn save-title-btn ${saved ? "active" : ""}" data-save-id="${title.id}" type="button">${saved ? "Saved" : "Save"}</button>
      </div>
      ${ownerControls
        ? `
        <div class="movie-owner-controls">
          ${ownerControls}
        </div>
      `
        : ""}
    </article>
  `;
}

function featuredCardTemplate(title) {
  const cardLabel = getCardLabel(title);
  const badges = `
    ${title.status === "Upcoming" ? '<span class="status-pill status-upcoming">Upcoming</span>' : '<span class="status-pill status-released">Released</span>'}
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
    ${title.source === "tmdb" ? '<span class="status-pill status-source">TMDb</span>' : ""}
  `;

  return `
    <a class="featured-card featured-feed-card" href="details.html?id=${title.id}">
      <img class="featured-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="featured-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p class="movie-meta">${escapeHtml(cardLabel)}</p>
        <p class="movie-meta subtle-line">${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
        <div class="status-row">${badges}</div>
      </div>
    </a>
  `;
}

function mostInterestedItemTemplate(title, index) {
  const stats = getReactionStats(title);

  return `
    <a class="interest-item" href="details.html?id=${title.id}">
      <span class="interest-rank">${index + 1}</span>
      <img class="interest-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="interest-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p>${escapeHtml(formatReleaseDate(title.releaseDate))} • ${escapeHtml(title.status)}</p>
        <span>${stats.recommendedPercent}% recommend</span>
      </div>
    </a>
  `;
}

function getInterestWindowDays(windowKey) {
  switch (windowKey) {
    case "week":
      return 7;
    case "month":
      return 31;
    case "year":
      return 366;
    default:
      return null;
  }
}

function isInsideInterestWindow(title, windowKey) {
  const days = getInterestWindowDays(windowKey);

  if (!days) {
    return true;
  }

  if (!title.releaseDate) {
    return false;
  }

  const today = new Date();
  const releaseDate = new Date(title.releaseDate);
  const diffMs = Math.abs(releaseDate.getTime() - today.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function getInterestScore(title) {
  const stats = getReactionStats(title);
  const popularity = Number(title.tmdbPopularity || 0);
  const votes =
    Number(title.votePerfect || 0) +
    Number(title.voteGoForIt || 0) +
    Number(title.voteTimepass || 0) +
    Number(title.voteSkip || 0);

  return (
    stats.recommendedPercent * 2 +
    popularity * 0.45 +
    votes * 6 +
    (title.trending ? 26 : 0) +
    (title.pinned ? 16 : 0) +
    (title.status === "Upcoming" ? 8 : 0)
  );
}

function upcomingCardTemplate(title) {
  const badges = `
    <span class="status-pill status-upcoming">Upcoming</span>
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
    ${title.source === "tmdb" ? '<span class="status-pill status-source">TMDb</span>' : ""}
  `;

  return `
    <article class="movie-card upcoming-card">
      <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="movie-content">
        <div class="movie-header">
          <div>
            <h3>${escapeHtml(title.title)}</h3>
            <p class="movie-meta">Type: ${escapeHtml(title.type)}</p>
            <p class="movie-meta">Genre: ${escapeHtml(title.genre)}</p>
            <p class="movie-meta">Language: ${escapeHtml(title.language.join(", "))}</p>
            <p class="movie-meta">Release date: ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
            <div class="status-row">${badges}</div>
          </div>
        </div>
        <p class="movie-description">${escapeHtml(title.description)}</p>
        <div class="movie-actions">
          <a class="details-link" href="details.html?id=${title.id}">View Details →</a>
        </div>
      </div>
    </article>
  `;
}

function pendingCardTemplate(title) {
  return `
    <article class="community-card pending-card">
      <p class="eyebrow">Awaiting approval</p>
      <h3>${escapeHtml(title.title)}</h3>
      <p class="movie-meta">${escapeHtml(title.type)} • ${escapeHtml(title.genre)} • ${escapeHtml(title.language.join(", "))}</p>
      <p class="movie-meta">Release date: ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
      ${title.source === "tmdb" ? '<div class="status-row"><span class="status-pill status-source">TMDb</span></div>' : ""}
      <p class="section-copy">${escapeHtml(title.description)}</p>
      <div class="owner-actions">
        ${ownerActionButton("Approve", "approve", title.id)}
        ${ownerActionButton("Edit", "edit", title.id)}
        ${ownerActionButton("Pin", "pin", title.id, title.pinned)}
        ${ownerActionButton("Trend", "trend", title.id, title.trending)}
        <button class="danger-btn delete-title-btn" data-id="${title.id}" type="button">Delete Title</button>
      </div>
    </article>
  `;
}

function commentTemplate(comment) {
  const ownerControls = isOwnerMode()
    ? `
        <div class="comment-actions">
          <button class="danger-btn comment-delete-btn" data-comment-id="${escapeHtml(comment.id || "")}" type="button">Delete Comment</button>
        </div>
      `
    : "";

  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.name || "Anonymous")}</strong>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p>${escapeHtml(comment.text)}</p>
      ${ownerControls}
    </article>
  `;
}

function populateSelect(selectId, values, label) {
  const select = document.querySelector(selectId);

  if (!select) {
    return;
  }

  select.innerHTML = `<option value="all">All ${label}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
}

function renderFeaturedTitles(titles) {
  const container = document.querySelector("#featuredMovies");

  if (!container) {
    return;
  }

  const featured = [...titles]
    .sort((a, b) => {
      if (Number(b.pinned) !== Number(a.pinned)) {
        return Number(b.pinned) - Number(a.pinned);
      }

      if (Number(b.trending) !== Number(a.trending)) {
        return Number(b.trending) - Number(a.trending);
      }

      return b.likes - a.likes;
    })
    .slice(0, 10);
  container.innerHTML = featured.map(featuredCardTemplate).join("");
}

function renderTrendingTitles(titles) {
  const grid = document.querySelector("#trendingGrid");
  const emptyState = document.querySelector("#trendingEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const trendingTitles = [...titles]
    .filter((title) => title.trending || title.pinned)
    .sort((a, b) => {
      if (Number(b.trending) !== Number(a.trending)) {
        return Number(b.trending) - Number(a.trending);
      }

      return getReactionStats(b).recommendedPercent - getReactionStats(a).recommendedPercent;
    })
    .slice(0, 6);

  grid.innerHTML = trendingTitles.map(featuredCardTemplate).join("");
  emptyState.classList.toggle("hidden", trendingTitles.length > 0);
}

function renderOwnerPanel(titles) {
  const panel = document.querySelector("#ownerPanel");
  const grid = document.querySelector("#pendingGrid");
  const emptyState = document.querySelector("#pendingEmptyState");

  if (!panel || !grid || !emptyState) {
    return;
  }

  const ownerActive = isOwnerMode();
  const pendingTitles = getPendingTitles(titles);

  panel.classList.toggle("hidden", !ownerActive);
  grid.innerHTML = ownerActive ? pendingTitles.map(pendingCardTemplate).join("") : "";
  emptyState.classList.toggle("hidden", !ownerActive || pendingTitles.length > 0);
}

function renderTitleGrid(titles) {
  const grid = document.querySelector("#movieGrid");
  const emptyState = document.querySelector("#emptyState");

  if (!grid || !emptyState) {
    return;
  }

  grid.innerHTML = titles.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", titles.length > 0);
}

function renderUpcomingGrid(titles) {
  const grid = document.querySelector("#upcomingGrid");
  const emptyState = document.querySelector("#upcomingEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const upcomingTitles = [...titles]
    .filter((title) => title.status === "Upcoming")
    .sort((a, b) => {
      const left = a.releaseDate || "9999-12-31";
      const right = b.releaseDate || "9999-12-31";
      return left.localeCompare(right);
    });

  grid.innerHTML = upcomingTitles.map(upcomingCardTemplate).join("");
  emptyState.classList.toggle("hidden", upcomingTitles.length > 0);
}

function renderAutoUpdatedGrid(titles) {
  const grid = document.querySelector("#autoUpdatedGrid");
  const emptyState = document.querySelector("#autoUpdatedEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const importedTitles = [...titles]
    .filter((title) => title.source === "tmdb")
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "Upcoming" ? -1 : 1;
      }

      return (a.releaseDate || "9999-12-31").localeCompare(b.releaseDate || "9999-12-31");
    })
    .slice(0, 12);

  grid.innerHTML = importedTitles.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", importedTitles.length > 0);
}

function renderPopularMoviesGrid(titles) {
  const grid = document.querySelector("#popularMoviesGrid");
  const emptyState = document.querySelector("#popularMoviesEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const items = titles
    .filter((title) => title.type === "Movie" && title.importBuckets.includes("popular"))
    .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
    .slice(0, 12);

  grid.innerHTML = items.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", items.length > 0);
}

function renderPopularSeriesGrid(titles) {
  const grid = document.querySelector("#popularSeriesGrid");
  const emptyState = document.querySelector("#popularSeriesEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const items = titles
    .filter((title) => title.type === "Series" && title.importBuckets.includes("popular"))
    .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
    .slice(0, 12);

  grid.innerHTML = items.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", items.length > 0);
}

function renderTmdbTrendingGrid(titles) {
  const grid = document.querySelector("#tmdbTrendingGrid");
  const emptyState = document.querySelector("#tmdbTrendingEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const items = titles
    .filter((title) => title.importBuckets.includes("trending"))
    .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
    .slice(0, 12);

  grid.innerHTML = items.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", items.length > 0);
}

function renderMostInterestedList(titles) {
  const list = document.querySelector("#mostInterestedList");
  const windowSelect = document.querySelector("#interestWindowSelect");

  if (!list) {
    return;
  }

  const selectedWindow = windowSelect?.value || "week";
  let filteredTitles = titles.filter((title) => isInsideInterestWindow(title, selectedWindow));

  if (!filteredTitles.length) {
    filteredTitles = [...titles];
  }

  const items = [...filteredTitles]
    .sort((a, b) => getInterestScore(b) - getInterestScore(a))
    .slice(0, 10);

  list.innerHTML = items.map(mostInterestedItemTemplate).join("");
}

function scheduleCardTemplate(title) {
  return `
    <a class="schedule-card" href="details.html?id=${title.id}">
      <div class="schedule-date-badge">
        <span>${title.releaseDate ? new Date(`${title.releaseDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase() : "TBD"}</span>
        <strong>${title.releaseDate ? new Date(`${title.releaseDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit" }) : "--"}</strong>
      </div>
      <img class="schedule-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="schedule-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p>${escapeHtml(title.type)} • ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
      </div>
    </a>
  `;
}

function getScheduleTitles(titles, windowKey, typeKey) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const futureThreshold = new Date(today);
  futureThreshold.setDate(today.getDate() + 30);

  let items = titles.filter((title) => title.releaseDate);

  if (typeKey !== "all") {
    items = items.filter((title) => title.type === typeKey);
  }

  if (windowKey === "today") {
    items = items
      .filter((title) => {
        const release = new Date(`${title.releaseDate}T00:00:00`);
        const diff = Math.abs(release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      })
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

    if (!items.length) {
      items = titles
        .filter((title) => title.releaseDate && title.releaseDate >= todayStr)
        .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    }
  } else if (windowKey === "upcoming") {
    items = items
      .filter((title) => title.releaseDate >= todayStr)
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  } else if (windowKey === "announced") {
    items = titles
      .filter((title) => {
        if (typeKey !== "all" && title.type !== typeKey) {
          return false;
        }

        if (!title.releaseDate) {
          return title.status === "Upcoming";
        }

        return title.status === "Upcoming" && new Date(`${title.releaseDate}T00:00:00`) > futureThreshold;
      })
      .sort((a, b) => (a.releaseDate || "9999-12-31").localeCompare(b.releaseDate || "9999-12-31"));
  }

  return items.slice(0, 12);
}

function renderScheduleGrid(titles) {
  const grid = document.querySelector("#scheduleGrid");
  const emptyState = document.querySelector("#scheduleEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const selectedWindow =
    document.querySelector(".schedule-menu-btn.active")?.dataset.scheduleWindow || "today";
  const selectedType =
    document.querySelector(".schedule-type-pill.active")?.dataset.scheduleType || "all";
  const items = getScheduleTitles(titles, selectedWindow, selectedType);

  grid.innerHTML = items.map(scheduleCardTemplate).join("");
  emptyState.classList.toggle("hidden", items.length > 0);
}

function collectionCardTemplate(collection) {
  return `
    <article class="collection-card">
      <img class="collection-cover" src="${collection.image}" alt="${escapeHtml(collection.title)} cover" />
      <div class="collection-copy">
        <h3>${escapeHtml(collection.title)}</h3>
        <p>${escapeHtml(collection.subtitle)}</p>
        <span>${collection.count} items • ${collection.likes} likes</span>
      </div>
    </article>
  `;
}

function buildDiscoverCollections(titles) {
  const byGenre = [...titles].sort((a, b) => getInterestScore(b) - getInterestScore(a));
  const groups = [
    {
      title: "Top Community Heat",
      subtitle: "The boldest public reactions on MovieMate",
      items: byGenre.slice(0, 8)
    },
    {
      title: "Upcoming Spotlight",
      subtitle: "Fresh releases landing soon",
      items: titles.filter((title) => title.status === "Upcoming").slice(0, 8)
    },
    {
      title: "Trending Now",
      subtitle: "Titles buzzing with reactions and traction",
      items: titles.filter((title) => title.trending || title.importBuckets.includes("trending")).slice(0, 8)
    },
    {
      title: "Series Marathon",
      subtitle: "Binge-worthy picks from the current library",
      items: titles.filter((title) => title.type === "Series").slice(0, 8)
    },
    {
      title: "Movie Night",
      subtitle: "Strong movie picks across genres",
      items: titles.filter((title) => title.type === "Movie").slice(0, 8)
    },
    {
      title: "Multilingual Mix",
      subtitle: "Titles across the languages visitors browse most",
      items: titles.filter((title) => title.language.length > 1 || title.language[0] !== "English").slice(0, 8)
    }
  ];

  return groups
    .filter((group) => group.items.length)
    .map((group) => ({
      ...group,
      image: group.items[0].image,
      count: group.items.length,
      likes: group.items.reduce((sum, item) => sum + getReactionStats(item).total, 0)
    }));
}

function buildPersonalCollections(titles) {
  const savedIds = new Set(getSavedTitles());
  const savedTitles = titles.filter((title) => savedIds.has(title.id));
  const reactionMap = getStoredReactions();
  const reactedTitles = titles.filter((title) => reactionMap[title.id]);
  const perfectTitles = titles.filter((title) => reactionMap[title.id] === "perfect");

  return [
    {
      title: "Your Saved Watchlist",
      subtitle: "Titles you saved for later",
      items: savedTitles
    },
    {
      title: "Your Reaction Picks",
      subtitle: "Movies and shows you already voted on",
      items: reactedTitles
    },
    {
      title: "Perfect Vote Picks",
      subtitle: "Titles you marked as perfect",
      items: perfectTitles
    }
  ]
    .filter((group) => group.items.length)
    .map((group) => ({
      ...group,
      image: group.items[0].image,
      count: group.items.length,
      likes: group.items.reduce((sum, item) => sum + getReactionStats(item).recommendedPercent, 0)
    }));
}

function buildSavedCollections(titles) {
  const savedIds = new Set(getSavedTitles());
  const savedTitles = titles.filter((title) => savedIds.has(title.id));

  return [
    {
      title: "Saved Titles",
      subtitle: "Everything you bookmarked on this browser",
      items: savedTitles
    },
    {
      title: "Saved Movies",
      subtitle: "Only movie picks from your saved list",
      items: savedTitles.filter((title) => title.type === "Movie")
    },
    {
      title: "Saved Series",
      subtitle: "Only series from your saved list",
      items: savedTitles.filter((title) => title.type === "Series")
    }
  ]
    .filter((group) => group.items.length)
    .map((group) => ({
      ...group,
      image: group.items[0].image,
      count: group.items.length,
      likes: group.items.reduce((sum, item) => sum + getReactionStats(item).total, 0)
    }));
}

function renderCollectionsGrid(titles) {
  const grid = document.querySelector("#collectionsGrid");
  const emptyState = document.querySelector("#collectionsEmptyState");

  if (!grid || !emptyState) {
    return;
  }

  const activeTab = document.querySelector(".collection-tab.active")?.dataset.collectionTab || "discover";
  const collections =
    activeTab === "mine"
      ? buildPersonalCollections(titles)
      : activeTab === "saved"
        ? buildSavedCollections(titles)
        : buildDiscoverCollections(titles);

  grid.innerHTML = collections.map(collectionCardTemplate).join("");
  emptyState.classList.toggle("hidden", collections.length > 0);
}

function userNotificationTemplate(item) {
  return `
    <article class="notification-feed-card">
      <div>
        <p class="eyebrow">${escapeHtml(item.label)}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.copy)}</p>
      </div>
      ${item.href ? `<a class="ghost-link" href="${item.href}">Open</a>` : ""}
    </article>
  `;
}

function buildUserNotifications(titles) {
  const recentTitles = [...titles]
    .filter((title) => getCreatedAtMs(title.createdAt) > 0)
    .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt))
    .slice(0, 5)
    .map((title) => ({
      label: "New title added",
      title: title.title,
      copy: `${title.type} • ${formatReleaseDate(title.releaseDate)} • now live on MovieMate.`,
      href: `details.html?id=${title.id}`,
      createdAtMs: getCreatedAtMs(title.createdAt)
    }));

  const allTimeGreats = [...titles]
    .sort((a, b) => getInterestScore(b) - getInterestScore(a))
    .slice(0, 3)
    .map((title) => ({
      label: "All-time great pick",
      title: title.title,
      copy: `${getReactionStats(title).recommendedPercent}% recommend • ${title.genre}`,
      href: `details.html?id=${title.id}`,
      createdAtMs: 0
    }));

  return [...recentTitles, ...allTimeGreats];
}

function renderUserNotifications(titles) {
  const list = document.querySelector("#userNotificationsList");
  const emptyState = document.querySelector("#userNotificationsEmpty");
  const dot = document.querySelector("#topNotificationDot");

  if (!list || !emptyState) {
    return;
  }

  const items = buildUserNotifications(titles);
  const seenAt = Number(localStorage.getItem(USER_NOTIFICATIONS_SEEN_KEY) || 0);
  const unseenCount = items.filter((item) => item.createdAtMs && item.createdAtMs > seenAt).length;

  list.innerHTML = items.map(userNotificationTemplate).join("");
  emptyState.classList.toggle("hidden", items.length > 0);

  if (dot) {
    dot.classList.toggle("visible", unseenCount > 0);
  }
}

function filterTitles(titles) {
  const searchValue = document.querySelector("#searchInput")?.value.trim().toLowerCase() || "";
  const typeValue = document.querySelector("#typeFilter")?.value || "all";
  const genreValue = document.querySelector("#genreFilter")?.value || "all";
  const languageValue = document.querySelector("#languageFilter")?.value || "all";

  return titles.filter((title) => {
    const titleMatch =
      title.title.toLowerCase().includes(searchValue) ||
      title.description.toLowerCase().includes(searchValue);
    const typeMatch = typeValue === "all" || title.type === typeValue;
    const genreMatch = genreValue === "all" || title.genre === genreValue;
    const languageMatch = languageValue === "all" || title.language.includes(languageValue);

    return titleMatch && typeMatch && genreMatch && languageMatch;
  });
}

function showMessage(selector, text) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = text;
  }
}

function setTextContent(selector, text) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = text;
  }
}

function renderHomepageContent(content) {
  setTextContent("#heroEyebrowText", content.heroEyebrow);
  setTextContent("#heroHeadlineText", content.heroTitle);
  setTextContent("#heroSupportText", content.heroText);
  setTextContent("#featuredHeadingText", content.featuredTitle);
  setTextContent("#trendingHeadingText", content.trendingTitle);
  setTextContent("#trendingCopyText", content.trendingText);
  setTextContent("#browseHeadingText", content.browseTitle);
  setTextContent("#browseCopyText", content.browseText);
  setTextContent("#upcomingHeadingText", content.upcomingTitle);
  setTextContent("#upcomingCopyText", content.upcomingText);
  setTextContent("#suggestHeadingText", content.suggestTitle);
  setTextContent("#suggestCopyText", content.suggestText);
  setTextContent("#ownerHeadingText", content.ownerTitle);
  setTextContent("#ownerCopyText", content.ownerText);
  setTextContent("#communityBrowseHeading", content.communityBrowseTitle);
  setTextContent("#communityBrowseCopy", content.communityBrowseText);
  setTextContent("#communitySuggestHeading", content.communitySuggestTitle);
  setTextContent("#communitySuggestCopy", content.communitySuggestText);
  setTextContent("#communityReviewHeading", content.communityReviewTitle);
  setTextContent("#communityReviewCopy", content.communityReviewText);
  setTextContent("#footerCopyText", content.footerText);
}

async function renderHomePage() {
  const [titles, homepageContent] = await Promise.all([
    fetchTitles(),
    fetchHomepageContent()
  ]);
  const visibleTitles = getVisibleTitles(titles);
  renderHomepageContent(homepageContent);
  populateSelect(
    "#genreFilter",
    [...new Set(visibleTitles.map((title) => title.genre))].sort(),
    "genres"
  );
  populateSelect(
    "#languageFilter",
    [...new Set(visibleTitles.flatMap((title) => title.language))].sort(),
    "languages"
  );
  renderFeaturedTitles(visibleTitles);
  renderTrendingTitles(visibleTitles);
  renderTitleGrid(filterTitles(visibleTitles));
  renderScheduleGrid(visibleTitles);
  renderAutoUpdatedGrid(visibleTitles);
  renderPopularMoviesGrid(visibleTitles);
  renderPopularSeriesGrid(visibleTitles);
  renderTmdbTrendingGrid(visibleTitles);
  renderMostInterestedList(visibleTitles);
  renderCollectionsGrid(visibleTitles);
  renderUserNotifications(visibleTitles);
  renderOwnerPanel(titles);
  renderOwnerNotifications(titles);
  renderHeroStats(visibleTitles);
  updateOwnerToggle();
}

async function addTitle(form) {
  const formData = new FormData(form);
  const title = formData.get("title")?.toString().trim() || "";
  const type = formData.get("type")?.toString().trim() || "Movie";
  const status = formData.get("status")?.toString().trim() || "Released";
  const genre = formData.get("genre")?.toString().trim() || "";
  const language = Array.from(form.querySelectorAll('input[name="language"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
  const releaseDate = formData.get("releaseDate")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const image = formData.get("image")?.toString().trim() || "";
  const trailerUrl = formData.get("trailerUrl")?.toString().trim() || "";
  const director = formData.get("director")?.toString().trim() || "";
  const mainLead = formData.get("mainLead")?.toString().trim() || "";
  const heroine = formData.get("heroine")?.toString().trim() || "";
  const cast = parseNameList(formData.get("castText"), "Cast");
  const crew = parseCrewText(formData.get("crewText"));

  const newTitle = {
    id: slugify(`${title}-${Date.now()}`),
    title,
    type,
    status,
    releaseDate,
    genre,
    language: language.length ? language : ["English"],
    description,
    image,
    trailerUrl,
    director,
    mainLead,
    heroine,
    cast,
    crew,
    likes: 0,
    dislikes: 0,
    votePerfect: 0,
    voteGoForIt: 0,
    voteTimepass: 0,
    voteSkip: 0,
    approved: false,
    pinned: false,
    trending: false,
    comments: [],
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, TITLES_COLLECTION, newTitle.id), newTitle);
}

async function updateTitleStatus(titleId, updates) {
  await updateDoc(doc(db, TITLES_COLLECTION, titleId), updates);
}

function syncModalVisibility() {
  document.querySelectorAll(".overlay-modal").forEach((modal) => {
    const hidden = modal.classList.contains("hidden");
    modal.setAttribute("aria-hidden", hidden ? "true" : "false");
  });
}

function openOwnerEditModal(titleId) {
  const title = titlesCache.find((item) => item.id === titleId);
  const modal = document.querySelector("#ownerEditModal");
  const form = document.querySelector("#ownerEditForm");

  if (!title || !modal || !form) {
    return;
  }

  form.elements.id.value = title.id;
  form.elements.title.value = title.title;
  form.elements.type.value = title.type;
  form.elements.status.value = title.status;
  form.elements.genre.value = title.genre;
  form.elements.language.value = title.language.join(", ");
  form.elements.releaseDate.value = title.releaseDate || "";
  form.elements.image.value = title.image;
  form.elements.trailerUrl.value = title.trailerUrl || "";
  form.elements.director.value = title.director || "";
  form.elements.mainLead.value = title.mainLead || "";
  form.elements.heroine.value = title.heroine || "";
  form.elements.castText.value = (title.cast || []).map((person) => person.name).join(", ");
  form.elements.crewText.value = (title.crew || [])
    .map((person) => `${person.name}${person.role ? ` - ${person.role}` : ""}`)
    .join(", ");
  form.elements.description.value = title.description;
  showMessage("#ownerEditMessage", "");
  modal.classList.remove("hidden");
  syncModalVisibility();
}

function closeOwnerEditModal() {
  const modal = document.querySelector("#ownerEditModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  syncModalVisibility();
}

function openTrailerModal(embedUrl, title) {
  const modal = document.querySelector("#trailerModal");
  const frame = document.querySelector("#trailerModalFrame");

  if (!modal || !frame || !embedUrl) {
    return;
  }

  frame.src = embedUrl;
  frame.title = title || "MovieMate trailer";
  modal.classList.remove("hidden");
  syncModalVisibility();
}

function closeTrailerModal() {
  const modal = document.querySelector("#trailerModal");
  const frame = document.querySelector("#trailerModalFrame");

  if (!modal || !frame) {
    return;
  }

  frame.src = "";
  modal.classList.add("hidden");
  syncModalVisibility();
}

function openHomepageEditModal() {
  const modal = document.querySelector("#homepageEditModal");
  const form = document.querySelector("#homepageEditForm");

  if (!modal || !form) {
    return;
  }

  Object.entries(homepageContentCache).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value;
    }
  });

  showMessage("#homepageEditMessage", "");
  modal.classList.remove("hidden");
  syncModalVisibility();
}

function closeHomepageEditModal() {
  const modal = document.querySelector("#homepageEditModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  syncModalVisibility();
}

function renderHeroStats(titles) {
  const titlesStat = document.querySelector("#titlesStat");
  const upcomingStat = document.querySelector("#upcomingStat");
  const reviewsStat = document.querySelector("#reviewsStat");

  if (!titlesStat || !upcomingStat || !reviewsStat) {
    return;
  }

  const totalReviews = titles.reduce((sum, title) => sum + title.comments.length, 0);
  const totalUpcoming = titles.filter((title) => title.status === "Upcoming").length;

  titlesStat.textContent = String(titles.length);
  upcomingStat.textContent = String(totalUpcoming);
  reviewsStat.textContent = String(totalReviews);
}

async function submitOwnerEdit(form) {
  const formData = new FormData(form);
  const titleId = formData.get("id")?.toString().trim() || "";

  if (!titleId) {
    return;
  }

  await updateTitleStatus(titleId, {
    title: formData.get("title")?.toString().trim() || "",
    type: formData.get("type")?.toString().trim() || "Movie",
    status: formData.get("status")?.toString().trim() || "Released",
    genre: formData.get("genre")?.toString().trim() || "",
    language: (formData.get("language")?.toString().trim() || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    releaseDate: formData.get("releaseDate")?.toString().trim() || "",
    image: formData.get("image")?.toString().trim() || "",
    trailerUrl: formData.get("trailerUrl")?.toString().trim() || "",
    director: formData.get("director")?.toString().trim() || "",
    mainLead: formData.get("mainLead")?.toString().trim() || "",
    heroine: formData.get("heroine")?.toString().trim() || "",
    cast: parseNameList(formData.get("castText"), "Cast"),
    crew: parseCrewText(formData.get("crewText")),
    description: formData.get("description")?.toString().trim() || ""
  });
}

function renderOwnerNotifications(titles) {
  const list = document.querySelector("#ownerNotificationsList");
  const count = document.querySelector("#ownerNotificationCount");
  const empty = document.querySelector("#ownerNotificationsEmpty");

  if (!list || !count || !empty) {
    return;
  }

  const pendingTitles = getPendingTitles(titles)
    .sort((a, b) => {
      const left = String(a.createdAt || "");
      const right = String(b.createdAt || "");
      return right.localeCompare(left);
    })
    .slice(0, 6);

  count.textContent = String(getPendingTitles(titles).length);
  list.innerHTML = pendingTitles.map(ownerNotificationTemplate).join("");
  empty.classList.toggle("hidden", pendingTitles.length > 0);
}

async function submitHomepageEdit(form) {
  const formData = new FormData(form);
  const content = normalizeHomepageContent({
    heroEyebrow: formData.get("heroEyebrow")?.toString().trim(),
    heroTitle: formData.get("heroTitle")?.toString().trim(),
    heroText: formData.get("heroText")?.toString().trim(),
    featuredTitle: formData.get("featuredTitle")?.toString().trim(),
    trendingTitle: formData.get("trendingTitle")?.toString().trim(),
    trendingText: formData.get("trendingText")?.toString().trim(),
    browseTitle: formData.get("browseTitle")?.toString().trim(),
    browseText: formData.get("browseText")?.toString().trim(),
    upcomingTitle: formData.get("upcomingTitle")?.toString().trim(),
    upcomingText: formData.get("upcomingText")?.toString().trim(),
    suggestTitle: formData.get("suggestTitle")?.toString().trim(),
    suggestText: formData.get("suggestText")?.toString().trim(),
    ownerTitle: formData.get("ownerTitle")?.toString().trim(),
    ownerText: formData.get("ownerText")?.toString().trim(),
    communityBrowseTitle: formData.get("communityBrowseTitle")?.toString().trim(),
    communityBrowseText: formData.get("communityBrowseText")?.toString().trim(),
    communitySuggestTitle: formData.get("communitySuggestTitle")?.toString().trim(),
    communitySuggestText: formData.get("communitySuggestText")?.toString().trim(),
    communityReviewTitle: formData.get("communityReviewTitle")?.toString().trim(),
    communityReviewText: formData.get("communityReviewText")?.toString().trim(),
    footerText: formData.get("footerText")?.toString().trim()
  });

  await setDoc(doc(db, SETTINGS_COLLECTION, HOMEPAGE_DOC_ID), content, { merge: true });
  homepageContentCache = content;
  renderHomepageContent(homepageContentCache);
}

async function reactToTitle(titleId, nextReaction) {
  const currentReaction = getReaction(titleId);

  if (!(nextReaction in REACTION_OPTIONS) || currentReaction === nextReaction) {
    return false;
  }

  const fieldMap = {
    perfect: "votePerfect",
    goForIt: "voteGoForIt",
    timepass: "voteTimepass",
    skip: "voteSkip"
  };

  const positiveReactions = new Set(["perfect", "goForIt"]);
  const negativeReactions = new Set(["skip"]);
  const updates = {
    [fieldMap[nextReaction]]: increment(1)
  };

  if (currentReaction && fieldMap[currentReaction]) {
    updates[fieldMap[currentReaction]] = increment(-1);
  }

  let likesDelta = 0;
  let dislikesDelta = 0;

  if (currentReaction && positiveReactions.has(currentReaction)) {
    likesDelta -= 1;
  }

  if (positiveReactions.has(nextReaction)) {
    likesDelta += 1;
  }

  if (currentReaction && negativeReactions.has(currentReaction)) {
    dislikesDelta -= 1;
  }

  if (negativeReactions.has(nextReaction)) {
    dislikesDelta += 1;
  }

  if (likesDelta !== 0) {
    updates.likes = increment(likesDelta);
  }

  if (dislikesDelta !== 0) {
    updates.dislikes = increment(dislikesDelta);
  }

  await updateDoc(doc(db, TITLES_COLLECTION, titleId), updates);

  setReaction(titleId, nextReaction);
  return true;
}

async function deleteTitle(titleId) {
  await deleteDoc(doc(db, TITLES_COLLECTION, titleId));
  clearReaction(titleId);
}

async function addComment(titleId, form) {
  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim() || "Anonymous";
  const text = formData.get("comment")?.toString().trim() || "";

  if (!text) {
    showMessage("#commentMessage", "Please write a review or comment first.");
    return false;
  }

  const titleRef = doc(db, TITLES_COLLECTION, titleId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(titleRef);

    if (!snapshot.exists()) {
      throw new Error("Title not found.");
    }

    const data = normalizeTitle(snapshot);
    transaction.update(titleRef, {
      comments: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          text,
          createdAt: new Date().toISOString()
        },
        ...data.comments
      ]
    });
  });

  return true;
}

async function deleteComment(titleId, commentId) {
  const titleRef = doc(db, TITLES_COLLECTION, titleId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(titleRef);

    if (!snapshot.exists()) {
      throw new Error("Title not found.");
    }

    const data = normalizeTitle(snapshot);
    transaction.update(titleRef, {
      comments: data.comments.filter((comment) => comment.id !== commentId)
    });
  });
}

async function renderDetailsPage() {
  const target = document.querySelector("#movieDetails");

  if (!target) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const titleId = params.get("id");

  if (!titleId) {
    target.innerHTML = `<section class="not-found"><h1>Title not found</h1></section>`;
    return;
  }

  const snapshot = await getDoc(doc(db, TITLES_COLLECTION, titleId));

  if (!snapshot.exists()) {
    target.innerHTML = `<section class="not-found"><h1>Title not found</h1></section>`;
    return;
  }

  const title = normalizeTitle(snapshot);
  titlesCache = [...titlesCache.filter((item) => item.id !== title.id), title];

  if (!title.approved && !isOwnerMode()) {
    target.innerHTML = `<section class="not-found"><h1>Title not found</h1></section>`;
    return;
  }

  const stats = getReactionStats(title);
  const saved = isSavedTitle(title.id);
  const embeddedTrailerUrl = getYouTubeEmbedUrl(title.trailerUrl);
  const releaseYear = title.releaseDate ? new Date(title.releaseDate).getFullYear() : "Now";
  const leadDirector = title.director || "MovieMate";
  const primaryLanguage = title.language?.[0] || "Not added";
  const ownerControls = isOwnerMode()
    ? `
        <div class="owner-actions">
          ${ownerActionButton("Edit", "edit", title.id)}
          ${ownerActionButton(title.approved ? "Approved" : "Approve", "approve", title.id, title.approved)}
          ${ownerActionButton(title.pinned ? "Pinned" : "Pin", "pin", title.id, title.pinned)}
          ${ownerActionButton(title.trending ? "Trending" : "Trend", "trend", title.id, title.trending)}
        </div>
        <button class="danger-btn delete-title-btn" data-id="${title.id}" type="button">Delete Title</button>
        <p class="owner-badge">Owner mode is active</p>
      `
    : "";
  const badges = `
    ${title.status === "Upcoming" ? '<span class="status-pill status-upcoming">Upcoming</span>' : '<span class="status-pill status-released">Released</span>'}
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
    ${title.source === "tmdb" ? '<span class="status-pill status-source">TMDb</span>' : ""}
    ${!title.approved ? '<span class="status-pill status-pending">Pending</span>' : ""}
  `;

  target.innerHTML = `
    <section class="detail-hero-card">
      ${trailerPanelTemplate(title)}
      <div class="detail-summary">
        <div class="detail-summary-header">
          <img class="detail-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
          <div class="detail-copy">
            <p class="eyebrow">${escapeHtml(title.type)} • ${escapeHtml(String(releaseYear))}</p>
            <h1>${escapeHtml(title.title)}</h1>
            <div class="status-row">${badges}</div>
            <div class="detail-facts-grid">
              <div class="detail-fact">
                <span>Directed by</span>
                <strong>${escapeHtml(leadDirector)}</strong>
              </div>
              <div class="detail-fact">
                <span>Genre</span>
                <strong>${escapeHtml(title.genre)}</strong>
              </div>
              <div class="detail-fact">
                <span>Language</span>
                <strong>${escapeHtml(primaryLanguage)}</strong>
              </div>
              <div class="detail-fact">
                <span>Release</span>
                <strong>${escapeHtml(formatReleaseDate(title.releaseDate))}</strong>
              </div>
            </div>
            <p class="detail-hero-description">${escapeHtml(title.description)}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="detail-action-strip">
      <div class="detail-actions">
        ${reactionButtonsTemplate(title)}
        ${
          embeddedTrailerUrl
            ? '<a class="secondary-btn trailer-btn" href="#trailerSection">Watch Trailer Here</a>'
            : `<a class="secondary-btn trailer-btn" href="${getTrailerLink(title)}" target="_blank" rel="noreferrer">Open Trailer</a>`
        }
        <button class="secondary-btn save-title-btn ${saved ? "active" : ""}" data-save-id="${title.id}" type="button">${saved ? "Saved to Collections" : "Save to Collections"}</button>
        ${ownerControls}
        <p class="form-message" id="detailVoteMessage" aria-live="polite"></p>
      </div>
    </section>

    <section class="detail-insights-grid">
      ${reactionMeterTemplate(title)}
      ${vibeChartTemplate(title)}
      <article class="insight-card insight-overview-card">
        <div class="insight-header">
          <div>
            <p class="eyebrow">Overview</p>
            <h3>${escapeHtml(title.title)}</h3>
          </div>
          <span class="insight-pill">${stats.recommendedPercent}% recommend</span>
        </div>
        <p class="detail-overview">${escapeHtml(title.description)}</p>
      </article>
    </section>

    ${peopleSectionTemplate(title)}

    <section class="comment-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Reviews and comments</p>
          <h2>What viewers are saying</h2>
        </div>
        <p class="section-copy">Reviews and comments are open for everyone.</p>
      </div>

      <form class="suggest-form comment-form" id="commentForm">
        <div class="form-grid">
          <label class="input-group">
            <span>Your name</span>
            <input name="name" type="text" placeholder="Your name" />
          </label>
          <label class="input-group form-span">
            <span>Your review or comment</span>
            <textarea name="comment" rows="4" placeholder="Share your thoughts on this title"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="primary-btn" type="submit">Post Review</button>
          <p class="form-message" id="commentMessage" aria-live="polite"></p>
        </div>
      </form>

      <div class="comment-list">
        ${title.comments.length ? title.comments.map(commentTemplate).join("") : '<p class="empty-state">No reviews yet. Be the first to write one.</p>'}
      </div>
    </section>
  `;

  target.querySelectorAll(".reaction-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        const changed = await reactToTitle(button.dataset.id, button.dataset.reaction);

        if (!changed) {
          showMessage("#detailVoteMessage", "You already picked that option.");
          return;
        }

        await renderDetailsPage();
        showMessage("#detailVoteMessage", "Your vote was saved.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", "Could not save your vote right now.");
      }
    });
  });

  setupCommentForm(title.id);
}

function setupLikeButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".reaction-btn");

    if (!button) {
      return;
    }

    try {
      const changed = await reactToTitle(button.dataset.id, button.dataset.reaction);

      if (!changed) {
        if (document.body.dataset.page === "details") {
          showMessage("#detailVoteMessage", "You already picked that option.");
        }
        return;
      }

      if (document.body.dataset.page === "home") {
        await renderHomePage();
      } else {
        await renderDetailsPage();
        showMessage("#detailVoteMessage", "Your vote was saved.");
      }
    } catch (error) {
      console.error(error);
      if (document.body.dataset.page === "details") {
        showMessage("#detailVoteMessage", "Could not save your vote right now.");
      }
    }
  });
}

function setupDeleteButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-title-btn");

    if (!button || !isOwnerMode()) {
      return;
    }

    const confirmed = window.confirm("Delete this title permanently from MovieMate?");

    if (!confirmed) {
      return;
    }

    await deleteTitle(button.dataset.id);

    if (document.body.dataset.page === "home") {
      await renderHomePage();
      return;
    }

    window.location.href = "index.html";
  });
}

function setupOwnerActionButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".owner-action-btn");

    if (!button || !isOwnerMode()) {
      return;
    }

    const { action, id } = button.dataset;

    if (action === "approve") {
      await updateTitleStatus(id, { approved: true });
    }

    if (action === "pin") {
      const title = titlesCache.find((item) => item.id === id);
      await updateTitleStatus(id, { pinned: !title?.pinned });
    }

    if (action === "trend") {
      const title = titlesCache.find((item) => item.id === id);
      await updateTitleStatus(id, { trending: !title?.trending });
    }

    if (action === "edit") {
      openOwnerEditModal(id);
      return;
    }

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
    }
  });
}

function setupOwnerEditForm() {
  const form = document.querySelector("#ownerEditForm");
  const closeButton = document.querySelector("#ownerEditClose");

  if (!form) {
    return;
  }

  closeButton?.addEventListener("click", closeOwnerEditModal);

  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeOwnerEdit === "true") {
      closeOwnerEditModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitOwnerEdit(form);
    showMessage("#ownerEditMessage", "Title updated successfully.");

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
    }

    closeOwnerEditModal();
  });
}

function setupTrailerModal() {
  const closeButton = document.querySelector("#trailerModalClose");

  closeButton?.addEventListener("click", closeTrailerModal);

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeTrailer === "true") {
      closeTrailerModal();
      return;
    }

    const openButton = target.closest("[data-open-trailer='true']");

    if (!openButton) {
      return;
    }

    event.preventDefault();

    if (document.body.dataset.page === "details") {
      playTrailerInline(openButton.dataset.embedUrl, openButton.dataset.trailerTitle);
      return;
    }

    openTrailerModal(openButton.dataset.embedUrl, openButton.dataset.trailerTitle);
  });
}

function setupHomepageEditor() {
  const openButton = document.querySelector("#editHomepageCopyBtn");
  const form = document.querySelector("#homepageEditForm");
  const closeButton = document.querySelector("#homepageEditClose");

  if (!openButton || !form) {
    return;
  }

  openButton.addEventListener("click", () => {
    if (!isOwnerMode()) {
      return;
    }

    openHomepageEditModal();
  });

  closeButton?.addEventListener("click", closeHomepageEditModal);

  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeHomepageEdit === "true") {
      closeHomepageEditModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitHomepageEdit(form);
    showMessage("#homepageEditMessage", "Homepage updated successfully.");
    closeHomepageEditModal();
  });
}

function setupCommentDeleteButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".comment-delete-btn");

    if (!button || !isOwnerMode() || document.body.dataset.page !== "details") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const titleId = params.get("id");

    if (!titleId) {
      return;
    }

    const confirmed = window.confirm("Delete this comment permanently?");

    if (!confirmed) {
      return;
    }

    await deleteComment(titleId, button.dataset.commentId);
    await renderDetailsPage();
  });
}

function updateOwnerToggle() {
  const active = isOwnerMode();
  const pendingCount =
    pendingNotificationState.count ?? getPendingTitles(titlesCache).length;

  document.querySelectorAll("#ownerToggle").forEach((button) => {
    button.classList.toggle("active", active);
    button.textContent = active
      ? pendingCount
        ? `Owner Unlocked • ${pendingCount}`
        : "Owner Unlocked"
      : pendingCount
        ? `Owner Mode • ${pendingCount}`
        : "Owner Mode";
  });

  document.querySelectorAll("#ownerDockToggle").forEach((button) => {
    button.classList.toggle("active", active);
  });
}

function setupOwnerMode() {
  const buttons = document.querySelectorAll("#ownerToggle, #ownerDockToggle");

  if (!buttons.length) {
    return;
  }

  updateOwnerToggle();

  const handler = async () => {
    if (isOwnerMode()) {
      setOwnerMode(false);
      updateOwnerToggle();
      closeHomepageEditModal();

      if (document.body.dataset.page === "home") {
        await renderHomePage();
      } else {
        await renderDetailsPage();
      }
      return;
    }

    const passcode = window.prompt("Enter your owner passcode to unlock delete controls:");

    if (passcode !== OWNER_PASSCODE) {
      window.alert("Incorrect passcode.");
      return;
    }

    setOwnerMode(true);
    updateOwnerToggle();

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
    }
  };

  buttons.forEach((button) => {
    button.addEventListener("click", handler);
  });
}

function setupCommentForm(titleId) {
  const form = document.querySelector("#commentForm");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const added = await addComment(titleId, form);

    if (!added) {
      return;
    }

    form.reset();
    showMessage("#commentMessage", "Your review is now live.");
    await renderDetailsPage();
  });
}

function setupFilters() {
  ["#searchInput", "#typeFilter", "#genreFilter", "#languageFilter"].forEach((selector) => {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    const handler = () => {
      renderTitleGrid(filterTitles(getVisibleTitles(titlesCache)));
    };

    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

function setupScheduleControls() {
  document.querySelectorAll(".schedule-menu-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".schedule-menu-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderScheduleGrid(getVisibleTitles(titlesCache));
    });
  });

  document.querySelectorAll(".schedule-type-pill").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".schedule-type-pill").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderScheduleGrid(getVisibleTitles(titlesCache));
    });
  });
}

function setupCollectionTabs() {
  document.querySelectorAll(".collection-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".collection-tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderCollectionsGrid(getVisibleTitles(titlesCache));
    });
  });
}

function setupInterestWindow() {
  const select = document.querySelector("#interestWindowSelect");

  if (!select) {
    return;
  }

  select.addEventListener("change", () => {
    renderMostInterestedList(getVisibleTitles(titlesCache));
  });
}

function openNotificationsModal() {
  const modal = document.querySelector("#notificationsModal");

  if (!modal) {
    return;
  }

  localStorage.setItem(USER_NOTIFICATIONS_SEEN_KEY, String(Date.now()));
  modal.classList.remove("hidden");
  syncModalVisibility();
  renderUserNotifications(getVisibleTitles(titlesCache));
}

function closeNotificationsModal() {
  const modal = document.querySelector("#notificationsModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  syncModalVisibility();
}

function setupTopSearch() {
  const button = document.querySelector("#topSearchBtn");

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const searchInput = document.querySelector("#searchInput");
    const browseSection = document.querySelector("#browse");

    browseSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      searchInput?.focus();
    }, 220);
  });
}

function setupUserNotificationsModal() {
  const openButton = document.querySelector("#topNotificationsBtn");
  const closeButton = document.querySelector("#notificationsClose");

  openButton?.addEventListener("click", openNotificationsModal);
  closeButton?.addEventListener("click", closeNotificationsModal);

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-notifications='true']")) {
      closeNotificationsModal();
    }
  });
}

function setupScrollControls() {
  const upButton = document.querySelector("#scrollUpBtn");
  const downButton = document.querySelector("#scrollDownBtn");
  const scrollTargets = [
    "#trending",
    "#browse",
    "#schedule",
    "#collections",
    "#auto-updated",
    "#popular-movies",
    "#popular-series",
    "#tmdb-trending",
    "#suggest",
    ".site-footer"
  ];

  upButton?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  downButton?.addEventListener("click", () => {
    const currentY = window.scrollY + 160;
    const nextTarget = scrollTargets
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .find((element) => element.offsetTop > currentY);

    if (nextTarget) {
      nextTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
  });
}

function setupSaveButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".save-title-btn");

    if (!button) {
      return;
    }

    toggleSavedTitle(button.dataset.saveId);

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
    }
  });
}

function setupSuggestForm() {
  const form = document.querySelector("#suggestForm");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addTitle(form);
    form.reset();
    showMessage("#formMessage", "Your suggestion has been sent for owner review.");
    await renderHomePage();
  });
}

function showOwnerToast(message) {
  let toast = document.querySelector("#ownerToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ownerToast";
    toast.className = "owner-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("visible");

  window.setTimeout(() => {
    toast?.classList.remove("visible");
  }, OWNER_NOTIFICATION_TOAST_MS);
}

function setupOwnerNotificationsRealtime() {
  pendingNotificationState.unsubscribe?.();

  pendingNotificationState.unsubscribe = onSnapshot(collection(db, TITLES_COLLECTION), (snapshot) => {
    const liveTitles = snapshot.docs.map(normalizeTitle);
    titlesCache = liveTitles;
    const pendingTitles = getPendingTitles(liveTitles);
    const pendingCount = pendingTitles.length;

    if (document.body.dataset.page === "home") {
      const visibleTitles = getVisibleTitles(liveTitles);
      renderScheduleGrid(visibleTitles);
      renderCollectionsGrid(visibleTitles);
      renderUserNotifications(visibleTitles);
      renderMostInterestedList(visibleTitles);
      renderOwnerNotifications(liveTitles);
      renderOwnerPanel(liveTitles);
    }

    const previousCount = pendingNotificationState.count;
    pendingNotificationState.count = pendingCount;

    if (previousCount !== null && pendingCount > previousCount && isOwnerMode()) {
      showOwnerToast(`You have ${pendingCount} title${pendingCount === 1 ? "" : "s"} waiting for approval.`);
    }

    updateOwnerToggle();
  });
}

async function init() {
  setupLikeButtons();
  setupSaveButtons();
  setupDeleteButtons();
  setupCommentDeleteButtons();
  setupOwnerActionButtons();
  setupOwnerMode();
  setupOwnerEditForm();
  setupHomepageEditor();
  setupTrailerModal();

  if (document.body.dataset.page === "home") {
    setupFilters();
    setupScheduleControls();
    setupCollectionTabs();
    setupInterestWindow();
    setupTopSearch();
    setupUserNotificationsModal();
    setupScrollControls();
    setupSuggestForm();
    await renderHomePage();
  }

  if (document.body.dataset.page === "details") {
    await fetchTitles();
    await renderDetailsPage();
    updateOwnerToggle();
  }

  setupOwnerNotificationsRealtime();
}

init().catch((error) => {
  console.error(error);
  showMessage("#formMessage", "Could not load MovieMate right now.");
  showMessage("#commentMessage", "Could not load comments right now.");
});
