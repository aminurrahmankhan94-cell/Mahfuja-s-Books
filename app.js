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

    // Save User to Firestore
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

// ====== Fetch and Render Articles (With Infinite Loading Fix) ======
db.collection("articles").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => {
    allArticles.push({ id: doc.id, ...doc.data() });
  });
  
  // Hide loader
  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  
  renderArticles();
}, (error) => {
  console.error("Error fetching articles: ", error);
  const loader = document.getElementById('bookLoader');
  if(loader) loader.style.display = 'none';
  document.getElementById('articlesGrid').innerHTML = `<p style="text-align:center; color:#ff4d4d; margin-top:20px;">Database Connection Error! Make sure your Firebase Rules are set to allow read/write.</p>`;
});

function renderArticles() {
  const container = document.getElementById('articlesGrid');
  if(!container) return; // Prevent error on admin page
  
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
  if(event) event.target.classList.add('active');
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
// 🤖 REAL SMART AI CHATBOT (Answers ANY Question)
// ========================================================

// আপনার দেওয়া API Key টি এখানে বসানো হয়েছে
const GEMINI_API_KEY = "AQ.Ab8RN6JyU2TVc_I3y01DmKrMs-S2AwZ2squ0udDZFDiYFsjrSw"; 

function toggleAIChat() {
  const box = document.getElementById('aiChatBox');
  box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function handleChatKey(e) {
  if(e.key === 'Enter') sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const body = document.getElementById('chatBody');
  const query = input.value.trim();
  
  if(!query) return;

  // ইউজারের মেসেজ শো করানো
  body.innerHTML += `<div class="chat-msg user">${escapeHtml(query)}</div>`;
  input.value = '';
  
  // এআই চিন্তা করার এনিমেশন
  const typingId = 'typing-' + Date.now();
  body.innerHTML += `<div id="${typingId}" class="chat-msg bot">Thinking... 🤔</div>`;
  body.scrollTop = body.scrollHeight;

  try {
    // রিয়েল এআই (Gemini) কে কল করা হচ্ছে
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
            parts: [{ text: `You are LitAI, a smart and friendly AI assistant for a website named "Mahfuja's Literature". Answer this question naturally in Bengali or English based on the user's language: ${query}` }] 
        }]
      })
    });

    const data = await response.json();
    
    // এআই এর উত্তর বের করা
    let reply = data.candidates[0].content.parts[0].text;
    
    document.getElementById(typingId).remove();
    
    // টেক্সট ফরম্যাটিং (বোল্ড ও লাইন ব্রেক ঠিক করা)
    reply = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    body.innerHTML += `<div class="chat-msg bot">${reply.replace(/\n/g, "<br>")}</div>`;
    body.scrollTop = body.scrollHeight;

  } catch (error) {
    document.getElementById(typingId).remove();
    body.innerHTML += `<div class="chat-msg bot" style="color:#ff4d4d;">দুঃখিত! সার্ভারে সমস্যা হচ্ছে অথবা আপনার API Key তে কোনো সমস্যা আছে।</div>`;
    console.error("AI Error:", error);
  }
}
