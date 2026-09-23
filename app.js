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
    loginBtn.style.display = 'none';
    userBadge.style.display = 'flex';
    document.getElementById('userName').innerText = user.displayName.split(' ')[0];
    document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/30';
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

// ====== Fetch and Render Articles ======
db.collection("articles").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => {
    allArticles.push({ id: doc.id, ...doc.data() });
  });
  document.getElementById('bookLoader').style.display = 'none';
  renderArticles();
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

document.getElementById('searchInput').addEventListener('input', renderArticles);

// ====== Likes & Comments ======
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
// 🤖 UPGRADED SMART AI CHATBOT (Answers All Questions)
// ========================================================

// [OPTIONAL] Put your Google Gemini API Key here to make it truly answer EVERYTHING!
// Get free key from: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 

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

  // Append user message
  body.innerHTML += `<div class="chat-msg user">${escapeHtml(query)}</div>`;
  input.value = '';
  
  // Show typing indicator
  const typingId = 'typing-' + Date.now();
  body.innerHTML += `<div id="${typingId}" class="chat-msg bot">Thinking...</div>`;
  body.scrollTop = body.scrollHeight;

  try {
    let reply = "";

    // If you haven't put an API Key, it uses an advanced simulated system.
    if(GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
       reply = getSimulatedSmartAnswer(query.toLowerCase());
    } else {
       // REAL AI API CALL (Google Gemini)
       const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             contents: [{ parts: [{ text: "You are LitAI, an assistant for Mahfuja's Literature website. " + query }] }]
          })
       });
       const data = await response.json();
       reply = data.candidates[0].content.parts[0].text;
    }

    // Remove typing indicator and show real message
    document.getElementById(typingId).remove();
    // Format bold text from AI (markdown to basic HTML)
    reply = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    body.innerHTML += `<div class="chat-msg bot">${reply.replace(/\n/g, "<br>")}</div>`;
    body.scrollTop = body.scrollHeight;

  } catch (error) {
    document.getElementById(typingId).remove();
    body.innerHTML += `<div class="chat-msg bot">Sorry, my servers are taking a break! Try again.</div>`;
  }
}

// Fallback logic if API key is not added yet
function getSimulatedSmartAnswer(q) {
  if (q.includes('hello') || q.includes('hi')) return "Hello! Welcome to Mahfuja's Literature. Ask me any question!";
  if (q.includes('who are you') || q.includes('name')) return "I am Smart LitAI, your virtual assistant for Mahfuja's Literature.";
  if (q.includes('poem')) return `We have ${allArticles.filter(a => a.subject === 'Poem').length} poem(s) right now. Read them from the Poems tab!`;
  if (q.includes('story')) return `We have ${allArticles.filter(a => a.subject === 'Story').length} story(ies) available.`;
  if (q.includes('mahfuja')) return "Mahfuja is the brilliant mind behind this literature platform!";
  if (q.includes('love')) return "Love is a popular theme in literature. Romeo and Juliet by Shakespeare is a classic example. Are you looking for romantic stories?";
  if (q.includes('science') || q.includes('history')) return "Science and History are vast topics! Did you know the first science fiction novel is often considered to be Mary Shelley's 'Frankenstein' (1818)?";
  if (q.includes('capital of')) return "If you're asking a general knowledge question, I'm pretty smart! For example, the capital of Bangladesh is Dhaka, and France is Paris. (Add an API key to unlock my full brain!)";
  if (q.includes('how to write')) return "To write a good piece, start with a strong hook, build relatable characters, and write from the heart. Consistency is key!";
  
  return "That's a very interesting question! While I am currently a limited local assistant, I am designed to assist you with everything related to Mahfuja's Literature. (Dev Note: Add the Gemini API Key in app.js to enable real AI answers to ANY question!)";
}
