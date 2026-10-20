---
title: USB 单路继电器入门：用 Python 分别控制开和关
createTime: '2026/10/20 10:15:54'
code: b2kz8iy4i
permalink: /blog/b2kz8iy4i/
summary: 从认识继电器、找到 Windows 串口开始，用一个短程序分别执行开和关，不再自动两秒后关闭。包含实际空载发送记录、逐段代码解释和常见报错排查。
tags:
  - Python
  - USB
  - 继电器
  - 硬件入门
---

把 USB 继电器插进电脑，PWR 灯亮了。接下来，怎样用电脑打开它，再由自己决定什么时候关闭？

这篇文章只学两个独立操作：**开（吸合）**和**关（释放）**。程序运行一次，只发送你选择的那个动作，不定时切换，不自动两秒后关闭。你不需要先学完 Python，也不需要先读懂模块附带的程序。

先做一件事：让板上的 **COM、NO、NC 三个接线端子全部空着，只连接 USB**。这叫“空载测试”，也就是暂时不接灯、电机或其他设备。把裸板放在干燥、绝缘的表面，本次不接市电和现场机器。

## 一、先把继电器理解成一个开关

普通开关需要用手按；继电器可以由电信号控制。USB 控制板的作用，就是接收电脑指令，让板上的继电器切换。

你手里的板上，几个部分分别负责这些事情：

| 部分 | 你现在需要知道的作用 |
| --- | --- |
| USB 插头 | 连接电脑，给控制板供电并传输数据 |
| 蓝色继电器 | 里面有可以切换连接的金属接点，也叫“触点” |
| COM、NO、NC 端子 | 把这个开关接入外部电路的位置；第一次练习先不接 |
| PWR 灯 | 电源指示；亮了不等于电脑已经能控制开关 |

本例的继电器外壳标有 **TONGLING（通灵）JQC-3FF-S-Z、5VDC**，板背面标有 `1 Channel USB Serial Relay`。

要分清两件事：`JQC-3FF-S-Z` 是**继电器元件型号**，不是整块 USB 控制板的型号；`5VDC` 是它的线圈电压标识，不是说三个接线端子会输出 5V。外壳上的电流、电压额定标识，也不能直接当成整块裸板的使用能力。

“单路”表示只有一个独立控制的开关，不是三个端子各控制一路。

## 二、COM、NO、NC 到底怎么用

先记两个词：

- **释放**：继电器没有被驱动，机构处于正常返回的位置。
- **吸合**：继电器被驱动，机构切换到另一个位置，通常可以听到切换声。

三个端子中，COM 是公共端。它在这两个位置之间切换：

| 继电器状态 | COM 与 NO（常开） | COM 与 NC（常闭） |
| --- | --- | --- |
| 释放 | 断开 | 接通 |
| 吸合 | 接通 | 断开 |

