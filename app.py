from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import sqlite3
import os
import random
from datetime import datetime, date
import hashlib

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'
CORS(app)

# 管理员密码
ADMIN_PASSWORD = "your-password-here"


# 数据库初始化
def init_db():
    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 创建语句表 - 添加author字段
    c.execute('''
        CREATE TABLE IF NOT EXISTS sentences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            author TEXT DEFAULT '匿名',
            status TEXT DEFAULT 'pending',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME,
            reviewed_by TEXT,
            content_hash TEXT UNIQUE  -- 用于查重
        )
    ''')

    # 创建访问统计表
    c.execute('''
        CREATE TABLE IF NOT EXISTS page_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            view_date DATE NOT NULL,
            view_count INTEGER DEFAULT 0,
            UNIQUE(view_date)
        )
    ''')

    # 创建API访问统计表
    c.execute('''
        CREATE TABLE IF NOT EXISTS api_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            access_date DATE NOT NULL,
            api_count INTEGER DEFAULT 0,
            UNIQUE(access_date)
        )
    ''')

    # 插入示例数据
    c.execute("SELECT COUNT(*) FROM sentences WHERE status='approved'")
    if c.fetchone()[0] == 0:
        sample_sentences = [
            ("生活就像一盒巧克力，你永远不知道下一颗是什么味道。", "阿甘正传"),
            ("成功的秘诀在于对目标的执着追求。", "爱迪生"),
            ("每一天都是新的开始，抓住机会，创造精彩。", "匿名"),
            ("知识就是力量，学习改变命运。", "培根"),
            ("坚持就是胜利，不要轻言放弃。", "拿破仑"),
            ("微笑是世界上最美的语言。", "佚名"),
            ("梦想还是要有的，万一实现了呢？", "马云"),
            ("时间是最好的老师，但遗憾的是，它会把所有的学生都杀死。", "佚名"),
            ("活在当下，珍惜眼前。", "匿名")
        ]
        for content, author in sample_sentences:
            content_hash = hashlib.md5(content.strip().encode('utf-8')).hexdigest()
            c.execute("INSERT INTO sentences (content, author, status, content_hash) VALUES (?, ?, 'approved', ?)",
                      (content, author, content_hash))

    conn.commit()
    conn.close()


def update_page_view():
    """更新页面访问统计"""
    today = date.today().isoformat()
    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 尝试更新或插入当天的访问统计
    c.execute("INSERT OR IGNORE INTO page_views (view_date, view_count) VALUES (?, 0)", (today,))
    c.execute("UPDATE page_views SET view_count = view_count + 1 WHERE view_date = ?", (today,))

    conn.commit()
    conn.close()


def update_api_usage():
    """更新API使用统计"""
    today = date.today().isoformat()
    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 尝试更新或插入当天的API使用统计
    c.execute("INSERT OR IGNORE INTO api_usage (access_date, api_count) VALUES (?, 0)", (today,))
    c.execute("UPDATE api_usage SET api_count = api_count + 1 WHERE access_date = ?", (today,))

    conn.commit()
    conn.close()


def check_duplicate(content):
    """检查内容是否重复"""
    content_hash = hashlib.md5(content.strip().encode('utf-8')).hexdigest()
    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM sentences WHERE content_hash = ?", (content_hash,))
    count = c.fetchone()[0]

    conn.close()
    return count > 0


@app.route('/')
def index():
    """首页 - 显示随机语句"""
    update_page_view()  # 更新访问统计
    return render_template('index.html')


@app.route('/api/random')
def get_random_sentence():
    """获取随机审核通过的语句"""
    update_api_usage()  # 更新API使用统计

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()
    c.execute("SELECT content, author FROM sentences WHERE status='approved' ORDER BY RANDOM() LIMIT 1")
    result = c.fetchone()
    conn.close()

    if result:
        return jsonify({
            'sentence': result[0],
            'author': result[1]
        })
    else:
        return jsonify({
            'sentence': '暂无语句，欢迎提交！',
            'author': '系统'
        })


