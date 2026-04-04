const STORAGE_KEY = "moviemate-movies";
const BASE_MOVIES = [
  {
    id: "moonlight-echo",
    title: "Moonlight Echo",
    genre: "Drama",
    description:
      "A grieving radio host forms an unexpected bond with a late-night caller whose secrets reshape both of their lives.",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 4, 5, 4]
  },
  {
    id: "neon-run",
    title: "Neon Run",
    genre: "Action",
    description:
      "An ex-getaway driver returns to the city underworld for one final rescue mission racing against sunrise.",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    ratings: [4, 5, 4, 4, 5]
  },
  {
    id: "orbit-of-us",
    title: "Orbit of Us",
    genre: "Sci-Fi",
    description:
      "Two astronauts stranded near Jupiter unravel a memory-altering signal that may rewrite humanity's future.",
    image:
      "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 5, 4]
  },
  {
    id: "the-last-laugh-club",
    title: "The Last Laugh Club",
    genre: "Comedy",
    description:
      "A washed-up comic and a fearless newcomer team up for a comeback tour full of chaos, healing, and very bad motels.",
    image:
      "https://images.unsplash.com/photo-1518932945647-7a1c969f8be2?auto=format&fit=crop&w=900&q=80",
    ratings: [4, 3, 4, 5]
  },
  {
    id: "winter-house",
    title: "Winter House",
    genre: "Thriller",
    description:
      "A family retreat in the mountains turns sinister when every room begins revealing a different version of the truth.",
    image:
      "https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&w=900&q=80",
    ratings: [3, 4, 4]
  },
  {
    id: "wildflower-summer",
    title: "Wildflower Summer",
    genre: "Romance",
    description:
      "A documentary filmmaker revisits her hometown and rediscovers first love while capturing its final harvest festival.",
    image:
      "https://images.unsplash.com/photo-1518131678677-a16a0df1f0cb?auto=format&fit=crop&w=900&q=80",
    ratings: [5, 4, 4, 5, 5]
  }
];

function loadMovies() {
  const existing = localStorage.getItem(STORAGE_KEY);

  if (existing) {
    try {
      return JSON.parse(existing);
    } catch (error) {
      console.error("Failed to parse saved movies", error);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(BASE_MOVIES));
  return [...BASE_MOVIES];
}

function saveMovies(movies) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
}

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

function createStarMarkup(movieId, ratings) {
  const rounded = Math.round(averageRating(ratings));

  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const activeClass = value <= rounded ? "active" : "";

    return `
      <button class="star-btn ${activeClass}" type="button" data-rate="${value}" data-id="${movieId}" aria-label="Rate ${value} star${value > 1 ? "s" : ""}">
        ★
      </button>
    `;
  }).join("");
}

function movieCardTemplate(movie) {
  return `
    <article class="movie-card">
      <img class="movie-poster" src="${movie.image}" alt="${movie.title} poster" />
      <div class="movie-content">
        <div class="movie-header">
          <div>
            <h3>${movie.title}</h3>
            <p class="movie-meta">${movie.genre}</p>
          </div>
          <span class="rating-pill"><strong>${formatRating(movie.ratings)}</strong> / 5</span>
        </div>
        <p class="movie-description">${movie.description}</p>
        <div class="rating-row">
          <span class="movie-meta">Rate this movie:</span>
          <div class="stars" data-stars-for="${movie.id}">
            ${createStarMarkup(movie.id, movie.ratings)}
          </div>
        </div>
        <div class="movie-actions">
          <a class="details-link" href="details.html?id=${movie.id}">View Details</a>
          <span class="movie-meta">${movie.ratings.length} vote${movie.ratings.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </article>
  `;
}

function featuredCardTemplate(movie) {
  return `
    <a class="featured-card" href="details.html?id=${movie.id}">
      <img class="featured-poster" src="${movie.image}" alt="${movie.title} poster" />
      <div class="featured-copy">
        <h3>${movie.title}</h3>
        <div class="movie-actions">
          <span class="genre-pill">${movie.genre}</span>
          <span class="rating-pill"><strong>${formatRating(movie.ratings)}</strong> / 5</span>
        </div>
      </div>
    </a>
  `;
}

function populateGenres(movies, selectedGenre = "all") {
  const select = document.querySelector("#genreFilter");

  if (!select) {
    return;
  }

  const genres = [...new Set(movies.map((movie) => movie.genre))].sort();
  select.innerHTML = `<option value="all">All genres</option>${genres
    .map((genre) => `<option value="${genre}">${genre}</option>`)
    .join("")}`;
  select.value = genres.includes(selectedGenre) ? selectedGenre : "all";
}

function renderFeaturedMovies(movies) {
  const container = document.querySelector("#featuredMovies");

  if (!container) {
    return;
  }

  const featured = [...movies]
    .sort((a, b) => averageRating(b.ratings) - averageRating(a.ratings))
    .slice(0, 4);

  container.innerHTML = featured.map(featuredCardTemplate).join("");
}

