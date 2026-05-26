import fs from "node:fs";

const analytics = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "a3795ec89854463a9b90761fb384fb6c"}'></script><!-- End Cloudflare Web Analytics -->`;
const cssVersion = "styles.css?v=120-moviemate-global-search";
const jsVersion = "app.js?v=168-global-search-header";

function head(title, description) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="#0a0a0f" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${cssVersion}" />
  </head>`;
}

function authModal() {
  return `
    <div class="overlay-modal hidden" id="authModal" aria-hidden="true">
      <button class="overlay-backdrop" data-close-auth="true" type="button" aria-label="Close account modal"></button>
      <div class="overlay-card auth-overlay">
        <button class="overlay-close" id="authClose" type="button" aria-label="Close account modal">&times;</button>
        <div class="auth-tab-row">
          <button class="schedule-type-pill active" id="authLoginTab" type="button">Login</button>
          <button class="schedule-type-pill" id="authSignupTab" type="button">Sign Up</button>
        </div>
        <p class="eyebrow">Your MovieMate account</p>
        <h2 class="overlay-title" id="authTitle">Sign in to MovieMate</h2>
        <p class="section-copy" id="authHint">Sign in to keep collections, member reactions, and your watch progress across devices.</p>
        <form class="overlay-form auth-form-single" id="authForm" data-mode="login">
          <label class="input-group hidden" id="authNameField"><span>Name</span><input name="displayName" type="text" placeholder="Your name" /></label>
          <label class="input-group form-span"><span>Email</span><input name="email" type="email" required /></label>
          <label class="input-group form-span"><span>Password</span><input name="password" type="password" required /></label>
          <div class="form-actions auth-actions">
            <button class="primary-btn" id="authSubmit" type="submit">Sign In</button>
            <button class="ghost-link" id="forgotPasswordBtn" type="button">Forgot Password?</button>
          </div>
          <p class="form-message" id="authMessage" aria-live="polite"></p>
        </form>
      </div>
    </div>`;
}

function accountMenu() {
  return `
          <div class="account-menu-wrap">
            <button class="ghost-link account-top-link" data-auth-toggle type="button" aria-label="MovieMate account">
              <span class="account-signin-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.25" r="3.25"></circle><path d="M5.75 19.5a6.25 6.25 0 0 1 12.5 0"></path></svg></span>
              <span class="account-chip-avatar hidden" data-account-avatar>MM</span>
              <span class="account-chip-label" data-account-label>Sign In</span>
            </button>
            <div class="account-menu hidden" aria-hidden="true">
              <a class="account-menu-link hidden" data-account-only data-profile-link href="profile.html">My Profile</a>
              <a class="account-menu-link hidden" data-account-only href="my-reviews.html">My Reviews</a>
              <a class="account-menu-link hidden" data-account-only data-account-settings-link href="account.html">Settings</a>
              <button class="account-menu-link hidden danger" data-account-only data-signout-action type="button">Logout</button>
              <button class="account-menu-link" data-signed-out-only data-signin-action type="button">Sign In</button>
            </div>
          </div>`;
}

function compactNav({ active = "explore", owner = false, detailsButtons = false } = {}) {
  const item = (key, label, href, svg) =>
    detailsButtons
      ? `<button class="detail-nav-btn ${active === key ? "active" : ""}" type="button" aria-label="${label}" data-detail-panel-trigger="${key}">${svg}<span class="detail-nav-label">${label}</span></button>`
      : `<a class="detail-nav-btn ${active === key ? "active" : ""}" aria-label="${label}" href="${href}">${svg}<span class="detail-nav-label">${label}</span></a>`;
  const svgs = {
    explore: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.25"></circle><circle cx="12" cy="12" r="2.25"></circle></svg>`,
    schedule: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2"></rect><path d="M8 3.5v4M16 3.5v4M4 9.5h16"></path></svg>`,
    spaces: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-3 3v-3H5a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3h1"></path><path d="M16 6h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1l-2 2v-2"></path></svg>`,
    collections: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-6.5-3.8L5.5 20V6A1.5 1.5 0 0 1 7 4.5Z"></path></svg>`,
    browse: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"></rect><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"></rect><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"></rect><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"></rect></svg>`,
    notifications: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a4 4 0 0 1 4 4v2.1c0 1.2.4 2.3 1.1 3.2l1 1.2H5.9l1-1.2c.7-.9 1.1-2 1.1-3.2V8.5a4 4 0 0 1 4-4Z"></path><path d="M9.5 18a2.5 2.5 0 0 0 5 0"></path></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="5.5"></circle><path d="m16 16 4 4"></path></svg>`
  };
  const search = detailsButtons
    ? item("search", "Search", "#", svgs.search)
    : `<button class="detail-nav-btn" type="button" aria-label="Search" data-global-search-toggle>${svgs.search}<span class="detail-nav-label">Search</span></button>`;
  return `
      <nav class="topbar compact">
        <a class="brand" href="/explore/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text">MOVIEMATE</span></a>
        <div class="detail-nav-icons" aria-label="MovieMate navigation">
          ${item("explore", "Explore", "/explore/#trending", svgs.explore)}
          ${item("schedule", "Schedule", "/explore/#schedule", svgs.schedule)}
          ${item("spaces", "Spaces", "/explore/#trending", svgs.spaces)}
          ${item("collections", "Collections", "/explore/#collections", svgs.collections)}
          ${item("browse", "Browse", "/explore/#browse", svgs.browse)}
          ${detailsButtons ? item("notifications", "Notifications", "#", svgs.notifications) : ""}
          ${search}
        </div>
        <div class="topbar-actions">
          <a class="ghost-link" href="/explore/">Back to Browse</a>
          <a class="ghost-link" href="contact.html">Contact</a>
          ${owner ? '<button class="ghost-link" id="ownerToggle" type="button">Owner Mode</button>' : ""}
          ${accountMenu()}
        </div>
      </nav>`;
}

