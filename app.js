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

let allArticles = [];
let currentCategory = 'All';

// Load Articles
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
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:30px;">No writings found in this catalog.</p>';
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
            ❤️ <span>${likes} Likes</span>
          </button>
          <button class="action-btn" onclick="toggleComments('${art.id}')">
            💬 <span>${comments.length} Comments</span>
          </button>
        </div>

        <div id="comments-${art.id}" class="comments-container">
          <div class="comment-input-box">
            <input type="text" id="input-name-${art.id}" placeholder="Your Name">
            <input type="text" id="input-text-${art.id}" placeholder="Add a comment...">
            <button class="nav-btn" onclick="addComment('${art.id}')">Post</button>
          </div>
          <div class="comment-list">
            ${comments.map(c => `<div class="comment-item"><strong>${escapeHtml(c.name)}:</strong> ${escapeHtml(c.text)}</div>`).join('')}
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

// Like Functionality
function likePost(id, currentLikes) {
  db.collection("articles").doc(id).update({
    likes: currentLikes + 1
  });
}

// Comments Toggle & Add
function toggleComments(id) {
  const box = document.getElementById(`comments-${id}`);
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function addComment(id) {
  const nameInput = document.getElementById(`input-name-${id}`);
  const textInput = document.getElementById(`input-text-${id}`);
  
  if(!nameInput.value.trim() || !textInput.value.trim()) return alert("Please fill both name and comment!");

  const newComment = {
    name: nameInput.value.trim(),
    text: textInput.value.trim(),
    date: new Date().toISOString()
  };

  db.collection("articles").doc(id).update({
    comments: firebase.firestore.FieldValue.arrayUnion(newComment)
  }).then(() => {
    nameInput.value = '';
    textInput.value = '';
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Floating AI Chatbot Assistant */
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
  const query = input.value.trim().toLowerCase();
  if(!query) return;

  body.innerHTML += `<div class="chat-msg user">${escapeHtml(input.value)}</div>`;
  input.value = '';

  setTimeout(() => {
    let reply = "I am LitAI! I can help you navigate through our stories, poems, and essays.";
    if(query.includes('hello') || query.includes('hi')) reply = "Hello reader! Looking for a specific story or poem today?";
    else if(query.includes('poem') || query.includes('poetry')) reply = `We have ${allArticles.filter(a => a.subject === 'Poem').length} poem(s) in our gallery! Use the 'Poems' tab to read them.`;
    else if(query.includes('story')) reply = `We have ${allArticles.filter(a => a.subject === 'Story').length} story(ies) available.`;
    else if(query.includes('recommend')) reply = allArticles.length > 0 ? `I recommend reading "${allArticles[0].title}" by ${allArticles[0].author || 'the author'}!` : "Add some writings first!";

    body.innerHTML += `<div class="chat-msg bot">${reply}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 500);
}
