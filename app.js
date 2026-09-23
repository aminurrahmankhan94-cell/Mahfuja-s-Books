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

// ====== Google Authentication ======
auth.onAuthStateChanged((user) => {
  currentUser = user;
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('userBadge');

  if (user) {
    if(loginBtn) loginBtn.style.display = 'none';
    if(userBadge) userBadge.style.display = 'flex';
    if(document.getElementById('userName')) document.getElementById('userName').innerText = user.displayName.split(' ')[0];
    if(document.getElementById('userAvatar')) document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/30';

    db.collection("users").doc(user.uid).set({
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
      lastLogin: new Date().toISOString()
    }, { merge: true });
  } else {
    if(loginBtn) loginBtn.style.display = 'block';
    if(userBadge) userBadge.style.display = 'none';
  }
});

function googleSignIn() {
  auth.signInWithPopup(googleProvider).then((result) => {
    console.log("Logged in user:", result.user);
  }).catch((error) => {
    console.error("Auth Error:", error);
    alert("Login Error: " + error.message);
  });
}

function googleSignOut() { 
  auth.signOut(); 
}

// ====== Fetch Data & Render Posts ======
db.collection("articles").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => { allArticles.push({ id: doc.id, ...doc.data() }); });
  
  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  renderArticles();
}, (error) => {
  console.error("Database Error:", error);
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
    const likes = art.likes || 0;
    const comments = art.comments || [];

    container.innerHTML += `
      <div class="article-card">
        <div class="card-header">
          <h2 class="article-title">${escapeHtml(art.title)}</h2>
          <span class="category-badge">${escapeHtml(art.subject || 'General')}</span>
        </div>
        <div class="author-name">By ${escapeHtml(art.author || 'Anonymous')}</div>
        <div class="article-body">${escapeHtml(art.content)}</div>
        
        <div class="card-actions">
          <button class="action-btn" onclick="likePost('${art.id}', ${likes})">LIKE (${likes})</button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">COMMENTS (${comments.length})</button>
        </div>

        <div id="comments-${art.id}" class="comments-container" style="display:none; margin-top:15px; background:#000; padding:15px; border-radius:8px; border:1px solid #222;">
          <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="input-text-${art.id}" placeholder="Write a comment..." style="flex:1; padding:10px; border-radius:4px; border:1px solid #333; background:#111; color:#fff;">
            <button class="btn-primary" onclick="addComment('${art.id}')">POST</button>
          </div>
          <div>
            ${comments.map(c => `<div style="margin-bottom:8px; font-size:14px; border-bottom:1px solid #222; padding-bottom:5px; color:#ddd;"><strong style="color:#fff;">${escapeHtml(c.name)}:</strong>${escapeHtml(c.text)}</div>`).join('')}
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

function likePost(id, currentLikes) {
  if (!currentUser) return alert("Please sign in to like this post.");
  db.collection("articles").doc(id).update({ likes: currentLikes + 1 });
}

function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function addComment(id) {
  if (!currentUser) return alert("Please sign in to comment.");
  const textInput = document.getElementById(`input-text-${id}`);
  if (!textInput.value.trim()) return;

  db.collection("articles").doc(id).update({
    comments: firebase.firestore.FieldValue.arrayUnion({
      name: currentUser.displayName,
      uid: currentUser.uid,
      text: textInput.value.trim(),
      createdAt: new Date().toISOString()
    })
  }).then(() => textInput.value = '');
}

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }

// ========================================================
// OFFLINE SMART AI LOGIC
// ========================================================
function toggleAIChat() {
  const box = document.getElementById('aiChatBox');
  box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function handleChatKey(e) { 
  if(e.key === 'Enter') sendChatMessage(); 
}

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
    const reply = getOfflineAIResponse(query);
    body.innerHTML += `<div class="chat-msg bot">${reply}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 600);
}

function getOfflineAIResponse(question) {
  let q = question.toLowerCase();

  // কাস্টম প্রশ্ন-উত্তর লিস্ট
  if(q.includes("hello") || q.includes("hi") || q.includes("হ্যালো")) return "Hello! I am LitAI. How can I assist you today?";
  if(q.includes("name") || q.includes("নাম")) return "My name is LitAI, the virtual assistant for Mahfuja's Literature.";
  if(q.includes("how are you") || q.includes("কেমন")) return "I am functioning perfectly. How are you doing?";
  
  if(q.includes("mahfuja") || q.includes("মাহফুজা")) return "Mahfuja is the founder and primary writer of this literary portal.";
  if(q.includes("poem") || q.includes("কবিতা")) return "You can browse various poems by selecting the Poems tab in the header.";
  if(q.includes("story") || q.includes("গল্প")) return "Check out the Stories section to read all published stories.";
  if(q.includes("rabindranath") || q.includes("রবীন্দ্রনাথ")) return "Rabindranath Tagore was a Bengali polymath who won the Nobel Prize in Literature in 1913.";
  if(q.includes("nazrul") || q.includes("নজরুল")) return "Kazi Nazrul Islam is the national poet of Bangladesh, widely known as the Rebel Poet.";

  return "Thank you for your question. My knowledge base currently does not have a direct match for this inquiry. Feel free to ask about published stories, poems, or authors.";
}
