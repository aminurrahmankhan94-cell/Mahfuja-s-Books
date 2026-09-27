// Firebase configuration kora ache dhore nilam...
// const db = firebase.firestore();
// const auth = firebase.auth();

let currentUser = null;
let allArticles = [];
let currentCategory = 'All';
let currentSort = 'newest';
let selectedReportArticleId = null;

// ====== Offline Persistence ======
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Offline data warning:", err.code);
});

// ====== 4.5s Splash Screen & Background Loading ======
// Splash screen thaka obosthatei pichone Firebase theke data load shuru hoye jabe.
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
      splash.remove();
    }, 500); // 0.5s fade transition
  }
}, 4500);

// ====== UI Settings (Theme & Text Size) ======
function initSettings() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const savedText = localStorage.getItem('textSize') || 'normal';
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if(document.getElementById('themeToggleBtn')) document.getElementById('themeToggleBtn').innerText = 'Switch to Dark Mode';
  }
  if (savedText === 'large') {
    document.body.classList.add('large-text');
    if(document.getElementById('textSizeBtn')) document.getElementById('textSizeBtn').innerText = 'Switch to Normal Text';
  }
}
initSettings();

function openSettingsModal() { document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  document.getElementById('themeToggleBtn').innerText = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
}

function toggleTextSize() {
  document.body.classList.toggle('large-text');
  const isLarge = document.body.classList.contains('large-text');
  localStorage.setItem('textSize', isLarge ? 'large' : 'normal');
  document.getElementById('textSizeBtn').innerText = isLarge ? 'Switch to Normal Text' : 'Switch to Large Text';
}

// ====== Auth System ======
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('userBadge');
  const settingsBtn = document.getElementById('settingsBtn');

  if (user) {
    // Check ban status...
    if(loginBtn) loginBtn.style.display = 'none';
    if(userBadge) userBadge.style.display = 'flex';
    if(settingsBtn) settingsBtn.style.display = 'block'; // Show settings when logged in
  } else {
    if(loginBtn) loginBtn.style.display = 'block';
    if(userBadge) userBadge.style.display = 'none';
    if(settingsBtn) settingsBtn.style.display = 'none';
  }
  renderArticles();
});

// ====== Fetch & Render Posts inside Card Boxes ======
db.collection("articles").onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => { allArticles.push({ id: doc.id, ...doc.data() }); });
  renderArticles(); // Background-e load hobe
});

function renderArticles() {
  const container = document.getElementById('articlesGrid');
  if (!container) return;
  container.innerHTML = '';

  let filtered = allArticles.filter(art => currentCategory === 'All' || art.subject === currentCategory);
  
  filtered.sort((a, b) => {
    if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  filtered.forEach(art => {
    const likesList = Array.isArray(art.likes) ? art.likes : [];
    const hasLiked = currentUser && likesList.some(l => (typeof l === 'string' ? l === currentUser.uid : l.uid === currentUser.uid));
    const comments = Array.isArray(art.comments) ? art.comments : [];

    const fullContent = art.content || '';
    const isLong = fullContent.length > 300;
    const shortContent = isLong ? fullContent.substring(0, 300) + '...' : fullContent;

    container.innerHTML += `
      <div class="article-card ${art.isPinned ? 'pinned-card' : ''}">
        ${art.isPinned ? '<div class="pinned-tag">PINNED WORK</div>' : ''}
        <div class="card-header">
          <h2 class="article-title">${escapeHtml(art.title)}</h2>
          <span style="color:var(--text-muted); font-size:13px;">${escapeHtml(art.subject || 'General')}</span>
        </div>
        <div style="font-size: 14px; color: var(--text-muted); margin-top: 5px;">
          By ${escapeHtml(art.author || 'Anonymous')}
        </div>

        <div id="body-short-${art.id}" class="article-body">${escapeHtml(shortContent)}</div>
        ${isLong ? `<div id="body-full-${art.id}" class="article-body" style="display:none;">${escapeHtml(fullContent)}</div>` : ''}
        ${isLong ? `<button id="btn-more-${art.id}" class="action-btn" style="margin-bottom:15px;" onclick="toggleReadMore('${art.id}')">Read More</button>` : ''}
        
        <div class="card-actions" style="display:flex; gap:10px; border-top:1px solid var(--card-border); padding-top:15px;">
          <button class="action-btn ${hasLiked ? 'active-like' : ''}" onclick="likePost('${art.id}')">
            ${hasLiked ? 'LIKED' : 'LIKE'} (${likesList.length})
          </button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">COMMENTS (${comments.length})</button>
          ${currentUser ? `<button class="action-btn" style="color:var(--danger-color);" onclick="openReportModal('${art.id}', '${escapeHtml(art.title)}')">REPORT</button>` : ''}
        </div>

        <div id="comments-${art.id}" style="display:none; margin-top:15px; padding-top:15px; border-top:1px dashed var(--card-border);">
          <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="input-text-${art.id}" placeholder="Write a comment..." style="flex:1; padding:10px; border-radius:6px; background:var(--bg-color); color:var(--text-main); border:1px solid var(--card-border);">
            <button class="action-btn" onclick="addComment('${art.id}')">POST</button>
          </div>
          <div>
            ${comments.map(c => `
              <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--bg-color);">
                <strong>${escapeHtml(c.name)}:</strong> <span style="color:var(--text-muted);">${escapeHtml(c.text)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });
}

function toggleReadMore(id) {
  const shortB = document.getElementById(`body-short-${id}`);
  const fullB = document.getElementById(`body-full-${id}`);
  const btn = document.getElementById(`btn-more-${id}`);
  if(fullB.style.display === 'none') {
    fullB.style.display = 'block';
    shortB.style.display = 'none';
    btn.innerText = 'Read Less';
  } else {
    fullB.style.display = 'none';
    shortB.style.display = 'block';
    btn.innerText = 'Read More';
  }
}

// ====== Admin Tab Switcher ======
function switchAdminTab(tabId, btnElement) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  btnElement.classList.add('active');

  if(tabId === 'tab-reports') loadReports();
}

// ====== Report System Logic ======
function openReportModal(artId, title) {
  selectedReportArticleId = artId;
  document.getElementById('reportPostTitle').innerText = "Post: " + title;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportModal').style.display = 'flex';
}
function closeReportModal() { document.getElementById('reportModal').style.display = 'none'; }
async function submitReport() {
  const reason = document.getElementById('reportReason').value.trim();
  if(!reason) return;
  await db.collection("reports").add({
    articleId: selectedReportArticleId,
    reportedByName: currentUser.displayName || 'Reader',
    reason: reason,
    createdAt: new Date().toISOString()
  });
  alert("Report submitted to Raflido Studios admin team.");
  closeReportModal();
}

// Helper to sanitize HTML tags
function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }
