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
});

function renderArticles(articles) {
  const list = document.getElementById('articlesList');
  list.innerHTML = '';

  if (articles.length === 0) {
    list.innerHTML = '<p style="text-align:center;">কোনো লেখা পাওয়া যায়নি।</p>';
    return;
  }

  articles.forEach(art => {
    list.innerHTML += `
      <div class="card">
        <h2>${art.title}</h2>
        <span class="tag">বিষয়: ${art.subject}</span>
        <p style="white-space: pre-line; margin-top:15px;">${art.content}</p>
      </div>
    `;
  });
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
