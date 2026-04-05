import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const TITLES_COLLECTION = "moviemate_titles";
const REACTIONS_STORAGE_KEY = "moviemate_reactions";
const OWNER_MODE_KEY = "moviemate_owner_mode";
const OWNER_PASSCODE = "1A2b3456@";

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
    likes: Number(data.likes || 0),
    dislikes: Number(data.dislikes || 0),
    approved: data.approved !== false,
    pinned: Boolean(data.pinned),
    trending: Boolean(data.trending),
    comments: Array.isArray(data.comments)
      ? data.comments.map((comment, index) => ({
          id: comment.id || `${data.id || docLike.id}-comment-${index}`,
          name: comment.name || "Anonymous",
          text: comment.text || "",
          createdAt: comment.createdAt || null
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
  const likes = Number(title.likes || 0);
  const dislikes = Number(title.dislikes || 0);
  const total = likes + dislikes;
  const likePercent = total ? Math.round((likes / total) * 100) : 0;
  const dislikePercent = total ? Math.round((dislikes / total) * 100) : 0;

  return {
    likes,
    dislikes,
    total,
    likePercent,
    dislikePercent
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

  return `
    <div class="reaction-panel">
      <div class="reaction-buttons">
        <button class="reaction-btn ${currentReaction === "like" ? "active like" : ""}" data-id="${title.id}" data-reaction="like" type="button">
          Like ${stats.likePercent}%
        </button>
        <button class="reaction-btn ${currentReaction === "dislike" ? "active dislike" : ""}" data-id="${title.id}" data-reaction="dislike" type="button">
          Dislike ${stats.dislikePercent}%
        </button>
      </div>
      <p class="reaction-summary">${stats.likes} likes • ${stats.dislikes} dislikes • ${stats.total} votes</p>
    </div>
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

function movieCardTemplate(title) {
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
  `;

  return `
    <article class="movie-card">
      <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="movie-content">
        <div class="movie-header">
          <div>
            <h3>${escapeHtml(title.title)}</h3>
            <p class="movie-meta">${escapeHtml(title.type)} • ${escapeHtml(title.genre)} • ${escapeHtml(title.language.join(", "))}</p>
            <p class="movie-meta">Release date: ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
            <div class="status-row">${badges}</div>
          </div>
          <span class="rating-pill"><strong>${getReactionStats(title).likePercent}%</strong> liked</span>
        </div>
        <p class="movie-description">${escapeHtml(title.description)}</p>
        ${reactionButtonsTemplate(title)}
        <div class="movie-actions">
          <a class="details-link" href="details.html?id=${title.id}">View Details →</a>
          ${ownerControls}
        </div>
      </div>
    </article>
  `;
}

function featuredCardTemplate(title) {
  const badges = `
    ${title.status === "Upcoming" ? '<span class="status-pill status-upcoming">Upcoming</span>' : '<span class="status-pill status-released">Released</span>'}
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
  `;

  return `
    <a class="featured-card" href="details.html?id=${title.id}">
      <img class="featured-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="featured-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p class="movie-meta">Release date: ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
        <div class="status-row">${badges}</div>
        <div class="movie-actions">
          <span class="genre-pill">${escapeHtml(title.type)}</span>
          <span class="rating-pill"><strong>${getReactionStats(title).likePercent}%</strong> liked</span>
        </div>
      </div>
    </a>
  `;
}

function upcomingCardTemplate(title) {
  const badges = `
    <span class="status-pill status-upcoming">Upcoming</span>
    ${title.pinned ? '<span class="status-pill status-pinned">Pinned</span>' : ""}
    ${title.trending ? '<span class="status-pill status-trending">Trending</span>' : ""}
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
  const commentId = escapeHtml(comment.id || "");
  const ownerControls = isOwnerMode()
    ? `<button class="danger-btn comment-delete-btn" data-comment-id="${commentId}" type="button">Delete Comment</button>`
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
    .slice(0, 4);
  container.innerHTML = featured.map(featuredCardTemplate).join("");
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

async function renderHomePage() {
  const titles = await fetchTitles();
  const visibleTitles = getVisibleTitles(titles);
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
  renderTitleGrid(filterTitles(visibleTitles));
  renderUpcomingGrid(visibleTitles);
  renderOwnerPanel(titles);
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
    likes: 0,
    dislikes: 0,
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

async function editTitle(titleId) {
  const title = titlesCache.find((item) => item.id === titleId);

  if (!title) {
    return;
  }

  const titleValue = window.prompt("Edit title", title.title);
  if (!titleValue) {
    return;
  }

  const typeValue = window.prompt("Edit type: Movie or Series", title.type);
  if (!typeValue) {
    return;
  }

  const statusValue = window.prompt("Edit status: Released or Upcoming", title.status);
  if (!statusValue) {
    return;
  }

  const genreValue = window.prompt("Edit genre", title.genre);
  if (!genreValue) {
    return;
  }

  const languageValue = window.prompt(
    "Edit languages with commas, for example English, Hindi",
    title.language.join(", ")
  );
  if (!languageValue) {
    return;
  }

  const descriptionValue = window.prompt("Edit description", title.description);
  if (!descriptionValue) {
    return;
  }

  const releaseDateValue = window.prompt("Edit release date in YYYY-MM-DD format", title.releaseDate);
  if (!releaseDateValue) {
    return;
  }

  const imageValue = window.prompt("Edit poster image URL", title.image);
  if (!imageValue) {
    return;
  }

  await updateTitleStatus(titleId, {
    title: titleValue.trim(),
    type: typeValue.trim(),
    status: statusValue.trim(),
    releaseDate: releaseDateValue.trim(),
    genre: genreValue.trim(),
    language: languageValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    description: descriptionValue.trim(),
    image: imageValue.trim()
  });
}

async function reactToTitle(titleId, nextReaction) {
  const currentReaction = getReaction(titleId);

  if (!["like", "dislike"].includes(nextReaction) || currentReaction === nextReaction) {
    return false;
  }

  const titleRef = doc(db, TITLES_COLLECTION, titleId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(titleRef);

    if (!snapshot.exists()) {
      throw new Error("Title not found.");
    }

    const updates = {};

    if (currentReaction === "like") {
      updates.likes = increment(-1);
    }

    if (currentReaction === "dislike") {
      updates.dislikes = increment(-1);
    }

    if (nextReaction === "like") {
      updates.likes = increment(1);
    }

    if (nextReaction === "dislike") {
      updates.dislikes = increment(1);
    }

    transaction.update(titleRef, updates);
  });

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

  if (!title.approved && !isOwnerMode()) {
    target.innerHTML = `<section class="not-found"><h1>Title not found</h1></section>`;
    return;
  }

  const stats = getReactionStats(title);
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
    ${!title.approved ? '<span class="status-pill status-pending">Pending</span>' : ""}
  `;

  target.innerHTML = `
    <section class="detail-card">
      <img class="detail-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="detail-copy">
        <p class="eyebrow">Title Details</p>
        <h1>${escapeHtml(title.title)}</h1>
        <div class="status-row">${badges}</div>
        <div class="detail-stats">
          <div class="detail-stat-card">
            <p class="movie-meta">Type</p>
            <strong>${escapeHtml(title.type)}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Genre</p>
            <strong>${escapeHtml(title.genre)}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Status</p>
            <strong>${escapeHtml(title.status)}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Language</p>
            <strong>${escapeHtml(title.language.join(", "))}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Release date</p>
            <strong>${escapeHtml(formatReleaseDate(title.releaseDate))}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Community score</p>
            <strong>${stats.likePercent}% liked</strong>
          </div>
        </div>
        <p class="detail-overview">${escapeHtml(title.description)}</p>
        <div class="detail-actions">
          ${reactionButtonsTemplate(title)}
          ${ownerControls}
        </div>
      </div>
    </section>

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

  setupCommentForm(title.id);
}

function setupLikeButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".reaction-btn");

    if (!button) {
      return;
    }

    const changed = await reactToTitle(button.dataset.id, button.dataset.reaction);

    if (!changed) {
      return;
    }

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
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
      await editTitle(id);
    }

    if (document.body.dataset.page === "home") {
      await renderHomePage();
    } else {
      await renderDetailsPage();
    }
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
  const button = document.querySelector("#ownerToggle");

  if (!button) {
    return;
  }

  const active = isOwnerMode();
  button.classList.toggle("active", active);
  button.textContent = active ? "Owner Unlocked" : "Owner Mode";
}

function setupOwnerMode() {
  const button = document.querySelector("#ownerToggle");

  if (!button) {
    return;
  }

  updateOwnerToggle();

  button.addEventListener("click", async () => {
    if (isOwnerMode()) {
      setOwnerMode(false);
      updateOwnerToggle();

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
      renderTitleGrid(filterTitles(titlesCache));
    };

    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
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

async function init() {
  setupLikeButtons();
  setupDeleteButtons();
  setupCommentDeleteButtons();
  setupOwnerActionButtons();
  setupOwnerMode();

  if (document.body.dataset.page === "home") {
    setupFilters();
    setupSuggestForm();
    await renderHomePage();
  }

  if (document.body.dataset.page === "details") {
    await renderDetailsPage();
  }
}

init().catch((error) => {
  console.error(error);
  showMessage("#formMessage", "Could not load MovieMate right now.");
  showMessage("#commentMessage", "Could not load comments right now.");
});
