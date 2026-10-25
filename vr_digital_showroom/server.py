#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get('PORT', 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(PUBLIC_DIR, 'uploads'), exist_ok=True)

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
            "avatar": "👨‍🏫",
            "content": "展厅场景模型材质光泽度很好，琉璃瓦金边与汉白玉栏杆质感真实！",
            "time": "2026-10-24 16:30",
            "pos": {"x": -8.0, "y": 15.0, "z": -8.0}
        },
        {
            "id": 2,
            "author": "评审专家",
            "avatar": "🎓",
            "content": "浮空平台周围的体积云层很有仙气，层峦叠嶂，空间纵深感充足。",
            "time": "2026-10-24 17:15",
            "pos": {"x": 0.0, "y": 0.5, "z": 0.0}
        },
        {
            "id": 3,
            "author": "参观同学",
            "avatar": "👩‍💻",
            "content": "手机陀螺仪和VR模式体验很流畅，石灯笼的暖光很有意境！",
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
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {}

        if parsed.path == '/api/login':
            u = payload.get('username')
            p = payload.get('password')
            user = next((x for x in db['users'] if x['username'] == u and x['password'] == p), None)
            if not user:
                return self.send_json(401, {"success": False, "message": "用户名或密码错误（测试: admin / 123）"})
            return self.send_json(200, {"success": True, "user": {"id": user['id'], "username": user['username'], "avatar": "👤"}})

        if parsed.path == '/api/register':
            u = payload.get('username')
            p = payload.get('password')
            if not u or not p:
                return self.send_json(400, {"success": False, "message": "用户名和密码不能为空"})
            if any(x['username'] == u for x in db['users']):
                return self.send_json(400, {"success": False, "message": "用户名已存在"})
            new_user = {"id": int(datetime.now().timestamp()), "username": u, "password": p, "avatar": "👤"}
            db['users'].append(new_user)
            save_db()
            return self.send_json(200, {"success": True, "user": {"id": new_user['id'], "username": new_user['username'], "avatar": "👤"}})

        if parsed.path == '/api/comments':
            content = payload.get('content', '').strip()
            if not content:
                return self.send_json(400, {"success": False, "message": "评论内容不能为空"})
            new_comment = {
                "id": int(datetime.now().timestamp()),
                "author": payload.get('author') or "游客观众",
                "avatar": "💬",
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
        print("  🌟 纯 Python 内置零依赖 VR 数字展厅服务已就绪 🌟")
        print("=======================================================")
        print(f"- 本地访问地址: http://localhost:{PORT}")
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            lan_ip = s.getsockname()[0]
            s.close()
            print(f"- 📱 手机 / VR 设备局域网访问地址: http://{lan_ip}:{PORT}")
        except Exception:
            pass
        print("=======================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
