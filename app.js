const firebaseConfig = {
  apiKey: "AIzaSyBzvxeq6feVCSdcDVywh7mWikxbD3RryuU",
  authDomain: "my-writer-gallery-2cd87.firebaseapp.com",
  projectId: "my-writer-gallery-2cd87",
  storageBucket: "my-writer-gallery-2cd87.firebasestorage.app",
  messagingSenderId: "233413550719",
  appId: "1:233413550719:web:fe5e2eae246ee601a3d54a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Enable offline caching
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistence note:", err.code);
});

let currentUser = null;
let allArticles = [];
let currentCategory = 'All';
let currentSort = 'newest';
let selectedReportArticleId = null;

// ====== Theme Toggle ======
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerText = 'Light Mode';
  }
}
initTheme();

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerText = isLight ? 'Light Mode' : 'Dark Mode';
}

// ====== Intro Splash Screen Delay (4.5 Seconds) ======
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity 0.6s ease';
    setTimeout(() => splash.remove(), 600);
  }
}, 4500);

// ====== Admin Panel Tab Switcher ======
function switchAdminTab(tabId, btnElement) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');
  if (btnElement) btnElement.classList.add('active');

  if (tabId === 'tab-reports') loadReports();
}

// ====== Auth Observer ======
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('userBadge');

  if (user) {
    const userRef = db.collection("users").doc(user.uid);
    try {
      const doc = await userRef.get();
      if (doc.exists && doc.data().isBanned) {
        alert("Your account has been suspended.");
        auth.signOut();
        return;
      }
      await userRef.set({
        uid: user.uid,
        name: user.displayName || 'Reader',
        email: user.email,
        photo: user.photoURL || '',
        lastLogin: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.log("User auth error:", e);
    }

    if (loginBtn) loginBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'flex';
    if (document.getElementById('userName')) document.getElementById('userName').innerText = (user.displayName || 'Reader').split(' ')[0];
    if (document.getElementById('userAvatar')) document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/32';
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (userBadge) userBadge.style.display = 'none';
  }
  renderArticles();
});

function googleSignIn() { auth.signInWithPopup(googleProvider); }
function googleSignOut() { auth.signOut(); }

// ====== Fetch Articles ======
db.collection("articles").onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => { allArticles.push({ id: doc.id, ...doc.data() }); });
  const loader = document.getElementById('bookLoader');
  if (loader) loader.style.display = 'none';
  renderArticles();
});

function changeSort(val) {
  currentSort = val;
  renderArticles();
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.category-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderArticles();
}

if (document.getElementById('searchInput')) {
  document.getElementById('searchInput').addEventListener('input', renderArticles);
}

