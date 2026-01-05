// 1. إعدادات الربط مع Supabase
const SUPABASE_URL = 'https://uojdargxeabqrxwkholc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aSK7IixHMKoHTVhxlx5DYA_u9N13C3D';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. عناصر الصفحة
const galleryGrid = document.getElementById('gallery-grid');
const categoriesList = document.getElementById('categories-list');
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const commentsContainer = document.getElementById('comments-list');

// متغير لتخزين ID الصورة المفتوحة حالياً
let currentOpenImageId = null;

// 3. فتح وقفل القائمة
function toggleMenu() {
    categoriesList.classList.toggle('hidden');
}

// 4. جلب الصور
async function fetchImages(categoryFilter = 'all') {
    galleryGrid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>جاري تحميل إبداعات طارق...</p>
        </div>`;
    
    let query = _supabase.from('images').select('*');

    if (categoryFilter !== 'all') {
        query = query.eq('main_type', categoryFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        galleryGrid.innerHTML = '<p class="error-text">عذراً، حدث خطأ أثناء التحميل.</p>';
        return;
    }

    displayImages(data);
}

// 5. عرض الصور في الشبكة (Grid)
function displayImages(images) {
    galleryGrid.innerHTML = '';
    
    if (!images || images.length === 0) {
        galleryGrid.innerHTML = '<p class="empty-text">لا توجد صور في هذا القسم حالياً.</p>';
        return;
    }

    images.forEach(img => {
        const item = document.createElement('div');
        item.className = 'image-item fade-in';
        item.innerHTML = `
            <img src="${img.url}" alt="${img.title}" loading="lazy">
            <div class="img-overlay">
                <div class="overlay-content">
                    <span>${img.title || 'عرض التفاصيل'}</span>
                    <div class="quick-stats">
                        <i class="fa-solid fa-heart"></i> ${img.likes_count || 0}
                    </div>
                </div>
            </div>`;
        item.onclick = () => openModal(img);
        galleryGrid.appendChild(item);
    });
}

// 6. التحكم في الـ Modal والتعليقات والمفضلة
async function openModal(img) {
    currentOpenImageId = img.id; // حفظ الـ ID للتعليق عليه لاحقاً
    modal.classList.add('active');
    modal.style.display = "flex";
    modalImg.src = img.url;
    modalTitle.innerText = img.title || 'بدون عنوان';
    modalDesc.innerText = img.description || 'لا يوجد وصف متاح.';
    
    // تحديث عداد اللايكات في المودال
    updateLikeButtonUI(img.id, img.likes_count || 0);

    document.body.style.overflow = "hidden";
    loadComments(img.id);
}

// --- ميزة المفضلة (اللايك) ---
async function handleLike() {
    if (!currentOpenImageId) return;

    // 1. تأثير بصري سريع
    const heartIcon = document.querySelector('.modal-actions .fa-heart');
    heartIcon.classList.replace('fa-regular', 'fa-solid');
    heartIcon.parentElement.style.color = "#ff4d4d";

    // 2. تحديث قاعدة البيانات (يفضل استخدام RPC في سوباباز لزيادة الرقم بـ 1)
    // حالياً سنقوم بجلب الرقم وزيادته ببساطة:
    const { data } = await _supabase.from('images').select('likes_count').eq('id', currentOpenImageId).single();
    const newCount = (data.likes_count || 0) + 1;

    await _supabase.from('images').update({ likes_count: newCount }).eq('id', currentOpenImageId);
    
    // تحديث الرقم في الواجهة
    document.getElementById('modal-like-count').innerText = newCount;
}

function updateLikeButtonUI(id, count) {
    // تأكد إن عندك عنصر في الـ HTML بتاع المودال شايل الرقم ده
    const likeSection = document.getElementById('modal-likes');
    if (likeSection) {
        likeSection.innerHTML = `
            <button class="action-btn" onclick="handleLike()">
                <i class="fa-regular fa-heart"></i> <span id="modal-like-count">${count}</span>
            </button>
        `;
    }
}

// --- ميزة التعليقات ---
async function loadComments(imageId) {
    commentsContainer.innerHTML = '<p>جاري جلب التعليقات...</p>';
    
    const { data: comments, error } = await _supabase
        .from('comments')
        .select('*')
        .eq('image_id', imageId)
        .order('created_at', { ascending: true });

    if (error || !comments || comments.length === 0) {
        commentsContainer.innerHTML = '<p class="no-comments">لا توجد تعليقات بعد. كن أول من يعلق!</p>';
        return;
    }

    commentsContainer.innerHTML = comments.map(c => `
        <div class="comment">
            <strong>${c.username}</strong>
            <p>${c.content}</p>
        </div>
    `).join('');
}

async function addComment() {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    
    if (!content || !currentOpenImageId) return;

    // طلب اسم المستخدم لو مش موجود (اختياري)
    const username = prompt("ادخل اسمك:") || "زائر";

    const { error } = await _supabase.from('comments').insert([
        { image_id: currentOpenImageId, content: content, username: username }
    ]);

    if (!error) {
        input.value = '';
        loadComments(currentOpenImageId);
    } else {
        alert("عذراً، فشل إرسال التعليق.");
    }
}

function closeModal() {
    modal.style.display = "none";
    modal.classList.remove('active');
    document.body.style.overflow = "auto";
    currentOpenImageId = null;
}

// 7. ميزة المشاركة
function shareImage() {
    const url = modalImg.src;
    if (navigator.share) {
        navigator.share({
            title: modalTitle.innerText,
            url: url
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        alert('تم نسخ رابط الصورة!');
    }
}

// 8. الفلترة
function filterImages(type) {
    document.querySelectorAll('#categories-list li').forEach(li => li.classList.remove('active'));
    // البحث عن العنصر الذي تم الضغط عليه وتفعيله
    if (event) event.target.classList.add('active');
    
    fetchImages(type);
    if (!categoriesList.classList.contains('hidden')) toggleMenu();
}

// التشغيل الابتدائي
document.addEventListener('DOMContentLoaded', () => fetchImages('all'));