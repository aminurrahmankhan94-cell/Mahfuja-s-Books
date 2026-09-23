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

// ====== Google Authentication & Save User Data ======
auth.onAuthStateChanged((user) => {
  currentUser = user;
  const loginBtn = document.getElementById('loginBtn');
  const userBadge = document.getElementById('userBadge');

  if (user) {
    loginBtn.style.display = 'none';
    userBadge.style.display = 'flex';
    document.getElementById('userName').innerText = user.displayName.split(' ')[0];
    document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/30';

    // রিডার লগিন করলে তার ডাটা আপনার ডাটাবেসে 'users' কালেকশনে সেভ হবে
    db.collection("users").doc(user.uid).set({
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
      lastLogin: new Date().toISOString()
    }, { merge: true });

  } else {
    loginBtn.style.display = 'block';
    userBadge.style.display = 'none';
  }
});

function googleSignIn() {
  auth.signInWithPopup(googleProvider).catch((error) => {
    alert("Sign-in Failed: " + error.message);
  });
}

function googleSignOut() {
  auth.signOut();
}

// ====== Fetch and Render Articles (With Error Fix) ======
db.collection("articles").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => {
    allArticles.push({ id: doc.id, ...doc.data() });
  });
  
  // লোডিং এনিমেশন বন্ধ করা
  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  
  renderArticles();
}, (error) => {
  console.error("Error fetching articles: ", error);
  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  document.getElementById('articlesGrid').innerHTML = `<p style="text-align:center; color:#ff4d4d;">Database Error! Please check Firebase Rules.</p>`;
});

function renderArticles() {
  const container = document.getElementById('articlesGrid');
  const searchText = document.getElementById('searchInput').value.toLowerCase();
  
  container.innerHTML = '';

  const filtered = allArticles.filter(art => {
    const matchesCat = currentCategory === 'All' || (art.subject && art.subject.toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = art.title.toLowerCase().includes(searchText) || 
                          (art.author && art.author.toLowerCase().includes(searchText)) ||
                          (art.content && art.content.toLowerCase().includes(searchText));
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:40px; font-size:18px;">No writings found here.</p>';
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
        <div class="author-name">By ${escapeHtml(art.author || 'Anonymous Author')}</div>
        <div class="article-body">${escapeHtml(art.content)}</div>
        
        <div class="card-actions">
          <button class="action-btn" onclick="likePost('${art.id}', ${likes})">
            🤍 <span>${likes} Likes</span>
          </button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">
            💬 <span>${comments.length} Comments</span>
          </button>
        </div>

        <div id="comments-${art.id}" class="comments-container">
          <div class="comment-input-box">
            <input type="text" id="input-text-${art.id}" placeholder="${currentUser ? 'Add a public comment...' : 'Sign in to comment'}">
            <button class="btn-primary" onclick="addComment('${art.id}')">Post</button>
          </div>
          <div class="comment-list">
            ${comments.map(c => `
              <div class="comment-item">
                <span><strong class="comment-user">${escapeHtml(c.name)}:</strong>${escapeHtml(c.text)}</span>
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
  event.target.classList.add('active');
  renderArticles();
}

if(document.getElementById('searchInput')){
  document.getElementById('searchInput').addEventListener('input', renderArticles);
}

function likePost(id, currentLikes) {
  if (!currentUser) {
    if(confirm("Please Sign-In with Google to Like! Would you like to sign in now?")) googleSignIn();
    return;
  }
  db.collection("articles").doc(id).update({ likes: currentLikes + 1 });
}

function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function addComment(id) {
  if (!currentUser) {
    if(confirm("Please Sign-In to Comment! Would you like to sign in now?")) googleSignIn();
    return;
  }
  const textInput = document.getElementById(`input-text-${id}`);
  if (!textInput.value.trim()) return alert("Please enter a comment!");

  const newComment = {
    name: currentUser.displayName || "Reader",
    uid: currentUser.uid,
    text: textInput.value.trim(),
    createdAt: new Date().toISOString()
  };

  db.collection("articles").doc(id).update({
    comments: firebase.firestore.FieldValue.arrayUnion(newComment)
  }).then(() => { textInput.value = ''; });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ========================================================
// 🤖 SMART AI CHATBOT
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
    let reply = getSimulatedSmartAnswer(query.toLowerCase());
    document.getElementById(typingId).remove();
    body.innerHTML += `<div class="chat-msg bot">${reply.replace(/\n/g, "<br>")}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 1000);
}

function getSimulatedSmartAnswer(q) {
  if (q.includes('hello') || q.includes('hi') || q.includes('হ্যালো') || q.includes('হাই')) return "হ্যালো! Mahfuja's Literature-এ আপনাকে স্বাগতম। আমি আপনাকে কীভাবে সাহায্য করতে পারি?";
  if (q.includes('কে তুমি') || q.includes('who are you') || q.includes('name')) return "আমি LitAI, Mahfuja's Literature এর ভার্চুয়াল অ্যাসিস্ট্যান্ট। আমি সাহিত্যের বিভিন্ন বিষয়ে আপনাকে সাহায্য করতে পারি।";
  if (q.includes('কবিতা') || q.includes('poem')) return "আমাদের ওয়েবসাইটে অনেক সুন্দর সুন্দর কবিতা আছে। আপনি উপরের 'Poems' ট্যাবে ক্লিক করে সেগুলো পড়তে পারেন।";
  if (q.includes('গল্প') || q.includes('story')) return "গল্প পড়তে ভালোবাসেন? আমাদের 'Stories' সেকশনে ঘুরে আসুন, সেখানে অনেক চমৎকার গল্প আছে।";
  if (q.includes('mahfuja') || q.includes('মাহফুজা')) return "মাহফুজা হলেন এই চমৎকার সাহিত্য প্ল্যাটফর্মটির প্রতিষ্ঠাতা এবং মূল কারিগর!";
  if (q.includes('ভালোবাসা') || q.includes('love')) return "ভালোবাসা সাহিত্যের অন্যতম প্রধান বিষয়। রোমিও-জুলিয়েট থেকে শুরু করে রবীন্দ্রনাথের শেষের কবিতা—সবখানেই ভালোবাসার জয়জয়কার।";
  if (q.includes('কষ্ট') || q.includes('sad')) return "কষ্ট থেকেই অনেক মহৎ সাহিত্যের জন্ম হয়। আপনি চাইলে আমাদের সাইটে কিছু বিরহের কবিতাও খুঁজে দেখতে পারেন।";
  
  return "খুব সুন্দর একটি প্রশ্ন! আমি এই ওয়েবসাইটের একজন আর্টিফিশিয়াল ইন্টেলিজেন্স। আমি আপনার ওয়েবসাইটের গল্প, কবিতা এবং সাধারণ সাহিত্যের বিষয়ে সাহায্য করার জন্য তৈরি হয়েছি।";
}