@app.route('/api/random/<int:count>')
def get_multiple_random_sentences(count):
    """获取多个随机语句"""
    update_api_usage()  # 更新API使用统计

    # 限制最大数量
    if count > 50:
        count = 50
    if count < 1:
        count = 1

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()
    c.execute("SELECT content, author FROM sentences WHERE status='approved' ORDER BY RANDOM() LIMIT ?", (count,))
    results = c.fetchall()
    conn.close()

    sentences = []
    for content, author in results:
        sentences.append({
            'content': content,
            'author': author
        })

    return jsonify({
        'count': len(sentences),
        'sentences': sentences
    })


@app.route('/api/stats')
def get_stats():
    """获取统计数据"""
    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 获取总语句数
    c.execute("SELECT COUNT(*) FROM sentences WHERE status='approved'")
    total_sentences = c.fetchone()[0]

    # 获取今日访问量
    today = date.today().isoformat()
    c.execute("SELECT view_count FROM page_views WHERE view_date = ?", (today,))
    result = c.fetchone()
    today_views = result[0] if result else 0

    # 获取待审核语句数
    c.execute("SELECT COUNT(*) FROM sentences WHERE status='pending'")
    pending_sentences = c.fetchone()[0]

    # 获取今日API调用次数
    c.execute("SELECT api_count FROM api_usage WHERE access_date = ?", (today,))
    result = c.fetchone()
    today_api_calls = result[0] if result else 0

    conn.close()

    return jsonify({
        'total_sentences': total_sentences,
        'today_views': today_views,
        'pending_sentences': pending_sentences,
        'today_api_calls': today_api_calls
    })


@app.route('/submit', methods=['GET', 'POST'])
def submit_sentence():
    """用户提交新语句"""
    if request.method == 'POST':
        content = request.form.get('content', '').strip()
        author = request.form.get('author', '').strip()

        # 验证数据
        errors = []

        # 检查内容长度
        if len(content) == 0:
            errors.append('请输入语句内容')
        elif len(content) > 2000:
            errors.append('语句内容不能超过2000字')

        # 检查作者长度
        if len(author) > 50:
            errors.append('署名不能超过50字')

        # 检查是否重复
        if content and check_duplicate(content):
            errors.append('该语句已存在，请勿重复提交')

        if not errors:
            # 处理作者信息
            if not author:
                author = '匿名'

            # 生成内容哈希
            content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()

            # 保存到数据库
            conn = sqlite3.connect('sentences.db')
            c = conn.cursor()
            c.execute("INSERT INTO sentences (content, author, status, content_hash) VALUES (?, ?, 'pending', ?)",
                      (content, author, content_hash))
            conn.commit()
            conn.close()

            # 提交成功后，保留署名但清空内容
            return render_template('submit.html', success=True, errors=[])

        # 如果有错误，返回表单并保留用户输入
        return render_template('submit.html', success=False, errors=errors)

    return render_template('submit.html', success=False, errors=[])


@app.route('/admin/login', methods=['POST'])
def admin_login():
    """管理员登录"""
    password = request.json.get('password')
    if password == ADMIN_PASSWORD:
        session['admin'] = True
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': '密码错误'})


@app.route('/admin')
def admin_panel():
    """管理员面板"""
    return render_template('admin.html')


@app.route('/api/admin/check')
def check_admin_login():
    """检查管理员登录状态"""
    if session.get('admin'):
        return jsonify({'logged_in': True})
    else:
        return jsonify({'logged_in': False})


@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """管理员退出登录"""
    session.pop('admin', None)
    return jsonify({'success': True})


@app.route('/api/admin/sentences')
def get_all_sentences():
    """获取所有语句（管理员用）"""
    if not session.get('admin'):
        return jsonify({'error': 'Unauthorized'}), 401

    status_filter = request.args.get('status', 'all')

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    if status_filter == 'all':
        c.execute("SELECT * FROM sentences ORDER BY submitted_at DESC")
    else:
        c.execute("SELECT * FROM sentences WHERE status=? ORDER BY submitted_at DESC", (status_filter,))

    sentences = []
    for row in c.fetchall():
        sentences.append({
            'id': row[0],
            'content': row[1],
            'author': row[2],
            'status': row[3],
            'submitted_at': row[4],
            'reviewed_at': row[5],
            'reviewed_by': row[6],
            'content_hash': row[7]
        })

    conn.close()
    return jsonify(sentences)


