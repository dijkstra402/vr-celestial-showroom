#!/usr/bin/env python3
import http.server
import socketserver
import os
import re
import json
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get('PORT', 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(PUBLIC_DIR, 'uploads')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, 'db.json')
db = {
    "users": [
        {"id": 1, "username": "admin", "password": "123"},
        {"id": 2, "username": "student", "password": "123"}
    ],
    "comments": [
        {
            "id": 1,
            "author": "指导教师",
            "avatar": "师",
            "content": "展厅场景模型材质光泽度很好，琉璃瓦金边与汉白玉栏杆质感真实。",
            "time": "2026-10-24 16:30",
            "pos": {"x": -8.0, "y": 15.0, "z": -8.0}
        },
        {
            "id": 2,
            "author": "评审专家",
            "avatar": "评",
            "content": "浮空平台周围的体积云层很有仙气，层峦叠嶂，空间纵深感充足。",
            "time": "2026-10-24 17:15",
            "pos": {"x": 0.0, "y": 0.5, "z": 0.0}
        },
        {
            "id": 3,
            "author": "参观同学",
            "avatar": "学",
            "content": "手机陀螺仪和VR模式体验很流畅，石灯笼的暖光很有意境。",
            "time": "2026-10-25 09:20",
            "pos": {"x": 8.0, "y": -2.0, "z": 8.0}
        }
    ],
    "exhibits": []
}

if os.path.exists(DB_PATH):
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            db = json.load(f)
    except Exception:
        pass

def save_db():
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/comments':
            return self.send_json(200, {"success": True, "comments": db["comments"]})
        if parsed.path == '/api/exhibits':
            return self.send_json(200, {"success": True, "exhibits": db.get("exhibits", [])})
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_length)
        content_type = self.headers.get('Content-Type', '')

        if parsed.path == '/api/upload' and 'multipart/form-data' in content_type:
            m = re.search(r'boundary=(.+)$', content_type)
            if not m:
                return self.send_json(400, {"success": False, "message": "无效的上传请求"})
            boundary = m.group(1).strip('"').encode('utf-8')
            parts = raw_body.split(b'--' + boundary)
            fields = {}
            file_info = None
            for part in parts:
                if b'\r\n\r\n' not in part:
                    continue
                hdr_bytes, body_bytes = part.split(b'\r\n\r\n', 1)
                if body_bytes.endswith(b'\r\n'):
                    body_bytes = body_bytes[:-2]
                hdr_str = hdr_bytes.decode('utf-8', errors='ignore')
                name_m = re.search(r'name="([^"]+)"', hdr_str)
                file_m = re.search(r'filename="([^"]+)"', hdr_str)
                if name_m:
                    fname = name_m.group(1)
                    if file_m:
                        file_info = (os.path.basename(file_m.group(1)), body_bytes)
                    else:
                        fields[fname] = body_bytes.decode('utf-8', errors='ignore')
            if not file_info:
                return self.send_json(400, {"success": False, "message": "未找到上传文件"})
            orig_name, file_bytes = file_info
            ext = os.path.splitext(orig_name)[1].lower()
            safe_name = f"{int(datetime.now().timestamp() * 1000)}_{re.sub(r'[^a-zA-Z0-9._-]', '_', orig_name)}"
            with open(os.path.join(UPLOAD_DIR, safe_name), 'wb') as out_f:
                out_f.write(file_bytes)
            platform_index = int(fields.get('platformIndex', '1') or '1')
            exhibit = {
                "id": int(datetime.now().timestamp() * 1000),
                "title": fields.get('title') or '学院测试展品',
                "category": fields.get('category') or '雕塑造像',
                "platformIndex": platform_index,
                "type": "model" if ext in ('.glb', '.gltf') else "image",
                "fileUrl": f"/uploads/{safe_name}",
                "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M")
            }
            db.setdefault('exhibits', [])
            db['exhibits'] = [e for e in db['exhibits'] if e.get('platformIndex') != platform_index]
            db['exhibits'].append(exhibit)
            save_db()
            return self.send_json(200, {"success": True, "exhibit": exhibit})

        try:
            payload = json.loads(raw_body.decode('utf-8')) if raw_body else {}
        except Exception:
            payload = {}

        if parsed.path == '/api/login':
            u = payload.get('username')
            p = payload.get('password')
            user = next((x for x in db['users'] if x['username'] == u and x['password'] == p), None)
            if not user:
                return self.send_json(401, {"success": False, "message": "用户名或密码错误（默认账号: admin / 123）"})
            return self.send_json(200, {"success": True, "user": {"id": user['id'], "username": user['username'], "avatar": user['username'][0].upper()}})

        if parsed.path == '/api/register':
            u = payload.get('username')
            p = payload.get('password')
            if not u or not p:
                return self.send_json(400, {"success": False, "message": "用户名和密码不能为空"})
            if any(x['username'] == u for x in db['users']):
                return self.send_json(400, {"success": False, "message": "用户名已存在"})
            new_user = {"id": int(datetime.now().timestamp()), "username": u, "password": p, "avatar": u[0].upper()}
            db['users'].append(new_user)
            save_db()
            return self.send_json(200, {"success": True, "user": {"id": new_user['id'], "username": new_user['username'], "avatar": new_user['avatar']}})

        if parsed.path == '/api/comments':
            content = payload.get('content', '').strip()
            if not content:
                return self.send_json(400, {"success": False, "message": "评论内容不能为空"})
            author_name = payload.get('author') or "游客观众"
            new_comment = {
                "id": int(datetime.now().timestamp()),
                "author": author_name,
                "avatar": author_name[0],
                "content": content,
                "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "pos": payload.get('pos')
            }
            db['comments'].insert(0, new_comment)
            save_db()
            return self.send_json(200, {"success": True, "comment": new_comment})

        self.send_error(404, "Not Found")

class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    with ThreadingServer(('0.0.0.0', PORT), CustomHandler) as httpd:
        print("=======================================================")
        print("  [READY] 纯 Python 内置零依赖 VR 数字展厅服务已启动")
        print("=======================================================")
        print(f"- 本地访问地址: http://localhost:{PORT}")
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            lan_ip = s.getsockname()[0]
            s.close()
            print(f"- 手机 / VR 设备局域网访问地址: http://{lan_ip}:{PORT}")
        except Exception:
            pass
        print("=======================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
