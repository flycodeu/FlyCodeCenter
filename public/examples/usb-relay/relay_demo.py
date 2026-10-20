import sys
try:
    import serial
except ModuleNotFoundError:
    raise SystemExit(f"缺少 pySerial，请在 PowerShell 执行：\n& '{sys.executable}' -m pip install pyserial==3.5") from None
PORT = "COM7"  # 改成设备管理器中确认过的串口号
COMMANDS = {"on": "A0 01 01 A2", "off": "A0 01 00 A1"}
if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
    raise SystemExit("用法：python relay_demo.py on（开）或 off（关）")
if input("确认三个端子都没有接线，输入 yes 后回车：") != "yes":
    raise SystemExit("已取消，没有打开串口。")
with serial.Serial(PORT, 9600, write_timeout=1) as relay:
    written = relay.write(bytes.fromhex(COMMANDS[sys.argv[1]]))
    if written != 4:
        raise OSError("指令没有完整写出，请检查设备。")
    relay.flush()
print("已发送开（吸合）指令。" if sys.argv[1] == "on" else "已发送关（释放）指令。")