function renderMovieGrid(movies) {
  const grid = document.querySelector("#movieGrid");
  const emptyState = document.querySelector("#emptyState");

  if (!grid || !emptyState) {
    return;
  }

  grid.innerHTML = movies.map(movieCardTemplate).join("");
  emptyState.classList.toggle("hidden", movies.length > 0);
}

function filterMovies(movies) {
  const searchValue = document.querySelector("#searchInput")?.value.trim().toLowerCase() || "";
  const genreValue = document.querySelector("#genreFilter")?.value || "all";
  const ratingValue = Number(document.querySelector("#ratingFilter")?.value || 0);

  return movies.filter((movie) => {
    const titleMatch =
      movie.title.toLowerCase().includes(searchValue) ||
      movie.description.toLowerCase().includes(searchValue);
    const genreMatch = genreValue === "all" || movie.genre === genreValue;
    const ratingMatch = averageRating(movie.ratings) >= ratingValue;

    return titleMatch && genreMatch && ratingMatch;
  });
}

function handleFilters(movies) {
  const controls = ["#searchInput", "#genreFilter", "#ratingFilter"];

  controls.forEach((selector) => {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    element.addEventListener("input", () => {
      renderMovieGrid(filterMovies(movies));
    });

    element.addEventListener("change", () => {
      renderMovieGrid(filterMovies(movies));
    });
  });
}

function addMovie(movies, form) {
  const formData = new FormData(form);
  const title = formData.get("title")?.toString().trim() || "";
  const genre = formData.get("genre")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const image = formData.get("image")?.toString().trim() || "";

  const movie = {
    id: slugify(`${title}-${Date.now()}`),
    title,
    genre,
    description,
    image,
    ratings: []
  };

  movies.unshift(movie);
  saveMovies(movies);
  return movie;
}

function setupSuggestForm(movies) {
  const form = document.querySelector("#suggestForm");
  const message = document.querySelector("#formMessage");

  if (!form || !message) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addMovie(movies, form);
    populateGenres(movies);
    renderFeaturedMovies(movies);
    renderMovieGrid(filterMovies(movies));
    form.reset();
    message.textContent = "Movie added. It is now live in the MovieMate collection.";
  });
}

function updateRating(movieId, value) {
  const movies = loadMovies();
  const movie = movies.find((entry) => entry.id === movieId);

  if (!movie) {
    return;
  }

  movie.ratings.push(value);
  saveMovies(movies);

  if (document.body.dataset.page === "home") {
    renderHomePage();
  } else {
    renderDetailsPage();
  }
}

function setupRatings() {
  document.addEventListener("click", (event) => {
    const star = event.target.closest(".star-btn");

    if (!star) {
      return;
    }

    const movieId = star.dataset.id;
    const rating = Number(star.dataset.rate);

    updateRating(movieId, rating);
  });
}

function renderHomePage() {
  const movies = loadMovies();
  const selectedGenre = document.querySelector("#genreFilter")?.value || "all";
  populateGenres(movies, selectedGenre);
  renderFeaturedMovies(movies);
  renderMovieGrid(filterMovies(movies));
}

function renderDetailsPage() {
  const target = document.querySelector("#movieDetails");

  if (!target) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");
  const movies = loadMovies();
  const movie = movies.find((entry) => entry.id === movieId);

  if (!movie) {
    target.innerHTML = `
      <section class="not-found">
        <h1>Movie not found</h1>
        <p class="detail-overview">The title you requested could not be found in this local collection.</p>
        <a class="primary-btn" href="index.html">Return home</a>
      </section>
    `;
    return;
  }

  target.innerHTML = `
    <section class="detail-card">
      <img class="detail-poster" src="${movie.image}" alt="${movie.title} poster" />
      <div class="detail-copy">
        <p class="eyebrow">Movie Details</p>
        <h1>${movie.title}</h1>
        <div class="detail-stats">
          <div class="detail-stat-card">
            <p class="movie-meta">Genre</p>
            <strong>${movie.genre}</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Average rating</p>
            <strong>${formatRating(movie.ratings)} / 5</strong>
          </div>
          <div class="detail-stat-card">
            <p class="movie-meta">Community votes</p>
            <strong>${movie.ratings.length}</strong>
          </div>
        </div>
        <p class="detail-overview">${movie.description}</p>
        <div class="detail-actions">
          <span class="movie-meta">Rate this movie:</span>
          <div class="stars">${createStarMarkup(movie.id, movie.ratings)}</div>
        </div>
      </div>
    </section>
  `;
}

function init() {
  setupRatings();

  if (document.body.dataset.page === "home") {
    const movies = loadMovies();
    renderHomePage();
    handleFilters(movies);
    setupSuggestForm(movies);
  }

  if (document.body.dataset.page === "details") {
    renderDetailsPage();
  }
}

init();
