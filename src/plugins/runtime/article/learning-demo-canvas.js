export function prepareCanvas(canvas, width, height) {
  if (!canvas) return null;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = width * scale;
  const targetH = height * scale;
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return ctx;
}

export function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawCoordinatePlot(ctx, options) {
  const {
    plot,
    samples,
    yTicks,
    displayWeight,
    displayBias = 0,
    errorWeight,
    errorBias = 0,
    showBias = false,
    revealedCount,
    isZeroMatch,
    lineEndX,
    prediction,
    formatNum = (v) => String(v)
  } = options;

  const toPx = (x) => plot.left + (x / plot.xMax) * (plot.right - plot.left);
  const toPy = (y) => plot.bottom - (y / plot.yMax) * (plot.bottom - plot.top);

  // Coordinate grid
  ctx.strokeStyle = '#20374e';
  ctx.lineWidth = 1;
  for (let gx = 1; gx <= 4; gx += 1) {
    const x = toPx(gx);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  }
  for (const gy of yTicks) {
    if (gy === 0) continue;
    const y = toPy(gy);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#5f7d99';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top - 4);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right + 4, plot.bottom);
  ctx.stroke();

  ctx.fillStyle = '#94adc4';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let gx = 0; gx <= 4; gx += 1) {
    ctx.fillText(String(gx), toPx(gx), plot.bottom + 14);
  }
  ctx.textAlign = 'right';
  for (const gy of yTicks) {
    ctx.fillText(String(gy), plot.left - 7, toPy(gy) + 4);
  }

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('输出 y（预测 vs 答案）', plot.left, 19);
  ctx.textAlign = 'right';
  ctx.fillText('输入 x', plot.right, plot.bottom + 14);

  // Active candidate line y = weight * x + bias
  if (displayWeight !== null && displayWeight !== undefined) {
    const clippedX =
      displayWeight > 0
        ? Math.min(lineEndX, Math.max(0, (plot.yMax - 0.4 - displayBias) / displayWeight))
        : lineEndX;

    ctx.save();
    ctx.strokeStyle = isZeroMatch ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(toPx(0), toPy(displayBias));
    ctx.lineTo(toPx(clippedX), toPy(clippedX * displayWeight + displayBias));
    ctx.stroke();

    if (showBias) {
      ctx.fillStyle = isZeroMatch ? '#22c55e' : '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(toPx(0), toPy(displayBias), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const pillText = showBias
      ? `y = ${formatNum(displayWeight)} × x + ${formatNum(displayBias)}`
      : `y = ${formatNum(displayWeight)} × x`;
    ctx.font = '700 12px monospace';
    const pillW = ctx.measureText(pillText).width + 16;
    ctx.fillStyle = isZeroMatch ? 'rgba(21, 128, 61, 0.28)' : 'rgba(180, 83, 9, 0.28)';
    ctx.strokeStyle = isZeroMatch ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, plot.left + 10, plot.top + 4, pillW, 22, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isZeroMatch ? '#4ade80' : '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(pillText, plot.left + 18, plot.top + 19);
    ctx.restore();
  }

  // Samples and vertical error segments
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const sx = toPx(sample.x);
    const syExp = toPy(sample.expected);

    if (i < revealedCount && errorWeight !== null && errorWeight !== undefined) {
      const predicted = sample.x * errorWeight + errorBias;
      const err = Math.abs(predicted - sample.expected);
      const syPred = toPy(predicted);

      if (err > 1e-6) {
        ctx.save();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, syExp);
        ctx.lineTo(sx, syPred);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#132334';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, syPred, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const midY = (syExp + syPred) / 2;
        ctx.fillStyle = '#fb7185';
        ctx.font = '700 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`差${formatNum(err)}`, sx + 8, midY + 4);
      } else {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(sx, syExp, 9.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.font = '700 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('差0', sx + 11, syExp + 4);
      }
    }

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx, syExp, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`(${sample.x},${sample.expected})`, sx - 8, syExp + 4);
  }

  // Final prediction pin
  if (prediction) {
    const px4 = toPx(prediction.x);
    const py4 = toPy(prediction.y);
    const exactHit = Boolean(prediction.exact ?? true);

    ctx.save();
    ctx.strokeStyle = exactHit ? '#34d399' : '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px4, plot.bottom);
    ctx.lineTo(px4, py4);
    ctx.lineTo(plot.left, py4);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = exactHit ? '#22c55e' : '#f59e0b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px4, py4, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = exactHit ? '#4ade80' : '#fbbf24';
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `预测 (${prediction.x}, ${formatNum(prediction.y)})`,
      px4 - 16,
      Math.max(plot.top + 14, py4 - 12)
    );
  }
}
