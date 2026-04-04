import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const MOVIES_COLLECTION = "moviemate_titles";

const BASE_TITLES = [
  {
    id: "moonlight-echo",
    title: "Moonlight Echo",
    type: "Movie",
    genre: "Drama",
    description:
      "A grieving radio host forms an unexpected bond with a late-night caller whose secrets reshape both of their lives.",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 4, 5, 4],
    comments: []
  },
  {
    id: "neon-run",
    title: "Neon Run",
    type: "Movie",
    genre: "Action",
    description:
      "An ex-getaway driver returns to the city underworld for one final rescue mission racing against sunrise.",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    ratings: [4, 5, 4, 4, 5],
    comments: []
  },
  {
    id: "orbit-of-us",
    title: "Orbit of Us",
    type: "Movie",
    genre: "Sci-Fi",
    description:
      "Two astronauts stranded near Jupiter unravel a memory-altering signal that may rewrite humanity's future.",
    image:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 5, 4],
    comments: []
  },
  {
    id: "the-last-laugh-club",
    title: "The Last Laugh Club",
    type: "Movie",
    genre: "Comedy",
    description:
      "A washed-up comic and a fearless newcomer team up for a comeback tour full of chaos, healing, and very bad motels.",
    image:
      "https://images.unsplash.com/photo-1518932945647-7a1c969f8be2?auto=format&fit=crop&w=900&q=80",
    ratings: [4, 3, 4, 5],
    comments: []
  },
  {
    id: "winter-house",
    title: "Winter House",
    type: "Series",
    genre: "Thriller",
    description:
      "A family retreat in the mountains turns sinister when every room begins revealing a different version of the truth.",
    image:
      "https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&w=900&q=80",
    ratings: [3, 4, 4],
    comments: []
  },
  {
    id: "wildflower-summer",
    title: "Wildflower Summer",
    type: "Series",
    genre: "Romance",
    description:
      "A documentary filmmaker revisits her hometown and rediscovers first love while capturing its final harvest festival.",
    image:
      "https://images.unsplash.com/photo-1518131678677-a16a0df1f0cb?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 4, 4, 5, 5],
    comments: []
  }
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let authMode = "login";
let currentUser = null;
let titlesCache = [];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function averageRating(ratings = []) {
  if (!ratings.length) {
    return 0;
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return total / ratings.length;
}

function formatRating(ratings) {
  const average = averageRating(ratings);
  return average ? average.toFixed(1) : "New";
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeTitle(docLike) {
  const data = typeof docLike.data === "function" ? docLike.data() : docLike;

  return {
    id: data.id || docLike.id,
    title: data.title || "",
    type: data.type || "Movie",
    genre: data.genre || "Drama",
    description: data.description || "",
    image: data.image || "",
    ratings: Array.isArray(data.ratings) ? data.ratings : [],
    comments: Array.isArray(data.comments) ? data.comments : []
  };
}

async function seedTitlesIfNeeded() {
  const snapshot = await getDocs(collection(db, MOVIES_COLLECTION));

  if (!snapshot.empty) {
    return;
  }

  await Promise.all(
    BASE_TITLES.map((title) =>
      setDoc(doc(db, MOVIES_COLLECTION, title.id), {
        ...title,
        createdAt: serverTimestamp()
      })
    )
  );
}

async function fetchTitles() {
  await seedTitlesIfNeeded();
  const snapshot = await getDocs(collection(db, MOVIES_COLLECTION));
  titlesCache = snapshot.docs.map(normalizeTitle);
  return titlesCache;
}

function createStarMarkup(titleId, ratings) {
  const rounded = Math.round(averageRating(ratings));
  const locked = !currentUser;

  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const activeClass = value <= rounded ? "active" : "";
    const lockClass = locked ? "locked" : "";

    return `
      <button class="star-btn ${activeClass} ${lockClass}" type="button" data-rate="${value}" data-id="${titleId}" aria-label="Rate ${value} star${value > 1 ? "s" : ""}">
        ★
      </button>
    `;
  }).join("");
}