function pageShell({ title, description, page, mainId, owner = false, detailsButtons = false }) {
  return `${head(title, description)}
  <body data-page="${page}">
    <div class="page-shell detail-shell">
      ${compactNav({ owner, detailsButtons })}
      ${detailsButtons ? '<section class="detail-header-panel hidden" id="detailHeaderPanel" aria-hidden="true"></section><button class="detail-header-panel-backdrop hidden" id="detailHeaderPanelBackdrop" type="button" aria-label="Close navigation panel"></button>' : ""}
      <main class="${page === "person" ? "person-page" : "detail-page"}" id="${mainId}"></main>
    </div>
    ${authModal()}
    <script type="module" src="${jsVersion}"></script>
    ${analytics}
  </body>
</html>`;
}

const explore = fs.readFileSync("explore/index.html", "utf8")
  .replaceAll('href="styles.css?v=100-moctale-header-align"', 'href="explore/styles.css?v=101-moviemate-global-search"')
  .replaceAll('href="../', 'href="')
  .replaceAll('src="../', 'src="')
  .replaceAll('content="../', 'content="')
  .replaceAll('href="/explore/#trending"', 'href="#trending"')
  .replaceAll('href="/explore/"', 'href="/"')
  .replaceAll('src="app.js?v=27-home-header-actions"', 'src="explore/app.js?v=28-moviemate-global-search"');
fs.writeFileSync("index.html", explore);

fs.writeFileSync("details.html", pageShell({
  title: "MovieMate | Title Details",
  description: "Explore title details, reactions, release dates, and public reviews on MovieMate.",
  page: "details",
  mainId: "movieDetails",
  owner: true,
  detailsButtons: true
}).replace("</body>", `
    <div class="overlay-modal hidden" id="trailerModal" aria-hidden="true">
      <button class="overlay-backdrop" data-close-trailer="true" type="button" aria-label="Close trailer"></button>
      <div class="overlay-card overlay-card-wide trailer-modal-card">
        <button class="overlay-close" id="trailerModalClose" type="button" aria-label="Close trailer">&times;</button>
        <div class="trailer-modal-frame-shell"><iframe id="trailerModalFrame" class="trailer-modal-frame" src="" title="MovieMate trailer" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      </div>
    </div>
  </body>`));

fs.writeFileSync("person.html", pageShell({ title: "MovieMate | Person Details", description: "Explore cast and crew details on MovieMate.", page: "person", mainId: "personPage" }));
fs.writeFileSync("season.html", pageShell({ title: "MovieMate | Season Details", description: "Explore a TV season, track watched progress, and read season-specific reviews on MovieMate.", page: "season", mainId: "seasonPage", owner: true }));
fs.writeFileSync("collection.html", pageShell({ title: "MovieMate | Collection", description: "Open a full MovieMate collection and browse all titles inside it.", page: "collection", mainId: "collectionPage" }));

function appPage(file, page, title, mainId, chip) {
  fs.writeFileSync(file, `${head(title, `MovieMate ${chip} page.`)}
  <body data-page="${page}">
    <div class="page-shell">
      <header class="explore-header">
        <nav class="explore-topbar"><div class="explore-topbar-main"><div class="explore-topbar-left"><a class="brand brand-compact" href="/explore/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text">MOVIEMATE</span></a><span class="beta-chip">${chip}</span></div><div class="explore-actions-right">${accountMenu()}</div></div></nav>
      </header>
      <main class="${page}-page" id="${mainId}"></main>
    </div>
    ${authModal()}
    <script type="module" src="${jsVersion}"></script>
    ${analytics}
  </body>
</html>`);
}

appPage("profile.html", "profile", "MovieMate | My Profile", "profilePage", "profile");
appPage("account.html", "account", "MovieMate | Account Settings", "accountPage", "settings");
appPage("my-reviews.html", "reviews", "MovieMate | My Reviews", "reviewsPage", "reviews");
appPage("admin.html", "admin", "MovieMate | Admin Dashboard", "adminPage", "admin");

function staticPage(file, page, title, eyebrow, h1, copy) {
  fs.writeFileSync(file, `${head(title, copy)}
  <body data-page="${page}">
    <div class="page-shell detail-shell">
      ${compactNav()}
      <main class="static-page">
        <section class="account-empty-state">
          <p class="eyebrow">${eyebrow}</p>
          <h1>${h1}</h1>
          <p class="section-copy">${copy}</p>
        </section>
      </main>
    </div>
    ${authModal()}
    <script type="module" src="${jsVersion}"></script>
    ${analytics}
  </body>
</html>`);
}

staticPage("about.html", "static", "MovieMate | About", "About MovieMate", "A public space for discovering movies and series.", "MovieMate helps viewers browse titles, collections, reviews, and release updates.");
staticPage("contact.html", "static", "MovieMate | Contact", "Contact", "Get in touch with MovieMate.", "Send feedback, support notes, partnership ideas, or moderation questions.");
staticPage("privacy.html", "static", "MovieMate | Privacy", "Privacy", "A short privacy note for MovieMate users.", "MovieMate stores public suggestions, likes, and reviews so the website can display community activity.");
fs.writeFileSync("offline.html", `${head("MovieMate | Offline", "MovieMate offline page.")}
  <body><main class="account-empty-state"><h1>You are offline.</h1><p class="section-copy">Reconnect to keep exploring MovieMate.</p></main></body></html>`);
