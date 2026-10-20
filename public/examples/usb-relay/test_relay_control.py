"""离线单元测试：串口全部使用替身，不打开真实设备。"""

import contextlib
import io
import types
import unittest
from unittest.mock import MagicMock, patch

import relay_control as relay


class RelayTests(unittest.TestCase):
    def setUp(self):
        self.output = io.StringIO()
        self.stdout = contextlib.redirect_stdout(self.output)
        self.stderr = contextlib.redirect_stderr(self.output)
        self.stdout.__enter__()
        self.stderr.__enter__()
        self.addCleanup(self.stderr.__exit__, None, None, None)
        self.addCleanup(self.stdout.__exit__, None, None, None)

    def fake_serial(self):
        module = types.ModuleType("serial")
        module.EIGHTBITS, module.PARITY_NONE, module.STOPBITS_ONE = 8, "N", 1
        connection = MagicMock()
        connection.write.return_value = 4
        module.Serial = MagicMock()
        module.Serial.return_value.__enter__.return_value = connection
        return module, connection

    def fake_ports(self, ports):
        serial = types.ModuleType("serial")
        tools = types.ModuleType("serial.tools")
        listing = types.ModuleType("serial.tools.list_ports")
        serial.Serial = MagicMock(side_effect=AssertionError("不应打开真实串口"))
        listing.comports = MagicMock(return_value=ports)
        return {"serial": serial, "serial.tools": tools,
                "serial.tools.list_ports": listing}

    def test_command_bytes(self):
        self.assertEqual(relay.build_command(0), b"\xa0\x01\x00\xa1")
        self.assertEqual(relay.build_command(1), b"\xa0\x01\x01\xa2")
        for value in (0, 1):
            frame = relay.build_command(value)
            self.assertEqual(sum(frame[:3]) & 0xFF, frame[3])

    def test_invalid_states(self):
        for value in (-1, 2, True, False, "1", 1.0, None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                relay.build_command(value)

    def test_seconds_bounds(self):
        self.assertEqual(relay.checked_seconds("0.1"), 0.1)
        self.assertEqual(relay.checked_seconds("10"), 10)
        for value in ("nan", "inf", "-inf", "0", "10.1", "oops"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                relay.checked_seconds(value)

    def test_dry_run_needs_no_serial_package(self):
        with patch.dict("sys.modules", {"serial": None}):
            self.assertEqual(relay.main(["pulse", "--dry-run"]), 0)
        self.assertIn("未连接硬件", self.output.getvalue())

    def test_send_bytes_and_settings(self):
        module, connection = self.fake_serial()
        with patch.dict("sys.modules", {"serial": module}):
            self.assertEqual(relay.send_state(1, "COM7"), relay.COMMANDS[1])
        connection.write.assert_called_once_with(b"\xa0\x01\x01\xa2")
        connection.flush.assert_called_once_with()
        module.Serial.assert_called_once_with(
            port="COM7", baudrate=9600, bytesize=8, parity="N", stopbits=1,
            timeout=1, write_timeout=1, xonxoff=False, rtscts=False, dsrdtr=False)
        module.Serial.return_value.__exit__.assert_called_once()

    def test_partial_write_is_failure(self):
        module, connection = self.fake_serial()
        connection.write.return_value = 2
        with patch.dict("sys.modules", {"serial": module}), self.assertRaises(OSError):
            relay.send_state(1, "COM7")
        module.Serial.return_value.__exit__.assert_called_once()

    def test_missing_port_does_not_import_serial(self):
        with patch.dict("sys.modules", {"serial": None}), self.assertRaises(ValueError):
            relay.send_state(1)

    def test_list_is_read_only(self):
        device = types.SimpleNamespace(device="COM7", description="USB-SERIAL CH340",
                                       hwid="USB VID:PID=1A86:7523")
        modules = self.fake_ports([device])
        with patch.dict("sys.modules", modules):
            relay.list_ports()
        modules["serial"].Serial.assert_not_called()
        self.assertIn("COM7", self.output.getvalue())

    def test_empty_list(self):
        with patch.dict("sys.modules", self.fake_ports([])):
            relay.list_ports()
        self.assertIn("未发现串口", self.output.getvalue())

    def test_target_identity(self):
        device = types.SimpleNamespace(device="COM7", vid=0x1A86, pid=0x7523)
        with patch.dict("sys.modules", self.fake_ports([device])):
            relay.check_target("com7")

    def test_wrong_or_missing_target(self):
        wrong = types.SimpleNamespace(device="COM7", vid=None, pid=None)
        for ports in ([], [wrong]):
            with self.subTest(ports=ports):
                with patch.dict("sys.modules", self.fake_ports(ports)):
                    with self.assertRaises(ValueError):
                        relay.check_target("COM7")

    def test_pulse_sequence(self):
        with patch.object(relay, "send_state") as send, patch.object(relay.time, "sleep") as sleep:
            relay.pulse("COM7", 2)
        self.assertEqual([call.args[0] for call in send.call_args_list], [0, 1, 0])
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])

    def test_pulse_releases_after_energize_error(self):
        with patch.object(relay, "send_state", side_effect=[None, OSError("写入失败"), None]) as send:
            with patch.object(relay.time, "sleep"), self.assertRaises(OSError):
                relay.pulse("COM7")
        self.assertEqual([call.args[0] for call in send.call_args_list], [0, 1, 0])

    def test_pulse_releases_after_interrupt(self):
        with patch.object(relay, "send_state") as send:
            with patch.object(relay.time, "sleep", side_effect=[None, KeyboardInterrupt()]):
                with self.assertRaises(KeyboardInterrupt):
                    relay.pulse("COM7")
        self.assertEqual([call.args[0] for call in send.call_args_list], [0, 1, 0])

    def test_invalid_pulse_does_not_send(self):
        with patch.object(relay, "send_state") as send, self.assertRaises(ValueError):
            relay.pulse("COM7", float("nan"))
        send.assert_not_called()

    def test_no_args_only_shows_help(self):
        with patch.object(relay, "send_state") as send:
            self.assertEqual(relay.main([]), 0)
        send.assert_not_called()

    def test_live_actions_require_explicit_port_and_confirmation(self):
        for args in (["on"], ["on", "--port", "COM7"],
                     ["off", "--confirm-no-load"]):
            with self.subTest(args=args), patch.object(relay, "check_target") as target:
                with self.assertRaises(SystemExit) as caught:
                    relay.main(args)
                self.assertEqual(caught.exception.code, 2)
                target.assert_not_called()

    def test_list_cannot_control(self):
        with patch.object(relay, "list_ports") as listing:
            with self.assertRaises(SystemExit):
                relay.main(["on", "--list"])
        listing.assert_not_called()

    def test_off_sends_zero(self):
        with patch.object(relay, "check_target") as target, patch.object(relay, "send_state") as send:
            self.assertEqual(relay.main(["off", "--port", "COM7", "--confirm-no-load"]), 0)
        target.assert_called_once_with("COM7")
        send.assert_called_once_with(0, "COM7", dry_run=False)

    def test_failure_reports_unknown_state(self):
        with patch.object(relay, "check_target", side_effect=OSError("端口不可用")):
            self.assertEqual(relay.main(["on", "--port", "COM7", "--confirm-no-load"]), 1)
        self.assertIn("实际状态未知", self.output.getvalue())


if __name__ == "__main__":
    unittest.main()
