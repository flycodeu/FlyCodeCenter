---
title: Web NVR录像回放：文件读取与Canvas时间轴
createTime: '2026/03/01 19:23:46'
code: bvaad5ll4
permalink: /blog/bvaad5ll4/
tags:
  - MediaMTX
  - 视频
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/efa331c41ff52b964587567007ab846d.jpg
---

在安防视频监控项目中，"历史回放"是最考验前端交互与后端稳定性的功能模块。与普通的视频网站不同，NVR 系统需要处理碎片化的视频文件（fmp4）、绝对时间轴的映射以及多片段的无缝衔接。

下面将录像索引、HTTP 文件访问和 Canvas 时间轴分开说明。代码依赖现有录像模型及文件定位逻辑，播放故障需要结合文件结构、Range 响应和浏览器解码日志排查。

## 一、 系统架构设计
- 视频源：MediaMTX 录制的 fmp4 文件，按日期分文件夹存储（流名称/日期/时间.mp4）。
- 后端：Spring Boot，负责文件检索和基于 RandomAccessFile 的字节流分发。
- 前端：HTML5 video + Canvas 自绘时间轴。不依赖庞大的第三方播放器库，以保证对底层 Seek 行为的控制。

## 二、 后端：稳健的视频流分发
对于 fmp4 格式（安防录像常用格式），Spring Boot 默认的 ResourceRegion 在处理 Chrome 的 Range 请求时，容易因 Content-Length
计算误差导致 FFmpegDemuxer 崩溃。我们需要手写底层的 IO 处理。

### 1. 文件检索接口
   首先，我们需要根据日期扫描磁盘，返回当天的录像片段列表。
```Java
@GetMapping("/search")
public R<List<VideoSegment>> search(@RequestParam String streamName, @RequestParam String date) {
// 1. 获取存储卷物理路径
HmRecordingPlan plan = planService.getByStream(streamName);
String dayPath = plan.getRootPath() + "/" + streamName + "/" + date;

    File dir = new File(dayPath);
    if (!dir.exists()) return R.data(new ArrayList<>());

    // 2. 扫描所有 .mp4 文件
    List<VideoSegment> segments = new ArrayList<>();
    File[] files = dir.listFiles((d, name) -> name.endsWith(".mp4"));
    
    if (files != null) {
        for (File f : files) {
            // 解析文件名获取时间戳 (假设文件名格式: 14-00-00.mp4)
            long startTime = parseTimeFromFileName(date, f.getName());
            long duration = 10 * 60 * 1000; // 假设切片为10分钟，生产环境应读取文件元数据
            
            // 生成流地址，指向下面的 streamVideo 接口
            String url = String.format("/static/videos/%d/%s/%s/%s", 
                plan.getVolumeId(), streamName, date, f.getName());
            
            segments.add(new VideoSegment(startTime, startTime + duration, url));
        }
    }
    // 按时间排序
    segments.sort(Comparator.comparingLong(VideoSegment::getBeginTime));
    return R.data(segments);

}
```
### 2. 返回支持 Range 的文件资源

Spring MVC 返回 `Resource` 或状态为 200 的 `ResponseEntity<Resource>` 时，可自动处理 Range。这里使用 `FileSystemResource`，不使用 `InputStreamResource`，也不需要手写只支持部分语法的 Range 解析器。参见 [Spring Range Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-range.html)。

```java
@GetMapping("/{volumeId}/{streamName}/{date}/{fileName}")
public ResponseEntity<Resource> streamVideo(
        @PathVariable Long volumeId,
        @PathVariable String streamName,
        @PathVariable String date,
        @PathVariable String fileName) throws IOException {
    // locateFile 需校验用户权限，且解析后的路径必须位于授权存储卷内。
    File file = locateFile(volumeId, streamName, date, fileName);
    if (!file.isFile()) {
        return ResponseEntity.notFound().build();
    }
    Resource resource = new FileSystemResource(file);
    return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("video/mp4"))
            .body(resource);
}
```

上例需引入 Spring 的 `Resource`、`FileSystemResource`、`ResponseEntity` 和 `MediaType`。只对已完成写入且可独立播放的 MP4 文件使用这个接口；原始 fMP4 媒体片段还可能需要初始化段和播放器封装支持。

## 三、 前端：时间轴与连贯播放
前端的核心难点在于：如何把一个个独立的视频文件，抽象成一个连续的时间流。
### 1. 播放器配置
   `preload` 是加载提示，可以按首帧需求选择 `none` 或 `metadata`，不能靠禁用预加载修复损坏文件或错误 Range 响应。
