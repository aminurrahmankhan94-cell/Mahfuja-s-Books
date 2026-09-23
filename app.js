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

// ====== Google Login ======
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
  auth.signInWithPopup(googleProvider).catch((error) => {
    alert("Login Error: Please add aminurrahman94-cell.github.io to Firebase Authorized Domains!");
  });
}

function googleSignOut() { auth.signOut(); }

// ====== Fetch Data & Show Posts ======
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
    container.innerHTML = '<p style="text-align:center; color:#888; margin-top:40px;">No writings found here.</p>';
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
          <button class="action-btn" onclick="likePost('${art.id}', ${likes})">🤍 <span>${likes} Likes</span></button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">💬 <span>${comments.length} Comments</span></button>
        </div>

        <div id="comments-${art.id}" class="comments-container" style="display:none; margin-top:15px; background:#000; padding:15px; border-radius:8px;">
          <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="input-text-${art.id}" placeholder="Write a comment..." style="flex:1; padding:10px; border-radius:4px; border:1px solid #333; background:#111; color:#fff;">
            <button class="btn-primary" onclick="addComment('${art.id}')">Post</button>
          </div>
          <div>
            ${comments.map(c => `<div style="margin-bottom:8px; font-size:14px; border-bottom:1px solid #333; padding-bottom:5px; color:#ddd;"><strong style="color:#fff;">${escapeHtml(c.name)}:</strong>${escapeHtml(c.text)}</div>`).join('')}
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
  if (!currentUser) return alert("Please sign in to like this post!");
  db.collection("articles").doc(id).update({ likes: currentLikes + 1 });
}

function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function addComment(id) {
  if (!currentUser) return alert("Please sign in to comment!");
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
// 🤖 OFFLINE AI (No API Key Required)
// ========================================================
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
  body.innerHTML += `<div id="${typingId}" class="chat-msg bot">Thinking... 🤔</div>`;
  body.scrollTop = body.scrollHeight;

  setTimeout(() => {
    document.getElementById(typingId).remove();
    const reply = getOfflineAIResponse(query);
    body.innerHTML += `<div class="chat-msg bot">${reply}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 700);
}

function getOfflineAIResponse(question) {
  let q = question.toLowerCase();

  // আপনি এখানে ২০০০+ প্রশ্ন সেট করতে পারবেন (if কন্ডিশন বাড়িয়ে)
  if(q.includes("hello") || q.includes("hi") || q.includes("হ্যালো")) return "হ্যালো! আমি LitAI। আমি সাহিত্যের বিভিন্ন প্রশ্নের উত্তর দিতে পারি।";
  if(q.includes("name") || q.includes("নাম")) return "আমার নাম LitAI। আমি এই ওয়েবসাইটের ভার্চুয়াল অ্যাসিস্ট্যান্ট।";
  if(q.includes("how are you") || q.includes("কেমন")) return "আমি খুব ভালো আছি। আপনি কেমন আছেন?";
  
  // সাহিত্য ও ওয়েবসাইট সম্পর্কিত 
  if(q.includes("mahfuja") || q.includes("মাহফুজা")) return "মাহফুজা হলেন এই চমৎকার সাহিত্য ওয়েবসাইটের প্রতিষ্ঠাতা এবং লেখক।";
  if(q.includes("poem") || q.includes("কবিতা")) return "আমাদের ওয়েবসাইটে অনেক কবিতা আছে। আপনি উপরের 'Poems' বাটনে ক্লিক করে পড়তে পারেন।";
  if(q.includes("story") || q.includes("গল্প")) return "গল্প পড়তে চাইলে 'Stories' ক্যাটাগরিতে ক্লিক করুন। সেখানে অনেক চমৎকার গল্প আছে।";
  if(q.includes("rabindranath") || q.includes("রবীন্দ্রনাথ")) return "রবীন্দ্রনাথ ঠাকুর ১৯১৩ সালে 'গীতাঞ্জলি' কাব্যগ্রন্থের জন্য সাহিত্যে নোবেল পুরস্কার পান।";
  if(q.includes("nazrul") || q.includes("নজরুল")) return "কাজী নজরুল ইসলাম বাংলাদেশের জাতীয় কবি। তাকে 'বিদ্রোহী কবি' বলা হয়।";
  if(q.includes("love") || q.includes("ভালোবাসা")) return "ভালোবাসা সাহিত্যের একটি অমর বিষয়। শেক্সপিয়র থেকে শুরু করে সব সাহিত্যিকের লেখায় ভালোবাসার কথা আছে।";
  if(q.includes("history") || q.includes("ইতিহাস")) return "সাহিত্যের ইতিহাস অনেক পুরোনো। মানুষ যখন লিখতে শেখেনি, তখনও মুখে মুখে গল্প ও কবিতার প্রচলন ছিল।";
  if(q.includes("bangladesh") || q.includes("বাংলাদেশ")) return "বাংলাদেশ ১৯৭১ সালে স্বাধীন হয়। এটি একটি সুন্দর নদীমাতৃক দেশ।";

  return "দারুণ প্রশ্ন! তবে আমার ডাটাবেসে এই প্রশ্নের উত্তরটি দেওয়া নেই। আপনি গল্প, কবিতা বা সাহিত্যের অন্য কোনো বিষয়ে জিজ্ঞাসা করতে পারেন।";
}
