// 首页功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取随机语句
    const sentenceElement = document.getElementById('sentence-content');
    const authorElement = document.getElementById('sentence-author');
    const getSentenceBtn = document.getElementById('get-sentence');
    const copyBtn = document.getElementById('copy-btn');

    async function getRandomSentence() {
        try {
            const response = await fetch('/api/random');
            const data = await response.json();
            sentenceElement.textContent = data.sentence;
            authorElement.textContent = `—— ${data.author}`;

            // 根据语句长度调整字体大小
            adjustFontSize(data.sentence);

            // 获取最新统计数据
            updateStats();
        } catch (error) {
            console.error('获取语句失败:', error);
            sentenceElement.textContent = '获取语句失败，请重试...';
            authorElement.textContent = '';
        }
    }

    // 根据语句长度调整字体大小
    function adjustFontSize(text) {
        const length = text.length;
        sentenceElement.classList.remove('short', 'medium', 'long', 'very-long');

        if (length <= 20) {
            sentenceElement.classList.add('short');
        } else if (length <= 50) {
            sentenceElement.classList.add('medium');
        } else if (length <= 100) {
            sentenceElement.classList.add('long');
        } else {
            sentenceElement.classList.add('very-long');
        }
    }

    // 获取真实统计数据
    async function updateStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();

            const totalCount = document.getElementById('total-count');
            const todayCount = document.getElementById('today-count');
            const pendingCount = document.getElementById('pending-count');
            const apiCount = document.getElementById('api-count');

            if (totalCount) totalCount.textContent = data.total_sentences;
            if (todayCount) todayCount.textContent = data.today_views;
            if (pendingCount) pendingCount.textContent = data.pending_sentences;
            if (apiCount) apiCount.textContent = data.today_api_calls;
        } catch (error) {
            console.error('获取统计数据失败:', error);
        }
    }

    // 复制到剪贴板功能 - 修改为只复制语句内容
    function copyToClipboard() {
        const sentence = sentenceElement.textContent;

        // 只复制语句内容，不复制作者
        // 使用现代 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(sentence).then(() => {
                showCopySuccess();
            }).catch(err => {
                console.error('复制失败:', err);
                fallbackCopyToClipboard(sentence);
            });
        } else {
            // 使用传统的 document.execCommand 作为备选
            fallbackCopyToClipboard(sentence);
        }
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // 避免滚动到底部
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopySuccess();
            } else {
                alert('复制失败，请手动复制文本');
            }
        } catch (err) {
            console.error('复制失败:', err);
            alert('复制失败，请手动复制文本');
        }

        document.body.removeChild(textArea);
    }

    function showCopySuccess() {
        // 移除已存在的提示
        const existingNotification = document.querySelector('.copy-success');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新的提示
        const notification = document.createElement('div');
        notification.className = 'copy-success';
        notification.textContent = '✅ 语句已复制到剪贴板！';
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // 初始化
    if (getSentenceBtn) {
        getSentenceBtn.addEventListener('click', getRandomSentence);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }

    // 页面加载时自动获取一句和统计数据
    getRandomSentence();
});

