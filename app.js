import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAGZXbY2mUnBMfqfJWDDnYNPRfChL38JG0",
  authDomain: "imageboard-web-a7a75.firebaseapp.com",
  projectId: "imageboard-web-a7a75",
  storageBucket: "imageboard-web-a7a75.firebasestorage.app",
  messagingSenderId: "270447305738",
  appId: "1:270447305738:web:dc4ff28bb2b5c925b66bf3",
  measurementId: "G-JCSX5M5S5D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

/* ----- Initialize Firebase (compat libs used in HTML) ----- */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

/* Helper: random filename */
function randomFilename(origName){
  const ext = (origName || '').split('.').pop().toLowerCase();
  const base = Math.random().toString(36).slice(2,12);
  return `${base}.${ext}`;
}

/* Helper: push image to storage and return download URL */
async function uploadImage(file){
  if (!file) return null;
  const name = 'images/' + randomFilename(file.name);
  const ref = storage.ref().child(name);
  await ref.put(file); // upload
  const url = await ref.getDownloadURL();
  return { url, path: name };
}

/* ---------- INDEX PAGE LOGIC ---------- */
if (document.getElementById('threads-list')) {
  const threadsList = document.getElementById('threads-list');
  const form = document.getElementById('thread-form');
  const status = document.getElementById('thread-status');
  const submitBtn = document.getElementById('thread-submit');

  // Real-time list of threads (most recent first)
  db.collection('threads').orderBy('created_at', 'desc').limit(100)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        threadsList.innerHTML = '<div class="muted">No threads yet.</div>';
        return;
      }
      const html = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const id = doc.id;
        const subject = d.subject || '(no subject)';
        const ts = d.created_at && d.created_at.toDate ? d.created_at.toDate().toLocaleString() : '';
        const replies = d.replies_count || 0;
        html.push(`
          <div class="thread-item">
            <div>
              <h3><a class="small-link" href="thread.html?id=${id}">${escapeHtml(subject)}</a></h3>
              <div class="thread-meta">${ts}</div>
            </div>
            <div class="thread-meta">Replies: ${replies}</div>
          </div>
        `);
      });
      threadsList.innerHTML = html.join('');
    }, err => {
      threadsList.innerHTML = `<div class="muted">Error loading threads: ${err.message}</div>`;
    });

  // On create thread
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    submitBtn.disabled = true;
    status.textContent = 'Posting...';
    try {
      const name = (document.getElementById('thread-name').value || '').trim().slice(0,64);
      const subject = (document.getElementById('thread-subject').value || '').trim().slice(0,200);
      const body = (document.getElementById('thread-body').value || '').trim().slice(0,2000);
      const file = document.getElementById('thread-image').files[0] || null;

      // optional small client-side validation
      if (!body) throw new Error('Comment required');

      // upload image if exists
      let image = null;
      if (file) {
        status.textContent = 'Uploading image...';
        const up = await uploadImage(file);
        image = up;
      }

      status.textContent = 'Saving thread...';

      // Create thread doc
      const threadRef = await db.collection('threads').add({
        subject: subject || '',
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        // simple cached count for display (updated below)
        replies_count: 1
      });

      // create first post in subcollection 'posts'
      await db.collection('threads').doc(threadRef.id).collection('posts').add({
        name: name || 'Anonymous',
        body,
        image_url: image ? image.url : null,
        image_path: image ? image.path : null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        ip: null
      });

      // reset form
      form.reset();
      status.textContent = 'Posted — redirecting...';
      // go to thread view
      window.location.href = `thread.html?id=${threadRef.id}`;
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------- THREAD PAGE LOGIC ---------- */
if (document.getElementById('posts-list')) {
  const urlParams = new URLSearchParams(window.location.search);
  const threadId = urlParams.get('id');
  if (!threadId) {
    document.getElementById('posts-list').innerHTML = '<div class="muted">Missing thread id.</div>';
  } else {
    const threadDoc = db.collection('threads').doc(threadId);
    const postsList = document.getElementById('posts-list');
    const headSubject = document.getElementById('thread-subject');
    const headMeta = document.getElementById('thread-meta');

    // load thread info
    threadDoc.get().then(snap => {
      if (!snap.exists) {
        headSubject.textContent = 'Thread not found';
        postsList.innerHTML = '<div class="muted">Thread not found.</div>';
        return;
      }
      const d = snap.data();
      headSubject.textContent = d.subject || `Thread #${snap.id}`;
      const ts = d.created_at && d.created_at.toDate ? d.created_at.toDate().toLocaleString() : '';
      headMeta.textContent = 'Created: ' + ts;
    });

    // realtime posts
    threadDoc.collection('posts').orderBy('created_at', 'asc')
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
          postsList.innerHTML = '<div class="muted">No posts yet.</div>';
          return;
        }
        const html = [];
        snapshot.forEach(doc => {
          const p = doc.data();
          const name = escapeHtml(p.name || 'Anonymous');
          const body = escapeHtml(p.body || '');
          const ts = p.created_at && p.created_at.toDate ? p.created_at.toDate().toLocaleString() : '';
          const image = p.image_url ? `<a href="${p.image_url}" target="_blank" rel="noopener noreferrer"><img src="${p.image_url}" alt="image"></a>` : '';
          html.push(`<div class="post"><div class="post-meta"><strong>${name}</strong> · <span class="muted">${ts}</span></div><div class="post-body">${nl2br(body)}</div>${image}</div>`);
        });
        postsList.innerHTML = html.join('');
      }, err => {
        postsList.innerHTML = `<div class="muted">Error loading posts: ${err.message}</div>`;
      });

    // reply form
    const replyForm = document.getElementById('reply-form');
    const replyStatus = document.getElementById('reply-status');
    const replyBtn = document.getElementById('reply-submit');

    replyForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      replyBtn.disabled = true;
      replyStatus.textContent = 'Posting...';
      try {
        const name = (document.getElementById('reply-name').value || '').trim().slice(0,64);
        const body = (document.getElementById('reply-body').value || '').trim().slice(0,2000);
        const file = document.getElementById('reply-image').files[0] || null;
        if (!body) throw new Error('Comment required');

        let image = null;
        if (file) {
          replyStatus.textContent = 'Uploading image...';
          image = await uploadImage(file);
        }

        // add post
        await db.collection('threads').doc(threadId).collection('posts').add({
          name: name || 'Anonymous',
          body,
          image_url: image ? image.url : null,
          image_path: image ? image.path : null,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        // increment replies_count atomically (optional, used on index)
        await db.collection('threads').doc(threadId).update({
          replies_count: firebase.firestore.FieldValue.increment(1)
        });

        replyForm.reset();
        replyStatus.textContent = 'Posted';
      } catch (err) {
        replyStatus.textContent = 'Error: ' + err.message;
        console.error(err);
      } finally {
        replyBtn.disabled = false;
      }
    });
  }
}

/* ------- small helpers ------- */
function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, function(m){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}
function nl2br(text){
  return text.replace(/\n/g, '<br>');
}




