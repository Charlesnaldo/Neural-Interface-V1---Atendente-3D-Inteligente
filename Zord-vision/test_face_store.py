import tempfile
import unittest
from pathlib import Path
from face_store import FaceStore


class FaceStoreTests(unittest.TestCase):
    def test_persistence_rename_and_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'faces.sqlite3'
            store = FaceStore(path)
            face_id = store.save(b'photo', {'backend': 'test', 'vector': [0.1]}, 'Charles')
            restored = FaceStore(path)
            self.assertEqual(restored.list()[0]['photo'], b'photo')
            restored.rename(face_id, 'Ronaldo Charles')
            self.assertEqual(restored.list()[0]['name'], 'Ronaldo Charles')
            before = restored.list()[0]['last_seen']
            restored.seen(face_id)
            self.assertGreaterEqual(restored.list()[0]['last_seen'], before)
            restored.delete(face_id)
            self.assertEqual(restored.list(), [])

    def test_unknown_names_and_invalid_rename(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FaceStore(Path(directory) / 'faces.sqlite3')
            face_id = store.save(b'photo')
            self.assertTrue(store.list()[0]['name'].startswith('Visitante '))
            with self.assertRaises(ValueError):
                store.rename(face_id, ' ')
            with self.assertRaises(ValueError):
                store.rename(face_id, 'x' * 81)

    def test_capacity(self):
        with tempfile.TemporaryDirectory() as directory:
            store = FaceStore(Path(directory) / 'faces.sqlite3')
            for _ in range(100):
                store.save(b'photo')
            with self.assertRaises(ValueError):
                store.save(b'photo')


if __name__ == '__main__':
    unittest.main()
