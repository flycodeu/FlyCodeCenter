---
title: BGM状态机
createTime: '2026/03/22 13:45:53'
code: t13pbh4ry
permalink: /tutorials/t13pbh4ry/
order: 6
---
# Godot 音频系统设计实战：从 BGM 状态机到设置界面状态机

在做游戏设置系统时，音频往往是最容易“先做出来”，也最容易“后期变乱”的一部分。

一开始可能只是：

- 主菜单里放一个 AudioStreamPlayer
- 设置界面里加一个“音乐音量”滑块
- 点保存后改一下音量

但随着项目推进，很快就会遇到一系列真实问题：

- 背景音乐播放完不会自动循环
- 一个场景结束后，下一首 BGM 怎么接 
- 主菜单、战斗、图鉴、结算界面如何切歌 
- 用户调整音量时，为什么当前音乐没有即时变化 
- 总音量、音乐音量、音效音量如何分层管理

设置界面页签越来越多，逻辑越来越乱，如何用状态机整理

如果这些逻辑都直接写在场景脚本里，后面几乎一定会出现：
- 场景之间相互耦合 
- 音频逻辑重复 
- 设置保存和实时试听互相覆盖 
- 后续扩展困难

所以更合理的做法，是从一开始就把音频系统拆成几个清晰的模块。

这篇文章就围绕三个核心展开：

- 音频总线与音量控制
- BGM 状态机设计 
- 设置界面状态机设计

并用 Godot 中的实际项目结构，给出一套可扩展的实现思路。

## 一、先明确目标：这个音频系统到底要解决什么问题

一个真正可用的音频系统，至少应该覆盖下面这些需求：

1. 背景音乐
- 可以播放单首音乐 
- 可以播放歌单 
- 播放结束后自动循环 
- 可以顺序播放，也可以随机播放 
- 不同界面进入时可以自动切换歌单 
- 可以随时切换到指定曲目

2. 音量控制
- 支持总音量 
- 支持音乐音量 
- 支持音效音量 
- 拖动滑块时可以实时试听 
- 点击保存后会写入本地配置 
- 下次启动仍然恢复

3. 设置界面
- 支持不同页签切换
- 不同设置项分区清晰
- 打开界面时能够自动回显当前设置
- 点击保存后统一应用
- 后续容易继续加语言、键位、辅助功能等配置

如果只做临时逻辑，短期看似简单，长期会越来越乱。
因此比较稳妥的方式是：
- 用 `Audio Bus` 解决音量分层
- 用 `BgmManager`解决背景音乐播放状态
- 用 `SettingsManager` 解决配置存储与应用
- 用 `SettingsPopup` 解决设置界面状态切换

## 二、音频总线：整套音频系统的基础

在 Godot 里，真正决定音量控制结构是否清晰的，不是某个 AudioStreamPlayer 节点，而是 Audio Bus。

推荐的基础结构非常简单：
- Master 
- BGM 
- SFX

![](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/20260322135003226.png)

各自职责

Master
- 全局总音量。
- 所有声音最终都经过 Master。

BGM
- 背景音乐总线。 
- 主菜单音乐、战斗音乐、城镇音乐、图鉴音乐都走这里。

SFX
- 音效总线。
- 按钮点击、抽卡、出牌、命中、UI 提示音都走这里。

为什么必须这么拆

如果不分 Bus，而是每个播放器各调各的音量，后面会有几个问题：

- 很难统一控制 
- 设置界面无法清晰映射到音频逻辑 
- 想做“整体音量”时需要逐个播放器处理 
- 想做“背景音乐静音但音效正常”会很麻烦

有了这三层 Bus，设置界面里的三个滑块就天然有了归属：

- 整体音量 → Master
- 音乐音量 → BGM
- 音效音量 → SFX

这就是为什么音频总线是整个系统的第一步。

## 三、SettingsManager：音量设置的中枢

设置界面不是直接控制某个播放器，而是应该通过一个统一的配置管理器来处理。

例如：
```gd
const DEFAULTS := {
    "audio": {
        "master_volume": 0.8,
        "music_volume": 0.7,
        "sfx_volume": 0.8
},
"display": {
    "resolution": "1600x900",
    "display_mode": "windowed"
},
"keybind": {}
}
```
这段结构有两个很重要的意义：

1. 默认值集中管理

所有设置的默认值统一放在一处，不会分散在各个 UI 脚本里。

