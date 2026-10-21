"""Supabase registry scoped to a verified user's JWT; no service-role keys."""
import json
import time
import uuid
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class CloudFaceStore:
    def __init__(self, url, key, token):
        self.url = url.rstrip('/')
        self.key = key
        self.token = token
        self.user_id = self.request('/auth/v1/user')['id']
        self.links = {}

    def request(self, path, method='GET', body=None, content_type='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        headers = {'apikey': self.key, 'Authorization': f'Bearer {self.token}', 'Content-Type': content_type}
        request = Request(self.url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=15) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except HTTPError as error:
            if error.code in (401, 403):
                raise PermissionError('Sessão expirada ou acesso negado. Entre novamente.') from None
            raise ValueError('O Supabase não conseguiu concluir a operação.') from None
        except (URLError, TimeoutError):
            raise ValueError('Falha de conexão com o Supabase. Tente novamente.') from None

    def list(self):
        rows = self.request(f'/rest/v1/zord_faces?user_id=eq.{self.user_id}&order=last_seen.desc&limit=100')
        return [{**row, 'encoding': json.dumps(row['encoding']) if row['encoding'] else None} for row in rows]

    def photo_url(self, row):
        cached = self.links.get(row['id'])
        if cached and cached[0] > time.monotonic():
            return cached[1]
        data = self.request('/storage/v1/object/sign/zord-faces/' + quote(row['photo_path'], safe='/'), 'POST', {'expiresIn': 300})
        path = data.get('signedURL') or data.get('signedUrl')
        url = path if path.startswith('https://') else self.url + '/storage/v1' + path
        self.links[row['id']] = (time.monotonic() + 240, url)
        return url

    def save(self, photo, encoding=None, name=''):
        if len(self.list()) >= 100:
            raise ValueError('Limite de 100 rostos atingido. Exclua registros para continuar.')
        face_id = str(uuid.uuid4())
        path = f'{self.user_id}/{face_id}.jpg'
        self.request('/storage/v1/object/zord-faces/' + path, 'POST', photo, 'image/jpeg')
        try:
            self.request('/rest/v1/zord_faces', 'POST', {
                'id': face_id, 'user_id': self.user_id, 'photo_path': path,
                'name': name.strip()[:80] or f'Visitante {face_id[:6]}', 'encoding': encoding,
            })
        except (ValueError, PermissionError):
            self.request('/storage/v1/object/zord-faces', 'DELETE', {'prefixes': [path]})
            raise
        return face_id

    def seen(self, face_id):
        self.request(f'/rest/v1/zord_faces?id=eq.{quote(face_id)}&user_id=eq.{self.user_id}', 'PATCH', {'last_seen': datetime.now(timezone.utc).isoformat()})

    def rename(self, face_id, name):
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError('Informe um nome de até 80 caracteres.')
        self.request(f'/rest/v1/zord_faces?id=eq.{quote(face_id)}&user_id=eq.{self.user_id}', 'PATCH', {'name': name.strip()})

    def delete(self, face_id):
        rows = self.request(f'/rest/v1/zord_faces?id=eq.{quote(face_id)}&user_id=eq.{self.user_id}&select=photo_path')
        if not rows:
            return
        self.request('/storage/v1/object/zord-faces', 'DELETE', {'prefixes': [rows[0]['photo_path']]})
        self.request(f'/rest/v1/zord_faces?id=eq.{quote(face_id)}&user_id=eq.{self.user_id}', 'DELETE')
        self.links.pop(face_id, None)
