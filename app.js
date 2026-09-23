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

let currentUser = null;
let allArticles = [];
let currentCategory = 'All';

// ====== Author Profile Loader & Modal ======
db.collection("settings").doc("authorProfile").onSnapshot((doc) => {
  if (doc.exists) {
    const data = doc.data();
    if (document.getElementById('modalAuthorName')) document.getElementById('modalAuthorName').innerText = data.name || "Mahfuja";
    if (document.getElementById('modalAuthorBio')) document.getElementById('modalAuthorBio').innerText = data.bio || "No biography available.";
    if (data.image && document.getElementById('modalAuthorImg')) document.getElementById('modalAuthorImg').src = data.image;
  }
});

function openAuthorModal() {
  const modal = document.getElementById('authorModal');
  if(modal) modal.style.display = 'flex';
}

function closeAuthorModal() {
  const modal = document.getElementById('authorModal');
  if(modal) modal.style.display = 'none';
}

// Close Modal when clicked outside content
window.onclick = function(e) {
  const modal = document.getElementById('authorModal');
  if (e.target === modal) modal.style.display = 'none';
}

// ====== Google Authentication ======
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('userBadge');

  if (user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (doc.exists && doc.data().isBanned) {
      alert("Your account has been suspended by the admin.");
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

    if(loginBtn) loginBtn.style.display = 'none';
    if(userBadge) userBadge.style.display = 'flex';
    if(document.getElementById('userName')) document.getElementById('userName').innerText = (user.displayName || 'Reader').split(' ')[0];
    if(document.getElementById('userAvatar')) document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/30';
  } else {
    if(loginBtn) loginBtn.style.display = 'block';
    if(userBadge) userBadge.style.display = 'none';
  }
});

function googleSignIn() {
  auth.signInWithPopup(googleProvider).catch((error) => {
    alert("Login Error: " + error.message);
  });
}

function googleSignOut() { auth.signOut(); }