2. 设置项天然分组

- `audio` 负责声音 
- `display` 负责显示 
- `keybind` 负责按键

这让后面无论是读取、保存，还是设置界面回显，都非常清晰。

音频应用逻辑

在 `SettingsManager` 里，音频设置最终应该统一落到 `_apply_audio()`：
```gd
func _apply_audio() -> void:
    var master_volume := float(data["audio"].get("master_volume", DEFAULTS["audio"]["master_volume"]))
    var music_volume := float(data["audio"].get("music_volume", DEFAULTS["audio"]["music_volume"]))
    var sfx_volume := float(data["audio"].get("sfx_volume", DEFAULTS["audio"]["sfx_volume"]))
	_set_bus_volume_linear("Master", master_volume)
	_set_bus_volume_linear("BGM", music_volume)
	_set_bus_volume_linear("SFX", sfx_volume)
```
这段逻辑的本质是：
设置界面不直接控制播放器，而是统一控制总线。
这会带来一个非常大的好处：

- 只要 BGM 播放器走的是 BGM 总线
- 只要 SFX 播放器走的是 SFX 总线

那么任何时候调用 `SettingsManager.apply_all()`，整个项目的声音都会自动同步。

## 四、BGM 系统为什么要设计成状态机

很多项目一开始会在主菜单里放一个：
```gd
[node name="bgm_player" type="AudioStreamPlayer" parent="."]
autoplay = true
bus = &"BGM"
```
这当然可以播放音乐，但它不是一个“音乐系统”，只是一个“能响的播放器”。

一旦项目变复杂，就会遇到这些问题：

- 单曲播完后怎么办
- 多首曲目如何循环
- 进入战斗时如何自动切歌 
- 图鉴界面是否要独立音乐 
- 暂停、恢复、切下一首如何管理 
- 未来要不要加随机播放、淡入淡出、插播 Boss 曲

如果这些都直接靠 `if/else` 堆在场景里，后续很容易失控。

所以更合理的做法，是用一个全局的 `BgmManager`，并把它设计成一个轻量状态机。

## 五、BGM 状态机怎么设计

这里的“状态机”，不是指复杂到有十几种状态的 AI 系统。
对 BGM 来说，最实用的是围绕“当前播放状态”来组织。

一个最常见的划分是：
```gd
Idle      空闲，没有播放
Playing   正在播放
Paused    暂停
Stopped   主动停止
```
再加上一层“播放策略”：
```gd
Sequential   顺序播放
Random       随机播放
```
于是整个 BGM 系统就可以拆成：

1. 播放状态

- 当前有没有播放
- 当前是否暂停

2. 当前歌单状态

- 当前播放哪个歌单
- 当前播到第几首 
- 当前播放模式是什么

一个典型结构
```gd
enum PlayMode {
SEQUENTIAL,
RANDOM
}

var current_playlist_name: String = ""
var current_tracks: Array = []
var current_index: int = -1
var play_mode: int = PlayMode.SEQUENTIAL
var loop_playlist: bool = true
```
这个结构已经足够覆盖：

- 顺序播放 
- 单首循环 
- 歌单循环 
- 随机播放 
- 指定曲目切换

## 六、BGM 状态机的核心流转

以顺序播放为例，BGM 状态机可以这样理解：

1. 进入主菜单

调用：
```gd
BgmManager.play_playlist("menu")
```
此时状态变为：
当前歌单：menu
当前索引：0
当前状态：Playing

2. 当前曲目播放结束
```gd
AudioStreamPlayer.finished 触发。
```
`BgmManager` 收到事件后：

如果只有一首歌并允许循环 → 重新播放当前曲

如果是顺序播放 → 切到下一首

如果到了末尾且允许歌单循环 → 回到第一首

如果不循环 → 状态变为 Stopped

3. 切换到战斗场景

调用：
```gd
BgmManager.play_playlist("battle")
```
状态机会把当前歌单切成战斗歌单，当前索引重置，并进入新的播放状态。

4. 暂停 / 恢复

例如：
```gd
BgmManager.pause_bgm()
BgmManager.resume_bgm()
```
这里只改变“播放状态”，不改变当前歌单和当前曲目索引。

## 七、一个实用的 BgmManager 结构

`BgmManager` 可以设计成一个 `AutoLoad` 单例，专门负责背景音乐。

核心职责包括：

