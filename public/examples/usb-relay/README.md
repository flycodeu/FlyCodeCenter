# USB 单路继电器入门示例

对应博客：`/blog/b2kz8iy4i/`。第一次练习只需要 `relay_demo.py`。

只用于 COM、NO、NC 三个端子都不接线的空载练习，不接市电或机器。
代码使用 9600、8N1、无流控，以及 LCUS-1 风格的两条指令；先确认整板协议。
CH340 或继电器外壳型号相同，不代表控制指令相同。

## 第一次运行

在保存代码的文件夹打开 PowerShell，逐条执行：

```powershell
python --version
python -m pip install pyserial==3.5
python -m serial.tools.list_ports
```

安装的包名是 `pyserial`，代码中导入的名字是 `serial`，不要安装其他同名包。
如果文件夹里已经有 `.venv`，进入文件夹不会自动启用它；安装与运行都明确指定
这个环境的解释器。先用以下命令检查依赖（不打开串口）：

```powershell
.\.venv\Scripts\python.exe -c "import sys, serial; print(sys.executable); print(serial.__version__)"
```

如果这里也报缺少依赖，才运行：

```powershell
.\.venv\Scripts\python.exe -m pip install pyserial==3.5
```

后面的 `python` 都换成 `.\.venv\Scripts\python.exe`，例如确认空载后选一条执行：

```powershell
.\.venv\Scripts\python.exe .\relay_demo.py on
.\.venv\Scripts\python.exe .\relay_demo.py off
```

不需要激活环境，也不需要更改 PowerShell 执行策略。
程序缺少依赖时会显示实际解释器对应的安装命令，不打开串口。

`relay_demo.py` 下载文件使用 UTF-8 BOM，帮助 Windows 工具识别中文。
自己保存时选择“带有 BOM 的 UTF-8”，不要选择 ANSI；若乱码已经写进文件，
重新下载正确文件，不是简单把乱码文本改存为 UTF-8。

在设备管理器确认实际串口，编辑 `relay_demo.py` 的 `PORT` 后保存。
确认三个端子没有接线，再运行：

```powershell
python .\relay_demo.py on
```

提示处输入小写 `yes` 才打开串口，其他输入会取消。这一次只发送开（吸合），
不会定时关闭，也不会在退出时额外发关指令。需要关闭时，单独执行：

```powershell
python .\relay_demo.py off
```

再次确认空载并输入小写 yes。`off` 只发送关（释放），不会先开启。
缺少参数、拼错或多写参数时，程序显示用法，不打开串口。
每次检查四字节是否完整写出，并等待写出完成；没有实际触点回读。
提示“已发送”不能代替动作观察和触点测量，断线、掉电也可能使控制失败。
这是直接运行的入门脚本，不要把它作为可导入的现场控制模块。

## 可选：保留的原工具

`relay_control.py` 的原有接口保留，不需要为了读正文而学习它。
不连接硬件的演练：

```powershell
python .\relay_control.py pulse --dry-run
```

此模式不导入 pyserial、不打开串口、不做真实等待。
真实空载操作前核对串口及端子，假设当次确认是 COM7：

```powershell
python .\relay_control.py pulse --port COM7 --seconds 2 --confirm-no-load
```

原工具另检查本例 USB 标识 `1A86:7523`，但它也不能证明固件兼容。
`on` / `off` 分别发送吸合 / 释放；单独的 `on` 不会自动定时释放。
有独立 Python 环境时，安装和运行都使用该环境的同一个解释器，不要混用。

## 离线测试（不会操作硬件）

```powershell
python -B -m unittest discover -s . -p "test_relay*.py" -v
```

两组测试都用串口替身，不打开真实端口。正文短程序已于 2026-10-20 在空载的
COM7 上分别执行 on（13:50:09）和 off（13:50:23），均完成四字节写入并正常退出。
用户随后已确认听到了本次测试的切换声；这不是程序自动检测到的声音。
后续修订补充编码标识和缺少依赖的提示，并精简输出，串口控制逻辑不变，只做离线验证。
没有万用表触点读数和外部负载测试，不把本例当作完整现场常驻控制服务。