```HTML
<video id="player" playsinline preload="none" crossorigin="anonymous"></video>
```
### 2. 渲染循环：实现丝滑的时间轴滚动
不要使用 video.ontimeupdate 更新 UI，它的频率太低（250ms/次），会导致时间轴看起来卡顿。使用 requestAnimationFrame。
```JavaScript
let viewTime = Date.now(); // 当前视图中心代表的绝对时间戳

function startRenderLoop() {
const video = document.getElementById('player');

    function loop() {
        // 如果视频正在播放，根据当前相对时间计算绝对时间
        // 公式：当前绝对时间 = 当前片段开始时间 + 视频播放秒数 * 1000
        if (!isDragging && !video.paused) {
            const currentSrc = decodeURIComponent(video.src).split('?')[0];
            const currentSeg = videoSegments.find(s => currentSrc.includes(s.url));
            
            if (currentSeg) {
                viewTime = currentSeg.beginTime + (video.currentTime * 1000);
            }
        }

        // 每一帧都重绘 Canvas
        drawTimeline(); 
        requestAnimationFrame(loop);
    }
    loop();

}
```
### 3. Canvas 绘制逻辑
Canvas 绘制的核心是将时间戳映射为 X 轴坐标。
```JavaScript
function drawTimeline() {
const w = canvas.width;
const pxPerMs = 0.05; // 缩放比例

    // 计算视口的时间范围
    const timeWindow = w / pxPerMs;
    const startTime = viewTime - timeWindow / 2;
    const endTime = viewTime + timeWindow / 2;

    // 绘制录像片段（绿色条）
    ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
    videoSegments.forEach(seg => {
        // 视口外剔除优化
        if (seg.endTime < startTime || seg.beginTime > endTime) return;

        const x = (seg.beginTime - startTime) * pxPerMs;
        const width = (seg.endTime - seg.beginTime) * pxPerMs;
        ctx.fillRect(x, 60, Math.max(width, 2), 40);
    });
    
    // 绘制时间刻度... (代码略，原理同上)

}
```
### 4. 连贯播放与安全跳转（防 Crash）
切换片段时清理上一条加载流程，再等待新资源的元数据。
- 防缓存：URL 加时间戳。
- 跳转：核对 `duration` 和 `seekable`，不要把任意的前 2 秒禁跳当作格式要求。
- 自动连播：监听 ended 事件。
```JavaScript
// 播放指定片段逻辑
function playSegment(seg, offsetSeconds) {
const video = document.getElementById('player');

    // 1. 强制防缓存
    const playUrl = `${API_BASE}${seg.url}?_t=${Date.now()}`;
    
    // 2. 切换源的标准流程
    video.pause();
    video.removeAttribute('src'); 
    video.load(); // 重置解码器
    video.src = playUrl;

    // 3. 必须在元数据加载后才能跳转
    const onMetadata = () => {
        video.removeEventListener('loadedmetadata', onMetadata);
        
        // 跳转目标应位于该文件的时间范围内。
        if (Number.isFinite(offsetSeconds) && offsetSeconds >= 0 && offsetSeconds < video.duration) {
            video.currentTime = offsetSeconds;
        } else {
            video.currentTime = 0;
        }
        
        video.play().catch(console.warn);
    };
    
    video.addEventListener('loadedmetadata', onMetadata);
    video.load(); // 显式触发加载

}

// 监听播放结束，自动切片
video.addEventListener('ended', () => {
// 查找当前片段的下一个
const currentSeg = findSegmentByUrl(video.currentSrc);
const currentIndex = videoSegments.findIndex(s => s.url === currentSeg?.url);
const nextSeg = currentIndex >= 0 ? videoSegments[currentIndex + 1] : null;
if (nextSeg) {
playSegment(nextSeg, 0); // 从下一个片段的 0秒开始播
}
});
```
## 播放失败时检查什么

- 文件是否完整，MP4 初始化信息、轨道编码和索引是否可用。
- `Range` 请求是否返回正确的 206、`Content-Range` 和字节数，越界请求是否正确处理。
- 目标时间是否落在浏览器报告的可跳转范围内，见 [HTMLMediaElement.seekable](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seekable)。
- 切换源后是否还有旧回调修改 `currentTime`，结束事件是否误选回当前片段。