如果想让一条回路在吸合时才接通，就使用 COM 和 NO；如果用 COM 和 NC，效果正好相反。这里说的是正常器件的稳定状态，通用定义可对照 [OMRON 继电器术语](https://www.ia.omron.com/support/guide/17/further_information.html)。

**本文把“开”称作吸合，把“关”称作释放。** 这样便于理解 COM—NO 的通断，但不是说“开继电器”就一定是开机器；接 NC 时关系相反，现场机器的控制方式也可能不同。

注意：**“释放”不等于“所有外设都关闭”**，还要看接的是 NO 还是 NC。上电后实际处于哪种状态，也要看控制板，不能只凭这个表猜。

找端子时认板上的字母，不记“上面那个”或“左边那个”。另外，板上的 `COM` 不是地线 `GND`，也不是接下来会看到的 Windows 串口名 `COM7`。

## 三、在 Windows 中找到这块板

电脑需要先知道“指令发给哪个设备”。Windows 给串口设备分配的名字通常是 `COM` 加一个数字，例如 `COM7`。

### 第 1 步：打开设备管理器

右键点击 Windows 开始菜单，打开“设备管理器”，展开“端口（COM 和 LPT）”。

本例电脑上看到的设备是：

```text
USB-SERIAL CH340 (COM7)
```

`CH340` 是 USB 转串口芯片的名称；括号中的 **COM7 才是代码要填写的串口号**。你的电脑可能是 COM3、COM8，按自己看到的填写，不要照抄编号。

### 第 2 步：确认没有选错设备

如果电脑有多个串口，可以在端子没有接线的条件下拔下、插回这块板，对比哪个条目消失又出现。不要拿蓝牙串口逐个试发指令。

如果没有出现对应设备，或者有黄色警告，再检查 USB 连接和驱动。CH340 驱动可从 [沁恒官方 CH341SER 下载页](https://www.wch.cn/downloads/CH341SER_EXE.html)取得。已经正常识别时，不必为了跟教程而重新装驱动。

**这一节做到：知道本次设备的实际串口号。** 找不到设备时，先停在这里，不急着运行控制代码。

## 四、准备运行 Python 的环境

这一节只用到三个名称：Python 负责运行程序，pip 负责安装工具，pySerial 负责让 Python 访问串口。

### 第 1 步：打开练习文件夹中的 PowerShell

在“文档”中新建一个文件夹，命名为 `UsbRelayDemo`，以后把代码放在这里。打开这个文件夹，在文件资源管理器的地址栏输入 `powershell`，按回车。

这样打开的命令窗口就在这个文件夹里。下面所有标为 PowerShell 的命令，都在这个窗口中**逐条输入，按回车执行**，不要一起粘进 Python 程序。

### 第 2 步：确认 Python 能运行

```powershell
python --version
```

正常时会显示类似 `Python 3.11.5` 的版本号；这是本例使用的版本，不要求你的版本号完全相同。

如果找不到 `python`，或跳到了商店而没有显示版本，先按 [Python 官方 Windows 安装说明](https://docs.python.org/3/using/windows.html)安装并确认命令可用，再继续。安装后需要重新打开 PowerShell。看到 `>>>` 表示误进了 Python 交互窗口，输入 `exit()` 回到 PowerShell。

### 第 3 步：安装串口工具

```powershell
python -m pip install pyserial==3.5
```

这条命令给当前这个 Python 安装 pySerial。安装包叫 `pyserial`，稍后代码写的是 `import serial`，这两个名字不同是正常的。

再运行一次只查看设备、不发送指令的命令：

```powershell
python -m serial.tools.list_ports
```

输出中应能找到你在设备管理器确认过的串口。如果报错，先看后面的排障表。这里统一使用 `python`，避免安装依赖和运行程序时用了不同的 Python。

### 文件夹里已经有 `.venv`，为什么还提示缺少 serial？

`.venv` 是这个项目自己的 Python 环境。**进入文件夹不会自动启用它。** 如果 pySerial 装在 `.venv` 里，直接输入 `python` 仍可能调用另一个没装依赖的 Python。

本次实际排查 `D:\demo\UsbRelayDemo` 时就遇到了这种情况：普通 `python` 指向 `D:\Developer Tools\Python311\python.exe`，没有 pySerial；`.venv\Scripts\python.exe` 已经安装 pySerial 3.5。

最直接的办法是指定这个环境的 Python，不需要先学激活命令，也不用修改 PowerShell 的执行策略。进入项目文件夹后，先做一个**不会操作继电器**的检查：

```powershell
.\.venv\Scripts\python.exe -c "import sys, serial; print(sys.executable); print(serial.__version__)"
```

正常会显示这个文件夹内的 Python 路径和 `3.5`。如果这个环境也缺少依赖，再运行：

```powershell
.\.venv\Scripts\python.exe -m pip install pyserial==3.5
```

使用哪一个 Python 运行程序，就用同一个 Python 的 `-m pip` 安装依赖。后面出现的 `python`，也要替换成 `.\.venv\Scripts\python.exe`。这符合 [Python 官方虚拟环境说明](https://docs.python.org/3/library/venv.html#how-venvs-work)：不激活也可以直接调用环境里的解释器。

## 五、一个程序，两个独立操作

安装好前面的环境、保存好代码后，日常只需要区分这两条命令：

| 想做什么 | 在 PowerShell 输入 | 程序只发送什么 |
| --- | --- | --- |
| 开：让继电器吸合 | `python .\relay_demo.py on` | `A0 01 01 A2` |
| 关：让继电器释放 | `python .\relay_demo.py off` | `A0 01 00 A1` |

**`on` 不会顺便执行 `off`。** 两条命令是两次独立操作，不需要修改代码里的指令，也没有两秒后自动释放的步骤。

### 第 1 步：保存代码，只改串口号

可以直接下载 [relay_demo.py：入门示例](/examples/usb-relay/relay_demo.py)，放进刚才的 `UsbRelayDemo` 文件夹，用记事本打开编辑。也可以新建文件，复制下面的完整代码。

文件名必须是 **relay_demo.py**，不是 `relay_demo.py.txt`。可以用代码块右上角的复制按钮复制完整代码。下载文件采用 **UTF-8 BOM** 编码，带有帮助 Windows 工具识别中文的文件头；它不会作为继电器指令发送。

如果自己复制保存，在记事本“另存为”中选择“所有文件”和“带有 BOM 的 UTF-8”（不同版本也可能叫“UTF-8 with BOM”）。不要保存为 ANSI。如果中文已经变成不认识的字符，重新下载或复制本页代码，不要仅把乱码文件改存为 UTF-8；改编码不会自动还原已经损坏的文字。

**适用范围：**下面两条指令已在本例 COM7 设备上实际发送，通信速率为 9600；使用者已确认听到了本次测试的切换声。其他 USB 继电器即使同样写着 CH340 或 JQC-3FF-S-Z，也不一定适用；应先对照整块板的卖家协议，不能只看继电器外壳型号判断。

```python
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
```

第一次只改 `PORT = "COM7"` 中的编号。例如设备管理器显示 COM8，就把它改成 `PORT = "COM8"`，然后保存。不要改代码缩进，也不用修改指令中的数字。

### 第 2 步：先单独执行“开”

再次看一眼：**三个端子都没有接线，串口号已经核实，其他串口调试工具已经关闭。** 然后在 PowerShell 输入：

```powershell
python .\relay_demo.py on
```

程序会停在确认提示处，不会立即打开串口。确实满足空载条件后，输入小写的 `yes`，按回车；输入其他内容会取消。

正常写出后会提示：

```text
已发送开（吸合）指令。
```

这时留意继电器是否有切换声、SW 指示灯是否变化。程序随后结束，**不会再补发关指令**；程序退出和继电器释放是两回事。

### 第 3 步：需要关闭时，再单独执行“关”

仍然保持空载，在同一窗口输入：

```powershell
python .\relay_demo.py off
```

确认端子未接线后，输入小写 `yes`，按回车。正常写出后会提示：

```text
已发送关（释放）指令。
```

这条命令只发送关指令，不会先开一次。以后要再开，就重新运行 `on`；要再关，就运行 `off`。

如果前面检查用的是 `.venv`，这里也指定它。确认仍然空载后，**只选择当前需要的一条执行**，不是让你把两条一起粘贴：

```powershell
.\.venv\Scripts\python.exe .\relay_demo.py on
.\.venv\Scripts\python.exe .\relay_demo.py off
```

如果原本已经释放，再发关指令可能没有声音；已经吸合时再发开也一样。**控制状态，不等于每执行一次就切换一下。** 没有预期动作时，先按后面的表排查，不反复猜指令。

## 六、看懂代码里的“开”和“关”

### 1. 导入工具，记住设备地址

`import sys` 用来取得命令后面写的 `on` 或 `off`，`import serial` 提供串口功能。`PORT` 是一个变量，可以理解成“给串口号起一个名字”，后面不用反复填写它。

`try` / `except ModuleNotFoundError` 用来处理缺少串口工具的情况：没有安装时，程序给出安装命令后退出，不打开串口。提示中的 `sys.executable` 是本次实际使用的 Python 路径，方便把依赖装进正确环境；路径外的引号和前面的 `&` 是 PowerShell 调用带空格路径的写法。

`COMMANDS` 是一张小对照表，也叫“字典”：`on` 对应吸合指令，`off` 对应释放指令。你不需要运行两份不同代码，只要在命令后面选一个动作。

`sys.argv` 保存命令行参数，`sys.argv[1]` 取出程序名后面的那个词。只接受一个参数，并且只能是小写 `on` 或 `off`；没写、拼错或多写时，程序显示用法并退出，不打开串口。后面的 `COMMANDS[sys.argv[1]]` 就是在对照表里查找本次动作的指令。[Python 官方参数说明](https://docs.python.org/3/library/sys.html#sys.argv)解释了这个列表。

`input(...)` 会显示提示并等待你输入；`!= "yes"` 表示输入的内容不是小写 yes。若条件成立，`SystemExit` 结束程序。**这只是人工确认，程序不能自动检查端子有没有接线。**

### 2. 打开串口

`serial.Serial(PORT, 9600, write_timeout=1)` 的意思是：打开指定设备，用 9600 的通信速率发送，写入超时设为 1 秒。

没有另外写出的数据格式使用 pySerial 默认值：8 个数据位、无奇偶校验、1 个停止位，流控关闭。第一次先按模块约定使用，不要把 9600 改得越大越好。

`with ... as relay:` 给打开的串口起名为 `relay`，离开这段缩进代码时会关闭串口。它关闭的是通信连接，**不是自动向继电器发释放指令**。[pySerial API](https://pyserial.readthedocs.io/en/latest/pyserial_api.html)说明了这些参数和方法。

### 3. 发送两种动作指令

| 代码中的选择 | 取出的四字节指令 | 本例协议要表达的动作 |
| --- | --- | --- |
| `COMMANDS["on"]` | `A0 01 01 A2` | 开：吸合 |
| `COMMANDS["off"]` | `A0 01 00 A1` | 关：释放 |

可以先把它们当成遥控器的两个按键编码，不需要先学会计算每个数字。

`bytes.fromhex(...)` 把写给人看的十六进制数字转换成真正要发的四个字节；`relay.write(...)` 负责发送。不要把这一句改成发送字符串 `"1"`，也不要自行加回车换行。[Python 字节类型说明](https://docs.python.org/3/library/stdtypes.html#bytes.fromhex)可用于继续了解这种写法。

`written` 是串口库报告写出的字节数。每条指令应当是 4 个字节，数量不对就报错；`relay.flush()` 等待待发送数据写出。它们都不是在查询真实触点。

### 4. 为什么没有等待和“退出时自动关”

因为这次要的是两个独立操作，而不是做一段自动演示。`on` 只写吸合，`off` 只写释放，所以程序里不需要等待几秒，也不在结束或出错时悄悄发送另一个动作。

最后一行只打印本次发送的动作，**没有读取实际触点状态**。如果写入或等待写出失败，程序会先报错，不会显示正常完成的提示。遇到异常，实际状态可能不明确，需要现场检查；不能靠“把 Python 窗口关掉”代替关指令。

Python 用行首空格区分代码属于哪一段，所以复制时要保留缩进。先练习说清楚：**端口是给谁发，动作是发什么，发送结束不是触点回读。** 不需要为了操作开关而学习循环、定时器或复杂参数框架。

## 七、继电器没有动作时，检查这几项

| 现象 | 下一步做什么 |
| --- | --- |
| PWR 亮，设备管理器没有对应串口 | 检查 USB 数据连接和驱动；灯亮只能说明有供电指示 |
| 提示找不到 COM 口 | 重新看设备管理器，检查 USB 是否仍连接、端口号是否变化 |
| 打开串口时提示拒绝访问 | 关闭占用该串口的调试工具或其他控制程序，再检查 USB 连接 |
| 程序无报错，但没有预期动作 | 先确认不是重复发送当前状态，再核对串口号、供电和整板协议；不要猜其他指令反复发送 |

想进一步检查开关是否真的导通，可以请熟悉万用表的人协助：**端子不接外部电源或负载，USB 只给控制板供电**，按万用表说明书使用通断档，比较释放与吸合时 COM—NO、COM—NC 的变化。不要对带外部电压的电路使用通断档，也不要把表笔插在电流档插孔中测量。

声音是机构动作的线索，SW 灯是指示线索，触点测量才是在检查电连接。记录自己实际观察到什么，不把“没有报错”写成“设备已经验证正常”。

## 八、用一个小灯例子理解接线

这一节只解释原理，不是本次已经接线成功的实验。前面的程序仍然只用于空载，不要接了灯还输入 yes。

假设有一盏**额定 5V、已内置限流的成品直流指示灯**和匹配的独立电源，把开关串进回路：

```text
外部电源正极 → COM → 继电器内部触点 → NO → 指示灯正极
外部电源负极 ←──────────────────────── 指示灯负极

NC 不接；USB 单独连接电脑。
```

正常释放时，COM—NO 断开，灯的回路被切断；正常吸合时，它们接通，外部电源才可以给灯供电。**电来自外部电源，不来自 COM 端子。**

不要把电源正负极直接接在 COM、NO 两端，那样闭合后会短路；也不要用裸 LED 代替成品指示灯直接接 5V。真正接负载时，需要另外核对整板能力、灯的参数、线材及保护措施，断开电源后再接线。本文不提供市电接线步骤。

## 九、以后怎样与网页系统联动

读到这里，先完成本地空载练习就够了。下面是接入项目时的方向，不需要现在复制额外代码。

如果 Spring Boot 部署在远端，继电器插在现场 Windows 电脑上，可以让现场电脑运行一个后台控制程序：

```text
已有异常结果 → Spring Boot → 现场后台程序 → USB 继电器 → 机器控制输入
网页上的用户确认 → Spring Boot → 现场后台程序 → 解除停止信号
```

网页负责显示和确认，现场程序负责操作 USB。它应独立运行，不能依赖用户一直开着网页。远端与现场可以通过 WebSocket 等方式通信，Spring 有[官方支持](https://docs.spring.io/spring-framework/reference/web/websocket.html)。

本篇已经把两个动作分开，但**这仍不是完整的现场常驻控制服务**。实际接入还需要保留停止状态、断线重连、指令结果和确认恢复处理，并根据机器输入要求决定使用持续接点还是脉冲。不能把 `off` 固定写成“停机器”，也不能把 `on` 固定写成“开机器”；解除停止信号不一定等于机器自动启动，现场独立按钮仍按原有方式工作。

## 十、这次练习到哪里才算完成

你至少应该能回答：自己的设备是哪个串口？COM 与 NO 在什么时候接通？代码哪一行发送吸合，哪一行发送释放？程序提示和实际动作有什么区别？

2026 年 10 月 20 日，在使用者确认“只有 USB，三个端子没有外部接线”之后，先进行实物串口测试，再修订本节文档。Windows 识别到 `USB-SERIAL CH340 (COM7)`，USB 标识为 `1A86:7523`。

| 本地时间（UTC+8） | 实际运行的短程序 | 软件检查结果 |
| --- | --- | --- |
| 13:50:09 | `relay_demo.py on` | 吸合指令的 4 个字节写出，等待写出完成，程序正常退出 |
| 13:50:23 | `relay_demo.py off` | 释放指令的 4 个字节写出，等待写出完成，程序正常退出 |

这是两个独立进程，中间约 14 秒是本次手动安排的间隔，不是程序定时功能，也不是经过测量的触点保持时间。测试最后发送的是关（释放）指令。

**使用者已确认听到了本次测试的切换声。** 这属于现场反馈，不是作者通过程序听到了声音。触点通断未做万用表测量，没有万用表实测证据，也没有测试任何外部负载、电脑断电或上电默认状态。

模块附带文件仅用于核对协议，不是本文的授课主线，也不要求读者阅读它。表中是独立开、关短程序的实际执行记录；后续修订补充了编码标识和缺少依赖时的提示，并精简输出，串口控制逻辑未改，修订后只做离线验证，没有再向设备发送指令。

## 参考资料与可选下载

资料核对日期：2026 年 10 月 20 日。这里区分通用知识、软件接口与本例板卡；没有整板说明书的部分，不推测负载能力、上电默认状态或状态查询指令。

- [OMRON 通用继电器术语](https://www.ia.omron.com/support/guide/17/further_information.html)：常开、常闭和触点的基础定义，不是本板的产品说明。
- [沁恒 CH340 资料](https://www.wch.cn/products/CH340.html)、[Windows 驱动](https://www.wch.cn/downloads/CH341SER_EXE.html)：USB 转串口芯片及驱动来源，不能据此判断继电器控制协议。
- [Python Windows 使用说明](https://docs.python.org/3/using/windows.html)、[命令行参数](https://docs.python.org/3/library/sys.html#sys.argv)、[字节类型](https://docs.python.org/3/library/stdtypes.html#bytes.fromhex)：环境与语法依据。
- [pySerial 入门](https://pyserial.readthedocs.io/en/latest/shortintro.html)、[API](https://pyserial.readthedocs.io/en/latest/pyserial_api.html)：串口枚举、打开、发送和关闭的依据。

<details>
<summary>可选：其他文件与原工具（第一次练习可以跳过）</summary>

正文只需要 `relay_demo.py`。下面保留依赖文件、离线测试和参数更多的原教学工具，方便以后查看，不要求新手先学习它们。

- [requirements.txt：依赖版本](/examples/usb-relay/requirements.txt)
- [README.md：操作说明](/examples/usb-relay/README.md)
- [test_relay_demo.py：短示例的离线测试](/examples/usb-relay/test_relay_demo.py)
- [relay_control.py：带参数检查的原教学工具](/examples/usb-relay/relay_control.py)
- [test_relay_control.py：原工具的离线测试](/examples/usb-relay/test_relay_control.py)

原工具仍保留只枚举、不连接硬件的演练、USB 标识检查和空载确认参数，具体命令见 README。离线测试使用串口替身，不驱动实物；测试通过不等于硬件验收。

</details>
