"""独立开/关的离线测试：串口均使用替身，不接触真实硬件。"""

import contextlib
import io
from pathlib import Path
import runpy
import sys
import types
import unittest
from unittest.mock import MagicMock, call, patch


DEMO = Path(__file__).with_name("relay_demo.py")
RELEASE = bytes.fromhex("A0 01 00 A1")
ENERGIZE = bytes.fromhex("A0 01 01 A2")


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.serial = types.ModuleType("serial")
        self.serial.Serial = MagicMock()
        self.connection = self.serial.Serial.return_value.__enter__.return_value
        self.connection.write.return_value = 4
        self.output = io.StringIO()

    def execute(self, *args, answer="yes"):
        with patch.dict("sys.modules", {"serial": self.serial}), \
                patch.object(sys, "argv", ["relay_demo.py", *args]), \
                patch("builtins.input", return_value=answer), \
                contextlib.redirect_stdout(self.output):
            runpy.run_path(str(DEMO), run_name="__main__")

    def test_invalid_arguments_never_open_serial(self):
        for args in ((), ("ON",), ("bad",), ("",), ("on", "off")):
            with self.subTest(args=args), self.assertRaises(SystemExit):
                self.execute(*args)
        self.serial.Serial.assert_not_called()

    def test_missing_dependency_names_the_current_interpreter(self):
        with patch.dict("sys.modules", {"serial": None}), \
                patch.object(sys, "argv", ["relay_demo.py", "on"]), \
                patch("builtins.input") as prompt, \
                self.assertRaises(SystemExit) as caught:
            runpy.run_path(str(DEMO), run_name="__main__")
        self.assertIn("缺少 pySerial", str(caught.exception))
        self.assertIn(f"& '{sys.executable}' -m pip install pyserial==3.5", str(caught.exception))
        prompt.assert_not_called()
        self.serial.Serial.assert_not_called()

    def test_cancel_never_opens_serial(self):
        for action in ("on", "off"):
            for answer in ("", "NO", "YES", "Yes", "yes "):
                with self.subTest(action=action, answer=answer), self.assertRaises(SystemExit):
                    self.execute(action, answer=answer)
        self.serial.Serial.assert_not_called()

    def test_on_sends_only_energize(self):
        self.execute("on")
        self.serial.Serial.assert_called_once_with("COM7", 9600, write_timeout=1)
        self.assertEqual(self.connection.write.call_args_list, [call(ENERGIZE)])
        self.connection.flush.assert_called_once()
        self.serial.Serial.return_value.__exit__.assert_called_once()
        self.assertIn("已发送开（吸合）指令。", self.output.getvalue())
        self.assertNotIn("已发送关", self.output.getvalue())

    def test_off_sends_only_release(self):
        self.execute("off")
        self.serial.Serial.assert_called_once_with("COM7", 9600, write_timeout=1)
        self.assertEqual(self.connection.write.call_args_list, [call(RELEASE)])
        self.connection.flush.assert_called_once()
        self.serial.Serial.return_value.__exit__.assert_called_once()
        self.assertIn("已发送关（释放）指令。", self.output.getvalue())
        self.assertNotIn("已发送开", self.output.getvalue())

    def test_separate_runs_send_independent_commands(self):
        self.execute("on")
        self.assertEqual(self.connection.write.call_args_list, [call(ENERGIZE)])
        self.execute("off")
        self.assertEqual(self.connection.write.call_args_list,
                         [call(ENERGIZE), call(RELEASE)])
        self.assertEqual(self.serial.Serial.call_count, 2)
        self.assertEqual(self.serial.Serial.return_value.__exit__.call_count, 2)

    def test_partial_write_reports_failure_without_success_text(self):
        for count in (0, 1, 3, None):
            self.connection.write.return_value = count
            with self.subTest(count=count), self.assertRaises(OSError):
                self.execute("on")
        self.connection.flush.assert_not_called()
        self.assertEqual(self.output.getvalue(), "")

    def test_open_failure_has_no_success_message(self):
        self.serial.Serial.side_effect = OSError("offline")
        with self.assertRaises(OSError):
            self.execute("on")
        self.connection.write.assert_not_called()
        self.assertEqual(self.output.getvalue(), "")

    def test_write_failure_does_not_send_an_unrequested_action(self):
        self.connection.write.side_effect = OSError("unplugged")
        with self.assertRaises(OSError):
            self.execute("on")
        self.assertEqual(self.connection.write.call_args_list, [call(ENERGIZE)])
        self.connection.flush.assert_not_called()
        self.serial.Serial.return_value.__exit__.assert_called_once()
        self.assertEqual(self.output.getvalue(), "")

    def test_flush_failure_does_not_report_success_or_send_off(self):
        self.connection.flush.side_effect = OSError("flush")
        with self.assertRaises(OSError):
            self.execute("on")
        self.assertEqual(self.connection.write.call_args_list, [call(ENERGIZE)])
        self.serial.Serial.return_value.__exit__.assert_called_once()
        self.assertEqual(self.output.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
