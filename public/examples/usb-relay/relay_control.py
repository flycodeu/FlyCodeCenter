"""LCUS-1 风格协议的 USB 串口继电器教学程序。

仅供端子不接外部电路的空载练习。CH340 的 VID/PID 不能证明固件协议。
默认不操作设备；真实发送必须指定端口并提供 --confirm-no-load。
程序不读取机械触点状态，发送成功不等于继电器已动作。
"""

import argparse
import math
import sys
import time


BAUDRATE = 9600
EXPECTED_USB_ID = (0x1A86, 0x7523)
COMMANDS = {
    0: bytes.fromhex("A0 01 00 A1"),
    1: bytes.fromhex("A0 01 01 A2"),
}


def build_command(value):
    """只构造指令，不接触硬件；拒绝 True、False、字符串等输入。"""
    if type(value) is not int or value not in COMMANDS:
        raise ValueError("状态必须是整数 0（释放）或 1（吸合）")
    return COMMANDS[value]


def checked_seconds(value):
    """限制为一次短时练习；也拒绝 nan、inf。"""
    seconds = float(value)
    if not math.isfinite(seconds) or not 0.1 <= seconds <= 10:
        raise ValueError("保持时间必须在 0.1～10 秒之间")
    return seconds


def list_ports():
    """仅枚举串口，不打开串口，也不发送指令。"""
    from serial.tools.list_ports import comports

    ports = sorted(comports(), key=lambda item: item.device)
    if not ports:
        print("未发现串口，请检查 USB 连接和驱动。")
    for item in ports:
        print(f"{item.device}: {item.description} [{item.hwid}]")


def check_target(port):
    """校验本教程这块板的 USB 标识，避免误选蓝牙等其他串口。"""
    from serial.tools.list_ports import comports

    matches = [item for item in comports()
               if item.device.casefold() == port.casefold()]
    if len(matches) != 1:
        raise ValueError(f"未找到唯一的在线串口：{port}")
    if (matches[0].vid, matches[0].pid) != EXPECTED_USB_ID:
        raise ValueError("该端口不是本教程预期的 1A86:7523 设备，停止发送")


def send_state(value, port=None, *, dry_run=False):
    """发送一次状态指令；返回的是指令字节，不是实际继电器状态。"""
    command = build_command(value)
    action = "吸合" if value else "释放"
    if dry_run:
        print(f"[演练/未连接硬件] {action}: {command.hex(' ').upper()}")
        return command
    if not port:
        raise ValueError("真实发送必须明确指定串口")

    import serial

    with serial.Serial(
        port=port,
        baudrate=BAUDRATE,
        bytesize=serial.EIGHTBITS,
        parity=serial.PARITY_NONE,
        stopbits=serial.STOPBITS_ONE,
        timeout=1,
        write_timeout=1,
        xonxoff=False,
        rtscts=False,
        dsrdtr=False,
    ) as connection:
        written = connection.write(command)
        if written != len(command):
            raise OSError(f"发送不完整：{written}/{len(command)} 字节")
        connection.flush()
    print(f"[仅发送，未回读触点] {port} {action}: {command.hex(' ').upper()}",
          flush=True)
    return command


def pulse(port=None, seconds=2, *, dry_run=False):
    """释放 → 吸合 → 等待 → 尝试释放；不做无限循环。"""
    seconds = checked_seconds(seconds)
    send_state(0, port, dry_run=dry_run)
    if not dry_run:
        time.sleep(1)
    try:
        send_state(1, port, dry_run=dry_run)
        if dry_run:
            print(f"[演练] 计划保持 {seconds:g} 秒，本次跳过等待")
        else:
            time.sleep(seconds)
    finally:
        # 即使吸合发送/等待出错，也尝试释放；断线、掉电等仍可能使其失败。
        send_state(0, port, dry_run=dry_run)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", nargs="?", choices=("on", "off", "pulse"))
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--list", action="store_true", help="只列出串口")
    modes.add_argument("--dry-run", action="store_true", help="只打印指令，不连接硬件")
    parser.add_argument("--port", help="实际串口，例如 COM7；没有默认值")
    parser.add_argument("--seconds", default="2", help="pulse 保持时间，0.1～10 秒")
    parser.add_argument("--confirm-no-load", action="store_true",
                        help="确认三个接线端子均未连接外部电路")
    args = parser.parse_args(argv)
    if args.list and args.action:
        parser.error("--list 不能与 on/off/pulse 同时使用")
    if args.action is None and not args.list:
        parser.print_help()
        return 0
    if args.action and not args.dry_run:
        if not args.port:
            parser.error("请先 --list，再使用 --port 明确指定串口")
        if not args.confirm_no_load:
            parser.error("仅供空载练习；确认端子空置后添加 --confirm-no-load")

    try:
        seconds = checked_seconds(args.seconds) if args.action == "pulse" else 2
        if args.list:
            list_ports()
            return 0
        if not args.dry_run:
            check_target(args.port)
        if args.action == "pulse":
            pulse(args.port, seconds, dry_run=args.dry_run)
        else:
            send_state(1 if args.action == "on" else 0, args.port,
                       dry_run=args.dry_run)
        print("结束：未读取实际触点状态。")
        return 0
    except ImportError:
        print("缺少依赖，请用运行本程序的同一个 Python 安装 pyserial。", file=sys.stderr)
    except KeyboardInterrupt:
        print("已中断；不能保证实际已释放，请检查设备。", file=sys.stderr)
        return 130
    except (OSError, ValueError) as exc:
        print(f"操作失败：{exc}；实际状态未知，请检查设备。", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