function movieCardTemplate(title) {
  return `
    <article class="movie-card">
      <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" />
      <div class="movie-content">
        <div class="movie-header">
          <div>
            <h3>${escapeHtml(title.title)}</h3>
            <p class="movie-meta">${escapeHtml(title.type)} • ${escapeHtml(title.genre)}</p>
          </div>
          <span class="rating-pill"><strong>${formatRating(title.ratings)}</strong> / 5</span>
        </div>
        <p class="movie-description">${escapeHtml(title.description)}</p>
        <div class="rating-row">
          <span class="movie-meta">Rate this title:</span>
          <div class="stars">${createStarMarkup(title.id, title.ratings)}</div>
        </div>
        <p class="auth-note">${currentUser ? `Signed in as ${escapeHtml(currentUser.email)}` : "Login required to rate or comment."}</p>
        <div class="movie-actions">
          <a class="details-link" href="details.html?id=${title.id}">View Details</a>
          <span class="movie-meta">${title.ratings.length} vote${title.ratings.length === 1 ? "" : "s"}</span>
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
          <span class="rating-pill"><strong>${formatRating(title.ratings)}</strong> / 5</span>
        </div>
      </div>
    </a>
  `;
}

function commentTemplate(comment) {
  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.email)}</strong>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      <p>${escapeHtml(comment.text)}</p>
    </article>
  `;
}

function populateGenres(titles, selectedGenre = "all") {
  const select = document.querySelector("#genreFilter");

  if (!select) {
    return;
  }

  const genres = [...new Set(titles.map((title) => title.genre))].sort();
  select.innerHTML = `<option value="all">All genres</option>${genres
    .map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`)
    .join("")}`;
  select.value = genres.includes(selectedGenre) ? selectedGenre : "all";
}

function renderFeaturedTitles(titles) {
  const container = document.querySelector("#featuredMovies");

  if (!container) {
    return;
  }

  const featured = [...titles]
    .sort((a, b) => averageRating(b.ratings) - averageRating(a.ratings))
    .slice(0, 4);

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
  const ratingValue = Number(document.querySelector("#ratingFilter")?.value || 0);

  return titles.filter((title) => {
    const titleMatch =
      title.title.toLowerCase().includes(searchValue) ||
      title.description.toLowerCase().includes(searchValue);
    const typeMatch = typeValue === "all" || title.type === typeValue;
    const genreMatch = genreValue === "all" || title.genre === genreValue;
    const ratingMatch = averageRating(title.ratings) >= ratingValue;

    return titleMatch && typeMatch && genreMatch && ratingMatch;
  });
}

async function renderHomePage() {
  const titles = await fetchTitles();
  const selectedGenre = document.querySelector("#genreFilter")?.value || "all";
  populateGenres(titles, selectedGenre);
  renderFeaturedTitles(titles);
  renderTitleGrid(filterTitles(titles));
}

function showMessage(selector, text) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = text;
  }
}

function updateMemberBanner() {
  const banner = document.querySelector("#memberBanner");

  if (!banner) {
    return;
  }

  if (currentUser) {
    banner.textContent = `Logged in as ${currentUser.email}. You can now rate, comment, and suggest titles.`;
    banner.classList.remove("hidden");
  } else {
    banner.textContent = "";
    banner.classList.add("hidden");
  }
}

async function addTitle(form) {
  if (!currentUser) {
    openAuthModal("signup", "Join MovieMate to suggest a movie or series.");
    return false;
  }

  const formData = new FormData(form);
  const title = formData.get("title")?.toString().trim() || "";
  const type = formData.get("type")?.toString().trim() || "Movie";
  const genre = formData.get("genre")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const image = formData.get("image")?.toString().trim() || "";

  const newTitle = {
    id: slugify(`${title}-${Date.now()}`),
    title,
    type,
    genre,
    description,
    image,
    ratings: [],
    comments: [],
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, MOVIES_COLLECTION, newTitle.id), newTitle);
  return true;
}

async function updateRating(titleId, value) {
  if (!currentUser) {
    openAuthModal("login", "Please log in with your email before rating a title.");
    return;
  }

  const titleRef = doc(db, MOVIES_COLLECTION, titleId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(titleRef);

    if (!snapshot.exists()) {
      throw new Error("Title not found.");
    }

    const data = normalizeTitle(snapshot);
    transaction.update(titleRef, {
      ratings: [...data.ratings, value]
    });
  });

  await rerenderCurrentPage();
}

