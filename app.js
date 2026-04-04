import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  collection,
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

const BASE_TITLES = [
  {
    id: "moonlight-echo",
    title: "Moonlight Echo",
    type: "Movie",
    genre: "Drama",
    language: "English",
    description:
      "A grieving radio host forms an unexpected bond with a late-night caller whose secrets reshape both of their lives.",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80",
    likes: 12,
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
    genre: "Action",
    language: "English",
    description:
      "An ex-getaway driver returns to the city underworld for one final rescue mission racing against sunrise.",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    likes: 18,
    comments: []
  },
  {
    id: "orbit-of-us",
    title: "Orbit of Us",
    type: "Movie",
    genre: "Sci-Fi",
    language: "English",
    description:
      "Two astronauts stranded near Jupiter unravel a memory-altering signal that may rewrite humanity's future.",
    image:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80",
    likes: 20,
    comments: []
  },
  {
    id: "winter-house",
    title: "Winter House",
    type: "Series",
    genre: "Thriller",
    language: "Hindi",
    description:
      "A family retreat in the mountains turns sinister when every room begins revealing a different version of the truth.",
    image:
      "https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&w=900&q=80",
    likes: 9,
    comments: []
  },
  {
    id: "wildflower-summer",
    title: "Wildflower Summer",
    type: "Series",
    genre: "Romance",
    language: "Korean",
    description:
      "A documentary filmmaker revisits her hometown and rediscovers first love while capturing its final harvest festival.",
    image:
      "https://images.unsplash.com/photo-1518131678677-a16a0df1f0cb?auto=format&fit=crop&w=900&q=80",
    likes: 14,
    comments: []
  }
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let titlesCache = [];

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

  return {
    id: data.id || docLike.id,
    title: data.title || "",
    type: data.type || "Movie",
    genre: data.genre || "",
    language: data.language || "English",
    description: data.description || "",
    image: data.image || "",
    likes: Number(data.likes || 0),
    comments: Array.isArray(data.comments) ? data.comments : []
  };
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
  return `
    <article class="movie-card">
      <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="movie-content">
        <div class="movie-header">
          <div>
            <h3>${escapeHtml(title.title)}</h3>
            <p class="movie-meta">${escapeHtml(title.type)} • ${escapeHtml(title.genre)} • ${escapeHtml(title.language)}</p>
          </div>
          <span class="rating-pill"><strong>${title.likes}</strong> likes</span>
        </div>
        <p class="movie-description">${escapeHtml(title.description)}</p>
        <div class="movie-actions">
          <a class="details-link" href="details.html?id=${title.id}">View Details</a>
          <button class="secondary-btn like-btn" data-id="${title.id}" type="button">Like</button>
        </div>
      </div>
    </article>
  `;
}

function featuredCardTemplate(title) {
  return `
    <a class="featured-card" href="details.html?id=${title.id}">
      <img class="featured-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="featured-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <div class="movie-actions">
          <span class="genre-pill">${escapeHtml(title.type)}</span>
          <span class="rating-pill"><strong>${title.likes}</strong> likes</span>
        </div>
      </div>
    </a>
  `;
}

function commentTemplate(comment) {
  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.name || "Anonymous")}</strong>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p>${escapeHtml(comment.text)}</p>
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

  const featured = [...titles].sort((a, b) => b.likes - a.likes).slice(0, 4);
  container.innerHTML = featured.map(featuredCardTemplate).join("");
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
    const languageMatch = languageValue === "all" || title.language === languageValue;

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
  populateSelect(
    "#genreFilter",
    [...new Set(titles.map((title) => title.genre))].sort(),
    "genres"
  );
  populateSelect(
    "#languageFilter",
    [...new Set(titles.map((title) => title.language))].sort(),
    "languages"
  );
  renderFeaturedTitles(titles);
  renderTitleGrid(filterTitles(titles));
}

async function addTitle(form) {
  const formData = new FormData(form);
  const title = formData.get("title")?.toString().trim() || "";
  const type = formData.get("type")?.toString().trim() || "Movie";
  const genre = formData.get("genre")?.toString().trim() || "";
  const language = formData.get("language")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const image = formData.get("image")?.toString().trim() || "";

  const newTitle = {
    id: slugify(`${title}-${Date.now()}`),
    title,
    type,
    genre,
    language,
    description,
    image,
    likes: 0,
    comments: [],
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, TITLES_COLLECTION, newTitle.id), newTitle);
}

async function likeTitle(titleId) {
  await updateDoc(doc(db, TITLES_COLLECTION, titleId), {
    likes: increment(1)
  });
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

  target.innerHTML = `
    <section class="detail-card">
      <img class="detail-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="detail-copy">
        <p class="eyebrow">Title Details</p>
        <h1>${escapeHtml(title.title)}</h1>
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
            <p class="movie-meta">Language</p>
            <strong>${escapeHtml(title.language)}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Likes</p>
            <strong>${title.likes}</strong>
          </div>
        </div>
        <p class="detail-overview">${escapeHtml(title.description)}</p>
        <div class="detail-actions">
          <button class="primary-btn like-btn" data-id="${title.id}" type="button">Like This Title</button>
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
    const button = event.target.closest(".like-btn");

    if (!button) {
      return;
    }

    await likeTitle(button.dataset.id);

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
    showMessage("#formMessage", "Your suggestion is now live on MovieMate.");
    await renderHomePage();
  });
}

async function init() {
  setupLikeButtons();

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
