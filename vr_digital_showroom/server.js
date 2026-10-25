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
      avatar: '师',
      content: '展厅场景模型材质光泽度很好，琉璃瓦金边与汉白玉栏杆质感真实。',
      time: '2026-10-24 16:30',
      pos: { x: -8.0, y: 15.0, z: -8.0 }
    },
    {
      id: 2,
      author: '评审专家',
      avatar: '评',
      content: '浮空平台周围的体积云层很有仙气，层峦叠嶂，空间纵深感充足。',
      time: '2026-10-24 17:15',
      pos: { x: 0.0, y: 0.5, z: 0.0 }
    },
    {
      id: 3,
      author: '参观同学',
      avatar: '学',
      content: '手机陀螺仪和VR模式体验很流畅，石灯笼的暖光很有意境。',
      time: '2026-10-25 09:20',
      pos: { x: 8.0, y: -2.0, z: 8.0 }
    }
  ],
  exhibits: []
};

if (fs.existsSync(DB_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (loaded && Array.isArray(loaded.comments)) {
      loaded.comments.forEach(c => {
        if (!c.avatar || c.avatar.length > 2) {
          c.avatar = (c.author || '访')[0];
        }
      });
      db = loaded;
      if (!Array.isArray(db.exhibits)) db.exhibits = [];
    }
  } catch (e) {}
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}
saveDb();

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
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseRawBody(req, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total <= maxBytes) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const buf = await parseRawBody(req);
  try {
    return JSON.parse(buf.toString('utf8') || '{}');
  } catch (e) {
    return {};
  }
}

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, file: null };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBuf);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (next === -1) break;
    const part = buffer.subarray(start + boundaryBuf.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerStr = part.subarray(0, headerEnd).toString('utf8');
      const bodyBuf = part.subarray(headerEnd + 4);
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const fileMatch = headerStr.match(/filename="([^"]+)"/);
      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (fileMatch) {
          result.file = {
            fieldname: fieldName,
            filename: path.basename(fileMatch[1]),
            data: bodyBuf
          };
        } else {
          result.fields[fieldName] = bodyBuf.toString('utf8');
        }
      }
    }
    start = next;
  }
  return result;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseJsonBody(req);
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) {
      return sendJson(res, 401, { success: false, message: '用户名或密码错误（默认账号: admin / 123）' });
    }
    return sendJson(res, 200, {
      success: true,
      user: { id: user.id, username: user.username, avatar: user.username[0].toUpperCase() }
    });
  }

  if (pathname === '/api/register' && req.method === 'POST') {
    const { username, password } = await parseJsonBody(req);
    if (!username || !password) {
      return sendJson(res, 400, { success: false, message: '用户名和密码不能为空' });
    }
    const exists = db.users.find(u => u.username === username);
    if (exists) {
      return sendJson(res, 400, { success: false, message: '用户名已存在' });
    }
    const newUser = { id: Date.now(), username, password, avatar: username[0].toUpperCase() };
    db.users.push(newUser);
    saveDb();
    return sendJson(res, 200, {
      success: true,
      user: { id: newUser.id, username: newUser.username, avatar: newUser.avatar }
    });
  }

  if (pathname === '/api/comments' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, comments: db.comments });
  }

  if (pathname === '/api/comments' && req.method === 'POST') {
    const { author, content, pos } = await parseJsonBody(req);
    if (!content || !content.trim()) {
      return sendJson(res, 400, { success: false, message: '评论内容不能为空' });
    }
    const authorName = author || '游客观众';
    const newComment = {
      id: Date.now(),
      author: authorName,
      avatar: authorName[0],
      content: content.trim(),
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      pos: pos || null
    };
    db.comments.unshift(newComment);
    saveDb();
    return sendJson(res, 200, { success: true, comment: newComment });
  }

  if (pathname === '/api/exhibits' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, exhibits: db.exhibits || [] });
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      const rawBuf = await parseRawBody(req);
      let title = '学院测试展品';
      let category = '雕塑造像';
      let platformIndex = 1;
      let filename = '';
      let fileData = null;

      if (contentType.includes('multipart/form-data')) {
        const bMatch = contentType.match(/boundary=(.+)$/);
        if (bMatch) {
          const boundary = bMatch[1].replace(/^"|"$/g, '');
          const parsed = parseMultipart(rawBuf, boundary);
          title = parsed.fields.title || title;
          category = parsed.fields.category || category;
          platformIndex = parseInt(parsed.fields.platformIndex || '1', 10) || 1;
          if (parsed.file && parsed.file.data) {
            filename = parsed.file.filename;
            fileData = parsed.file.data;
          }
        }
      } else {
        const bodyObj = JSON.parse(rawBuf.toString('utf8') || '{}');
        title = bodyObj.title || title;
        category = bodyObj.category || category;
        platformIndex = parseInt(bodyObj.platformIndex || '1', 10) || 1;
        filename = bodyObj.filename || 'asset.glb';
        if (bodyObj.dataBase64) {
          fileData = Buffer.from(bodyObj.dataBase64, 'base64');
        }
      }

      if (!fileData || !filename) {
        return sendJson(res, 400, { success: false, message: '未检测到上传的美术资源文件' });
      }

      const ext = path.extname(filename).toLowerCase();
      const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const savePath = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(savePath, fileData);

      const isModel = ['.glb', '.gltf'].includes(ext);
      const exhibit = {
        id: Date.now(),
        title,
        category,
        platformIndex,
        type: isModel ? 'model' : 'image',
        fileUrl: `/uploads/${safeName}`,
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
      };

      if (!Array.isArray(db.exhibits)) db.exhibits = [];
      db.exhibits = db.exhibits.filter(e => e.platformIndex !== platformIndex);
      db.exhibits.push(exhibit);
      saveDb();

      return sendJson(res, 200, { success: true, exhibit });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: '资源导入解析失败: ' + err.message });
    }
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
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
  console.log('=======================================================');
  console.log('  [READY] 零依赖 VR 数字展厅服务已启动 (Node.js 内置模块)');
  console.log('=======================================================');
  console.log(`- 本地访问地址: http://localhost:${PORT}`);

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`- 手机 / VR 设备局域网访问地址: http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('=======================================================');
});