async function addComment(titleId, text) {
  if (!currentUser) {
    openAuthModal("login", "Please log in with your email before leaving a comment.");
    return false;
  }

  const titleRef = doc(db, MOVIES_COLLECTION, titleId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(titleRef);

    if (!snapshot.exists()) {
      throw new Error("Title not found.");
    }

    const data = normalizeTitle(snapshot);
    transaction.update(titleRef, {
      comments: [
        {
          email: currentUser.email,
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
    target.innerHTML = `
      <section class="not-found">
        <h1>Title not found</h1>
        <p class="detail-overview">The title you requested could not be found in this collection.</p>
        <a class="primary-btn" href="index.html">Return home</a>
      </section>
    `;
    return;
  }

  const snapshot = await getDoc(doc(db, MOVIES_COLLECTION, titleId));

  if (!snapshot.exists()) {
    target.innerHTML = `
      <section class="not-found">
        <h1>Title not found</h1>
        <p class="detail-overview">The title you requested could not be found in this collection.</p>
        <a class="primary-btn" href="index.html">Return home</a>
      </section>
    `;
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
            <p class="movie-meta">Average rating</p>
            <strong>${formatRating(title.ratings)} / 5</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Community votes</p>
            <strong>${title.ratings.length}</strong>
          </div>
        </div>
        <p class="detail-overview">${escapeHtml(title.description)}</p>
        <div class="detail-actions">
          <span class="movie-meta">Rate this title:</span>
          <div class="stars">${createStarMarkup(title.id, title.ratings)}</div>
        </div>
        <p class="auth-note">${currentUser ? `Signed in as ${escapeHtml(currentUser.email)}` : "Login with your email to rate and comment."}</p>
      </div>
    </section>

    <section class="comment-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Community comments</p>
          <h2>What viewers are saying</h2>
        </div>
        <p class="section-copy">
          ${currentUser ? "Share your take with the MovieMate community." : "Please log in first to join the conversation."}
        </p>
      </div>

      <form class="suggest-form comment-form" id="commentForm">
        <label class="input-group">
          <span>Your comment</span>
          <textarea name="comment" rows="4" placeholder="Write your review or reaction here" ${currentUser ? "" : "disabled"}></textarea>
        </label>
        <div class="form-actions">
          <button class="primary-btn" type="submit" ${currentUser ? "" : "disabled"}>Post Comment</button>
          <p class="form-message" id="commentMessage" aria-live="polite"></p>
        </div>
      </form>

      <div class="comment-list">
        ${title.comments.length ? title.comments.map(commentTemplate).join("") : '<p class="empty-state">No comments yet. Be the first to share a review.</p>'}
      </div>
    </section>
  `;

  setupCommentForm(title.id);
}

function updateAuthTrigger() {
  const trigger = document.querySelector("#authTrigger");

  if (!trigger) {
    return;
  }

  if (currentUser) {
    trigger.textContent = `Logout (${currentUser.email})`;
    trigger.dataset.authAction = "logout";
  } else {
    trigger.textContent = "Login / Signup";
    trigger.dataset.authAction = "open";
  }
}

function switchAuthMode(mode) {
  authMode = mode;

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authMode === mode);
  });

  const submit = document.querySelector("#authSubmit");
  const confirmGroup = document.querySelector("#confirmPasswordGroup");
  const confirmInput = document.querySelector("#authConfirmPassword");
  const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

  if (submit) {
    submit.textContent = mode === "login" ? "Login" : "Create Account";
  }

  if (confirmGroup && confirmInput) {
    const showConfirm = mode === "signup";
    confirmGroup.classList.toggle("hidden", !showConfirm);
    confirmInput.required = showConfirm;
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.classList.toggle("hidden", mode !== "login");
  }

  showMessage(
    "#authMessage",
    mode === "login"
      ? "Use your email to access ratings and comments."
      : "Create a MovieMate account with your email."
  );
}

function openAuthModal(mode = "login", messageText = "") {
  if (currentUser) {
    return;
  }

  switchAuthMode(mode);

  const modal = document.querySelector("#authModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  if (messageText) {
    showMessage("#authMessage", messageText);
  }
}

function closeAuthModal(force = false) {
  const modal = document.querySelector("#authModal");
  const form = document.querySelector("#authForm");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  if (form) {
    form.reset();
  }

  showMessage("#authMessage", "");
}

function formatAuthError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/wrong-password":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "This email already has an account. Please log in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection and try again.";
    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase yet.";
    default:
      return error?.message || "Authentication failed.";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document.querySelector("#authEmail")?.value.trim() || "";
  const password = document.querySelector("#authPassword")?.value || "";
  const confirmPassword = document.querySelector("#authConfirmPassword")?.value || "";

  try {
    if (authMode === "signup") {
      if (password !== confirmPassword) {
        showMessage("#authMessage", "Passwords do not match.");
        return;
      }

      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    updateAuthTrigger();
    updateMemberBanner();
    closeAuthModal(true);
  } catch (error) {
    showMessage("#authMessage", formatAuthError(error));
  }
}

async function handleForgotPassword() {
  const email = document.querySelector("#authEmail")?.value.trim() || "";

  if (!email) {
    showMessage("#authMessage", "Enter your email first, then click Forgot password.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("#authMessage", "Password reset email sent. Check your inbox.");
  } catch (error) {
    showMessage("#authMessage", formatAuthError(error));
  }
}

async function rerenderCurrentPage() {
  updateAuthTrigger();
  updateMemberBanner();

  if (document.body.dataset.page === "home") {
    await renderHomePage();
  }

  if (document.body.dataset.page === "details") {
    await renderDetailsPage();
  }
}

function setupRatings() {
  document.addEventListener("click", async (event) => {
    const star = event.target.closest(".star-btn");

    if (!star) {
      return;
    }

    const titleId = star.dataset.id;
    const rating = Number(star.dataset.rate);

    try {
      await updateRating(titleId, rating);
    } catch (error) {
      alert(formatAuthError(error));
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
    const text = new FormData(form).get("comment")?.toString().trim() || "";

    if (!text) {
      showMessage("#commentMessage", "Please write a comment before submitting.");
      return;
    }

    try {
      const added = await addComment(titleId, text);

      if (!added) {
        return;
      }

      form.reset();
      showMessage("#commentMessage", "Your comment is now live on this title page.");
      await renderDetailsPage();
    } catch (error) {
      showMessage("#commentMessage", formatAuthError(error));
    }
  });
}

function setupFilters() {
  const controls = ["#searchInput", "#typeFilter", "#genreFilter", "#ratingFilter"];

  controls.forEach((selector) => {
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

    try {
      const added = await addTitle(form);

      if (!added) {
        return;
      }

      form.reset();
      showMessage("#formMessage", "Title added. It is now live in the MovieMate collection.");
      await renderHomePage();
    } catch (error) {
      showMessage("#formMessage", formatAuthError(error));
    }
  });
}

function setupAuth() {
  updateAuthTrigger();
  switchAuthMode("login");

  document.querySelector("#authTrigger")?.addEventListener("click", async () => {
    const trigger = document.querySelector("#authTrigger");

    if (trigger?.dataset.authAction === "logout") {
      await signOut(auth);
      return;
    }

    openAuthModal("login");
  });

  document.querySelector("#authClose")?.addEventListener("click", closeAuthModal);
  document.querySelector("#authBackdrop")?.addEventListener("click", closeAuthModal);
  document.querySelector("#authForm")?.addEventListener("submit", handleAuthSubmit);
  document.querySelector("#forgotPasswordBtn")?.addEventListener("click", handleForgotPassword);

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchAuthMode(tab.dataset.authMode);
    });
  });
}

async function init() {
  setupAuth();
  setupRatings();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user ? { email: user.email, uid: user.uid } : null;
    await rerenderCurrentPage();
  });

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
  showMessage("#formMessage", "Firebase setup is incomplete. Add your Firebase config first.");
  showMessage("#authMessage", "Firebase setup is incomplete. Add your Firebase config first.");
});