- 注册歌单 
- 播放歌单 
- 播放指定曲目 
- 切下一首 / 上一首 
- 监听播放结束 
- 根据状态机自动决定下一步行为

例如：
```gd
extends Node
signal track_changed(track_key: String, stream: AudioStream)
enum PlayMode {
SEQUENTIAL,
RANDOM
}

@onready var player: AudioStreamPlayer = AudioStreamPlayer.new()

var playlists: Dictionary = {}
var current_playlist_name: String = ""
var current_tracks: Array = []
var current_index: int = -1
var play_mode: int = PlayMode.SEQUENTIAL
var loop_playlist: bool = true
```
这里的思路很明确：

- `player` 只负责真正播放

- `BgmManager` 负责决定播什么、何时切歌、如何循环

- 外部场景只需要调用 `play_playlist()` 或 `play_track_by_key()`

这就是“状态机 + 管理器”的价值所在。

## 八、BGM 如何跟随音量变化

这是很多人会忽略但实际上非常重要的一点。

如果你的背景音乐播放器走的是：
```gd
player.bus = "BGM"
```
那么它本身不需要知道“设置界面的滑块是什么状态”。
因为它只要挂在 BGM 总线上，就会自动受到 BGM Bus 音量影响。

也就是说： 设置界面拖动“音乐音量”滑块 调用：
```gd
_set_bus_volume_linear("BGM", slider_music.value)
```
BGM 当前播放中的音乐 会立刻跟着变大变小

这就是“总线设计”的最大优势：

播放逻辑和音量逻辑天然解耦。

BgmManager 只管“播哪首歌”，
SettingsManager 只管“BGM 总线多大声”，
两者不需要互相侵入。

## 九、设置界面为什么也适合做状态机

设置界面看起来只是几个按钮切页，但它其实也是一个天然状态机。

最简单的状态定义就是：
```gd
const TAB_AUDIO := 0
const TAB_VIDEO := 1
const TAB_KEYBIND := 2
```
然后统一通过一个方法控制页面显示：
```gd
func _switch_tab(tab_index: int) -> void:
    page_audio.visible = tab_index == TAB_AUDIO
    page_video.visible = tab_index == TAB_VIDEO
    page_keybind.visible = tab_index == TAB_KEYBIND
```
这就是一个最轻量但实用的“设置界面状态机”。

为什么这很重要

如果没有统一的状态切换入口，后面随着设置越来越多，你会慢慢出现这些问题：

- 某些页面没有正确隐藏 
- 页签高亮和实际页面不同步 
- 打开弹窗时不知道该回显哪一页 
- 某些按钮逻辑散落在多个地方

但如果用状态机思路来设计，就会非常清晰：
- 当前只会有一个激活页签
- 所有页签切换只走 _switch_tab()
- 后续扩展更多页面时，不会破坏现有逻辑

## 十、设置界面中的“音频状态”与“保存状态”

除了页签切换，其实设置界面本身还有另一层很实用的状态概念：

1. 当前 UI 状态

也就是当前显示哪一页：

- 音频页 
- 图像页 
- 按键页

2. 当前设置草稿状态

也就是用户正在滑动、正在修改，但还没保存的那份值
这就意味着，一个更成熟的设置界面，通常会区分：
- 预览状态：拖动滑块时立即试听 
- 已保存状态：点击保存后写入配置 
- 取消状态：关闭时恢复之前的值

你现在先做的是最常用的简化版：

- 滑块拖动时实时试听 
- 点击保存后正式写入 SettingsManager

以后如果继续优化，就可以加：

- 点击取消时恢复原始音量 
- 恢复默认值按钮

只有改动后才亮“保存”按钮

也就是说，设置界面后续还可以从“页签状态机”继续演进成“带草稿状态管理的设置系统”。

## 十一、音频页如何设计成可维护结构

以当前的设置界面为例，音频页最适合先做成这 3 行：

整体音量   [Slider]   80%
音乐音量   [Slider]   70%
音效音量   [Slider]   80%

它们的结构最好保持完全一致：

- 左边 Label
- 中间 Slider 
- 右边百分比 Label

这样会带来三个好处：

1. 用户理解成本低

三个设置的交互方式完全一致。

2. 代码更统一

同一个 `_on_audio_slider_changed()` 就能统一处理。

3. 后续更容易扩展

以后增加“语音音量”“环境音音量”，可以直接复用同样模式。