@app.route('/api/admin/review', methods=['POST'])
def review_sentence():
    """审核语句"""
    if not session.get('admin'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    sentence_id = data.get('id')
    action = data.get('action')  # 'approve' or 'reject'

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    if action == 'approve':
        c.execute("UPDATE sentences SET status='approved', reviewed_at=?, reviewed_by='admin' WHERE id=?",
                  (datetime.now(), sentence_id))
    elif action == 'reject':
        c.execute("UPDATE sentences SET status='rejected', reviewed_at=?, reviewed_by='admin' WHERE id=?",
                  (datetime.now(), sentence_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/admin/add', methods=['POST'])
def add_sentence():
    """管理员直接添加语句"""
    if not session.get('admin'):
        return jsonify({'error': 'Unauthorized'}), 401

    content = request.json.get('content')
    author = request.json.get('author', '匿名')

    if content:
        # 检查重复
        if check_duplicate(content):
            return jsonify({'success': False, 'error': '该语句已存在'})

        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()

        conn = sqlite3.connect('sentences.db')
        c = conn.cursor()
        c.execute("INSERT INTO sentences (content, author, status, content_hash) VALUES (?, ?, 'approved', ?)",
                  (content, author, content_hash))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    return jsonify({'success': False})


@app.route('/api/admin/delete', methods=['POST'])
def delete_sentence():
    """删除语句"""
    if not session.get('admin'):
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    sentence_id = data.get('id')

    if not sentence_id:
        return jsonify({'success': False, 'error': '缺少语句ID'})

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    try:
        c.execute("DELETE FROM sentences WHERE id = ?", (sentence_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)})


# API文档页面
@app.route('/api/docs')
def api_docs():
    """API文档页面"""
    return render_template('api_docs.html')


@app.route('/leaderboard')
def leaderboard():
    """排行榜页面"""
    return render_template('leaderboard.html')


@app.route('/api/leaderboard')
def get_leaderboard():
    """获取提交排行榜数据 - 只统计已通过的语句"""
    limit = request.args.get('limit', 20, type=int)

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 获取已通过审核的语句中提交数最多的作者
    c.execute("""
        SELECT author, COUNT(*) as submission_count 
        FROM sentences 
        WHERE status = 'approved' 
          AND author != '匿名' 
          AND author != '系统'
        GROUP BY author 
        ORDER BY submission_count DESC 
        LIMIT ?
    """, (limit,))

    results = c.fetchall()

    leaderboard_data = []
    for rank, (author, count) in enumerate(results, 1):
        leaderboard_data.append({
            'rank': rank,
            'author': author,
            'count': count
        })

    # 获取统计数据 - 只统计已通过的
    c.execute("SELECT COUNT(*) FROM sentences WHERE status = 'approved'")
    total_approved_submissions = c.fetchone()[0]

    c.execute("""
        SELECT COUNT(DISTINCT author) 
        FROM sentences 
        WHERE status = 'approved' 
          AND author != '匿名' 
          AND author != '系统'
    """)
    total_authors = c.fetchone()[0]

    # 获取最高提交数
    top_submissions = 0
    if leaderboard_data:
        top_submissions = leaderboard_data[0]['count']

    conn.close()

    return jsonify({
        'leaderboard': leaderboard_data,
        'stats': {
            'total_approved_submissions': total_approved_submissions,
            'total_authors': total_authors,
            'top_submissions': top_submissions
        }
    })


@app.route('/api/admin/approve-all', methods=['POST'])
def approve_all_pending():
    """一键通过所有待审核语句"""
    if not session.get('admin'):
        return jsonify({'error': 'Unauthorized'}), 401

    conn = sqlite3.connect('sentences.db')
    c = conn.cursor()

    # 获取待审核语句数量
    c.execute("SELECT COUNT(*) FROM sentences WHERE status='pending'")
    pending_count = c.fetchone()[0]

    if pending_count == 0:
        conn.close()
        return jsonify({'success': True, 'approved_count': 0})

    # 更新所有待审核语句状态为已通过
    c.execute("UPDATE sentences SET status='approved', reviewed_at=?, reviewed_by='admin' WHERE status='pending'",
              (datetime.now(),))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'approved_count': pending_count
    })


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)