const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'db.json');
let db = {
  users: [
    { id: 1, username: 'admin', password: '123' },
    { id: 2, username: 'student', password: '123' }
  ],
  comments: [
    {
      id: 1,
      author: '指导教师',
      avatar: '👨‍🏫',
      content: '展厅场景模型材质光泽度很好，琉璃瓦金边与汉白玉栏杆质感真实！',
      time: '2026-10-24 16:30',
      pos: { x: -8.0, y: 15.0, z: -8.0 }
    },
    {
      id: 2,
      author: '评审专家',
      avatar: '🎓',
      content: '浮空平台周围的体积云层很有仙气，层峦叠嶂，空间纵深感充足。',
      time: '2026-10-24 17:15',
      pos: { x: 0.0, y: 0.5, z: 0.0 }
    },
    {
      id: 3,
      author: '参观同学',
      avatar: '👩‍💻',
      content: '手机陀螺仪和VR模式体验很流畅，石灯笼的暖光很有意境！',
      time: '2026-10-25 09:20',
      pos: { x: 8.0, y: -2.0, z: 8.0 }
    }
  ],
  exhibits: []
};

if (fs.existsSync(DB_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {}
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API Routes
  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) {
      return sendJson(res, 401, { success: false, message: '用户名或密码错误（测试: admin / 123）' });
    }
    return sendJson(res, 200, { success: true, user: { id: user.id, username: user.username, avatar: '👤' } });
  }

  if (pathname === '/api/register' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) {
      return sendJson(res, 400, { success: false, message: '用户名和密码不能为空' });
    }
    const exists = db.users.find(u => u.username === username);
    if (exists) {
      return sendJson(res, 400, { success: false, message: '用户名已存在' });
    }
    const newUser = { id: Date.now(), username, password, avatar: '👤' };
    db.users.push(newUser);
    saveDb();
    return sendJson(res, 200, { success: true, user: { id: newUser.id, username: newUser.username, avatar: '👤' } });
  }

  if (pathname === '/api/comments' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, comments: db.comments });
  }

  if (pathname === '/api/comments' && req.method === 'POST') {
    const { author, content, pos } = await parseBody(req);
    if (!content || !content.trim()) {
      return sendJson(res, 400, { success: false, message: '评论内容不能为空' });
    }
    const newComment = {
      id: Date.now(),
      author: author || '游客观众',
      avatar: '💬',
      content: content.trim(),
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      pos: pos || null
    };
    db.comments.unshift(newComment);
    saveDb();
    return sendJson(res, 200, { success: true, comment: newComment });
  }

  if (pathname === '/api/exhibits' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, exhibits: db.exhibits });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  🌟 零依赖 VR 数字展厅服务已就绪 (纯内置模块运行) 🌟`);
  console.log(`=======================================================`);
  console.log(`- 本地访问地址: http://localhost:${PORT}`);
  
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`- 📱 手机 / VR 设备局域网访问地址: http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log(`=======================================================`);
});
