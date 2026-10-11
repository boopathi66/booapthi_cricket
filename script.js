"use strict";

/* CricScout
   1. Setup and small helpers
   2. Login (only active when config.js has Supabase details)
   3. Player list
   4. Player page and chart
   5. Page routing (the #player-id part of the address)
*/

// ---------- 1. Setup ----------
const cfg = window.CRICSCOUT_CONFIG || {};
const authEnabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
const db = authEnabled ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

let players = [];
let chart = null;
let appReady = false;
let signUpMode = false;

const $ = (id) => document.getElementById(id);

function showView(name) {
  $("authView").classList.toggle("hidden", name !== "auth");
  $("listView").classList.toggle("hidden", name !== "list");
  $("playerView").classList.toggle("hidden", name !== "player");
  if (name !== "player") document.title = "CricScout: scouting notes on international players";
}

function makeCell(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function fmt(value, decimals) {
  if (value === undefined || value === null) return "–";
  if (decimals === undefined) return Number(value).toLocaleString("en-IN");
  return Number(value).toFixed(decimals);
}

// ---------- 2. Login ----------
function showMessage(text, type) {
  const box = $("authMsg");
  box.textContent = text;
  box.className = "msg" + (type === "ok" ? " ok" : "");
}

function clearMessage() {
  $("authMsg").className = "msg hidden";
}

function friendlyError(err) {
  const m = String(err && err.message ? err.message : err).toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Check them and try again.";
  if (m.includes("not confirmed")) return "Confirm your email first. Look for our message and click the link in it.";
  if (m.includes("already registered")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("password")) return "Use a password of at least 8 characters.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a few minutes and try again.";
  return "Something went wrong. Check your connection and try again.";
}

function setSignUpMode(on) {
  signUpMode = on;
  clearMessage();
  $("authTitle").textContent = on ? "Create an account" : "Sign in";
  $("authIntro").textContent = on
    ? "You'll get an email with a link to confirm your address."
    : "Use your email and password to see the player notes.";
  $("nameRow").classList.toggle("hidden", !on);
  $("passwordHint").classList.toggle("hidden", !on);
  $("passwordInput").autocomplete = on ? "new-password" : "current-password";
  $("authSubmit").textContent = on ? "Create account" : "Sign in";
  $("switchText").textContent = on ? "Already have an account?" : "New here?";
  $("switchBtn").textContent = on ? "Sign in" : "Create an account";
}

function showAuth() {
  appReady = false;
  players = [];
  $("userArea").classList.add("hidden");
  $("authForm").reset();
  setSignUpMode(false);
  showView("auth");
}

async function enterApp(user) {
  if (user) {
    const meta = user.user_metadata || {};
    $("userName").textContent = meta.name || user.email;
    $("userArea").classList.remove("hidden");
  }
  await loadPlayers();
  populateCountries();
  renderList();
  appReady = true;
  route();
}

$("switchBtn").addEventListener("click", () => setSignUpMode(!signUpMode));

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const name = $("nameInput").value.trim();

  if (!email) return showMessage("Enter your email address.", "error");
  if (password.length < 8) return showMessage("Use a password of at least 8 characters.", "error");

  $("authSubmit").disabled = true;
  try {
    if (signUpMode) {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });
      if (error) throw error;
      if (data.session) {
        await enterApp(data.user);
      } else {
        setSignUpMode(false);
        showMessage("Account created. Check your email and click the confirmation link, then sign in.", "ok");
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await enterApp(data.user);
    }
  } catch (err) {
    showMessage(friendlyError(err), "error");
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("signOutBtn").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  location.hash = "";
  showAuth();
});

async function start() {
  if (!authEnabled) {
    await enterApp(null);   // no login configured yet
    return;
  }
  const { data } = await db.auth.getSession();
  if (data.session) {
    await enterApp(data.session.user);
  } else {
    showAuth();
  }
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") showAuth();
  });
}

// ---------- 3. Player list ----------
async function loadPlayers() {
  if (players.length) return;
  try {
    if (authEnabled) {
      // Players kept in your Supabase table are only readable by signed-in users.
      const { data, error } = await db.from("players").select("data");
      if (!error && data && data.length) {
        players = data.map((row) => row.data);
        return;
      }
    }
    const res = await fetch("data.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    players = await res.json();
  } catch (err) {
    console.error("Could not load players:", err);
    const msg = $("loadMsg");
    msg.textContent = "The player data didn't load. If you opened index.html by double-clicking it, run the site through a local server or GitHub Pages instead (see README.md).";
    msg.classList.remove("hidden");
  }
}

function populateCountries() {
  const select = $("countryFilter");
  const countries = [...new Set(players.map((p) => p.country))].sort();
  select.length = 1; // keep "All countries"
  countries.forEach((c) => select.add(new Option(c, c)));
}

function filteredPlayers() {
  const query = $("searchInput").value.trim().toLowerCase();
  const country = $("countryFilter").value;
  const role = $("roleFilter").value;
  return players.filter((p) =>
    (!query || p.name.toLowerCase().includes(query)) &&
    (country === "ALL" || p.country === country) &&
    (role === "ALL" || p.category === role)
  );
}

function renderList() {
  const body = $("rosterBody");
  const list = filteredPlayers();
  body.textContent = "";

  list.forEach((p) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "name-btn";
    btn.textContent = p.name;
    nameCell.appendChild(btn);
    row.append(nameCell, makeCell("td", p.country), makeCell("td", p.role), makeCell("td", p.battingStyle));
    row.addEventListener("click", () => { location.hash = p.id; });
    body.appendChild(row);
  });

  $("resultCount").textContent =
    list.length === players.length
      ? `${players.length} players`
      : `${list.length} of ${players.length} players`;
  $("emptyMsg").classList.toggle("hidden", list.length > 0 || players.length === 0);
}