// 管理后台功能
document.addEventListener('DOMContentLoaded', function() {
    const adminSection = document.getElementById('admin-section');
    const loginSection = document.getElementById('login-section');

    // 如果没有管理后台元素，直接返回
    if (!adminSection || !loginSection) {
        return;
    }

    console.log('管理后台脚本已加载');

    let currentFilter = 'all';
    let pendingCount = 0;

    // 检查登录状态
    checkLoginStatus();

    // 登录功能
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password })
                });

                const data = await response.json();
                if (data.success) {
                    // 登录成功，显示管理界面
                    loginSection.style.display = 'none';
                    adminSection.style.display = 'block';
                    loadSentences();
                } else {
                    alert(data.error || '登录失败！');
                }
            } catch (error) {
                console.error('登录失败:', error);
                alert('登录失败，请重试: ' + error.message);
            }
        });
    }

    // 退出登录功能
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('确定要退出登录吗？')) {
                // 清除登录状态
                fetch('/api/admin/logout', { method: 'POST' })
                    .then(() => {
                        // 显示登录界面，隐藏管理界面
                        loginSection.style.display = 'block';
                        adminSection.style.display = 'none';
                        document.getElementById('password').value = '';
                    })
                    .catch(error => {
                        console.error('退出登录失败:', error);
                    });
            }
        });
    }

    // 检查登录状态
    async function checkLoginStatus() {
        try {
            const response = await fetch('/api/admin/check');
            if (response.ok) {
                const data = await response.json();
                if (data.logged_in) {
                    // 已登录，显示管理界面
                    loginSection.style.display = 'none';
                    adminSection.style.display = 'block';
                    loadSentences();
                } else {
                    // 未登录，显示登录界面
                    loginSection.style.display = 'block';
                    adminSection.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            // 默认显示登录界面
            loginSection.style.display = 'block';
            adminSection.style.display = 'none';
        }
    }

    // 加载语句列表
    async function loadSentences() {
        try {
            console.log('正在加载语句...');
            const response = await fetch(`/api/admin/sentences?status=${currentFilter}`);

            if (response.status === 401) {
                // 未授权，显示登录界面
                loginSection.style.display = 'block';
                adminSection.style.display = 'none';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const sentences = await response.json();
            console.log('加载到的语句:', sentences);

            // 更新待审核数量
            pendingCount = sentences.filter(s => s.status === 'pending').length;
            updateApproveAllButton();

            const listElement = document.getElementById('sentences-list');
            if (!listElement) {
                console.error('找不到语句列表元素');
                return;
            }

            listElement.innerHTML = '';

            if (sentences.length === 0) {
                listElement.innerHTML = '<div class="sentence-item">暂无语句</div>';
                return;
            }

            sentences.forEach(sentence => {
                const sentenceElement = createSentenceElement(sentence);
                listElement.appendChild(sentenceElement);
            });
        } catch (error) {
            console.error('加载语句失败:', error);
            alert('加载语句失败: ' + error.message);
        }
    }

    // 更新一键通过按钮状态
    function updateApproveAllButton() {
        const approveAllBtn = document.getElementById('approve-all-btn');
        if (approveAllBtn) {
            if (pendingCount === 0) {
                approveAllBtn.disabled = true;
                approveAllBtn.textContent = '无待审核语句';
                approveAllBtn.style.background = '#6c757d';
            } else {
                approveAllBtn.disabled = false;
                approveAllBtn.textContent = `一键通过 (${pendingCount})`;
                approveAllBtn.style.background = '#28a745';
            }
        }
    }

    // 创建语句元素
    function createSentenceElement(sentence) {
        const div = document.createElement('div');
        div.className = 'sentence-item';
        div.id = `sentence-${sentence.id}`;

        const statusClass = `status-${sentence.status}`;
        const statusText = getStatusText(sentence.status);

        div.innerHTML = `
            <div class="sentence-content-admin">
                <div>${escapeHtml(sentence.content)}</div>
                <div class="sentence-meta">
                    作者: ${escapeHtml(sentence.author)} | 
                    提交时间: ${new Date(sentence.submitted_at).toLocaleString()}
                    ${sentence.reviewed_at ? ` | 审核时间: ${new Date(sentence.reviewed_at).toLocaleString()}` : ''}
                    ${sentence.reviewed_by ? ` | 审核人: ${sentence.reviewed_by}` : ''}
                </div>
            </div>
            <div class="sentence-actions">
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
                ${sentence.status === 'pending' ? `
                    <button class="btn-approve btn-primary" data-id="${sentence.id}">通过</button>
                    <button class="btn-reject btn-secondary" data-id="${sentence.id}">拒绝</button>
                ` : ''}
                <button class="btn-delete btn-danger" data-id="${sentence.id}">删除</button>
            </div>
        `;

        return div;
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': '待审核',
            'approved': '已通过',
            'rejected': '已拒绝'
        };
        return statusMap[status] || status;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 使用事件委托处理审核按钮点击
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('btn-approve')) {
            const id = e.target.getAttribute('data-id');
            await reviewSentence(id, 'approve');
        } else if (e.target.classList.contains('btn-reject')) {
            const id = e.target.getAttribute('data-id');
            await reviewSentence(id, 'reject');
        } else if (e.target.classList.contains('btn-delete')) {
            const id = e.target.getAttribute('data-id');
            await deleteSentence(id);
        }
    });

    async function reviewSentence(id, action) {
        if (!confirm(`确定要${action === 'approve' ? '通过' : '拒绝'}这个语句吗？`)) {
            return;
        }

        try {
            const response = await fetch('/api/admin/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: parseInt(id), action })
            });

            if (response.status === 401) {
                // 未授权，显示登录界面
                loginSection.style.display = 'block';
                adminSection.style.display = 'none';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                alert('操作成功！');
                loadSentences();
            } else {
                alert('操作失败');
            }
        } catch (error) {
            console.error('审核失败:', error);
            alert('操作失败，请重试: ' + error.message);
        }
    }

    // 删除语句函数
    async function deleteSentence(id) {
        if (!confirm('确定要删除这个语句吗？此操作不可撤销！')) {
            return;
        }

        try {
            const response = await fetch('/api/admin/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: parseInt(id) })
            });

            if (response.status === 401) {
                // 未授权，显示登录界面
                loginSection.style.display = 'block';
                adminSection.style.display = 'none';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                alert('删除成功！');
                loadSentences();
            } else {
                alert('删除失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败，请重试: ' + error.message);
        }
    }

    // 筛选功能
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;
            loadSentences();
        });
    });

    // 刷新功能
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadSentences);
    }

    // 添加语句功能
    const addModal = document.getElementById('add-modal');
    const addBtn = document.getElementById('add-sentence-btn');
    const confirmAdd = document.getElementById('confirm-add');
    const cancelAdd = document.getElementById('cancel-add');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            addModal.style.display = 'flex';
        });
    }

    if (cancelAdd) {
        cancelAdd.addEventListener('click', () => {
            addModal.style.display = 'none';
            document.getElementById('new-sentence-content').value = '';
        });
    }

    if (confirmAdd) {
        confirmAdd.addEventListener('click', async () => {
            const content = document.getElementById('new-sentence-content').value.trim();
            if (!content) {
                alert('请输入语句内容');
                return;
            }

            try {
                const response = await fetch('/api/admin/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content })
                });

                if (response.status === 401) {
                    // 未授权，显示登录界面
                    loginSection.style.display = 'block';
                    adminSection.style.display = 'none';
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success) {
                    addModal.style.display = 'none';
                    document.getElementById('new-sentence-content').value = '';
                    alert('添加成功！');
                    loadSentences();
                } else {
                    alert('添加失败: ' + (data.error || '未知错误'));
                }
            } catch (error) {
                console.error('添加失败:', error);
                alert('添加失败，请重试: ' + error.message);
            }
        });
    }

    // 一键通过功能
    const approveAllBtn = document.getElementById('approve-all-btn');
    const approveAllModal = document.getElementById('approve-all-modal');
    const confirmApproveAll = document.getElementById('confirm-approve-all');
    const cancelApproveAll = document.getElementById('cancel-approve-all');

    if (approveAllBtn) {
        approveAllBtn.addEventListener('click', () => {
            if (pendingCount === 0) {
                alert('当前没有待审核的语句');
                return;
            }

            // 更新模态框中的待审核数量
            document.getElementById('pending-count').textContent = pendingCount;
            approveAllModal.style.display = 'flex';
        });
    }

    if (cancelApproveAll) {
        cancelApproveAll.addEventListener('click', () => {
            approveAllModal.style.display = 'none';
        });
    }

    if (confirmApproveAll) {
        confirmApproveAll.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/admin/approve-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 401) {
                    // 未授权，显示登录界面
                    loginSection.style.display = 'block';
                    adminSection.style.display = 'none';
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success) {
                    approveAllModal.style.display = 'none';
                    alert(`成功通过 ${data.approved_count} 条语句！`);
                    loadSentences();
                } else {
                    alert('一键通过失败: ' + (data.error || '未知错误'));
                }
            } catch (error) {
                console.error('一键通过失败:', error);
                alert('一键通过失败，请重试: ' + error.message);
            }
        });
    }

    // 点击模态框外部关闭
    if (addModal) {
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) {
                addModal.style.display = 'none';
            }
        });
    }

    if (approveAllModal) {
        approveAllModal.addEventListener('click', (e) => {
            if (e.target === approveAllModal) {
                approveAllModal.style.display = 'none';
            }
        });
    }
});