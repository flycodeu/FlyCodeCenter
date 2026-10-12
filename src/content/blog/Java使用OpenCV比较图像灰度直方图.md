---
title: Java使用OpenCV比较图像灰度直方图
createTime: '2026/03/01 19:23:46'
code: b3ldoapuj
permalink: /blog/b3ldoapuj/
tags:
  - OpenCv
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/f4005b755563b4f1159e0b98f749683c.jpg
---

灰度直方图比较的是亮度分布，不包含像素位置。两张内容不同的图片也可能有相似直方图，不能把相关性当人脸身份判断或统一的相似概率。

## 准备依赖

使用 Java 17 以上，在 Maven 项目添加：

```xml
<dependency>
  <groupId>org.openpnp</groupId>
  <artifactId>opencv</artifactId>
  <version>4.9.0-0</version>
</dependency>
```

OpenPnP 包带有本地库加载器，支持的平台由该包决定；不用再混装另一版本的官方 DLL。完整 Maven 结构可参考 Java HTML 解析文章，替换依赖。

## 比较两张图

保存 `HistogramDemo.java`：

```java
import java.util.List;
import org.opencv.core.Mat;
import org.opencv.core.MatOfFloat;
import org.opencv.core.MatOfInt;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;

public class HistogramDemo {
    private static Mat histogram(Mat image) {
        Mat hist = new Mat();
        Mat mask = new Mat();
        MatOfInt channels = new MatOfInt(0);
        MatOfInt bins = new MatOfInt(256);
        MatOfFloat ranges = new MatOfFloat(0, 256);
        try {
            Imgproc.calcHist(List.of(image), channels, mask, hist, bins, ranges);
            return hist;
        } catch (RuntimeException error) {
            hist.release();
            throw error;
        } finally {
            mask.release(); channels.release(); bins.release(); ranges.release();
        }
    }
    public static void main(String[] args) {
        if (args.length != 2) throw new IllegalArgumentException("参数：图片1 图片2");
        nu.pattern.OpenCV.loadLocally();
        Mat first = Imgcodecs.imread(args[0], Imgcodecs.IMREAD_GRAYSCALE);
        Mat second = Imgcodecs.imread(args[1], Imgcodecs.IMREAD_GRAYSCALE);
        Mat a = null, b = null;
        try {
            if (first.empty() || second.empty()) throw new IllegalArgumentException("图片无法读取");
            a = histogram(first);
            b = histogram(second);
            double correlation = Imgproc.compareHist(a, b, Imgproc.HISTCMP_CORREL);
            System.out.println("灰度分布相关性=" + correlation);
        } finally {
            first.release(); second.release();
            if (a != null) a.release();
            if (b != null) b.release();
        }
    }
}
```

```powershell
mvn package dependency:copy-dependencies
java -cp 'target/classes;target/dependency/*' HistogramDemo demo.png demo.png
```

Linux/macOS classpath 使用冒号。相同图片预期相关性接近 1；替换第二张图片再比较，注意它不是百分比。输入路径错误时应明确失败，不能返回 0 掩盖读取异常。

256 个 bin 按灰度计数，直方图维度一致即可比较，不要求两张图的像素尺寸相同。相关性采用该比较方法定义，退化分布也可能产生缺乏区分度的结果，应结合具体数据检查。

参考：[OpenCV 直方图比较](https://docs.opencv.org/4.x/d8/dc8/tutorial_histogram_comparison.html)、[OpenPnP OpenCV 包](https://github.com/openpnp/opencv)。