// ====== Fetch Articles & Render ======
db.collection("articles").onSnapshot((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => { allArticles.push({ id: doc.id, ...doc.data() }); });
  
  allArticles.sort((a, b) => {
    if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  renderArticles();
});

function renderArticles() {
  const container = document.getElementById('articlesGrid');
  if(!container) return;
  const searchInput = document.getElementById('searchInput');
  const searchText = searchInput ? searchInput.value.toLowerCase() : '';
  
  container.innerHTML = '';

  const filtered = allArticles.filter(art => {
    const matchesCat = currentCategory === 'All' || (art.subject && art.subject.toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = art.title.toLowerCase().includes(searchText) || 
                          (art.author && art.author.toLowerCase().includes(searchText)) ||
                          (art.content && art.content.toLowerCase().includes(searchText));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#888; margin-top:40px; letter-spacing:1px;">NO WRITINGS FOUND</p>';
    return;
  }

  filtered.forEach(art => {
    const likesList = Array.isArray(art.likes) ? art.likes : [];
    const hasLiked = currentUser && likesList.some(l => (typeof l === 'string' ? l === currentUser.uid : l.uid === currentUser.uid));
    const comments = Array.isArray(art.comments) ? art.comments : [];

    container.innerHTML += `
      <div class="article-card ${art.isPinned ? 'pinned-card' : ''}">
        ${art.isPinned ? '<div class="pinned-tag">PINNED WORK</div>' : ''}
        <div class="card-header">
          <h2 class="article-title">${escapeHtml(art.title)}</h2>
          <span class="category-badge">${escapeHtml(art.subject || 'General')}</span>
        </div>
        <div class="author-name">By ${escapeHtml(art.author || 'Anonymous')}</div>
        
        ${art.imageUrl ? `<img src="${escapeHtml(art.imageUrl)}" class="post-image" alt="Post Image">` : ''}

        <div class="article-body">${escapeHtml(art.content)}</div>
        
        <div class="card-actions">
          <button class="action-btn ${hasLiked ? 'active-like' : ''}" onclick="likePost('${art.id}')">
            ${hasLiked ? 'LIKED' : 'LIKE'} (${likesList.length})
          </button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">COMMENTS (${comments.length})</button>
        </div>

        <div id="comments-${art.id}" class="comments-container" style="display:none; margin-top:15px; background:#000; padding:15px; border-radius:8px; border:1px solid #222;">
          <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="input-text-${art.id}" placeholder="Write a comment..." style="flex:1; padding:10px; border-radius:4px; border:1px solid #333; background:#111; color:#fff;">
            <button class="btn-primary" onclick="addComment('${art.id}')">POST</button>
          </div>
          <div>
            ${comments.map(c => `
              <div style="margin-bottom:12px; font-size:14px; border-bottom:1px solid #222; padding-bottom:10px; color:#ddd;">
                <strong style="color:#fff;">${escapeHtml(c.name)}:</strong> ${escapeHtml(c.text)}${(c.replies && c.replies.length > 0) ? c.replies.map(r => `
                  <div style="margin-top:6px; margin-left:15px; font-size:13px; color:#bbb; border-left:2px solid #fff; padding-left:10px; background:#0a0a0a; padding-top:4px; padding-bottom:4px; border-radius:0 4px 4px 0;">
                    <strong style="color:#fff;">Admin Reply:</strong> ${escapeHtml(r.text)}
                  </div>
                `).join('') : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if(event && event.target) event.target.classList.add('active');
  renderArticles();
}

if(document.getElementById('searchInput')){
  document.getElementById('searchInput').addEventListener('input', renderArticles);
}

// ====== Toggle Like Logic ======
async function likePost(id) {
  if (!currentUser) return alert("Please sign in to like this post.");

  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  if (userDoc.exists && userDoc.data().isBanned) return alert("Your account has been suspended.");

  const articleRef = db.collection("articles").doc(id);
  const doc = await articleRef.get();
  if (!doc.exists) return;

  let likesList = Array.isArray(doc.data().likes) ? doc.data().likes : [];
  const existingIndex = likesList.findIndex(l => (typeof l === 'string' ? l === currentUser.uid : l.uid === currentUser.uid));

  if (existingIndex > -1) {
    likesList.splice(existingIndex, 1);
  } else {
    likesList.push({
      uid: currentUser.uid,
      name: currentUser.displayName || 'Reader',
      email: currentUser.email || 'N/A'
    });
  }

  articleRef.update({ likes: likesList });
}

function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

async function addComment(id) {
  if (!currentUser) return alert("Please sign in to comment.");

  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  if (userDoc.exists && userDoc.data().isBanned) return alert("Your account has been suspended.");

  const textInput = document.getElementById(`input-text-${id}`);
  const text = textInput.value.trim();
  if (!text) return;

  const newComment = {
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    uid: currentUser.uid,
    name: currentUser.displayName || 'Reader',
    email: currentUser.email || 'N/A',
    text: text,
    replies: [],
    createdAt: new Date().toISOString()
  };

  db.collection("articles").doc(id).update({
    comments: firebase.firestore.FieldValue.arrayUnion(newComment)
  }).then(() => textInput.value = '');
}

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }

// ====== Offline Smart AI Logic ======
function toggleAIChat() {
  const box = document.getElementById('aiChatBox');
  box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function handleChatKey(e) { if(e.key === 'Enter') sendChatMessage(); }

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const body = document.getElementById('chatBody');
  const query = input.value.trim();
  if(!query) return;

  body.innerHTML += `<div class="chat-msg user">${escapeHtml(query)}</div>`;
  input.value = '';
  
  const typingId = 'typing-' + Date.now();
  body.innerHTML += `<div id="${typingId}" class="chat-msg bot">Thinking...</div>`;
  body.scrollTop = body.scrollHeight;

  setTimeout(() => {
    document.getElementById(typingId).remove();
    body.innerHTML += `<div class="chat-msg bot">${getOfflineAIResponse(query)}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 600);
}

function getOfflineAIResponse(q) {
  q = q.toLowerCase();
  if(q.includes("hello") || q.includes("hi")) return "Hello! How can I help you today?";
  if(q.includes("mahfuja")) return "Mahfuja is the founder and poet of this literature portal.";
  return "Thank you for reaching out! You can explore stories, poems, and novels in the portal.";
}
