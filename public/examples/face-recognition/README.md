# 人脸与活体：算法示例

配套教程：/tutorials/face-recognition/。所有脚本独立读取本地图片，不依赖业务项目，不上传或保存输入图片。

| 文件 | 作用 |
| --- | --- |
| algorithms.py | 标准库：余弦距离、softmax、姿态与嘴眼比例 |
| face_io.py | NumPy/OpenCV：图片读取、YuNet 单脸检测 |
| compare_faces.py | 两图比对：YuNet → SFace 对齐与特征 → 余弦 |
| single_image_pad.py | 单图防伪：YuNet → 上游裁剪 → MiniFASNetV2 → softmax |
| pnp_pose.py | 合成三维点的 PnP 回归 |
| landmark_camera.py | 可选摄像头几何观察，不做活体判定 |
| test_algorithms.py | 纯数学测试 |
| test_image_pipeline.py | 输入处理与判定规则测试，不测模型准确率 |

Python 3.11，示例依赖：

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install numpy==1.26.4 opencv-python==4.11.0.86
.\.venv\Scripts\python -m pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python -m unittest test_algorithms test_image_pipeline -v
```

从 OpenCV Zoo 获取完整的 face_detection_yunet_2023mar.onnx、face_recognition_sface_2021dec.onnx，放入 models。不要下载成 Git LFS 指针文件。

```powershell
.\.venv\Scripts\python compare_faces.py a.jpg b.jpg --detector models/face_detection_yunet_2023mar.onnx --recognizer models/face_recognition_sface_2021dec.onnx --threshold 0.363
New-Item -ItemType Directory -Force Silent-Face-Anti-Spoofing/src/model_lib,Silent-Face-Anti-Spoofing/resources/anti_spoof_models | Out-Null
$faceSource = 'https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/b6d5f04ad78778917853b25c778acef6d5626d15'
Invoke-WebRequest "$faceSource/src/model_lib/MiniFASNet.py" -OutFile Silent-Face-Anti-Spoofing/src/model_lib/MiniFASNet.py
Invoke-WebRequest "$faceSource/src/generate_patches.py" -OutFile Silent-Face-Anti-Spoofing/src/generate_patches.py
Invoke-WebRequest "$faceSource/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth" -OutFile Silent-Face-Anti-Spoofing/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth
.\.venv\Scripts\python single_image_pad.py face.jpg --detector models/face_detection_yunet_2023mar.onnx --repo Silent-Face-Anti-Spoofing --weights Silent-Face-Anti-Spoofing/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth --threshold 0.8
```

0.363 是官方 SFace 的 LFW 示例相似度阈值；0.8 仅用于展示 PAD 输出。都不能直接解释为通用安全阈值。

PAD 固定使用 2.7 倍上游裁剪、80×80 BGR、float32 0–255、NCHW、三类 logits 的索引 1。不支持随意换权重。权重 SHA-256：a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0。只加载可信权重。

上游代码与模型各自的许可、使用限制仍适用。网站不附带权重或输入照片。

几何示例：
```powershell
.\.venv\Scripts\python pnp_pose.py
```

摄像头观察器额外安装 mediapipe==0.10.31，并从 MediaPipe 官方页面获取 face_landmarker.task：
```powershell
.\.venv\Scripts\python -m pip install mediapipe==0.10.31
.\.venv\Scripts\python landmark_camera.py --model models/face_landmarker.task
```
