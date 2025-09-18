// functions.js
const { createClient } = supabase; // global von CDN

// === HIER deine Werte einsetzen ===
const SUPABASE_URL = "https://bepewmvemlekplshjovy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcGV3bXZlbWxla3Bsc2hqb3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjcyNDcsImV4cCI6MjA3MzYwMzI0N30.8uBEKGhcU5rHMCp3L2l9JJdXEgfRvPj23LQ91oC1Ed8";
// ==================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

// DOM-Referenzen
const githubBtn = document.getElementById("github-btn");
const signupForm = document.getElementById("signup-form");
const signinForm = document.getElementById("signin-form");
const guestBtn = document.getElementById("guest-btn");
const avatarInput = document.getElementById("avatar-input");
const profileArea = document.getElementById("profile-area");
const authArea = document.getElementById("auth-area");
const usernameEl = document.getElementById("username");
const avatarEl = document.getElementById("avatar");
const signoutBtn = document.getElementById("signout-btn");
const statusEl = document.getElementById("status");

// Helpers: localStorage
function saveUserToLocal(user) {
  localStorage.setItem("user", JSON.stringify(user));
}
function getUserFromLocal() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
function clearLocalUser() {
  localStorage.removeItem("user");
  localStorage.removeItem("guest_id");
}

// UI
function renderUser(u) {
  if (!u) {
    profileArea.classList.add("hidden");
    authArea.classList.remove("hidden");
    usernameEl.textContent = "";
    avatarEl.src = "";
    return;
  }
  authArea.classList.add("hidden");
  profileArea.classList.remove("hidden");
  usernameEl.textContent = u.name || (u.guest ? "Gast" : "Benutzer");
  avatarEl.src = u.avatar_url || "";
  statusEl.textContent = u.guest ? "Eingeloggt als Gast" : "Eingeloggt";
}

// Auth Funktionen
async function signInWithGitHub() {
  statusEl.textContent = "Öffne GitHub-Anmeldung…";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    statusEl.textContent = "Fehler: " + error.message;
  }
}

async function signUpWithEmail(name, email, password) {
  statusEl.textContent = "Registriere…";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) {
    statusEl.textContent = "Fehler: " + error.message;
  } else {
    statusEl.textContent = "Registrierung gestartet. E-Mail prüfen.";
  }
}

async function signInWithEmail(email, password) {
  statusEl.textContent = "Anmeldung…";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    statusEl.textContent = "Fehler: " + error.message;
  } else {
    statusEl.textContent = "Anmeldung erfolgreich.";
  }
}

function signInAsGuest() {
  let guestId = localStorage.getItem("guest_id");
  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem("guest_id", guestId);
  }
  const guest = { id: guestId, name: "Gast", avatar_url: "", guest: true };
  saveUserToLocal(guest);
  renderUser(guest);
  statusEl.textContent = "Fortfahren als Gast";
}

async function uploadAvatarFile(file) {
  const user = getUserFromLocal();
  if (!user) return alert("Kein Benutzer angemeldet.");
  const path = `${user.id}/${Date.now()}_${file.name}`;
  statusEl.textContent = "Lade Bild hoch…";

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) {
    statusEl.textContent = "Upload Fehler: " + uploadError.message;
    return;
  }

  const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  if (user.guest) {
    const newUser = { ...user, avatar_url: publicUrl };
    saveUserToLocal(newUser);
    renderUser(newUser);
    statusEl.textContent = "Profilbild lokal gespeichert.";
    return;
  }

  const { data: updated, error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
  if (updateError) {
    statusEl.textContent = "Update Fehler: " + updateError.message;
    return;
  }

  const newUser = {
    id: updated.user?.id || user.id,
    name: updated.user?.user_metadata?.full_name || updated.user?.email || user.name,
    avatar_url: publicUrl,
  };
  saveUserToLocal(newUser);
  renderUser(newUser);
  statusEl.textContent = "Profilbild hochgeladen.";
}

async function signOut() {
  await supabase.auth.signOut();
  clearLocalUser();
  renderUser(null);
  statusEl.textContent = "Abgemeldet.";
}

// Supabase Listener
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    const u = {
      id: session.user.id,
      name: session.user.user_metadata?.full_name || session.user.email,
      avatar_url: session.user.user_metadata?.avatar_url || null,
      guest: false,
    };
    saveUserToLocal(u);
    renderUser(u);
  } else if (event === "SIGNED_OUT") {
    clearLocalUser();
    renderUser(null);
  }
});

// Initialisieren
(async function init() {
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (user) {
    const u = {
      id: user.id,
      name: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
      guest: false,
    };
    saveUserToLocal(u);
    renderUser(u);
  } else {
    const local = getUserFromLocal();
    if (local) renderUser(local);
  }
})();

// Events
githubBtn.addEventListener("click", signInWithGitHub);
signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  signUpWithEmail(
    document.getElementById("signup-name").value.trim(),
    document.getElementById("signup-email").value.trim(),
    document.getElementById("signup-pass").value
  );
});
signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  signInWithEmail(
    document.getElementById("signin-email").value.trim(),
    document.getElementById("signin-pass").value
  );
});
guestBtn.addEventListener("click", signInAsGuest);
avatarInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) uploadAvatarFile(file);
});
signoutBtn.addEventListener("click", signOut);