["input", "change"].forEach((evt) => {
  $("searchInput").addEventListener(evt, renderList);
  $("countryFilter").addEventListener(evt, renderList);
  $("roleFilter").addEventListener(evt, renderList);
});

$("clearFilters").addEventListener("click", () => {
  $("searchInput").value = "";
  $("countryFilter").value = "ALL";
  $("roleFilter").value = "ALL";
  renderList();
});

// ---------- 4. Player page ----------
const FORMATS = [["T20I", "t20i"], ["ODI", "odi"], ["Test", "test"]];

function renderPlayer(p) {
  document.title = `${p.name} | CricScout`;
  $("pName").textContent = p.name;
  $("pMeta").textContent = `${p.country}. ${p.role}. ${p.battingStyle}.`;

  const link = $("pLink");
  if (typeof p.cricinfoUrl === "string" && p.cricinfoUrl.startsWith("https://")) {
    link.href = p.cricinfoUrl;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }

  renderRecord(p);

  fillList($("strengthList"), p.advantages);
  fillList($("weaknessList"), p.disadvantages);

  showView("player");   // show first so the chart can measure its box
  renderChart(p);
  window.scrollTo(0, 0);
}

function fillList(ul, items) {
  ul.textContent = "";
  (items || []).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  });
}

function renderRecord(p) {
  // Bowlers have a "wickets" figure; batters have "runs".
  const isBowler = p.career.t20i && p.career.t20i.wickets !== undefined;
  const headings = isBowler
    ? ["Format", "Matches", "Wickets", "Average", "Economy"]
    : ["Format", "Matches", "Runs", "Average", "Strike rate"];

  const head = $("recordHead");
  head.textContent = "";
  const headRow = document.createElement("tr");
  headings.forEach((h, i) => {
    const th = makeCell("th", h, i > 0 ? "num" : "");
    th.scope = "col";
    headRow.appendChild(th);
  });
  head.appendChild(headRow);

  const body = $("recordBody");
  body.textContent = "";
  FORMATS.forEach(([label, key]) => {
    const s = p.career[key];
    if (!s) return;
    const tr = document.createElement("tr");
    const th = makeCell("th", label);
    th.scope = "row";
    tr.appendChild(th);
    tr.appendChild(makeCell("td", fmt(s.matches), "num"));
    tr.appendChild(makeCell("td", fmt(isBowler ? s.wickets : s.runs), "num"));
    tr.appendChild(makeCell("td", fmt(s.average, 1), "num"));
    tr.appendChild(makeCell("td", isBowler ? fmt(s.economy, 2) : fmt(s.strikeRate, 1), "num"));
    body.appendChild(tr);
  });
}

function renderChart(p) {
  if (chart) { chart.destroy(); chart = null; }

  const useEconomy = Boolean(p.phaseEconomy);
  const phases = p.phaseStrikeRates || p.phaseEconomy;
  const hasChart = Boolean(phases) && typeof Chart !== "undefined";

  $("chartBox").classList.toggle("hidden", !hasChart);
  $("chartEmpty").classList.toggle("hidden", hasChart);
  $("chartTitle").textContent = useEconomy ? "Economy rate by phase of the innings" : "Strike rate by phase of the innings";
  if (!hasChart) return;

  Chart.defaults.font.family = '"Barlow", system-ui, sans-serif';
  Chart.defaults.font.size = 14;
  Chart.defaults.color = "#54625a";

  chart = new Chart($("phaseChart"), {
    type: "bar",
    data: {
      labels: ["Overs 1 to 6", "Overs 7 to 15", "Overs 16 to 20"],
      datasets: [{
        label: useEconomy ? "Economy rate" : "Strike rate",
        data: [phases.powerplay, phases.middle, phases.death],
        backgroundColor: "#1f4f3a",
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#cdd7d1" } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ---------- 5. Routing ----------
function route() {
  if (!appReady) return;
  const id = decodeURIComponent(location.hash.slice(1));
  const player = players.find((p) => p.id === id);
  if (player) {
    renderPlayer(player);
  } else {
    showView("list");
  }
}

window.addEventListener("hashchange", route);

start();
