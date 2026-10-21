import asyncio
import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import WebSocketDisconnect
import main
from face_store import FaceStore


class Socket:
    def __init__(self, commands, origin='http://localhost:3000'):
        self.headers = {'origin': origin}
        self.commands = iter(commands)
        self.messages = []
        self.closed = None
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def receive_text(self):
        try:
            return json.dumps(next(self.commands))
        except StopIteration:
            raise WebSocketDisconnect()

    async def send_json(self, message):
        await asyncio.sleep(0)
        self.messages.append(message)

    async def close(self, code):
        self.closed = code


class FaceVisionTests(unittest.TestCase):
    def setUp(self):
        self.cloud = patch.object(main, 'CLOUD_VISION', False)
        self.cloud.start()
        self.addCleanup(self.cloud.stop)

    def test_gallery_rename_delete_over_socket(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FaceStore(Path(directory) / 'faces.sqlite3')
            face_id = store.save(b'jpeg', name='Teste')
            socket = Socket([{'action': 'list_faces'}, {'action': 'rename_face', 'id': face_id, 'name': 'Novo nome'}, {'action': 'delete_face', 'id': face_id}])
            with patch.object(main, 'face_store', store):
                asyncio.run(main.websocket_endpoint(socket))
            self.assertEqual(socket.messages[0]['faces'][0]['name'], 'Teste')
            self.assertEqual(socket.messages[1]['faces'][0]['name'], 'Novo nome')
            self.assertEqual(socket.messages[2]['faces'], [])

    def test_untrusted_origin_is_rejected(self):
        socket = Socket([], 'https://untrusted.invalid')
        asyncio.run(main.websocket_endpoint(socket))
        self.assertEqual(socket.closed, 1008)
        self.assertFalse(socket.accepted)

    def test_cloud_requires_authentication_before_listing(self):
        socket = Socket([{'action': 'list_faces'}])
        with patch.object(main, 'CLOUD_VISION', True):
            asyncio.run(main.websocket_endpoint(socket))
        self.assertEqual(socket.closed, 1008)
        self.assertEqual(socket.messages, [])

    def test_simultaneous_cloud_connections_have_separate_registries(self):
        from types import SimpleNamespace
        def registry(url, key, token):
            return SimpleNamespace(list=lambda: [{'id': token, 'name': token, 'photo': b'jpeg', 'created_at': '2026-01-01', 'last_seen': '2026-01-01'}])
        first = Socket([{'action': 'authenticate', 'token': 'user-a'}, {'action': 'list_faces'}])
        second = Socket([{'action': 'authenticate', 'token': 'user-b'}, {'action': 'list_faces'}])
        async def run():
            await asyncio.gather(main.websocket_endpoint(first), main.websocket_endpoint(second))
        with patch.object(main, 'CLOUD_VISION', True), patch.object(main, 'CloudFaceStore', side_effect=registry):
            asyncio.run(run())
        self.assertEqual(first.messages[1]['faces'][0]['id'], 'user-a')
        self.assertEqual(second.messages[1]['faces'][0]['id'], 'user-b')

    def test_blank_frame_does_not_create_person(self):
        _, image = cv2.imencode('.jpg', np.zeros((480, 640, 3), dtype=np.uint8))
        data = base64.b64encode(image).decode()
        self.assertIsNone(main.observe_face(data, automatic=True))
        with self.assertRaises(ValueError):
            main.observe_face(data)

    def test_invalid_photo_returns_socket_error(self):
        socket = Socket([{'action': 'capture_face', 'image': 'invalid'}])
        asyncio.run(main.websocket_endpoint(socket))
        self.assertEqual(socket.messages[0]['type'], 'face_error')


if __name__ == '__main__':
    unittest.main()
