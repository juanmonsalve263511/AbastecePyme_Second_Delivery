import socket
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from Start import CheckPort, CheckBuild

class StartupTests(unittest.TestCase):
    def test_occupied_port(self):
        with socket.socket() as Listener:
            Listener.bind(("127.0.0.1",0))
            Listener.listen()
            with self.assertRaises(RuntimeError):
                CheckPort(Listener.getsockname()[1])

    def test_missing_build(self):
        with TemporaryDirectory() as Folder:
            with self.assertRaises(RuntimeError):
                CheckBuild(Path(Folder))