function renderArticles() {
  const container = document.getElementById('articlesGrid');
  if (!container) return;
  const searchInput = document.getElementById('searchInput');
  const searchText = searchInput ? searchInput.value.toLowerCase() : '';

  container.innerHTML = '';

  let filtered = allArticles.filter(art => {
    const matchesCat = currentCategory === 'All' || (art.subject && art.subject.toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = (art.title && art.title.toLowerCase().includes(searchText)) || 
                          (art.author && art.author.toLowerCase().includes(searchText)) ||
                          (art.content && art.content.toLowerCase().includes(searchText));
    return matchesCat && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    if (currentSort === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (currentSort === 'likes') {
      const likesA = Array.isArray(a.likes) ? a.likes.length : 0;
      const likesB = Array.isArray(b.likes) ? b.likes.length : 0;
      return likesB - likesA;
    } else {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:40px;">NO WRITINGS FOUND</p>';
    return;
  }

  filtered.forEach(art => {
    const likesList = Array.isArray(art.likes) ? art.likes : [];
    const hasLiked = currentUser && likesList.some(l => (typeof l === 'string' ? l === currentUser.uid : l.uid === currentUser.uid));
    const comments = Array.isArray(art.comments) ? art.comments : [];

    const fullContent = art.content || '';
    const isLong = fullContent.length > 250;
    const shortContent = isLong ? fullContent.substring(0, 250) + '...' : fullContent;

    container.innerHTML += `
      <div class="article-card ${art.isPinned ? 'pinned-card' : ''}">
        ${art.isPinned ? '<div class="pinned-tag">PINNED POST</div>' : ''}
        <div class="card-header">
          <h2 class="article-title">${escapeHtml(art.title)}</h2>
          <span class="category-badge">${escapeHtml(art.subject || 'General')}</span>
        </div>
        <div class="author-name">By ${escapeHtml(art.author || 'Anonymous')}</div>
        
        ${art.imageUrl ? `<img src="${escapeHtml(art.imageUrl)}" class="post-image" alt="Post">` : ''}

        <div id="body-short-${art.id}" class="article-body">${escapeHtml(shortContent)}</div>
        ${isLong ? `<div id="body-full-${art.id}" class="article-body" style="display:none;">${escapeHtml(fullContent)}</div>` : ''}
        ${isLong ? `<button id="btn-more-${art.id}" class="action-btn" onclick="toggleReadMore('${art.id}')">Read More v</button>` : ''}
        
        <div class="card-actions">
          <button class="action-btn ${hasLiked ? 'active-like' : ''}" onclick="likePost('${art.id}')">
            ${hasLiked ? 'LIKED' : 'LIKE'} (${likesList.length})
          </button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">COMMENTS (${comments.length})</button>
          ${currentUser ? `<button class="action-btn" onclick="openReportModal('${art.id}', '${escapeHtml(art.title)}')">REPORT</button>` : ''}
        </div>

        <div id="comments-${art.id}" class="comments-container" style="display:none; margin-top:15px;">
          <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="input-text-${art.id}" placeholder="Write a comment..." style="flex:1; padding:10px; border-radius:6px; background:var(--bg-color); color:var(--text-main); border:1px solid var(--card-border);">
            <button class="btn-primary" onclick="addComment('${art.id}')">POST</button>
          </div>
          <div>
            ${comments.map(c => `
              <div style="margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--card-border);">
                <strong>${escapeHtml(c.name)}:</strong>${escapeHtml(c.text)}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });
}

function toggleReadMore(id) {
  const shortBody = document.getElementById(`body-short-${id}`);
  const fullBody = document.getElementById(`body-full-${id}`);
  const btn = document.getElementById(`btn-more-${id}`);

  if (fullBody.style.display === 'none') {
    fullBody.style.display = 'block';
    shortBody.style.display = 'none';
    btn.innerText = 'Read Less ^';
  } else {
    fullBody.style.display = 'none';
    shortBody.style.display = 'block';
    btn.innerText = 'Read More v';
  }
}

// ====== User Settings Modal ======
function openUserSettingsModal() {
  if (!currentUser) return;
  const details = document.getElementById('settingsUserDetail');
  if (details) details.innerText = `Logged in as: ${currentUser.displayName} (${currentUser.email})`;
  document.getElementById('userSettingsModal').style.display = 'flex';
}

function closeUserSettingsModal() {
  document.getElementById('userSettingsModal').style.display = 'none';
}

// ====== Report Modal Logic ======
function openReportModal(artId, title) {
  if (!currentUser) return alert("Please sign in to report.");
  selectedReportArticleId = artId;
  document.getElementById('reportPostTitle').innerText = "Post: " + title;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
  selectedReportArticleId = null;
}

async function submitReport() {
  const reason = document.getElementById('reportReason').value.trim();
  if (!reason) return alert("Please write a reason.");

  try {
    await db.collection("reports").add({
      articleId: selectedReportArticleId,
      reportedByUid: currentUser.uid,
      reportedByName: currentUser.displayName || 'Reader',
      reportedByEmail: currentUser.email || 'N/A',
      reason: reason,
      createdAt: new Date().toISOString()
    });
    alert("Report submitted successfully.");
    closeReportModal();
  } catch (err) {
    alert("Error submitting report: " + err.message);
  }
}

function loadReports() {
  const list = document.getElementById('adminReportList');
  if (!list) return;

  db.collection("reports").orderBy("createdAt", "desc").get().then(snapshot => {
    if (snapshot.empty) {
      list.innerHTML = '<p style="color:var(--text-muted);">No reports submitted yet.</p>';
      return;
    }
    list.innerHTML = '';
    snapshot.forEach(doc => {
      const r = doc.data();
      list.innerHTML += `
        <div style="background:var(--bg-color); padding:12px; border-radius:6px; margin-bottom:10px; border:1px solid var(--card-border);">
          <strong>Reported By:</strong> ${escapeHtml(r.reportedByName)} (${escapeHtml(r.reportedByEmail)})<br>
          <strong>Reason:</strong> ${escapeHtml(r.reason)}<br>
          <small style="color:var(--text-muted);">${new Date(r.createdAt).toLocaleString()}</small>
        </div>
      `;
    });
  });
}

// ====== Like & Comment Functions ======
async function likePost(id) {
  if (!currentUser) return alert("Please sign in to like.");
  const articleRef = db.collection("articles").doc(id);
  const doc = await articleRef.get();
  if (!doc.exists) return;

  let likesList = Array.isArray(doc.data().likes) ? doc.data().likes : [];
  const existingIndex = likesList.findIndex(l => (typeof l === 'string' ? l === currentUser.uid : l.uid === currentUser.uid));

  if (existingIndex > -1) {
    likesList.splice(existingIndex, 1);
  } else {
    likesList.push({ uid: currentUser.uid, name: currentUser.displayName || 'Reader' });
  }

  articleRef.update({ likes: likesList });
}

function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

async function addComment(id) {
  if (!currentUser) return alert("Please sign in to comment.");
  const textInput = document.getElementById(`input-text-${id}`);
  const text = textInput.value.trim();
  if (!text) return;

  const newComment = {
    id: 'cmt_' + Date.now(),
    uid: currentUser.uid,
    name: currentUser.displayName || 'Reader',
    text: text,
    createdAt: new Date().toISOString()
  };

  db.collection("articles").doc(id).update({
    comments: firebase.firestore.FieldValue.arrayUnion(newComment)
  }).then(() => textInput.value = '');
}

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }
