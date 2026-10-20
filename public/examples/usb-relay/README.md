# USB 单路继电器教学代码

对应博客：`/blog/b2kz8iy4i/`。

本程序仅供三个接线端子均未连接外部电路的空载练习。目标是本次记录的
CH340 USB 串口设备（VID:PID 为 `1A86:7523`），按 LCUS-1 风格协议发送。
USB 标识不证明固件兼容，也不证明接线、触点状态或整板负载能力。

## 不连接硬件的演练

```powershell
python .\relay_control.py pulse --dry-run
```

此命令不导入 pyserial，不打开串口，不等待真实保持时间。

## Windows 准备

在保存了本目录文件的文件夹打开 PowerShell：

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
& .\.venv\Scripts\python.exe .\relay_control.py --list
```

若 `.venv` 已存在且可用，不必重新创建。真实操作先按博客确认设备和空载条件。
假设当次枚举结果确认为 `COM7`：

```powershell
& .\.venv\Scripts\python.exe .\relay_control.py pulse --port COM7 --seconds 2 --confirm-no-load
```

命令会先发送释放，等待 1 秒，发送吸合，等待约 2 秒，最后尝试发送释放。
发生异常时也尝试释放，但不能保证设备掉线、进程被强杀等情况下实际释放。
`on`、`off` 分别发送吸合、释放指令；单独执行 `on` 不会自动定时释放。
没有实际状态回读，不得用于急停、安全联锁或无人值守的危险设备控制。

## 离线测试

```powershell
python -B -m unittest discover -s . -p test_relay_control.py -v
```

测试使用串口替身，不会打开真实串口。它验证程序逻辑，不验证实体继电器。
博客中的本次硬件发送记录来自用户原有 `Usb_Test.py`，不是本教学程序的硬件验收。
