"""Local face registry. Photos and templates stay in the vision service."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


class FaceStore:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS faces (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, photo BLOB NOT NULL,
                encoding TEXT, created_at TEXT NOT NULL, last_seen TEXT NOT NULL)''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def list(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute('SELECT * FROM faces ORDER BY last_seen DESC LIMIT 100')]

    def save(self, photo, encoding=None, name=''):
        now = datetime.now(timezone.utc).isoformat()
        face_id = uuid.uuid4().hex
        with self.connect() as db:
            if db.execute('SELECT count(*) FROM faces').fetchone()[0] >= 100:
                raise ValueError('Limite de 100 rostos atingido. Exclua registros para continuar.')
            db.execute('INSERT INTO faces VALUES (?, ?, ?, ?, ?, ?)', (
                face_id, name.strip()[:80] or f'Visitante {face_id[:6]}', photo,
                json.dumps(encoding) if encoding is not None else None, now, now))
        return face_id

    def seen(self, face_id):
        with self.connect() as db:
            db.execute('UPDATE faces SET last_seen = ? WHERE id = ?', (datetime.now(timezone.utc).isoformat(), face_id))

    def rename(self, face_id, name):
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError('Informe um nome de até 80 caracteres.')
        with self.connect() as db:
            db.execute('UPDATE faces SET name = ? WHERE id = ?', (name.strip(), face_id))

    def delete(self, face_id):
        with self.connect() as db:
            db.execute('DELETE FROM faces WHERE id = ?', (face_id,))
