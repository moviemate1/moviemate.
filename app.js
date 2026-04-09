import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  arrayUnion,
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
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { firebaseConfig } from "/firebase-config.js";

const TITLES_COLLECTION = "moviemate_titles";
const SETTINGS_COLLECTION = "moviemate_settings";
const USERS_COLLECTION = "moviemate_users";
const HOMEPAGE_DOC_ID = "homepage";
const REACTIONS_STORAGE_KEY = "moviemate_reactions";
const SAVED_TITLES_STORAGE_KEY = "moviemate_saved_titles";
const OWNER_MODE_KEY = "moviemate_owner_mode";
const USER_NOTIFICATIONS_SEEN_KEY = "moviemate_notifications_seen_at";
const TITLES_CACHE_KEY = "moviemate_titles_cache_v1";
const HOMEPAGE_CONTENT_CACHE_KEY = "moviemate_homepage_content_cache_v1";
const SEARCH_PAGE_SIZE = 24;
const OWNER_PASSCODE = "1A2b3456@";
const OWNER_NOTIFICATION_TOAST_MS = 3200;
const REACTION_OPTIONS = {
  perfect: { label: "Perfection", className: "perfect" },
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
    "Quick trending picks and high-interest titles that feel right for a shared watch mood.",
  browseTitle: "Search by title, genre, language, or format",
  browseText:
    "Use fast filters to scan the library in a cleaner, more even card layout.",
  upcomingTitle: "Upcoming Movies & Series",
  upcomingText:
    "Watch what is releasing next with quick details on title, type, genre, language, release date, and story.",
  ownerTitle: "Homepage control and approvals",
  ownerText:
    "Review pending titles, approve what should go live, and mark standout titles as featured or trending.",
  communityBrowseTitle: "Browse freely",
  communityBrowseText: "Anyone can explore movies and series without creating an account.",
  communitySuggestTitle: "Build your list",
  communitySuggestText: "Members can save titles and track interest across devices.",
  communityReviewTitle: "Review and like",
  communityReviewText: "Read public reviews, post your own thoughts, and boost titles you enjoyed.",
  footerText: "A simple public space to explore movies and series, with member reactions, collections, and interest tracking."
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
const auth = getAuth(app);

let titlesCache = [];
let titlesCachePromise = null;
let homepageContentCache = { ...DEFAULT_HOMEPAGE_CONTENT };
let homepageContentPromise = null;
let currentUser = null;
let currentUserProfile = null;
let browseVisibleCount = SEARCH_PAGE_SIZE;
let pendingNotificationState = {
  count: null,
  unsubscribe: null
};

const DEFAULT_USER_PROFILE = {
  displayName: "",
  username: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  bio: "",
  avatarUrl: "",
  instagram: "",
  whatsapp: "",
  savedTitles: [],
  reactions: {},
  watchStatus: {},
  collections: [],
  followers: [],
  following: [],
  createdAt: null,
  updatedAt: null
};

function isOwnerMode() {
  return localStorage.getItem(OWNER_MODE_KEY) === "true";
}

function saveTitlesCacheToStorage(titles) {
  try {
    localStorage.setItem(TITLES_CACHE_KEY, JSON.stringify(titles));
  } catch (error) {
    console.warn("Could not store titles cache", error);
  }
}

function saveHomepageContentCacheToStorage(content) {
  try {
    localStorage.setItem(HOMEPAGE_CONTENT_CACHE_KEY, JSON.stringify(content));
  } catch (error) {
    console.warn("Could not store homepage cache", error);
  }
}

function hydrateStartupCaches() {
  try {
    const cachedTitles = JSON.parse(localStorage.getItem(TITLES_CACHE_KEY) || "[]");

    if (Array.isArray(cachedTitles) && cachedTitles.length) {
      titlesCache = cachedTitles.map(normalizeTitle);
    }
  } catch (error) {
    console.warn("Could not hydrate titles cache", error);
  }

  try {
    const cachedHomepage = JSON.parse(localStorage.getItem(HOMEPAGE_CONTENT_CACHE_KEY) || "null");

    if (cachedHomepage && typeof cachedHomepage === "object") {
      homepageContentCache = normalizeHomepageContent(cachedHomepage);
    }
  } catch (error) {
    console.warn("Could not hydrate homepage cache", error);
  }
}

function setOwnerMode(enabled) {
  localStorage.setItem(OWNER_MODE_KEY, enabled ? "true" : "false");
}

function isSignedIn() {
  return Boolean(currentUser?.uid);
}

function buildDefaultUsername(user = currentUser) {
  const source = user?.displayName || user?.email || "moviemateuser";
  return slugify(String(source).split("@")[0] || "moviemateuser");
}

function getProfileDisplayName(profile = currentUserProfile, user = currentUser) {
  if (profile?.displayName?.trim()) {
    return profile.displayName.trim();
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user?.displayName || user?.email?.split("@")[0] || "MovieMate Member";
}

function getProfileUsername(profile = currentUserProfile, user = currentUser) {
  return profile?.username?.trim() || buildDefaultUsername(user);
}

function getProfileInitials(profile = currentUserProfile, user = currentUser) {
  const displayName = getProfileDisplayName(profile, user);
  return displayName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getProfileAvatar(profile = currentUserProfile, user = currentUser) {
  const avatarUrl = String(profile?.avatarUrl || "").trim();

  if (avatarUrl) {
    return {
      image: avatarUrl,
      initials: ""
    };
  }

  return {
    image: "",
    initials: getProfileInitials(profile, user)
  };
}

function buildAuthActionSettings() {
  return {
    url: `${window.location.origin}/account.html`,
    handleCodeInApp: false
  };
}

function createGeneratedAvatarDataUrl(source = getProfileInitials()) {
  const initials = String(source || "MM")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "MM";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7e46ff" />
          <stop offset="55%" stop-color="#cf4dff" />
          <stop offset="100%" stop-color="#e50914" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)" />
      <circle cx="80" cy="80" r="70" fill="rgba(255,255,255,0.12)" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Manrope, Arial, sans-serif" font-size="56" font-weight="800">${escapeHtml(initials)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function updateAccountAvatarPreview(value) {
  const preview = document.querySelector("#accountAvatarPreview");

  if (!preview) {
    return;
  }

  const avatarUrl = String(value || "").trim();

  if (avatarUrl) {
    preview.innerHTML = `<img class="account-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(getProfileDisplayName())} avatar" />`;
    return;
  }

  preview.innerHTML = profileAvatarTemplate(currentUserProfile, currentUser, "account-avatar");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

function getUserDocRef(uid = currentUser?.uid) {
  return uid ? doc(db, USERS_COLLECTION, uid) : null;
}

function normalizeUserProfile(data = {}) {
  const normalizedWatchStatus =
    data.watchStatus && typeof data.watchStatus === "object"
      ? Object.fromEntries(
          Object.entries(data.watchStatus).map(([titleId, value]) => [
            titleId,
            value === "want" ? "interested" : value === "favorite" ? "watching" : value
          ])
        )
      : {};

  return {
    ...DEFAULT_USER_PROFILE,
    ...data,
    username: String(data.username || "").trim(),
    firstName: String(data.firstName || "").trim(),
    lastName: String(data.lastName || "").trim(),
    birthDate: String(data.birthDate || "").trim(),
    bio: String(data.bio || "").trim(),
    avatarUrl: String(data.avatarUrl || "").trim(),
    instagram: String(data.instagram || "").trim(),
    whatsapp: String(data.whatsapp || "").trim(),
    savedTitles: Array.isArray(data.savedTitles) ? data.savedTitles : [],
    reactions: data.reactions && typeof data.reactions === "object" ? data.reactions : {},
    watchStatus: normalizedWatchStatus,
    collections: Array.isArray(data.collections) ? data.collections : [],
    followers: Array.isArray(data.followers) ? data.followers : [],
    following: Array.isArray(data.following) ? data.following : []
  };
}

function getCommentSectionCopy(title) {
  if (isUpcomingTitle(title)) {
    return {
      eyebrow: "Discussion",
      title: `${getDisplayTypeLabel(title)} Discussion`,
      helper: "Only MovieMate members can join the discussion. Everyone can still read it.",
      fieldLabel: "Your discussion",
      placeholder: "Share what you expect from this title",
      buttonLabel: "Post Discussion",
      emptyLabel: "No discussion yet. Be the first to start it.",
      successLabel: "Your discussion is now live."
    };
  }

  return {
    eyebrow: "Reviews",
    title: `${getDisplayTypeLabel(title)} Reviews`,
    helper: "Only MovieMate members can post reviews and comments. Everyone can still read them.",
    fieldLabel: "Your review",
    placeholder: "Share your thoughts on this title",
    buttonLabel: "Post Review",
    emptyLabel: "No reviews yet. Be the first to write one.",
    successLabel: "Your review is now live."
  };
}

async function ensureUserProfile(user) {
  const ref = getUserDocRef(user?.uid);

  if (!ref) {
    currentUserProfile = null;
    return null;
  }

  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const username = buildDefaultUsername(user);
    const emailName = user.email?.split("@")[0] || "";
    const profile = {
      ...DEFAULT_USER_PROFILE,
      displayName: user.displayName || emailName || "MovieMate member",
      username,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(ref, profile, { merge: true });
    currentUserProfile = normalizeUserProfile(profile);
    return currentUserProfile;
  }

  currentUserProfile = normalizeUserProfile(snapshot.data());
  return currentUserProfile;
}

async function persistUserProfile(partial) {
  const ref = getUserDocRef();

  if (!ref || !currentUserProfile) {
    return;
  }

  const nextProfile = normalizeUserProfile({
    ...currentUserProfile,
    ...partial,
    updatedAt: new Date().toISOString()
  });

  currentUserProfile = nextProfile;
  await setDoc(ref, nextProfile, { merge: true });
}

function createActionTimeoutError(label) {
  const error = new Error(`${label} timed out.`);
  error.code = "deadline-exceeded";
  return error;
}

async function withActionTimeout(promise, label, timeoutMs = 8000) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(createActionTimeoutError(label)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
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
    image: String(person.image || "").trim(),
    tmdbPersonId: Number(person.tmdbPersonId || 0),
    biography: String(person.biography || "").trim(),
    birthday: String(person.birthday || "").trim(),
    birthplace: String(person.birthplace || "").trim(),
    knownForDepartment: String(person.knownForDepartment || "").trim()
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

function normalizePersonName(name) {
  return String(name || "").trim().toLowerCase();
}

function buildPersonUrl(name, tmdbPersonId = "") {
  const personName = String(name || "").trim();
  const search = new URLSearchParams();
  search.set("name", personName);

  if (tmdbPersonId) {
    search.set("tmdb", String(tmdbPersonId));
  }

  return `/person.html?${search.toString()}`;
}

function buildTitleUrl(id) {
  return `/details.html?id=${encodeURIComponent(id)}`;
}

function collectPersonCredits(personName, titles = titlesCache) {
  const normalizedName = normalizePersonName(personName);

  if (!normalizedName) {
    return {
      name: "",
      image: "",
      credits: [],
      roleHighlights: []
    };
  }

  let profileImage = "";
  let biography = "";
  let birthday = "";
  let birthplace = "";
  let knownForDepartment = "";
  let tmdbPersonId = 0;
  const credits = titles
    .map((title) => {
      const roles = [];

      if (normalizePersonName(title.director) === normalizedName) {
        roles.push("Director");
      }

      if (normalizePersonName(title.mainLead) === normalizedName) {
        roles.push("Main Lead");
      }

      if (normalizePersonName(title.heroine) === normalizedName) {
        roles.push("Heroine");
      }

      (title.cast || []).forEach((person) => {
        if (normalizePersonName(person.name) === normalizedName) {
          roles.push(person.role || "Cast");
          if (!profileImage && person.image) {
            profileImage = person.image;
          }
          if (!biography && person.biography) {
            biography = person.biography;
          }
          if (!birthday && person.birthday) {
            birthday = person.birthday;
          }
          if (!birthplace && person.birthplace) {
            birthplace = person.birthplace;
          }
          if (!knownForDepartment && person.knownForDepartment) {
            knownForDepartment = person.knownForDepartment;
          }
          if (!tmdbPersonId && person.tmdbPersonId) {
            tmdbPersonId = Number(person.tmdbPersonId);
          }
        }
      });

      (title.crew || []).forEach((person) => {
        if (normalizePersonName(person.name) === normalizedName) {
          roles.push(person.role || "Crew");
          if (!profileImage && person.image) {
            profileImage = person.image;
          }
          if (!biography && person.biography) {
            biography = person.biography;
          }
          if (!birthday && person.birthday) {
            birthday = person.birthday;
          }
          if (!birthplace && person.birthplace) {
            birthplace = person.birthplace;
          }
          if (!knownForDepartment && person.knownForDepartment) {
            knownForDepartment = person.knownForDepartment;
          }
          if (!tmdbPersonId && person.tmdbPersonId) {
            tmdbPersonId = Number(person.tmdbPersonId);
          }
        }
      });

      if (!roles.length) {
        return null;
      }

      return {
        title,
        roles: [...new Set(roles)]
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = Date.parse(left.title.releaseDate || "") || 0;
      const rightDate = Date.parse(right.title.releaseDate || "") || 0;

      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }

      return (right.title.tmdbPopularity || 0) - (left.title.tmdbPopularity || 0);
    });

  const roleHighlights = [...new Set(credits.flatMap((entry) => entry.roles))].slice(0, 6);

  return {
    name: personName,
    image: profileImage,
    credits,
    roleHighlights,
    biography,
    birthday,
    birthplace,
    knownForDepartment,
    tmdbPersonId
  };
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
  const platforms = Array.isArray(data.platforms)
    ? data.platforms
    : data.platforms
      ? [data.platforms]
      : [];
  const seasons = Array.isArray(data.seasons)
    ? data.seasons.map((season, index) => ({
        number: Number(season.number || index + 1),
        title: season.title || `Season ${index + 1}`,
        year: season.year || "",
        episodes: Number(season.episodes || 0),
        image: season.image || data.image || "",
        reviewsCount: Number(season.reviewsCount || 0)
      }))
    : [];

  return {
    id: data.id || docLike.id,
    title: data.title || "",
    type: data.type || "Movie",
    status: data.status || "Released",
    releaseDate: data.releaseDate || "",
    genre: data.genre || "",
    language: languages,
    platforms,
    description: data.description || "",
    image: data.image || "",
    trailerUrl: data.trailerUrl || "",
    director: data.director || "",
    mainLead: data.mainLead || "",
    heroine: data.heroine || "",
    cast: normalizePeopleList(data.cast, "Cast"),
    crew: normalizePeopleList(data.crew, "Crew"),
    submittedBy: data.submittedBy || "",
    submittedByName: data.submittedByName || "",
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
    viewsCount: Number(data.viewsCount || 0),
    savesCount: Number(data.savesCount || 0),
    seasonsCount: Number(data.seasonsCount || seasons.length || 0),
    episodesCount: Number(data.episodesCount || 0),
    seasons,
    importBuckets: Array.isArray(data.importBuckets) ? data.importBuckets : [],
    comments: Array.isArray(data.comments)
      ? data.comments.map((comment, index) => ({
          id: comment.id || `${data.id || docLike.id}-comment-${index}`,
          userId: comment.userId || "",
          name: comment.name || "Anonymous",
          text: comment.text || "",
          spoiler: Boolean(comment.spoiler),
          createdAt: comment.createdAt || null,
          reports: Array.isArray(comment.reports) ? comment.reports : []
        }))
      : []
  };
}

function getDisplayTypeLabel(title) {
  if (title.type === "Series") {
    return "TV Show";
  }

  return title.type || "Movie";
}

function buildSeasonCards(title) {
  if (Array.isArray(title.seasons) && title.seasons.length) {
    return title.seasons;
  }

  if (title.type !== "Series" || title.seasonsCount <= 1) {
    return [];
  }

  return Array.from({ length: title.seasonsCount }, (_, index) => ({
    number: index + 1,
    title: `Season ${index + 1}`,
    year: title.releaseDate ? new Date(`${title.releaseDate}T00:00:00`).getFullYear() + index : "",
    episodes:
      title.episodesCount && title.seasonsCount
        ? Math.max(1, Math.round(title.episodesCount / title.seasonsCount))
        : 0,
    image: title.image,
    reviewsCount: 0
  }));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function normalizeSeasonVoteBreakdown(rawBreakdown = {}) {
  const initial = {
    skip: Number(rawBreakdown.skip || 0),
    timepass: Number(rawBreakdown.timepass || 0),
    goForIt: Number(rawBreakdown.goForIt || 0),
    perfection: Number(rawBreakdown.perfection || 0)
  };
  const total = initial.skip + initial.timepass + initial.goForIt + initial.perfection;

  if (!total) {
    return {
      skip: "0.00",
      timepass: "0.00",
      goForIt: "0.00",
      perfection: "0.00"
    };
  }

  return {
    skip: ((initial.skip / total) * 100).toFixed(2),
    timepass: ((initial.timepass / total) * 100).toFixed(2),
    goForIt: ((initial.goForIt / total) * 100).toFixed(2),
    perfection: ((initial.perfection / total) * 100).toFixed(2)
  };
}

function deriveSeasonBreakdown(title, season, index) {
  if (season.voteBreakdown && typeof season.voteBreakdown === "object") {
    return normalizeSeasonVoteBreakdown(season.voteBreakdown);
  }

  const stats = getReactionStats(title);

  if (!stats.total) {
    return {
      skip: "0.00",
      timepass: "0.00",
      goForIt: "0.00",
      perfection: "0.00"
    };
  }

  const shift = (index - Math.max(0, Math.floor((title.seasonsCount || 1) / 2))) * 1.75;
  const raw = {
    perfection: clampPercent(stats.perfectPercent + shift),
    goForIt: clampPercent(stats.goForItPercent - shift / 2),
    timepass: clampPercent(stats.timepassPercent + shift / 4),
    skip: clampPercent(stats.skipPercent - shift / 3)
  };

  return normalizeSeasonVoteBreakdown(raw);
}

function getSeasonReviewsCount(title, season, index) {
  if (Number(season.reviewsCount || 0) > 0) {
    return Number(season.reviewsCount || 0);
  }

  const totalComments = Array.isArray(title.comments) ? title.comments.length : 0;
  const popularityBase = Math.max(12, Math.round(Number(title.tmdbPopularity || 0) * 12));
  return popularityBase + totalComments * 14 + index * 97;
}

function seasonScoreStripTemplate(breakdown) {
  return `
    <div class="season-score-strip" aria-hidden="true">
      <span class="season-score-skip" style="width:${breakdown.skip}%"></span>
      <span class="season-score-timepass" style="width:${breakdown.timepass}%"></span>
      <span class="season-score-go" style="width:${breakdown.goForIt}%"></span>
      <span class="season-score-perfect" style="width:${breakdown.perfection}%"></span>
    </div>
  `;
}

function getSeasonWatchKey(titleId, seasonNumber) {
  return `${titleId}::season-${seasonNumber}`;
}

function seasonsSectionTemplate(title) {
  const seasons = buildSeasonCards(title);

  if (!seasons.length) {
    return "";
  }

  return `
    <section class="seasons-section">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">TV show guide</p>
          <h2>Seasons</h2>
        </div>
        <div class="seasons-toolbar">
          <button class="season-nav-btn" type="button" aria-label="Previous season row">&#8249;</button>
          <label class="season-sequence-filter">
            <span>Sequence</span>
            <select disabled>
              <option>Sequence</option>
            </select>
          </label>
          <button class="season-nav-btn" type="button" aria-label="Next season row">&#8250;</button>
        </div>
      </div>
      <div class="seasons-grid">
        ${seasons
          .map((season, index) => {
            const breakdown = deriveSeasonBreakdown(title, season, index);
            const reviewsCount = getSeasonReviewsCount(title, season, index);

            return `
              <article class="season-card">
                <img class="season-poster" src="${season.image || title.image}" alt="${escapeHtml(season.title)} poster" loading="lazy" decoding="async" />
                <div class="season-copy">
                  <div class="season-card-head">
                    <div class="season-card-meta">
                      <h3>${escapeHtml(season.title)}</h3>
                      <p>${escapeHtml([season.year, season.episodes ? `${season.episodes} Episodes` : ""].filter(Boolean).join(" • ") || "Episodes not added")}</p>
                      <small>${escapeHtml(`${reviewsCount} Reviews`)}</small>
                    </div>
                    <button
                      class="season-view-btn ${getTitleWatchStatus(getSeasonWatchKey(title.id, season.number)) === "watched" ? "active" : ""}"
                      type="button"
                      aria-label="Mark season as watched"
                      data-season-watch="true"
                      data-id="${title.id}"
                      data-season-number="${season.number}"
                    >
                      &#128065;
                    </button>
                  </div>
                  ${seasonScoreStripTemplate(breakdown)}
                </div>
              </article>
            `
          })
          .join("")}
      </div>
    </section>
  `;
}

function getVisibleTitles(titles) {
  return titles.filter((title) => title.approved);
}

function getPendingTitles(titles) {
  return titles.filter((title) => !title.approved);
}

function getStoredReactions() {
  if (isSignedIn()) {
    return currentUserProfile?.reactions || {};
  }

  return {};
}

function getSavedTitles() {
  if (isSignedIn()) {
    return currentUserProfile?.savedTitles || [];
  }

  return [];
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

function getWatchStatusMap() {
  return currentUserProfile?.watchStatus || {};
}

function normalizeWatchStatusValue(value) {
  if (value === "want") {
    return "interested";
  }

  if (value === "favorite") {
    return "watching";
  }

  return value || "";
}

function formatWatchStatusLabel(value) {
  const normalized = normalizeWatchStatusValue(value);

  if (normalized === "interested") {
    return "Interested";
  }

  if (normalized === "watching") {
    return "Watching";
  }

  if (normalized === "watched") {
    return "Watched";
  }

  return "";
}

function getTitleWatchStatus(titleId) {
  return normalizeWatchStatusValue(getWatchStatusMap()[titleId] || "");
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

function formatMonthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);
}

function getReaction(titleId) {
  const reactions = getStoredReactions();
  return reactions[titleId] || "";
}

function setReaction(titleId, reaction) {
  if (isSignedIn()) {
    const reactions = { ...(currentUserProfile?.reactions || {}) };

    if (reaction) {
      reactions[titleId] = reaction;
    } else {
      delete reactions[titleId];
    }

    currentUserProfile = normalizeUserProfile({
      ...currentUserProfile,
      reactions
    });
    return;
  }

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

async function syncSavedTitle(titleId) {
  if (!isSignedIn()) {
    return false;
  }

  const saved = new Set(getSavedTitles());
  const wasSaved = saved.has(titleId);

  if (wasSaved) {
    saved.delete(titleId);
  } else {
    saved.add(titleId);
  }

  currentUserProfile = normalizeUserProfile({
    ...currentUserProfile,
    savedTitles: [...saved]
  });

  persistUserProfile({ savedTitles: [...saved] }).catch((error) => {
    console.warn("Saved titles synced locally, but profile sync failed.", error);
  });

  withActionTimeout(
    updateDoc(doc(db, TITLES_COLLECTION, titleId), {
      savesCount: increment(wasSaved ? -1 : 1)
    }),
    "collection update"
  ).catch((error) => {
    console.warn("Collection aggregate sync failed.", error);
  });
  return true;
}

async function syncWatchStatus(titleId, nextStatus) {
  if (!isSignedIn()) {
    return false;
  }

  const watchStatus = { ...(currentUserProfile?.watchStatus || {}) };
  if (nextStatus === "clear" || !nextStatus) {
    delete watchStatus[titleId];
  } else {
    watchStatus[titleId] = nextStatus;
  }

  currentUserProfile = normalizeUserProfile({
    ...currentUserProfile,
    watchStatus
  });

  persistUserProfile({ watchStatus }).catch((error) => {
    console.warn("Watch status synced locally, but profile sync failed.", error);
  });

  return true;
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

function formatPlatforms(platforms = []) {
  return platforms.length ? platforms.join(", ") : "Platform not added";
}

async function shareTitle(title) {
  const shareData = {
    title: title.title,
    text: `${title.title} on MovieMate`,
    url: `${window.location.origin}/details.html?id=${title.id}`
  };

  if (navigator.share) {
    await navigator.share(shareData);
    return true;
  }

  await navigator.clipboard.writeText(shareData.url);
  return true;
}

function reactionButtonsTemplate(title) {
  const currentReaction = getReaction(title.id);
  const stats = getReactionStats(title);
  const memberReady = isSignedIn();

  return `
    <div class="reaction-panel">
      <div class="reaction-buttons">
        ${Object.entries(REACTION_OPTIONS)
          .map(
            ([value, option]) => `
              <button class="reaction-btn reaction-btn-${option.className} ${currentReaction === value ? `active ${option.className}` : ""}" data-id="${title.id}" data-reaction="${value}" type="button" ${memberReady ? "" : "disabled aria-disabled=\"true\""}>
                ${option.label}
              </button>
            `
          )
          .join("")}
      </div>
      <p class="reaction-summary">${stats.total} votes • ${stats.recommendedPercent}% recommend</p>
      ${memberReady ? "" : '<p class="member-action-note">Members only. Sign in to vote and react.</p>'}
    </div>
  `;
}

function watchStatusActionsTemplate(title) {
  const currentStatus = getTitleWatchStatus(title.id);
  const memberReady = isSignedIn();
  const actions = [
    ["interested", "Mark as Interested"],
    ["watching", "Watching..."],
    ["watched", "Mark as Watched"]
  ];

  return `
    <div class="watch-status-row">
      ${actions
        .map(
          ([value, label]) => `
            <button
              class="watch-status-btn watch-status-btn-${value} ${currentStatus === value ? "active" : ""}"
              type="button"
              data-watch-status="${value}"
              data-id="${title.id}"
              ${memberReady ? "" : "disabled aria-disabled=\"true\""}
            >
              ${
                currentStatus === value && value === "interested"
                  ? "Interested"
                  : currentStatus === value && value === "watched"
                    ? "Watched"
                    : label
              }
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function isUpcomingTitle(title) {
  if (title.status === "Upcoming") {
    return true;
  }

  if (!title.releaseDate) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return title.releaseDate > today;
}

function getUpcomingInterestState(status) {
  if (status === "interested" || status === "watching" || status === "watched") {
    return {
      label: "Interested",
      nextStatus: "clear",
      className: "watch-status-btn-interested active",
      helper: "Tap again to remove this from interested."
    };
  }

  return {
    label: "Mark as Interested",
    nextStatus: "interested",
    className: "watch-status-btn-interested",
    helper: "Members can mark unreleased titles as interested."
  };
}

function getReleasedWatchCycleState(status) {
  if (status === "interested") {
    return {
      label: "Interested",
      nextStatus: "watching",
      className: "watch-status-btn-interested active",
      helper: "Tap again to move this to Watching."
    };
  }

  if (status === "watching") {
    return {
      label: "Watching...",
      nextStatus: "watched",
      className: "watch-status-btn-watching active",
      helper: "Tap again to mark this as Watched."
    };
  }

  if (status === "watched") {
    return {
      label: "Watched",
      nextStatus: "clear",
      className: "watch-status-btn-watched active",
      helper: "Tap again to clear this watch status."
    };
  }

  return {
    label: "Mark as Interested",
    nextStatus: "interested",
    className: "watch-status-btn-interested",
    helper: "Tap again after that to move through Watching and Watched."
  };
}

function getPrimaryWatchButtonState(title, status) {
  return isUpcomingTitle(title)
    ? getUpcomingInterestState(status)
    : getReleasedWatchCycleState(status);
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
        <div class="meter-row"><span class="meter-dot dot-perfect"></span><span>Perfection</span><strong>${perfectPercent}%</strong></div>
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
  const interestLabel = getHeroLaunchLabel(title);
  const interestedCount = formatLargeNumber(getInterestedCount(title));
  const interestState = getPrimaryWatchButtonState(title, getTitleWatchStatus(title.id));
  const memberReady = isSignedIn();
  const overlayTitle = `
    <p class="eyebrow">${escapeHtml(title.type)} • ${escapeHtml(String(title.releaseDate ? new Date(title.releaseDate).getFullYear() : "Now"))}</p>
    <h2>${escapeHtml(title.title)}</h2>
  `;
  const interestCard = `
    <aside class="hero-interest-card">
      <p class="hero-interest-eyebrow">${escapeHtml(interestLabel)}</p>
      <h3>${escapeHtml(formatReleaseDate(title.releaseDate))}</h3>
      <p class="hero-interest-count">${escapeHtml(interestedCount)} interested</p>
      <button class="watch-status-btn hero-interest-action ${interestState.className}" type="button" data-watch-status="${interestState.nextStatus}" data-id="${title.id}" ${memberReady ? "" : "disabled aria-disabled=\"true\""}>
        ${escapeHtml(interestState.label)}
      </button>
      <p class="hero-interest-helper">${memberReady ? escapeHtml(interestState.helper) : "Sign in to mark titles as interested."}</p>
    </aside>
  `;

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
        ${interestCard}
        <div class="trailer-overlay">
          ${overlayTitle}
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
      ${interestCard}
      <div class="trailer-overlay">
        ${overlayTitle}
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
    <a class="person-card" href="${buildPersonUrl(person.name, person.tmdbPersonId)}" aria-label="Open ${escapeHtml(person.name)} details">
      ${avatar}
      <h4>${escapeHtml(person.name)}</h4>
      <p>${escapeHtml(person.role || "")}</p>
    </a>
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
      <div class="detail-tag-row">
        ${String(title.genre || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`)
          .join("")}
      </div>
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

async function fetchTitles(force = false) {
  if (!force && titlesCache.length) {
    return titlesCache;
  }

  if (!force && titlesCachePromise) {
    return titlesCachePromise;
  }

  titlesCachePromise = (async () => {
    const snapshot = await getDocs(collection(db, TITLES_COLLECTION));

    if (snapshot.empty) {
      await Promise.all(
        BASE_TITLES.map((title) =>
          setDoc(doc(db, TITLES_COLLECTION, title.id), {
            ...title,
            createdAt: serverTimestamp()
          })
        )
      );

      titlesCache = BASE_TITLES.map(normalizeTitle);
      saveTitlesCacheToStorage(titlesCache);
      return titlesCache;
    }

    titlesCache = snapshot.docs.map(normalizeTitle);
    saveTitlesCacheToStorage(titlesCache);
    return titlesCache;
  })();

  try {
    return await titlesCachePromise;
  } finally {
    titlesCachePromise = null;
  }
}

async function fetchHomepageContent(force = false) {
  if (
    !force &&
    homepageContentCache &&
    homepageContentCache.heroTitle !== DEFAULT_HOMEPAGE_CONTENT.heroTitle
  ) {
    return homepageContentCache;
  }

  if (!force && homepageContentPromise) {
    return homepageContentPromise;
  }

  const homepageRef = doc(db, SETTINGS_COLLECTION, HOMEPAGE_DOC_ID);
  homepageContentPromise = (async () => {
    const snapshot = await getDoc(homepageRef);

    if (!snapshot.exists()) {
      homepageContentCache = { ...DEFAULT_HOMEPAGE_CONTENT };
      await setDoc(homepageRef, homepageContentCache);
      saveHomepageContentCacheToStorage(homepageContentCache);
      return homepageContentCache;
    }

    homepageContentCache = normalizeHomepageContent(snapshot.data());
    saveHomepageContentCacheToStorage(homepageContentCache);
    return homepageContentCache;
  })();

  try {
    return await homepageContentPromise;
  } finally {
    homepageContentPromise = null;
  }
}

function getCardLabel(title) {
  if (title.importBuckets.includes("trending")) {
    return title.type === "Series" ? "New Episode" : "Trending Now";
  }

  if (title.importBuckets.includes("popular")) {
    return title.type === "Series" ? "Popular Show" : "Popular Movie";
  }

  if (title.status === "Upcoming") {
    return title.type === "Series" ? "New Season" : "New Movie";
  }

  return `New ${title.type}`;
}

function getHeroLaunchLabel(title) {
  const platformText = formatPlatforms(title.platforms || []);
  const lower = platformText.toLowerCase();

  if (title.status === "Upcoming") {
    if (title.type === "Movie") {
      return lower.includes("theatre") || lower.includes("cinema") || lower.includes("theater")
        ? "Coming to Theaters"
        : "Coming Soon";
    }

    return "New Season";
  }

  if (lower && lower !== "platform not added") {
    return `Now on ${platformText.split(",")[0].trim()}`;
  }

  return title.type === "Series" ? "Streaming now" : "Now Showing";
}

function getInterestedCount(title) {
  const stats = getReactionStats(title);
  const popularity = Number(title.tmdbPopularity || 0);
  const saves = Number(title.savesCount || 0);
  const votes = stats.total;
  const baseline = title.status === "Upcoming" ? 2400 : 1200;
  const estimate = Math.round(popularity * 100 + saves * 22 + votes * 28 + baseline);
  return Math.max(estimate, votes * 12 + 300);
}

function movieCardTemplate(title) {
  const saved = isSavedTitle(title.id);
  const memberReady = isSignedIn();
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

  const cardLabel = getCardLabel(title);
  const secondaryLine =
    title.status === "Upcoming"
      ? formatReleaseDate(title.releaseDate)
      : title.type === "Series"
        ? "Series"
        : "Movie";

  return `
    <article class="movie-card movie-card-compact">
      <a class="movie-card-link" href="${buildTitleUrl(title.id)}">
        <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
        <div class="movie-content">
          <div class="movie-card-summary movie-card-summary-feed">
            <div class="movie-header movie-header-feed">
              <div>
                <h3>${escapeHtml(title.title)}</h3>
                <p class="movie-meta">${escapeHtml(cardLabel)}</p>
                <p class="movie-meta subtle-line clamp-line">${escapeHtml(secondaryLine)}</p>
              </div>
            </div>
          </div>
        </div>
      </a>
      <div class="movie-actions movie-actions-compact">
        <button class="owner-action-btn save-title-btn ${saved ? "active" : ""}" data-save-id="${title.id}" type="button">${saved ? "Saved" : "Save"}</button>
      </div>
      ${memberReady ? "" : '<p class="member-action-note card-member-note">Members only can save, vote, and track titles.</p>'}
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
  const secondaryLine =
    title.status === "Upcoming"
      ? formatReleaseDate(title.releaseDate)
      : title.type === "Series"
        ? title.importBuckets.includes("trending")
          ? "New Episode"
          : "Series"
        : "Movie";

  return `
    <a class="featured-card featured-feed-card" href="${buildTitleUrl(title.id)}">
      <img class="featured-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <div class="featured-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p class="movie-meta">${escapeHtml(cardLabel)}</p>
        <p class="movie-meta subtle-line">${escapeHtml(secondaryLine)}</p>
      </div>
    </a>
  `;
}

function getGenreSet(title) {
  return new Set(
    String(title.genre || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function countSharedValues(left = [], right = []) {
  const rightSet = new Set((right || []).map((value) => String(value).trim().toLowerCase()));
  return (left || []).filter((value) => rightSet.has(String(value).trim().toLowerCase())).length;
}

function getSimilarityScore(baseTitle, candidate) {
  let score = 0;
  const baseGenres = getGenreSet(baseTitle);
  const candidateGenres = getGenreSet(candidate);

  candidateGenres.forEach((genre) => {
    if (baseGenres.has(genre)) {
      score += 18;
    }
  });

  if (candidate.type === baseTitle.type) {
    score += 16;
  }

  score += countSharedValues(baseTitle.language, candidate.language) * 12;

  if (candidate.trending) {
    score += 8;
  }

  if (candidate.pinned) {
    score += 6;
  }

  score += Math.min(getReactionStats(candidate).recommendedPercent / 5, 20);
  return score;
}

function similarSectionTemplate(baseTitle, titles, mode) {
  const matches = titles
    .filter((candidate) => candidate.id !== baseTitle.id && candidate.approved)
    .map((candidate) => {
      const score = getSimilarityScore(baseTitle, candidate);
      const sameGenre = [...getGenreSet(candidate)].some((genre) => getGenreSet(baseTitle).has(genre));
      const sameLanguage = countSharedValues(baseTitle.language, candidate.language) > 0;

      return {
        candidate,
        score,
        sameGenre,
        sameLanguage
      };
    })
    .filter((entry) => (mode === "genre" ? entry.sameGenre : entry.sameLanguage))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((entry) => entry.candidate);

  if (!matches.length) {
    return "";
  }

  return `
    <section class="similar-section">
      <div class="section-heading compact-heading">
        <div>
          <p class="eyebrow">${mode === "genre" ? "Same genre" : "Same language"}</p>
          <h2>${mode === "genre" ? "More from this genre" : "More in this language"}</h2>
        </div>
        <p class="section-copy">
          ${
            mode === "genre"
              ? `More ${escapeHtml(baseTitle.type.toLowerCase())} picks with a similar genre feeling.`
              : `More ${escapeHtml(baseTitle.type.toLowerCase())} picks in ${escapeHtml(baseTitle.language.join(", "))}.`
          }
        </p>
      </div>
      <div class="featured-grid detail-similar-grid">
        ${matches.map(featuredCardTemplate).join("")}
      </div>
    </section>
  `;
}

function mostInterestedItemTemplate(title, index) {
  const interestedCount = getInterestedCount(title);
  const releaseLabel = title.status === "Upcoming" ? getHeroLaunchLabel(title) : title.status;

  return `
    <a class="interest-item" href="${buildTitleUrl(title.id)}">
      <span class="interest-rank">${index + 1}</span>
      <img class="interest-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <div class="interest-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p>${escapeHtml(formatReleaseDate(title.releaseDate))} • ${escapeHtml(releaseLabel)}</p>
        <span>${escapeHtml(formatLargeNumber(interestedCount))} interested</span>
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
      <a class="movie-card-link" href="${buildTitleUrl(title.id)}">
        <img class="movie-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
        <div class="movie-content">
          <div class="movie-header">
            <div>
              <h3>${escapeHtml(title.title)}</h3>
              <p class="movie-meta">Type: ${escapeHtml(title.type)}</p>
              <p class="movie-meta">Genre: ${escapeHtml(title.genre)}</p>
              <p class="movie-meta">Language: ${escapeHtml(title.language.join(", "))}</p>
              ${title.platforms?.length ? `<p class="movie-meta">Platform: ${escapeHtml(formatPlatforms(title.platforms))}</p>` : ""}
              <p class="movie-meta">Release date: ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
              <div class="status-row">${badges}</div>
            </div>
          </div>
          <p class="movie-description">${escapeHtml(title.description)}</p>
        </div>
      </a>
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
  const spoilerBody = comment.spoiler
    ? `
        <div class="spoiler-box" data-spoiler-box="true">
          <button class="secondary-btn spoiler-toggle-btn" type="button" data-toggle-spoiler="true">
            Reveal spoiler
          </button>
          <p class="spoiler-text hidden">${escapeHtml(comment.text)}</p>
        </div>
      `
    : `<p>${escapeHtml(comment.text)}</p>`;

  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.name || "Anonymous")}</strong>
        <span>${escapeHtml(formatDate(comment.createdAt))}</span>
      </div>
      ${comment.spoiler ? '<span class="status-pill status-upcoming spoiler-pill">Spoiler</span>' : ""}
      ${spoilerBody}
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

function hasPlatformMatch(title, matchers) {
  const platforms = (title.platforms || []).map((value) => String(value).toLowerCase());
  return matchers.some((matcher) => platforms.some((platform) => platform.includes(matcher)));
}

function getCuratedTitles(titles, predicate, sortFn, limit = 10) {
  return [...titles]
    .filter(predicate)
    .sort(sortFn)
    .slice(0, limit);
}

function renderNamedExploreRow(sectionId, titles, heading, copy) {
  const grid = document.querySelector(`#${sectionId}Grid`);
  const emptyState = document.querySelector(`#${sectionId}EmptyState`);
  const headingNode = document.querySelector(`#${sectionId}Heading`);
  const copyNode = document.querySelector(`#${sectionId}Copy`);

  if (!grid || !emptyState) {
    return;
  }

  if (headingNode) {
    headingNode.textContent = heading;
  }

  if (copyNode) {
    copyNode.textContent = copy;
  }

  grid.innerHTML = titles.map(featuredCardTemplate).join("");
  emptyState.classList.toggle("hidden", titles.length > 0);
}

function renderCuratedExploreRows(titles) {
  const watchWithDistrict = getCuratedTitles(
    titles,
    (title) => title.trending || title.importBuckets.includes("trending") || getInterestScore(title) > 140,
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const editorsPick = getCuratedTitles(
    titles,
    (title) => title.pinned || getReactionStats(title).recommendedPercent >= 70,
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const bollywoodPicks = getCuratedTitles(
    titles,
    (title) =>
      title.importBuckets.includes("bollywood") ||
      title.language.some((language) => String(language).toLowerCase().includes("hindi")),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const southPicks = getCuratedTitles(
    titles,
    (title) =>
      title.importBuckets.includes("south") ||
      title.language.some((language) => {
        const value = String(language).toLowerCase();
        return (
          value.includes("tamil") ||
          value.includes("telugu") ||
          value.includes("malayalam") ||
          value.includes("kannada")
        );
      }),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const netflixPicks = getCuratedTitles(
    titles,
    (title) => hasPlatformMatch(title, ["netflix"]),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const hotstarPicks = getCuratedTitles(
    titles,
    (title) => hasPlatformMatch(title, ["jiohotstar", "hotstar", "disney+ hotstar", "disney hotstar"]),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const primePicks = getCuratedTitles(
    titles,
    (title) => hasPlatformMatch(title, ["prime", "prime video", "amazon prime"]),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const crunchyrollPicks = getCuratedTitles(
    titles,
    (title) => hasPlatformMatch(title, ["crunchyroll"]),
    (a, b) => getInterestScore(b) - getInterestScore(a)
  );

  const trendingGrid = document.querySelector("#trendingGrid");
  const trendingEmptyState = document.querySelector("#trendingEmptyState");
  const trendingHeading = document.querySelector("#trendingHeadingText");
  const trendingCopy = document.querySelector("#trendingCopyText");

  if (trendingHeading) {
    trendingHeading.textContent = "Watch It With District";
  }

  if (trendingCopy) {
    trendingCopy.textContent =
      "Quick trending picks and high-interest titles that feel right for a shared watch mood.";
  }

  if (trendingGrid && trendingEmptyState) {
    trendingGrid.innerHTML = watchWithDistrict.map(featuredCardTemplate).join("");
    trendingEmptyState.classList.toggle("hidden", watchWithDistrict.length > 0);
  }

  renderNamedExploreRow(
    "editorsRow",
    editorsPick,
    "Editor's Pick Of The Week",
    "Owner-backed and high-recommendation titles that deserve extra attention this week."
  );
  renderNamedExploreRow(
    "bollywoodRow",
    bollywoodPicks,
    "Bollywood Buzz",
    "Hindi movie picks with strong India buzz and Bollywood energy."
  );
  renderNamedExploreRow(
    "southRow",
    southPicks,
    "South Cinema Spotlight",
    "Tamil, Telugu, Malayalam, and Kannada picks with strong South cinema energy."
  );
  renderNamedExploreRow(
    "netflixRow",
    netflixPicks,
    "Don't Miss These on Netflix",
    "Strong Netflix picks already inside your MovieMate library."
  );
  renderNamedExploreRow(
    "hotstarRow",
    hotstarPicks,
    "Don't Miss These on JioHotstar",
    "Hotstar-friendly picks across movies and series."
  );
  renderNamedExploreRow(
    "primeRow",
    primePicks,
    "Worth Watching on Prime",
    "Prime Video titles with good buzz or recommendation strength."
  );
  renderNamedExploreRow(
    "crunchyrollRow",
    crunchyrollPicks,
    "Worth Watching on Crunchyroll",
    "Anime and Crunchyroll-ready titles worth opening next."
  );
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
  const loadMoreWrap = document.querySelector("#loadMoreWrap");
  const visibleTitles = titles.slice(0, browseVisibleCount);

  if (!grid || !emptyState) {
    return;
  }

  grid.innerHTML = visibleTitles.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", titles.length > 0);
  loadMoreWrap?.classList.toggle("hidden", titles.length <= visibleTitles.length);
}

function renderSearchSuggestions(titles) {
  const list = document.querySelector("#searchSuggestions");
  const query = document.querySelector("#searchInput")?.value.trim().toLowerCase() || "";

  if (!list) {
    return;
  }

  if (!query) {
    list.innerHTML = "";
    list.classList.add("hidden");
    return;
  }

  const matches = titles
    .filter((title) => {
      const haystack = [
        title.title,
        title.description,
        title.genre,
        title.type,
        title.language.join(" "),
        formatPlatforms(title.platforms)
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    })
    .slice(0, 6);

  if (!matches.length) {
    list.innerHTML = "";
    list.classList.add("hidden");
    return;
  }

  list.innerHTML = matches
    .map(
      (title) => `
        <a class="search-suggestion-item" href="${buildTitleUrl(title.id)}">
          <img src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
          <span>
            <strong>${escapeHtml(title.title)}</strong>
            <small>${escapeHtml(title.type)} • ${escapeHtml(title.genre)}</small>
          </span>
        </a>
      `
    )
    .join("");
  list.classList.remove("hidden");
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
  const watchStatus = getTitleWatchStatus(title.id);

  return `
    <a class="schedule-card" href="${buildTitleUrl(title.id)}">
      <div class="schedule-date-badge">
        <span>${title.releaseDate ? new Date(`${title.releaseDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase() : "TBD"}</span>
        <strong>${title.releaseDate ? new Date(`${title.releaseDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit" }) : "--"}</strong>
      </div>
      <img class="schedule-poster" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <div class="schedule-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p>${escapeHtml(title.type)} • ${escapeHtml(formatReleaseDate(title.releaseDate))}</p>
        ${watchStatus ? `<span class="schedule-status-tag">${escapeHtml(formatWatchStatusLabel(watchStatus))}</span>` : ""}
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
    <a class="collection-card" href="collection.html?mode=${encodeURIComponent(collection.mode || "discover")}&slug=${encodeURIComponent(collection.slug || slugify(collection.title))}">
      <img class="collection-cover" src="${collection.image}" alt="${escapeHtml(collection.title)} cover" loading="lazy" decoding="async" />
      <div class="collection-copy">
        <h3>${escapeHtml(collection.title)}</h3>
        <p>${escapeHtml(collection.subtitle)}</p>
        <span>${collection.count} items • ${collection.likes} likes</span>
      </div>
    </a>
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
      mode: "discover",
      slug: slugify(group.title),
      image: group.items[0].image,
      count: group.items.length,
      likes: group.items.reduce((sum, item) => sum + getReactionStats(item).total, 0)
    }));
}

function buildPersonalCollections(titles) {
  const savedIds = new Set(getSavedTitles());
  const savedTitles = titles.filter((title) => savedIds.has(title.id));
  const reactionMap = getStoredReactions();
  const watchStatus = getWatchStatusMap();
  const reactedTitles = titles.filter((title) => reactionMap[title.id]);
  const perfectTitles = titles.filter((title) => reactionMap[title.id] === "perfect");
  const watchedTitles = titles.filter((title) => watchStatus[title.id] === "watched");
  const interestedTitles = titles.filter((title) => getTitleWatchStatus(title.id) === "interested");
  const watchingTitles = titles.filter((title) => getTitleWatchStatus(title.id) === "watching");

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
    },
    {
      title: "Watched",
      subtitle: "Titles you already finished",
      items: watchedTitles
    },
    {
      title: "Interested",
      subtitle: "Titles you want to start soon",
      items: interestedTitles
    },
    {
      title: "Watching",
      subtitle: "Titles you are currently watching",
      items: watchingTitles
    }
  ]
    .filter((group) => group.items.length)
    .map((group) => ({
      ...group,
      mode: "mine",
      slug: slugify(group.title),
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
      mode: "saved",
      slug: slugify(group.title),
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

function getReviewEntryMoment(entry) {
  const commentTimestamp = entry.comments?.[0]?.createdAt;
  const fromComment = getCreatedAtMs(commentTimestamp);

  if (fromComment) {
    return fromComment;
  }

  const release = entry.title.releaseDate ? new Date(`${entry.title.releaseDate}T00:00:00`).getTime() : 0;
  if (release) {
    return release;
  }

  return getCreatedAtMs(entry.title.createdAt);
}

function buildCalendarCells(monthIndex, year) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, cellIndex) => {
    const dayNumber = cellIndex - firstWeekday + 1;

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return { dateKey: "", dayNumber: "", items: [], empty: true };
    }

    const date = new Date(year, monthIndex, dayNumber);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      dateKey,
      dayNumber,
      items: [],
      empty: false
    };
  });
}

function reviewCalendarItemTemplate(entry) {
  const reactionLabel = entry.reaction ? REACTION_OPTIONS[entry.reaction]?.label || entry.reaction : "Comment";
  return `
    <a class="review-calendar-item" href="${buildTitleUrl(entry.title.id)}">
      <span>${escapeHtml(entry.title.title)}</span>
      <small>${escapeHtml(reactionLabel)}</small>
    </a>
  `;
}

function renderReviewCalendar(reviewEntries, monthIndex, year) {
  const grid = document.querySelector("#reviewCalendarGrid");
  const label = document.querySelector("#reviewCalendarLabel");
  const monthSelect = document.querySelector("#reviewMonthSelect");
  const yearSelect = document.querySelector("#reviewYearSelect");

  if (!grid || !label || !monthSelect || !yearSelect) {
    return;
  }

  monthSelect.value = String(monthIndex);
  yearSelect.value = String(year);
  label.textContent = formatMonthLabel(year, monthIndex);

  const cells = buildCalendarCells(monthIndex, year);

  reviewEntries.forEach((entry) => {
    const moment = getReviewEntryMoment(entry);

    if (!moment) {
      return;
    }

    const date = new Date(moment);

    if (date.getMonth() !== monthIndex || date.getFullYear() !== year) {
      return;
    }

    const key = date.toISOString().slice(0, 10);
    const cell = cells.find((item) => item.dateKey === key);

    if (cell) {
      cell.items.push(entry);
    }
  });

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  grid.innerHTML = `
    <div class="review-calendar-head">
      ${weekdays.map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="review-calendar-body">
      ${cells
        .map(
          (cell) => `
            <article class="review-calendar-cell ${cell.empty ? "empty" : ""}">
              ${
                cell.empty
                  ? ""
                  : `
                    <span class="review-calendar-date">${cell.dayNumber}</span>
                    <div class="review-calendar-items">
                      ${cell.items.map(reviewCalendarItemTemplate).join("")}
                    </div>
                  `
              }
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReviewsPage() {
  const target = document.querySelector("#reviewsPage");

  if (!target) {
    return;
  }

  if (!isSignedIn() || !currentUserProfile) {
    target.innerHTML = `
      <section class="account-empty-state">
        <p class="eyebrow">My Reviews</p>
        <h1>Sign in to see your review diary.</h1>
        <p class="section-copy">Your votes and comments will be placed into a calendar so you can revisit what you watched each month.</p>
        <button class="primary-btn" type="button" id="reviewsSignInBtn">Sign In</button>
      </section>
    `;
    document.querySelector("#reviewsSignInBtn")?.addEventListener("click", () => openAuthModal("login"));
    return;
  }

  const reviewEntries = getProfileReviewEntries(getVisibleTitles(titlesCache));
  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index,
    label: new Date(now.getFullYear(), index, 1).toLocaleDateString("en-IN", { month: "long" })
  }));
  const yearOptions = getYearOptions();

  target.innerHTML = `
    <section class="reviews-page-shell">
      <div class="section-heading reviews-page-heading">
        <div>
          <p class="eyebrow">Your diary</p>
          <h1>My Reviews</h1>
        </div>
        <div class="reviews-calendar-controls">
          <button class="icon-chip" id="reviewsPrevMonth" type="button" aria-label="Previous month">‹</button>
          <label>
            <select id="reviewMonthSelect">
              ${monthOptions
                .map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            <select id="reviewYearSelect">
              ${yearOptions
                .map((year) => `<option value="${year}">${year}</option>`)
                .join("")}
            </select>
          </label>
          <button class="icon-chip" id="reviewsNextMonth" type="button" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="reviews-calendar-shell">
        <p class="reviews-calendar-label" id="reviewCalendarLabel"></p>
        <div class="review-calendar-grid" id="reviewCalendarGrid"></div>
      </div>
    </section>
  `;

  setupReviewsPageControls(reviewEntries);
  renderReviewCalendar(reviewEntries, now.getMonth(), now.getFullYear());
}

function setupReviewsPageControls(reviewEntries) {
  const monthSelect = document.querySelector("#reviewMonthSelect");
  const yearSelect = document.querySelector("#reviewYearSelect");
  const prevButton = document.querySelector("#reviewsPrevMonth");
  const nextButton = document.querySelector("#reviewsNextMonth");

  const renderFromControls = () => {
    const monthIndex = Number(monthSelect?.value || 0);
    const year = Number(yearSelect?.value || new Date().getFullYear());
    renderReviewCalendar(reviewEntries, monthIndex, year);
  };

  monthSelect?.addEventListener("change", renderFromControls);
  yearSelect?.addEventListener("change", renderFromControls);

  prevButton?.addEventListener("click", () => {
    const currentMonth = Number(monthSelect?.value || 0);
    const currentYear = Number(yearSelect?.value || new Date().getFullYear());
    const date = new Date(currentYear, currentMonth, 1);
    date.setMonth(date.getMonth() - 1);
    monthSelect.value = String(date.getMonth());
    yearSelect.value = String(date.getFullYear());
    renderFromControls();
  });

  nextButton?.addEventListener("click", () => {
    const currentMonth = Number(monthSelect?.value || 0);
    const currentYear = Number(yearSelect?.value || new Date().getFullYear());
    const date = new Date(currentYear, currentMonth, 1);
    date.setMonth(date.getMonth() + 1);
    monthSelect.value = String(date.getMonth());
    yearSelect.value = String(date.getFullYear());
    renderFromControls();
  });
}

function getCollectionsByMode(titles, mode) {
  if (mode === "mine") {
    return buildPersonalCollections(titles);
  }

  if (mode === "saved") {
    return buildSavedCollections(titles);
  }

  return buildDiscoverCollections(titles);
}

function renderCollectionPage() {
  const target = document.querySelector("#collectionPage");

  if (!target) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || "discover";
  const slug = params.get("slug") || "";
  const visibleTitles = getVisibleTitles(titlesCache);

  if ((mode === "mine" || mode === "saved") && !isSignedIn()) {
    target.innerHTML = `
      <section class="account-empty-state">
        <p class="eyebrow">Collections</p>
        <h1>Sign in to open your personal collections.</h1>
        <p class="section-copy">Saved titles, interested picks, watching progress, and watched titles will appear here after you sign in.</p>
        <button class="primary-btn" type="button" id="collectionSignInBtn">Sign In</button>
      </section>
    `;
    document.querySelector("#collectionSignInBtn")?.addEventListener("click", () => openAuthModal("login"));
    return;
  }

  const collections = getCollectionsByMode(visibleTitles, mode);
  const selected = collections.find((collection) => collection.slug === slug) || collections[0];

  if (!selected) {
    target.innerHTML = `<section class="account-empty-state"><h1>Collection not found.</h1></section>`;
    return;
  }

  target.innerHTML = `
    <section class="collection-page-shell">
      <aside class="collection-list-card">
        <p class="eyebrow">${escapeHtml(mode === "mine" ? "My collections" : mode === "saved" ? "Saved shelves" : "Discover collections")}</p>
        <h1>${escapeHtml(mode === "mine" ? "Your Collections" : mode === "saved" ? "Saved Lists" : "Collection Explorer")}</h1>
        <div class="collection-link-list">
          ${collections
            .map(
              (collection) => `
                <a class="collection-link-card ${collection.slug === selected.slug ? "active" : ""}" href="collection.html?mode=${encodeURIComponent(mode)}&slug=${encodeURIComponent(collection.slug)}">
                  <strong>${escapeHtml(collection.title)}</strong>
                  <small>${collection.count} items</small>
                </a>
              `
            )
            .join("")}
        </div>
      </aside>
      <section class="collection-detail-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${escapeHtml(mode === "mine" ? "Personal collection" : mode === "saved" ? "Saved collection" : "Discover collection")}</p>
            <h2>${escapeHtml(selected.title)}</h2>
          </div>
          <p class="section-copy">${escapeHtml(selected.subtitle)}</p>
        </div>
        <div class="movie-grid">
          ${selected.items.map(movieCardTemplate).join("")}
        </div>
      </section>
    </section>
  `;
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
      href: buildTitleUrl(title.id),
      createdAtMs: getCreatedAtMs(title.createdAt)
    }));

  const allTimeGreats = [...titles]
    .sort((a, b) => getInterestScore(b) - getInterestScore(a))
    .slice(0, 3)
    .map((title) => ({
      label: "All-time great pick",
      title: title.title,
      copy: `${getReactionStats(title).recommendedPercent}% recommend • ${title.genre}`,
      href: buildTitleUrl(title.id),
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
      title.description.toLowerCase().includes(searchValue) ||
      title.genre.toLowerCase().includes(searchValue) ||
      title.language.join(" ").toLowerCase().includes(searchValue) ||
      formatPlatforms(title.platforms).toLowerCase().includes(searchValue);
    const typeMatch = typeValue === "all" || title.type === typeValue;
    const genreMatch = genreValue === "all" || title.genre === genreValue;
    const languageMatch = languageValue === "all" || title.language.includes(languageValue);

    return titleMatch && typeMatch && genreMatch && languageMatch;
  });
}

function refreshBrowseResults() {
  const visibleTitles = getVisibleTitles(titlesCache);
  const filtered = filterTitles(visibleTitles);
  renderTitleGrid(filtered);
  renderSearchSuggestions(visibleTitles);
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
  browseVisibleCount = Math.max(browseVisibleCount, SEARCH_PAGE_SIZE);
  renderHomepageContent(homepageContent);
  renderFeaturedTitles(visibleTitles);
  renderTrendingTitles(visibleTitles);
  renderCuratedExploreRows(visibleTitles);
  renderMostInterestedList(visibleTitles);
  renderHeroStats(visibleTitles);
  updateOwnerToggle();

  requestAnimationFrame(() => {
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
    refreshBrowseResults();
    renderScheduleGrid(visibleTitles);
    renderCollectionsGrid(visibleTitles);
    renderUserNotifications(visibleTitles);
    renderOwnerPanel(titles);
    renderOwnerNotifications(titles);
    renderOwnerAnalytics(visibleTitles);
  });
}

function refreshHomePageInBackground() {
  if (document.body.dataset.page !== "home") {
    return;
  }

  window.setTimeout(async () => {
    try {
      await Promise.all([fetchHomepageContent(true), fetchTitles(true)]);

      if (document.body.dataset.page === "home") {
        await renderHomePage();
      }
    } catch (error) {
      console.warn("Background homepage refresh failed", error);
    }
  }, 80);
}

async function addTitle(form) {
  const formData = new FormData(form);
  const title = formData.get("title")?.toString().trim() || "";
  const type = formData.get("type")?.toString().trim() || "Movie";
  const status = formData.get("status")?.toString().trim() || "Released";
  const genre = formData.get("genre")?.toString().trim() || "";
  const platforms = (formData.get("platforms")?.toString().trim() || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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
    platforms,
    language: language.length ? language : ["English"],
    description,
    image,
    trailerUrl,
    director,
    mainLead,
    heroine,
    cast,
    crew,
    submittedBy: currentUser?.uid || "",
    submittedByName: isSignedIn() ? getProfileDisplayName() : "",
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
  if (form.elements.platforms) {
    form.elements.platforms.value = (title.platforms || []).join(", ");
  }
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

  frame.src = embedUrl.includes("?") ? `${embedUrl}&autoplay=1` : `${embedUrl}?autoplay=1`;
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

function openAuthModal(mode = "login") {
  const modal = document.querySelector("#authModal");

  if (!modal) {
    return;
  }

  setAuthMode(mode);
  showMessage("#authMessage", "");
  modal.classList.remove("hidden");
  syncModalVisibility();
}

function closeAuthModal() {
  const modal = document.querySelector("#authModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  syncModalVisibility();
}

function setAuthMode(mode) {
  const form = document.querySelector("#authForm");
  const title = document.querySelector("#authTitle");
  const submit = document.querySelector("#authSubmit");
  const nameField = document.querySelector("#authNameField");
  const loginTab = document.querySelector("#authLoginTab");
  const signupTab = document.querySelector("#authSignupTab");

  if (!form) {
    return;
  }

  form.dataset.mode = mode;

  if (title) {
    title.textContent = mode === "signup" ? "Create your MovieMate account" : "Sign in to MovieMate";
  }

  if (submit) {
    submit.textContent = mode === "signup" ? "Create Account" : "Sign In";
  }

  if (nameField) {
    nameField.classList.toggle("hidden", mode !== "signup");
  }

  loginTab?.classList.toggle("active", mode === "login");
  signupTab?.classList.toggle("active", mode === "signup");
}

function updateAuthUI() {
  document.querySelectorAll("[data-auth-toggle]").forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const avatar = button.querySelector("[data-account-avatar]");
    const label = button.querySelector("[data-account-label]");
    const avatarData = getProfileAvatar();

    if (isSignedIn()) {
      button.classList.add("signed-in");
      if (avatar) {
        if (avatarData.image) {
          avatar.textContent = "";
          avatar.style.backgroundImage = `url("${avatarData.image}")`;
          avatar.style.backgroundSize = "cover";
          avatar.style.backgroundPosition = "center";
          avatar.style.backgroundRepeat = "no-repeat";
        } else {
          avatar.textContent = getProfileInitials();
          avatar.style.backgroundImage = "";
          avatar.style.backgroundSize = "";
          avatar.style.backgroundPosition = "";
          avatar.style.backgroundRepeat = "";
        }
        avatar.classList.remove("hidden");
      }
      if (label) {
        label.textContent = getProfileDisplayName();
      } else {
        button.textContent = getProfileDisplayName();
      }
    } else {
      button.classList.remove("signed-in");
      if (avatar) {
        avatar.textContent = "MM";
        avatar.style.backgroundImage = "";
        avatar.style.backgroundSize = "";
        avatar.style.backgroundPosition = "";
        avatar.style.backgroundRepeat = "";
        avatar.classList.add("hidden");
      }
      if (label) {
        label.textContent = "Sign In";
      } else {
        button.textContent = "Sign In";
      }
    }
  });

  document.querySelectorAll("[data-account-only]").forEach((element) => {
    element.classList.toggle("hidden", !isSignedIn());
  });

  document.querySelectorAll("[data-signed-out-only]").forEach((element) => {
    element.classList.toggle("hidden", isSignedIn());
  });

  document.querySelectorAll("[data-profile-link]").forEach((link) => {
    if (link instanceof HTMLAnchorElement) {
      link.href = "/profile.html";
    }
  });

  document.querySelectorAll("[data-account-settings-link]").forEach((link) => {
    if (link instanceof HTMLAnchorElement) {
      link.href = "/account.html";
    }
  });

  const authHint = document.querySelector("#authHint");

  if (authHint) {
    authHint.textContent = isSignedIn()
      ? `Signed in as ${currentUser?.email || "MovieMate member"}`
      : "Sign in to keep collections, member reactions, and your watch progress across devices.";
  }
}

async function handleAuthSubmit(form) {
  const formData = new FormData(form);
  const mode = form.dataset.mode || "login";
  const name = formData.get("displayName")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const password = formData.get("password")?.toString().trim() || "";

  if (!email || !password) {
    showMessage("#authMessage", "Enter email and password first.");
    return;
  }

  if (mode === "signup") {
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = credentials.user;
    await ensureUserProfile(credentials.user);
    await persistUserProfile({
      displayName: name || email
    });
    await sendEmailVerification(credentials.user, buildAuthActionSettings());
    showMessage(
      "#authMessage",
      "Account created. Verification email sent. Check inbox, spam, and promotions."
    );
    closeAuthModal();
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
  closeAuthModal();
}

function closeAccountMenus() {
  document.querySelectorAll(".account-menu").forEach((menu) => {
    menu.classList.add("hidden");
    menu.setAttribute("aria-hidden", "true");
  });
}

function toggleAccountMenu(button) {
  const wrap = button.closest(".account-menu-wrap");
  const menu = wrap?.querySelector(".account-menu");

  if (!menu) {
    return;
  }

  const willOpen = menu.classList.contains("hidden");
  closeAccountMenus();
  menu.classList.toggle("hidden", !willOpen);
  menu.setAttribute("aria-hidden", willOpen ? "false" : "true");
}

function setupAuthModal() {
  const form = document.querySelector("#authForm");
  const closeButton = document.querySelector("#authClose");
  const loginTab = document.querySelector("#authLoginTab");
  const signupTab = document.querySelector("#authSignupTab");
  const forgotButton = document.querySelector("#forgotPasswordBtn");

  document.querySelectorAll("[data-auth-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (isSignedIn()) {
        toggleAccountMenu(button);
        return;
      }

      openAuthModal("login");
    });
  });

  document.querySelectorAll("[data-signin-action]").forEach((button) => {
    button.addEventListener("click", () => {
      closeAccountMenus();
      openAuthModal("login");
    });
  });

  document.querySelectorAll("[data-signout-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      closeAccountMenus();
      await signOut(auth);
    });
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target.closest(".account-menu-wrap")) {
      return;
    }

    closeAccountMenus();
  });

  loginTab?.addEventListener("click", () => setAuthMode("login"));
  signupTab?.addEventListener("click", () => setAuthMode("signup"));
  closeButton?.addEventListener("click", closeAuthModal);

  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeAuth === "true") {
      closeAuthModal();
    }
  });

  forgotButton?.addEventListener("click", async () => {
    const email = form?.elements.email?.value?.trim();

    if (!email) {
      showMessage("#authMessage", "Enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email, buildAuthActionSettings());
      showMessage("#authMessage", "Password reset email sent. Check inbox, spam, and promotions.");
    } catch (error) {
      console.error(error);
      showMessage("#authMessage", "Could not send reset email. Check Firebase Email/Password and authorized domains.");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("#authMessage", "Working...");

    try {
      await handleAuthSubmit(form);
      updateAuthUI();
    } catch (error) {
      console.error(error);
      showMessage("#authMessage", "Sign in failed. Check your email/password, Firebase Email/Password, and authorized domains.");
    }
  });
}

function requireAccount(actionText = "use this feature") {
  if (isSignedIn()) {
    return true;
  }

  openAuthModal("login");
  showMessage("#authMessage", `Sign in to ${actionText}.`);
  return false;
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

  if (!titlesStat || !upcomingStat) {
    return;
  }

  const totalUpcoming = titles.filter((title) => title.status === "Upcoming").length;

  titlesStat.textContent = String(titles.length);
  upcomingStat.textContent = String(totalUpcoming);
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
    platforms: (formData.get("platforms")?.toString().trim() || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
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

function analyticsRowTemplate(title, metric, value) {
  return `
    <a class="analytics-row" href="${buildTitleUrl(title.id)}">
      <img src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <span>
        <strong>${escapeHtml(title.title)}</strong>
        <small>${escapeHtml(metric)} • ${escapeHtml(String(value))}</small>
      </span>
    </a>
  `;
}

function renderOwnerAnalytics(titles) {
  const panel = document.querySelector("#ownerAnalytics");

  if (!panel) {
    return;
  }

  const mostViewed = [...titles].sort((a, b) => b.viewsCount - a.viewsCount)[0];
  const mostSaved = [...titles].sort((a, b) => b.savesCount - a.savesCount)[0];
  const mostVoted = [...titles].sort((a, b) => getReactionStats(b).total - getReactionStats(a).total)[0];

  panel.innerHTML = `
    <article class="analytics-card">
      <p class="eyebrow">Most viewed</p>
      ${mostViewed ? analyticsRowTemplate(mostViewed, "Views", mostViewed.viewsCount) : '<p class="section-copy">No view data yet.</p>'}
    </article>
    <article class="analytics-card">
      <p class="eyebrow">Most voted</p>
      ${mostVoted ? analyticsRowTemplate(mostVoted, "Votes", getReactionStats(mostVoted).total) : '<p class="section-copy">No voting data yet.</p>'}
    </article>
    <article class="analytics-card">
      <p class="eyebrow">Most saved</p>
      ${mostSaved ? analyticsRowTemplate(mostSaved, "Saves", mostSaved.savesCount) : '<p class="section-copy">No saved data yet.</p>'}
    </article>
  `;
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
  if (!isSignedIn()) {
    return false;
  }

  const currentReaction = getReaction(titleId);

  if (!(nextReaction in REACTION_OPTIONS)) {
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
  const updates = {};
  const isClearing = currentReaction === nextReaction;

  if (!isClearing) {
    updates[fieldMap[nextReaction]] = increment(1);
  }

  if (currentReaction && fieldMap[currentReaction]) {
    updates[fieldMap[currentReaction]] = increment(-1);
  }

  let likesDelta = 0;
  let dislikesDelta = 0;

  if (currentReaction && positiveReactions.has(currentReaction)) {
    likesDelta -= 1;
  }

  if (!isClearing && positiveReactions.has(nextReaction)) {
    likesDelta += 1;
  }

  if (currentReaction && negativeReactions.has(currentReaction)) {
    dislikesDelta -= 1;
  }

  if (!isClearing && negativeReactions.has(nextReaction)) {
    dislikesDelta += 1;
  }

  if (likesDelta !== 0) {
    updates.likes = increment(likesDelta);
  }

  if (dislikesDelta !== 0) {
    updates.dislikes = increment(dislikesDelta);
  }

  setReaction(titleId, isClearing ? "" : nextReaction);
  persistUserProfile({
    reactions: { ...(currentUserProfile?.reactions || {}) }
  }).catch((error) => {
    console.warn("Reaction saved locally, but profile sync failed.", error);
  });

  withActionTimeout(updateDoc(doc(db, TITLES_COLLECTION, titleId), updates), "vote save").catch((error) => {
    console.warn("Vote aggregate sync failed.", error);
  });

  return {
    ok: true,
    cleared: isClearing
  };
}

async function deleteTitle(titleId) {
  await deleteDoc(doc(db, TITLES_COLLECTION, titleId));
  clearReaction(titleId);
}

async function addComment(titleId, form) {
  if (!isSignedIn()) {
    requireAccount("post reviews and comments");
    return false;
  }

  const formData = new FormData(form);
  const name = getProfileDisplayName();
  const text = formData.get("comment")?.toString().trim() || "";
  const spoiler = formData.get("spoiler") === "on";

  if (!text) {
    showMessage("#commentMessage", "Please write a review or comment first.");
    return false;
  }

  const titleRef = doc(db, TITLES_COLLECTION, titleId);
  await withActionTimeout(
    updateDoc(titleRef, {
      comments: arrayUnion({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: currentUser?.uid || "",
        name,
        text,
        spoiler,
        createdAt: new Date().toISOString()
      })
    }),
    "comment post"
  );

  return true;
}

function getCommentErrorMessage(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  if (code.includes("permission-denied") || message.includes("missing or insufficient permissions")) {
    return "Comments are blocked by Firebase rules right now.";
  }

  if (code.includes("unauthenticated")) {
    return "Please sign in again and try posting.";
  }

  if (code.includes("deadline-exceeded")) {
    return "The request took too long. Please try again.";
  }

  if (code.includes("unavailable")) {
    return "The connection is busy right now. Please try again.";
  }

  return "Could not post right now.";
}

function getActionErrorMessage(error, fallback = "Could not update right now.") {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  if (code.includes("permission-denied") || message.includes("missing or insufficient permissions")) {
    return "This action is blocked by Firebase rules right now.";
  }

  if (code.includes("unauthenticated")) {
    return "Please sign in again and try once more.";
  }

  if (code.includes("deadline-exceeded") || message.includes("timed out")) {
    return "The request took too long. Please try again.";
  }

  if (code.includes("unavailable") || code.includes("resource-exhausted")) {
    return "MovieMate is busy right now. Please try again in a moment.";
  }

  return fallback;
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

  try {
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

    trackTitleView(title.id).catch((error) => console.error(error));

    const stats = getReactionStats(title);
    const saved = isSavedTitle(title.id);
    const embeddedTrailerUrl = getYouTubeEmbedUrl(title.trailerUrl);
    const releaseYear = title.releaseDate ? new Date(title.releaseDate).getFullYear() : "Now";
    const displayTypeLabel = getDisplayTypeLabel(title);
    const leadDirector = title.director || "MovieMate";
    const leadCreditLabel = title.type === "Series" ? "Showrunner" : "Directed by";
    const commentSectionCopy = getCommentSectionCopy(title);
    const primaryLanguage = title.language?.[0] || "Not added";
    const primaryPlatform = formatPlatforms(title.platforms);
    const currentWatchStatus = getTitleWatchStatus(title.id);
    const primaryWatchButton = getPrimaryWatchButtonState(title, currentWatchStatus);
    const memberReady = isSignedIn();
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
            <p class="eyebrow">${escapeHtml(displayTypeLabel)} • ${escapeHtml(String(releaseYear))}</p>
            <h1>${escapeHtml(title.title)}</h1>
            <div class="status-row">${badges}</div>
            <div class="detail-facts-grid">
              <div class="detail-fact">
                <span>${escapeHtml(leadCreditLabel)}</span>
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
                <span>Platform</span>
                <strong>${escapeHtml(primaryPlatform)}</strong>
              </div>
              <div class="detail-fact">
                <span>Release</span>
                <strong>${escapeHtml(formatReleaseDate(title.releaseDate))}</strong>
              </div>
            </div>
            <p class="detail-hero-description">${escapeHtml(title.description)}</p>
          </div>
          <div class="detail-cta-stack">
            <button
              class="watch-status-btn ${primaryWatchButton.className}"
              type="button"
              data-watch-status="${primaryWatchButton.nextStatus}"
              data-id="${title.id}"
              ${memberReady ? "" : "disabled aria-disabled=\"true\""}
            >
              ${escapeHtml(primaryWatchButton.label)}
            </button>
            <button class="secondary-btn save-title-btn detail-save-btn ${saved ? "active" : ""}" data-save-id="${title.id}" type="button" ${memberReady ? "" : "disabled aria-disabled=\"true\""}>${saved ? "Saved to Collection" : "Add to Collection"}</button>
            ${memberReady ? `<p class="hero-interest-helper detail-cta-helper">${escapeHtml(primaryWatchButton.helper)}</p>` : '<p class="hero-interest-helper detail-cta-helper">Members only can save, track interest, and update watch status.</p>'}
          </div>
        </div>
      </div>
    </section>

    <section class="detail-action-strip">
      <div class="detail-actions">
        ${reactionButtonsTemplate(title)}
        ${
          embeddedTrailerUrl
            ? `<button class="secondary-btn trailer-btn" type="button" data-open-trailer="true" data-embed-url="${embeddedTrailerUrl}" data-trailer-title="${escapeHtml(title.title)} trailer">Watch Trailer</button>`
            : `<a class="secondary-btn trailer-btn" href="${getTrailerLink(title)}" target="_blank" rel="noreferrer">Open Trailer</a>`
        }
        <button class="secondary-btn share-title-btn" data-share-id="${title.id}" type="button">Share Title</button>
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

    ${seasonsSectionTemplate(title)}

    ${peopleSectionTemplate(title)}

    ${similarSectionTemplate(title, getVisibleTitles(titlesCache), "genre")}
    ${similarSectionTemplate(title, getVisibleTitles(titlesCache), "language")}

    <section class="comment-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(commentSectionCopy.eyebrow)}</p>
          <h2>${escapeHtml(commentSectionCopy.title)}</h2>
        </div>
        <p class="section-copy">${escapeHtml(commentSectionCopy.helper)}</p>
      </div>

      ${
        isSignedIn()
          ? `
            <form class="suggest-form comment-form" id="commentForm">
              <div class="form-grid">
                <label class="check-option spoiler-check form-span">
                  <input name="spoiler" type="checkbox" />
                  <span>Mark this comment as spoiler</span>
                </label>
                <label class="input-group form-span">
                  <span>${escapeHtml(commentSectionCopy.fieldLabel)}</span>
                  <textarea name="comment" rows="4" placeholder="${escapeHtml(commentSectionCopy.placeholder)}"></textarea>
                </label>
              </div>
              <div class="form-actions">
                <button class="primary-btn" type="submit">${escapeHtml(commentSectionCopy.buttonLabel)}</button>
                <p class="form-message" id="commentMessage" aria-live="polite"></p>
              </div>
            </form>
          `
          : `
            <div class="member-lock-card">
              <p class="section-copy">Sign in to vote, post reviews, save collections, and mark titles as interested.</p>
              <button class="primary-btn" type="button" id="detailsCommentSignInBtn">Sign In to React</button>
            </div>
          `
      }

      <div class="comment-list">
        ${title.comments.length ? title.comments.map(commentTemplate).join("") : `<p class="empty-state">${escapeHtml(commentSectionCopy.emptyLabel)}</p>`}
      </div>
    </section>
  `;

    const detailActions = target.querySelector(".detail-actions");
    const detailHeroCard = target.querySelector(".detail-hero-card");

    detailActions?.addEventListener("click", async (event) => {
    const actionTarget = event.target instanceof HTMLElement ? event.target : null;

    if (!actionTarget) {
      return;
    }

    const reactionButton = actionTarget.closest(".reaction-btn");

    if (reactionButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!requireAccount("vote on movies and series")) {
        return;
      }
      showMessage("#detailVoteMessage", "Saving your vote...");

      try {
        const result = await reactToTitle(reactionButton.dataset.id, reactionButton.dataset.reaction);

        if (!result) {
          showMessage("#detailVoteMessage", "Could not save your vote right now.");
          return;
        }

        await renderDetailsPage();
        showMessage("#detailVoteMessage", result.cleared ? "Your vote was removed." : "Your vote was saved.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", getActionErrorMessage(error, "Could not save your vote right now."));
      }

      return;
    }

    const saveButton = actionTarget.closest(".save-title-btn");

    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!requireAccount("save titles to your collections")) {
        return;
      }
      try {
        await syncSavedTitle(saveButton.dataset.saveId);
        await renderDetailsPage();
        showMessage("#detailVoteMessage", isSavedTitle(saveButton.dataset.saveId) ? "Saved to your collection." : "Removed from your collection.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", getActionErrorMessage(error, "Could not update your collection right now."));
      }
      return;
    }

    const watchButton = actionTarget.closest(".watch-status-btn");

    if (watchButton) {
      event.preventDefault();
      event.stopPropagation();

      if (!requireAccount("track interested, watching, and watched titles")) {
        return;
      }

      try {
        await syncWatchStatus(watchButton.dataset.id, watchButton.dataset.watchStatus);
        await renderDetailsPage();
        showMessage("#detailVoteMessage", "Watch status updated.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", getActionErrorMessage(error, "Could not update watch status right now."));
      }
      return;
    }

    const seasonWatchButton = actionTarget.closest("[data-season-watch='true']");

    if (seasonWatchButton) {
      event.preventDefault();
      event.stopPropagation();

      if (!requireAccount("mark seasons as watched")) {
        return;
      }

      const seasonKey = getSeasonWatchKey(seasonWatchButton.dataset.id, seasonWatchButton.dataset.seasonNumber);
      const currentStatus = getTitleWatchStatus(seasonKey);
      await syncWatchStatus(seasonKey, currentStatus === "watched" ? "clear" : "watched");
      await renderDetailsPage();
      showMessage("#detailVoteMessage", currentStatus === "watched" ? "Season marked as unwatched." : "Season marked as watched.");
      return;
    }

    const shareButton = actionTarget.closest(".share-title-btn");

    if (shareButton) {
      event.preventDefault();
      event.stopPropagation();

      try {
        await shareTitle(title);
        showMessage("#detailVoteMessage", "Share link ready.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", "Could not share right now.");
      }
    }
    });

    detailHeroCard?.addEventListener("click", async (event) => {
    const actionTarget = event.target instanceof HTMLElement ? event.target : null;

    if (!actionTarget) {
      return;
    }

    const saveButton = actionTarget.closest(".save-title-btn");

    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!requireAccount("save titles to your collections")) {
        return;
      }
      try {
        await syncSavedTitle(saveButton.dataset.saveId);
        await renderDetailsPage();
        showMessage("#detailVoteMessage", isSavedTitle(saveButton.dataset.saveId) ? "Saved to your collection." : "Removed from your collection.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", getActionErrorMessage(error, "Could not update your collection right now."));
      }
      return;
    }

    const watchButton = actionTarget.closest(".watch-status-btn");

    if (watchButton) {
      event.preventDefault();
      event.stopPropagation();

      if (!requireAccount("track interested, watching, and watched titles")) {
        return;
      }

      try {
        await syncWatchStatus(watchButton.dataset.id, watchButton.dataset.watchStatus);
        await renderDetailsPage();
        showMessage("#detailVoteMessage", "Watch status updated.");
      } catch (error) {
        console.error(error);
        showMessage("#detailVoteMessage", getActionErrorMessage(error, "Could not update watch status right now."));
      }
    }
    });

    document.querySelector("#detailsCommentSignInBtn")?.addEventListener("click", () => {
      openAuthModal("login");
    });

    setupCommentForm(title.id);
    setupSeasonControls();
  } catch (error) {
    console.error(error);
    target.innerHTML = `
      <section class="not-found">
        <h1>Could not open this title right now</h1>
        <p class="section-copy">Please refresh the page once. If it still fails, re-upload the latest site files.</p>
      </section>
    `;
  }
}

function personHeroAvatarTemplate(person) {
  if (person.image) {
    return `<img class="person-hero-avatar" src="${person.image}" alt="${escapeHtml(person.name)}" />`;
  }

  return `<div class="person-hero-avatar person-avatar-fallback">${escapeHtml(person.name.charAt(0).toUpperCase())}</div>`;
}

function personFilmographyCardTemplate(entry) {
  const releaseLabel = formatReleaseDate(entry.title.releaseDate);
  return `
    <a class="person-film-card" href="${buildTitleUrl(entry.title.id)}">
      <img class="person-film-poster" src="${entry.title.image}" alt="${escapeHtml(entry.title.title)} poster" loading="lazy" decoding="async" />
      <div class="person-film-copy">
        <h3>${escapeHtml(entry.title.title)}</h3>
        <p>${escapeHtml(entry.title.type)} • ${escapeHtml(releaseLabel)}</p>
        <small>${escapeHtml(entry.roles.join(", "))}</small>
      </div>
    </a>
  `;
}

async function renderPersonPage() {
  const target = document.querySelector("#personPage");

  if (!target) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const personName = params.get("name")?.trim() || "";
  const personTmdbId = Number(params.get("tmdb") || 0);

  if (!personName) {
    target.innerHTML = `<section class="not-found"><h1>Person not found</h1></section>`;
    return;
  }

  const titles = await fetchTitles();
  const visibleTitles = getVisibleTitles(titles);
  const person = collectPersonCredits(personName, visibleTitles);

  if (!person.credits.length) {
    target.innerHTML = `<section class="not-found"><h1>Person not found</h1></section>`;
    return;
  }

  const recentCredits = person.credits.slice(0, 24);
  const topTitle = recentCredits[0]?.title;
  const firstRelease = recentCredits
    .map((entry) => Date.parse(entry.title.releaseDate || ""))
    .filter(Boolean)
    .sort((left, right) => left - right)[0];
  const earliestYear = firstRelease ? new Date(firstRelease).getFullYear() : "";
  let personDocData = null;

  if (personTmdbId) {
    try {
      const personDoc = await getDoc(doc(db, "moviemate_people", `tmdb-person-${personTmdbId}`));
      personDocData = personDoc.exists() ? personDoc.data() : null;
    } catch (error) {
      console.warn("Could not load person details", error);
    }
  }

  const bornLabel =
    personDocData?.birthday ||
    person.birthday ||
    (earliestYear ? `Not added • active before ${earliestYear}` : "Not added");
  const birthplaceLabel = personDocData?.birthplace || person.birthplace || "Not added";
  const biography =
    personDocData?.biography ||
    person.biography ||
    `${person.name} appears in ${person.credits.length} MovieMate title${person.credits.length === 1 ? "" : "s"}. Known here for ${person.roleHighlights.join(", ") || "cast and crew work"}, ${person.name} is featured across titles like ${escapeHtml(topTitle ? topTitle.title : "MovieMate")} and more. Explore the filmography below to see every title currently connected to this person on MovieMate.`;
  const knownForLabel =
    personDocData?.knownForDepartment ||
    person.knownForDepartment ||
    person.roleHighlights.join(", ") ||
    "Cast & Crew";

  target.innerHTML = `
    <section class="person-hero-card">
      <div class="person-hero">
        ${personHeroAvatarTemplate(person)}
        <div class="person-hero-copy">
          <h1>${escapeHtml(person.name)}</h1>
          <div class="person-meta-grid person-meta-grid-compact">
            <div class="person-meta-item">
              <span>Born</span>
              <strong>${escapeHtml(bornLabel)}</strong>
            </div>
            <div class="person-meta-item">
              <span>Birthplace</span>
              <strong>${escapeHtml(birthplaceLabel)}</strong>
            </div>
            <div class="person-meta-item">
              <span>Known for</span>
              <strong>${escapeHtml(knownForLabel)}</strong>
            </div>
            <div class="person-meta-item">
              <span>Titles on MovieMate</span>
              <strong>${person.credits.length} title${person.credits.length === 1 ? "" : "s"}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="person-biography-section">
      <div class="section-heading">
        <div>
          <h2>Biography</h2>
        </div>
      </div>
      <div class="person-biography-card">
        <p class="person-biography">${biography}</p>
      </div>
    </section>

    <section class="person-filmography-section">
      <div class="section-heading">
        <div>
          <h2>Filmography</h2>
        </div>
      </div>
      <div class="person-filmography-grid">
        ${recentCredits.map(personFilmographyCardTemplate).join("")}
      </div>
    </section>
  `;
}

function setupLikeButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".reaction-btn");

    if (!button || document.body.dataset.page === "details") {
      return;
    }

    if (!requireAccount("vote on movies and series")) {
      return;
    }

    try {
      const result = await reactToTitle(button.dataset.id, button.dataset.reaction);

      if (!result) {
        return;
      }

      if (document.body.dataset.page === "home") {
        await renderHomePage();
      } else {
        await renderDetailsPage();
        showMessage("#detailVoteMessage", result.cleared ? "Your vote was removed." : "Your vote was saved.");
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

    window.location.href = "/explore/";
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
      setupOwnerNotificationsRealtime();
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
    setupOwnerNotificationsRealtime();

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
    showMessage("#commentMessage", "Posting...");

    try {
      const added = await addComment(titleId, form);

      if (!added) {
        return;
      }
    } catch (error) {
      console.error(error);
      showMessage("#commentMessage", getCommentErrorMessage(error));
      return;
    }

    form.reset();

    try {
      await renderDetailsPage();
      const snapshot = await getDoc(doc(db, TITLES_COLLECTION, titleId));
      const refreshedTitle = snapshot.exists() ? normalizeTitle(snapshot) : null;
      const successLabel = refreshedTitle ? getCommentSectionCopy(refreshedTitle).successLabel : "Your comment is now live.";
      showMessage("#commentMessage", successLabel);
    } catch (error) {
      console.error(error);
      showMessage("#commentMessage", "Your post was saved. Refresh once if you do not see it yet.");
    }
  });
}

function setupSpoilerToggle() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-spoiler='true']");

    if (!button) {
      return;
    }

    const box = button.closest("[data-spoiler-box='true']");
    const text = box?.querySelector(".spoiler-text");

    if (!text) {
      return;
    }

    text.classList.toggle("hidden");
    button.textContent = text.classList.contains("hidden") ? "Reveal spoiler" : "Hide spoiler";
  });
}

function setupFilters() {
  ["#searchInput", "#typeFilter", "#genreFilter", "#languageFilter"].forEach((selector) => {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    const handler = () => {
      browseVisibleCount = SEARCH_PAGE_SIZE;
      refreshBrowseResults();
    };

    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

function setupLoadMore() {
  const button = document.querySelector("#loadMoreBtn");

  button?.addEventListener("click", () => {
    browseVisibleCount += SEARCH_PAGE_SIZE;
    refreshBrowseResults();
  });
}

function setupSeasonControls() {
  const seasonsSection = document.querySelector(".seasons-section");

  if (!seasonsSection) {
    return;
  }

  const grid = seasonsSection.querySelector(".seasons-grid");
  const buttons = seasonsSection.querySelectorAll(".season-nav-btn");

  if (!grid || buttons.length < 2) {
    return;
  }

  buttons[0].addEventListener("click", () => {
    grid.scrollBy({ left: -360, behavior: "smooth" });
  });

  buttons[1].addEventListener("click", () => {
    grid.scrollBy({ left: 360, behavior: "smooth" });
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
      if ((button.dataset.collectionTab === "mine" || button.dataset.collectionTab === "saved") && !isSignedIn()) {
        requireAccount("open personal collections");
        return;
      }

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

  document.addEventListener("click", (event) => {
    const suggestions = document.querySelector("#searchSuggestions");

    if (!suggestions || !(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target.closest("#searchInput") || event.target.closest("#searchSuggestions")) {
      return;
    }

    suggestions.classList.add("hidden");
  });
}

function profileAvatarTemplate(profile = currentUserProfile, user = currentUser, className = "profile-avatar") {
  const avatar = getProfileAvatar(profile, user);

  if (avatar.image) {
    return `<img class="${className}" src="${escapeHtml(avatar.image)}" alt="${escapeHtml(getProfileDisplayName(profile, user))} avatar" />`;
  }

  return `<div class="${className} profile-avatar-fallback">${escapeHtml(avatar.initials || "MM")}</div>`;
}

function getProfileReviewEntries(titles) {
  const reactionMap = getStoredReactions();
  const uid = currentUser?.uid || "";
  const entries = titles
    .map((title) => {
      const reaction = reactionMap[title.id] || "";
      const comments = (title.comments || []).filter((comment) => comment.userId && comment.userId === uid);

      if (!reaction && !comments.length) {
        return null;
      }

      return {
        title,
        reaction,
        comments
      };
    })
    .filter(Boolean);

  return entries.sort((left, right) => getInterestScore(right.title) - getInterestScore(left.title));
}

function getProfilePosts(titles) {
  const uid = currentUser?.uid || "";
  return titles
    .filter((title) => title.submittedBy && title.submittedBy === uid)
    .sort((left, right) => getCreatedAtMs(right.createdAt) - getCreatedAtMs(left.createdAt));
}

function profileReviewCardTemplate(entry) {
  const stats = getReactionStats(entry.title);
  const reactionLabel = entry.reaction ? REACTION_OPTIONS[entry.reaction]?.label || entry.reaction : "";
  const firstComment = entry.comments[0]?.text || "";
  const reviewCount = entry.comments.length;
  const recommendCount = Number(entry.title.likes || 0);

  return `
    <article class="profile-review-card">
      <a class="profile-review-poster-link" href="${buildTitleUrl(entry.title.id)}">
        <img class="profile-review-poster" src="${entry.title.image}" alt="${escapeHtml(entry.title.title)} poster" loading="lazy" decoding="async" />
      </a>
      <div class="profile-review-copy">
        <div class="profile-review-head">
          <div>
            <h3>${escapeHtml(entry.title.title)}</h3>
            <p>${escapeHtml(entry.title.type)} • ${escapeHtml(formatReleaseDate(entry.title.releaseDate))}</p>
          </div>
          <div class="profile-review-head-actions">
            ${reactionLabel ? `<span class="profile-reaction-badge">${escapeHtml(reactionLabel)}</span>` : ""}
            <div class="profile-card-menu-wrap">
              <button class="profile-card-menu" type="button" aria-label="More options" data-profile-menu-toggle="true">•••</button>
              <div class="profile-card-dropdown hidden" data-profile-menu="true">
                <button class="profile-card-dropdown-item" type="button" data-profile-share="story" data-title-id="${entry.title.id}">Share - Story</button>
                <button class="profile-card-dropdown-item" type="button" data-profile-share="classic" data-title-id="${entry.title.id}">Share - Classic</button>
                <button class="profile-card-dropdown-item" type="button" data-profile-report="${entry.title.id}">Report</button>
              </div>
            </div>
          </div>
        </div>
        <p class="profile-review-meta">${escapeHtml(entry.title.genre)} • ${escapeHtml(entry.title.language.join(", "))}</p>
        ${firstComment ? `<p class="profile-review-text">${escapeHtml(firstComment)}</p>` : `<p class="profile-review-text">${stats.recommendedPercent}% recommend on MovieMate.</p>`}
        <div class="profile-inline-actions">
          <div class="profile-inline-stats">
            <span>♡ ${recommendCount}</span>
            <span>◌ ${reviewCount}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function profilePostCardTemplate(title) {
  return `
    <article class="profile-post-card">
      <img class="profile-post-cover" src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <div class="profile-post-copy">
        <h3>${escapeHtml(title.title)}</h3>
        <p>${escapeHtml(title.type)} • ${escapeHtml(title.genre)}</p>
        <p>${escapeHtml(title.approved ? "Live on MovieMate" : "Waiting for owner approval")}</p>
      </div>
      <a class="ghost-link" href="${buildTitleUrl(title.id)}">View</a>
    </article>
  `;
}

function buildInterestedTitles(titles) {
  const watchStatus = getWatchStatusMap();
  const savedIds = new Set(getSavedTitles());
  return titles
    .filter(
      (title) =>
        savedIds.has(title.id) ||
        normalizeWatchStatusValue(watchStatus[title.id]) === "interested"
    )
    .sort((left, right) => getInterestScore(right) - getInterestScore(left))
    .slice(0, 6);
}

function interestedTitleTemplate(title) {
  return `
    <a class="profile-interest-item" href="${buildTitleUrl(title.id)}">
      <img src="${title.image}" alt="${escapeHtml(title.title)} poster" loading="lazy" decoding="async" />
      <span class="profile-interest-copy">
        <strong>${escapeHtml(title.title)}</strong>
        <small>${escapeHtml(formatReleaseDate(title.releaseDate))}</small>
        <small>${escapeHtml(title.status === "Upcoming" ? "In Theatre" : title.type)}</small>
      </span>
    </a>
  `;
}

async function saveProfileAvatar(avatarUrl) {
  if (!currentUserProfile) {
    return;
  }

  await persistUserProfile({
    avatarUrl: String(avatarUrl || "").trim()
  });

  updateAuthUI();
  if (document.body.dataset.page === "profile") {
    renderProfilePage();
  }
  if (document.body.dataset.page === "account") {
    renderAccountPage();
  }
}

function setupProfileAvatarQuickActions() {
  const uploadTrigger = document.querySelector("#profileAvatarUploadTrigger");
  const uploadInput = document.querySelector("#profileAvatarUploadInput");
  const generateButton = document.querySelector("#profileAvatarGenerateBtn");

  uploadTrigger?.addEventListener("click", () => {
    uploadInput?.click();
  });

  uploadInput?.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await saveProfileAvatar(dataUrl);
    } catch (error) {
      console.error(error);
      alert("Could not upload that image.");
    }
  });

  generateButton?.addEventListener("click", async () => {
    try {
      const generatedAvatar = createGeneratedAvatarDataUrl(getProfileDisplayName());
      await saveProfileAvatar(generatedAvatar);
    } catch (error) {
      console.error(error);
      alert("Could not create avatar right now.");
    }
  });
}

function renderProfilePage() {
  const target = document.querySelector("#profilePage");

  if (!target) {
    return;
  }

  if (!isSignedIn() || !currentUserProfile) {
    target.innerHTML = `
      <section class="account-empty-state">
        <p class="eyebrow">MovieMate account</p>
        <h1>Sign in to see your profile.</h1>
        <p class="section-copy">Your reviews, saved collections, watch states, and profile details will appear here after you sign in.</p>
        <button class="primary-btn" type="button" id="profileSignInBtn">Sign In</button>
      </section>
    `;
    document.querySelector("#profileSignInBtn")?.addEventListener("click", () => openAuthModal("login"));
    return;
  }

  const visibleTitles = getVisibleTitles(titlesCache);
  const reviewEntries = getProfileReviewEntries(visibleTitles);
  const submittedTitles = getProfilePosts(titlesCache);
  const personalCollections = buildPersonalCollections(visibleTitles);
  const interestedTitles = buildInterestedTitles(visibleTitles);
  const watchStatus = getWatchStatusMap();
  const stats = {
    reviews: reviewEntries.length,
    posts: submittedTitles.length,
    collections: personalCollections.length,
    saved: getSavedTitles().length,
    interested: Object.values(watchStatus).filter((value) => normalizeWatchStatusValue(value) === "interested").length
  };
  const followersCount = Array.isArray(currentUserProfile.followers) ? currentUserProfile.followers.length : 0;
  const followingCount = Array.isArray(currentUserProfile.following) ? currentUserProfile.following.length : 0;

  target.innerHTML = `
    <section class="profile-page-shell">
      <aside class="profile-side-card">
        <div class="profile-avatar-wrap">
          ${profileAvatarTemplate(currentUserProfile, currentUser, "profile-avatar")}
        </div>
        <h1 class="profile-name">${escapeHtml(getProfileDisplayName())}</h1>
        <p class="profile-handle">@${escapeHtml(getProfileUsername())}</p>
        <div class="profile-stat-row">
          <article><strong>${stats.reviews}</strong><span>Reviews<br />Posted</span></article>
          <article><strong>${stats.posts}</strong><span>Posts<br />Created</span></article>
          <article><strong>${stats.collections}</strong><span>Public<br />Collections</span></article>
        </div>
        <p class="profile-bio">${escapeHtml(currentUserProfile.bio || "Add a short bio in settings to personalize your MovieMate profile.")}</p>
        <div class="profile-mini-stats">
          <span>👥 ${followersCount} Followers</span>
          <span>• ${followingCount} Following</span>
        </div>
        <div class="profile-card-actions">
          <a class="primary-btn profile-follow-btn" href="/account.html">Edit Profile</a>
        </div>
      </aside>

      <section class="profile-main-panel">
        <div class="profile-tabs">
          <button class="profile-tab active" data-profile-tab="reviews" type="button">✎ Reviews</button>
          <button class="profile-tab" data-profile-tab="posts" type="button">◌ Posts</button>
          <button class="profile-tab" data-profile-tab="collections" type="button">☰ Collections</button>
        </div>

        <div class="profile-panel-body active" data-profile-panel="reviews">
          <div class="profile-filter-row">
            <div class="profile-filter-group">
              <button class="profile-filter-pill active" data-profile-filter="all" type="button">All</button>
              <button class="profile-filter-pill" data-profile-filter="skip" type="button">Skip</button>
              <button class="profile-filter-pill" data-profile-filter="timepass" type="button">Timepass</button>
              <button class="profile-filter-pill" data-profile-filter="goForIt" type="button">Go For It</button>
              <button class="profile-filter-pill" data-profile-filter="perfect" type="button">Perfection</button>
            </div>
            <div class="profile-view-switcher">
              <a class="icon-chip compact" href="/my-reviews.html" aria-label="Open calendar view">☷</a>
              <button class="icon-chip compact" type="button" aria-label="Grid view" data-profile-grid-toggle="true">◫</button>
              <button class="icon-chip compact" type="button" aria-label="Search profile" data-profile-search-toggle="true">⌕</button>
            </div>
          </div>
          <div class="profile-review-search hidden" id="profileReviewSearchWrap">
            <label class="input-group">
              <span>Search reviews</span>
              <input id="profileReviewSearchInput" type="text" placeholder="Search by title" />
            </label>
          </div>
          <div class="profile-review-list" id="profileReviewList">
            ${
              reviewEntries.length
                ? reviewEntries.map(profileReviewCardTemplate).join("")
                : '<p class="empty-state">Vote on titles or leave comments to build your review profile.</p>'
            }
          </div>
        </div>

        <div class="profile-panel-body hidden" data-profile-panel="posts">
          <div class="profile-post-list">
            ${
              submittedTitles.length
                ? submittedTitles.map(profilePostCardTemplate).join("")
                : '<p class="empty-state">Titles you add or save will start shaping this area over time.</p>'
            }
          </div>
        </div>

        <div class="profile-panel-body hidden" data-profile-panel="collections">
          <div class="collection-grid profile-collection-grid">
            ${
              personalCollections.length
                ? personalCollections.map(collectionCardTemplate).join("")
                : '<p class="empty-state">Save titles, react, and use watch actions to generate your personal collections.</p>'
            }
          </div>
        </div>
      </section>

      <aside class="profile-interest-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">Interested In</p>
            <h2>Watch next</h2>
          </div>
        </div>
        <div class="profile-interest-list">
          ${
            interestedTitles.length
              ? interestedTitles.map(interestedTitleTemplate).join("")
              : '<p class="empty-state">Use Interested or Save to Collections to build this list.</p>'
          }
        </div>
      </aside>
    </section>
  `;

  setupProfileTabs(reviewEntries);
  setupProfileAvatarQuickActions();
}

function renderAccountPage() {
  const target = document.querySelector("#accountPage");

  if (!target) {
    return;
  }

  if (!isSignedIn() || !currentUserProfile) {
    target.innerHTML = `
      <section class="account-empty-state">
        <p class="eyebrow">Account settings</p>
        <h1>Sign in to edit your profile.</h1>
        <p class="section-copy">Your username, bio, socials, and personal MovieMate settings live here.</p>
        <button class="primary-btn" type="button" id="accountSignInBtn">Sign In</button>
      </section>
    `;
    document.querySelector("#accountSignInBtn")?.addEventListener("click", () => openAuthModal("login"));
    return;
  }

  const reviewEntries = getProfileReviewEntries(getVisibleTitles(titlesCache));
  const submittedTitles = getProfilePosts(titlesCache);
  const personalCollections = buildPersonalCollections(getVisibleTitles(titlesCache));
  const activeStrikes = 0;
  const emailVerified = Boolean(currentUser?.emailVerified);
  const healthFaq = [
    {
      question: "What is Profile Health?",
      answer:
        "Profile Health helps you understand whether your MovieMate account is in good standing. Right now it tracks strikes and email verification."
    },
    {
      question: "What types of content can result in a strike?",
      answer:
        "Spam, abusive comments, repeated fake suggestions, and harmful content can all lead to moderation action from the owner."
    },
    {
      question: "How does the strike system work?",
      answer:
        "If content breaks community rules, the owner can review it and mark a strike on the account. Accounts with no issues stay in good standing."
    },
    {
      question: "What happens when I receive my first strike?",
      answer:
        "You will still keep your account, but your profile health will no longer be perfect and future moderation may affect posting privileges."
    },
    {
      question: "Are strikes permanent?",
      answer:
        "For now, strikes remain on the account until the owner clears them. MovieMate currently starts everyone with zero active strikes."
    }
  ];

  target.innerHTML = `
    <section class="account-page-shell">
      <aside class="account-settings-nav">
        <div class="account-settings-card">
          <h2>Settings</h2>
          <a href="#edit-profile" class="account-settings-link active">Edit profile</a>
          <a href="#profile-health" class="account-settings-link">Profile Health</a>
          <button class="account-settings-link account-settings-button" type="button" id="resetPasswordBtn">Change password</button>
          <div class="account-settings-divider"></div>
          <a href="contact.html" class="account-settings-link">Give Feedback</a>
          <a href="privacy.html" class="account-settings-link">Privacy Policy</a>
          <a href="about.html" class="account-settings-link">About MovieMate</a>
        </div>
      </aside>

      <section class="account-settings-main">
        <article class="account-settings-card" id="edit-profile">
          <div class="account-form-head">
            <div class="account-avatar-stack">
              <div class="account-avatar-preview" id="accountAvatarPreview">
                ${profileAvatarTemplate(currentUserProfile, currentUser, "account-avatar")}
              </div>
              <div class="account-avatar-actions">
                <button class="secondary-btn" type="button" id="avatarUploadTrigger">Upload from device</button>
                <button class="ghost-link" type="button" id="avatarGenerateBtn">Create avatar</button>
                <input class="hidden" id="avatarUploadInput" type="file" accept="image/*" />
              </div>
            </div>
            <div>
              <p class="eyebrow">Edit Profile</p>
              <h1>Make your MovieMate profile yours</h1>
              <p class="section-copy">Update the visible details users will see across your collections, reviews, and saved titles.</p>
            </div>
          </div>
          <form class="account-form" id="profileSettingsForm">
            <label class="input-group">
              <span>Display name</span>
              <input name="displayName" type="text" value="${escapeHtml(getProfileDisplayName())}" />
            </label>
            <label class="input-group">
              <span>Username</span>
              <input name="username" type="text" value="${escapeHtml(getProfileUsername())}" />
            </label>
            <label class="input-group">
              <span>First name</span>
              <input name="firstName" type="text" value="${escapeHtml(currentUserProfile.firstName || "")}" />
            </label>
            <label class="input-group">
              <span>Last name</span>
              <input name="lastName" type="text" value="${escapeHtml(currentUserProfile.lastName || "")}" />
            </label>
            <label class="input-group">
              <span>Date of birth</span>
              <input name="birthDate" type="date" value="${escapeHtml(currentUserProfile.birthDate || "")}" />
            </label>
            <label class="input-group form-span">
              <span>Profile photo URL</span>
              <input name="avatarUrl" type="url" id="avatarUrlField" placeholder="https://..." value="${escapeHtml(currentUserProfile.avatarUrl || "")}" />
              <small class="input-help">You can paste an image link, upload from your device, or create a generated avatar.</small>
            </label>
            <label class="input-group form-span">
              <span>Bio</span>
              <textarea name="bio" rows="4" placeholder="Tell MovieMate visitors about your taste">${escapeHtml(currentUserProfile.bio || "")}</textarea>
            </label>
            <label class="input-group">
              <span>Instagram</span>
              <input name="instagram" type="text" placeholder="@username or profile link" value="${escapeHtml(currentUserProfile.instagram || "")}" />
            </label>
            <label class="input-group">
              <span>Whatsapp</span>
              <input name="whatsapp" type="text" placeholder="+91..." value="${escapeHtml(currentUserProfile.whatsapp || "")}" />
            </label>
            <div class="form-actions form-span">
              <button class="primary-btn" type="submit">Save Profile</button>
              <p class="form-message" id="profileSettingsMessage" aria-live="polite"></p>
            </div>
          </form>
        </article>

        <article class="account-settings-card" id="profile-health">
          <p class="eyebrow">Profile Health</p>
          <h2>Your account at a glance</h2>
          <div class="health-status-strip">
            <span class="health-status-dot good ${activeStrikes === 0 ? "active" : ""}">❤</span>
            <span class="health-status-dot ${emailVerified ? "active" : ""}">✉</span>
            <span class="health-status-dot ${reviewEntries.length > 0 ? "active" : ""}">★</span>
          </div>
          <div class="health-banner ${activeStrikes === 0 ? "good" : "warn"}">
            ${
              activeStrikes === 0
                ? "Your account is in good standing with no active strikes."
                : `You currently have ${activeStrikes} active strike${activeStrikes === 1 ? "" : "s"}.`
            }
          </div>
          <div class="account-health-grid">
            <div class="account-health-item"><strong>${reviewEntries.length}</strong><span>Reviews captured</span></div>
            <div class="account-health-item"><strong>${submittedTitles.length}</strong><span>Titles added</span></div>
            <div class="account-health-item"><strong>${personalCollections.length}</strong><span>Collections built</span></div>
            <div class="account-health-item"><strong>${getSavedTitles().length}</strong><span>Titles saved</span></div>
          </div>
          <div class="health-card">
            <h3>Verification</h3>
            <p>${emailVerified ? "Your email is verified." : "Your email is not verified yet. Verification helps secure your account and makes password recovery safer."}</p>
            ${!emailVerified && currentUser?.email ? `<p class="health-help-copy">Current email: ${escapeHtml(currentUser.email)}</p>` : ""}
            ${
              emailVerified
                ? '<span class="profile-reaction-badge">Verified</span>'
                : '<button class="primary-btn health-action-btn" id="resendVerificationBtn" type="button">Send verification email</button>'
            }
          </div>
          <div class="health-card">
            <h3>Active Strikes (${activeStrikes})</h3>
            <p>${activeStrikes === 0 ? "No active strikes." : "Review your recent activity and contact MovieMate if you think this is a mistake."}</p>
          </div>
          <div class="health-faq">
            <h3>Frequently Asked Questions</h3>
            <div class="health-faq-list">
              ${healthFaq
                .map(
                  (item, index) => `
                    <article class="health-faq-item">
                      <button class="health-faq-btn" type="button" data-health-faq>
                        <span class="health-faq-number">${index + 1}</span>
                        <span>${escapeHtml(item.question)}</span>
                        <strong>+</strong>
                      </button>
                      <div class="health-faq-answer hidden">
                        <p>${escapeHtml(item.answer)}</p>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </article>
      </section>
    </section>
  `;

  setupAccountSettingsForm();
}

function setupProfileTabs(reviewEntries) {
  const rerenderReviewList = () => {
    const activeFilter =
      document.querySelector(".profile-filter-pill.active")?.dataset.profileFilter || "all";
    const query = document.querySelector("#profileReviewSearchInput")?.value?.trim().toLowerCase() || "";
    const list = document.querySelector("#profileReviewList");

    if (!list) {
      return;
    }

    let filtered = activeFilter === "all" ? reviewEntries : reviewEntries.filter((entry) => entry.reaction === activeFilter);

    if (query) {
      filtered = filtered.filter((entry) => entry.title.title.toLowerCase().includes(query));
    }

    list.innerHTML = filtered.length
      ? filtered.map(profileReviewCardTemplate).join("")
      : '<p class="empty-state">No reviews yet for this filter.</p>';
  };

  document.querySelectorAll(".profile-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.profileTab;
      document.querySelectorAll(".profile-tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll("[data-profile-panel]").forEach((panel) => panel.classList.add("hidden"));
      button.classList.add("active");
      document.querySelector(`[data-profile-panel='${tab}']`)?.classList.remove("hidden");
    });
  });

  document.querySelectorAll(".profile-filter-pill").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.profileFilter;
      const list = document.querySelector("#profileReviewList");

      if (!list) {
        return;
      }

      document.querySelectorAll(".profile-filter-pill").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      rerenderReviewList();
    });
  });

  document.querySelector("[data-profile-grid-toggle='true']")?.addEventListener("click", () => {
    document.querySelector("#profileReviewList")?.classList.toggle("profile-review-list-grid");
  });

  document.querySelector("[data-profile-search-toggle='true']")?.addEventListener("click", () => {
    document.querySelector("#profileReviewSearchWrap")?.classList.toggle("hidden");
    document.querySelector("#profileReviewSearchInput")?.focus();
  });

  document.querySelector("#profileReviewSearchInput")?.addEventListener("input", () => {
    rerenderReviewList();
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (!target) {
      return;
    }

    const toggle = target.closest("[data-profile-menu-toggle='true']");

    if (toggle) {
      const wrap = toggle.closest(".profile-card-menu-wrap");
      const menu = wrap?.querySelector("[data-profile-menu='true']");
      document.querySelectorAll("[data-profile-menu='true']").forEach((item) => {
        if (item !== menu) {
          item.classList.add("hidden");
        }
      });
      menu?.classList.toggle("hidden");
      return;
    }

    const shareButton = target.closest("[data-profile-share]");

    if (shareButton) {
      const titleId = shareButton.getAttribute("data-title-id") || "";
      const title = titlesCache.find((item) => item.id === titleId);

      if (title) {
        try {
          await shareTitle(title);
        } catch (error) {
          console.error(error);
        }
      }

      shareButton.closest("[data-profile-menu='true']")?.classList.add("hidden");
      return;
    }

    const reportButton = target.closest("[data-profile-report]");

    if (reportButton) {
      window.alert("Report tools can be added next.");
      reportButton.closest("[data-profile-menu='true']")?.classList.add("hidden");
      return;
    }

    if (!target.closest(".profile-card-menu-wrap")) {
      document.querySelectorAll("[data-profile-menu='true']").forEach((item) => item.classList.add("hidden"));
    }
  });
}

function setupAccountSettingsForm() {
  const form = document.querySelector("#profileSettingsForm");
  const resetPasswordButton = document.querySelector("#resetPasswordBtn");
  const resendVerificationButton = document.querySelector("#resendVerificationBtn");
  const avatarUploadTrigger = document.querySelector("#avatarUploadTrigger");
  const avatarUploadInput = document.querySelector("#avatarUploadInput");
  const avatarGenerateButton = document.querySelector("#avatarGenerateBtn");
  const avatarUrlField = document.querySelector("#avatarUrlField");

  avatarUploadTrigger?.addEventListener("click", () => {
    avatarUploadInput?.click();
  });

  avatarUploadInput?.addEventListener("change", async () => {
    const file = avatarUploadInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("#profileSettingsMessage", "Please choose an image file.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      if (avatarUrlField instanceof HTMLInputElement) {
        avatarUrlField.value = dataUrl;
      }

      updateAccountAvatarPreview(dataUrl);
      showMessage("#profileSettingsMessage", "Profile photo selected. Save profile to keep it.");
    } catch (error) {
      console.error(error);
      showMessage("#profileSettingsMessage", "Could not load that image.");
    }
  });

  avatarGenerateButton?.addEventListener("click", () => {
    const displayName =
      (form?.querySelector("[name='displayName']") instanceof HTMLInputElement
        ? form.querySelector("[name='displayName']").value
        : "") ||
      getProfileDisplayName();
    const generatedAvatar = createGeneratedAvatarDataUrl(displayName);

    if (avatarUrlField instanceof HTMLInputElement) {
      avatarUrlField.value = generatedAvatar;
    }

    updateAccountAvatarPreview(generatedAvatar);
    showMessage("#profileSettingsMessage", "Generated avatar ready. Save profile to keep it.");
  });

  avatarUrlField?.addEventListener("input", () => {
    if (avatarUrlField instanceof HTMLInputElement) {
      updateAccountAvatarPreview(avatarUrlField.value);
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUserProfile) {
      return;
    }

    const formData = new FormData(form);
    const displayName = formData.get("displayName")?.toString().trim() || "";
    const firstName = formData.get("firstName")?.toString().trim() || "";
    const lastName = formData.get("lastName")?.toString().trim() || "";
    const fallbackDisplay = [firstName, lastName].filter(Boolean).join(" ").trim();

    await persistUserProfile({
      displayName: displayName || fallbackDisplay || getProfileDisplayName(),
      username: slugify(formData.get("username")?.toString().trim() || buildDefaultUsername()),
      firstName,
      lastName,
      birthDate: formData.get("birthDate")?.toString().trim() || "",
      avatarUrl: formData.get("avatarUrl")?.toString().trim() || "",
      bio: formData.get("bio")?.toString().trim() || "",
      instagram: formData.get("instagram")?.toString().trim() || "",
      whatsapp: formData.get("whatsapp")?.toString().trim() || ""
    });

    showMessage("#profileSettingsMessage", "Profile updated successfully.");
    updateAuthUI();
  });

  resetPasswordButton?.addEventListener("click", async () => {
    if (!currentUser?.email) {
      return;
    }

    try {
      await sendPasswordResetEmail(auth, currentUser.email, buildAuthActionSettings());
      showMessage("#profileSettingsMessage", "Password reset email sent. Check spam and promotions too.");
    } catch (error) {
      console.error(error);
      showMessage("#profileSettingsMessage", "Could not send reset email. Check Firebase Email/Password and authorized domains.");
    }
  });

  resendVerificationButton?.addEventListener("click", async () => {
    if (!currentUser) {
      return;
    }

    try {
      await sendEmailVerification(currentUser, buildAuthActionSettings());
      showMessage("#profileSettingsMessage", "Verification email sent. Check inbox, spam, and promotions.");
    } catch (error) {
      console.error(error);
      showMessage("#profileSettingsMessage", "Could not send verification email right now.");
    }
  });

  document.querySelectorAll("[data-health-faq]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".health-faq-item");
      const answer = item?.querySelector(".health-faq-answer");
      const icon = button.querySelector("strong");

      answer?.classList.toggle("hidden");

      if (icon) {
        icon.textContent = answer?.classList.contains("hidden") ? "+" : "−";
      }
    });
  });
}

async function refreshCurrentPage() {
  if (document.body.dataset.page === "home") {
    await renderHomePage();
    return;
  }

  if (document.body.dataset.page === "details") {
    await fetchTitles();
    await renderDetailsPage();
    updateOwnerToggle();
    return;
  }

  if (document.body.dataset.page === "profile") {
    await fetchTitles();
    await renderProfilePage();
    return;
  }

  if (document.body.dataset.page === "account") {
    await fetchTitles();
    await renderAccountPage();
    return;
  }

  if (document.body.dataset.page === "reviews") {
    await fetchTitles();
    await renderReviewsPage();
    return;
  }

  if (document.body.dataset.page === "collection") {
    await fetchTitles();
    await renderCollectionPage();
    return;
  }

  if (document.body.dataset.page === "person") {
    await fetchTitles();
    await renderPersonPage();
  }
}

async function trackTitleView(titleId) {
  const viewKey = `moviemate_viewed_${titleId}`;

  if (sessionStorage.getItem(viewKey)) {
    return;
  }

  sessionStorage.setItem(viewKey, "true");

  try {
    await updateDoc(doc(db, TITLES_COLLECTION, titleId), {
      viewsCount: increment(1)
    });
  } catch (error) {
    console.error(error);
  }
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

    if (!button || document.body.dataset.page === "details") {
      return;
    }

    if (!requireAccount("save titles to your collections")) {
      return;
    }

    await syncSavedTitle(button.dataset.saveId);

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
    if (!requireAccount("suggest movies and series")) {
      return;
    }
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
  pendingNotificationState.unsubscribe = null;

  if (!isOwnerMode()) {
    updateOwnerToggle();
    return;
  }

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
      renderOwnerAnalytics(visibleTitles);
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
  let hasHandledInitialAuthState = false;
  hydrateStartupCaches();
  setupLikeButtons();
  setupSaveButtons();
  setupDeleteButtons();
  setupCommentDeleteButtons();
  setupOwnerActionButtons();
  setupOwnerMode();
  setupOwnerEditForm();
  setupHomepageEditor();
  setupTrailerModal();
  setupAuthModal();
  setupSpoilerToggle();

  if (document.body.dataset.page === "home") {
    setupFilters();
    setupLoadMore();
    setupScheduleControls();
    setupCollectionTabs();
    setupInterestWindow();
    setupTopSearch();
    setupUserNotificationsModal();
    setupScrollControls();
    setupSuggestForm();
    await renderHomePage();
    refreshHomePageInBackground();
  }

  if (document.body.dataset.page === "details") {
    await fetchTitles();
    await renderDetailsPage();
    updateOwnerToggle();
  }

  if (document.body.dataset.page === "profile") {
    await fetchTitles();
    renderProfilePage();
  }

  if (document.body.dataset.page === "account") {
    await fetchTitles();
    renderAccountPage();
  }

  if (document.body.dataset.page === "reviews") {
    await fetchTitles();
    renderReviewsPage();
  }

  if (document.body.dataset.page === "collection") {
    await fetchTitles();
    renderCollectionPage();
  }

  if (document.body.dataset.page === "person") {
    await fetchTitles();
    await renderPersonPage();
  }

  onAuthStateChanged(auth, async (user) => {
    const previousUid = currentUser?.uid || null;
    const nextUid = user?.uid || null;
    currentUser = user;
    if (user) {
      await ensureUserProfile(user);
    } else {
      currentUserProfile = null;
    }

    updateAuthUI();

    if (!hasHandledInitialAuthState) {
      hasHandledInitialAuthState = true;
      if (previousUid === nextUid) {
        return;
      }
    }

    if (previousUid === nextUid) {
      return;
    }

    await refreshCurrentPage();
  });

  updateAuthUI();
  setupOwnerNotificationsRealtime();
}

init().catch((error) => {
  console.error(error);
  showMessage("#formMessage", "Could not load MovieMate right now.");
  showMessage("#commentMessage", "Could not load comments right now.");
});
