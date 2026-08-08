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

db.collection("articles").orderBy("createdAt", "desc").get().then((snapshot) => {
  allArticles = [];
  snapshot.forEach((doc) => {
    allArticles.push({ id: doc.id, ...doc.data() });
  });
  renderArticles(allArticles);
}).catch((err) => {
  document.getElementById('articlesList').innerHTML = `<p style="text-align:center; color:red;">লেখা লোড করতে সমস্যা হয়েছে: ${err.message}</p>`;
});

function renderArticles(articles) {
  const list = document.getElementById('articlesList');
  list.innerHTML = '';

  if (articles.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:20px;">কোনো লেখা পাওয়া যায়নি।</p>';
    return;
  }

  articles.forEach(art => {
    list.innerHTML += `
      <div class="article-card">
        <h2 class="article-title">${escapeHtml(art.title)}</h2>
        <span class="tag">📌 বিষয়: ${escapeHtml(art.subject)}</span>
        <div class="article-content">${escapeHtml(art.content)}</div>
      </div>
    `;
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  const text = e.target.value.toLowerCase();
  const filtered = allArticles.filter(art => 
    art.title.toLowerCase().includes(text) || 
    art.subject.toLowerCase().includes(text) ||
    art.content.toLowerCase().includes(text)
  );
  renderArticles(filtered);
});