## 十二、拖动滑块时为什么要实时试听

如果用户拖动滑块却听不到变化，设置体验会非常差。
所以音频页最常见的交互是：

- 拖动 → 实时更新数值 
- 拖动 → 实时试听效果 
- 点击保存 → 正式写入配置

例如：
```gd
func _on_audio_slider_changed(_value: float) -> void:
    value_master.text = _to_percent(slider_master.value)
    value_music.text = _to_percent(slider_music.value)
    value_sfx.text = _to_percent(slider_sfx.value)
	_preview_audio_settings()
```
这里的 `_preview_audio_settings()` 并不需要改配置文件，它只是临时把总线音量调过去：
```gd
func _preview_audio_settings() -> void:
    _set_bus_volume_linear("Master", slider_master.value)
    _set_bus_volume_linear("BGM", slider_music.value)
    _set_bus_volume_linear("SFX", slider_sfx.value)
```
这样用户一边拖，一边就能听到结果。

## 十三、保存时为什么要统一交给 SettingsManager

如果设置界面自己保存配置文件，后面很快会出问题：

- 保存逻辑散落 
- 配置结构难以统一 
- 其他场景也想改设置时容易重复写代码

所以更推荐的模式是：

设置界面

只负责：

- 读取当前值 
- 显示给用户 
- 收集用户改动 
- 调用 SettingsManager 

SettingsManager 只负责：
- 管理配置数据 
- 统一应用到系统 
- 保存到本地文件

例如点击保存时：
```gd
SettingsManager.set_value("audio", "master_volume", slider_master.value)
SettingsManager.set_value("audio", "music_volume", slider_music.value)
SettingsManager.set_value("audio", "sfx_volume", slider_sfx.value)
SettingsManager.apply_all()
SettingsManager.save_settings()
```
这样后续无论哪个地方要改设置，都可以走同一套接口。

## 十四、整套链路如何串起来

现在把“背景音乐 + 音量控制 + 设置界面状态机”串在一起，完整的数据流就是：

1. 游戏启动

`SettingsManager._ready()` 读取配置，并调用：

`apply_all()`
2. `apply_all()` 进入 `_apply_audio()`
把：`master_volume` `music_volume` `sfx_volume`

分别应用到：

- Master 
- BGM 
- SFX

总线

3. BgmManager 中的播放器挂在 BGM 总线

所以当前正在播放的背景音乐，自动受到音乐音量控制。

4. 用户打开设置界面

`SettingsPopup` 进入某个页签状态，例如 `TAB_AUDIO`。

5. 音频页加载当前值

根据 `SettingsManager.get_value(...)` 把当前音量回显到滑块和百分比。

6. 用户拖动滑块

设置界面临时调整总线音量，实时试听。

7. 用户点击保存

设置界面把当前滑块值写回 SettingsManager，再统一 apply_all() 和 save_settings()。

8. 下次启动游戏

配置文件重新读取，声音恢复到上次保存值。

这就是一个完整、干净、可扩展的设置系统闭环。

## 十五、这套设计后续还可以扩展什么

一旦基础架构搭好，后续扩展会非常自然。

BGM 侧可以扩展

- 随机播放 
- 上一首 / 下一首 
- 淡入淡出 
- 场景切换自动换歌 
- 插播 Boss 曲后恢复主歌单 
- 按章节切换音乐主题 

设置界面侧可以扩展 
- 静音开关 
- 恢复默认值 
- 点击取消恢复原值 
- 更多页签（语言 / 辅助功能 / 游戏设置） 
- 键位绑定系统 
- 音效侧可以扩展 
- 按钮点击音效 
- 卡牌操作音效 
- 战斗命中音效

不同 UI 模块独立音效风格

也就是说，这套结构不是只服务当前主菜单，而是整个项目后续都能用。

## 十六、一个很重要的设计结论

很多项目早期会把“音频播放”“音量设置”“设置界面”分开临时写。
这样短期能跑，但后面非常容易失控。

更稳的设计思路是：

BGM 播放逻辑 交给 BgmManager

音量与配置 交给 SettingsManager

设置界面展示与交互 交给 SettingsPopup

页签切换 用状态机管理

换句话说：

BGM 管理器解决“播什么”，
设置管理器解决“多大声”，
设置界面状态机解决“用户现在正在改什么”。

当这三者职责清晰时，项目会比单纯堆功能稳定得多。
