(() => {
  const Game = window.CubDep;

  function getSelectedBlockLabel(state) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    return (labels && labels[state.player.selectedBlock]) || 'Блок';
  }

  function drawCompass(ctx, canvas, state) {
    const player = state.player;
    const cx = canvas.width - 74;
    const cy = 64;
    const radius = 34;
    const northAngle = -player.yaw;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,16,0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.translate(cx, cy);
    ctx.rotate(northAngle);
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(8, -5);
    ctx.lineTo(0, -10);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-northAngle);
    ctx.fillStyle = '#fff8e8';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -1);
    ctx.restore();
  }

  function drawUI3D(ctx, canvas, state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    drawCompass(ctx, canvas, state);

    ctx.fillStyle = 'rgba(8,12,16,0.58)';
    ctx.fillRect(18, 18, 92, 26);
    ctx.fillStyle = '#f5f0df';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`FPS ${Math.round(state.ui.fps || 0)}`, 30, 32);

    ctx.fillStyle = 'rgba(8,12,16,0.58)';
    ctx.fillRect(18, canvas.height - 52, 184, 34);
    ctx.fillStyle = '#f5f0df';
    ctx.font = '14px Arial';
    ctx.fillText(`Блок: ${getSelectedBlockLabel(state)}`, 30, canvas.height - 35);

    if (state.ui.noticeText) {
      ctx.fillStyle = 'rgba(8,12,16,0.62)';
      const width = Math.min(canvas.width - 36, Math.max(180, ctx.measureText(state.ui.noticeText).width + 32));
      ctx.fillRect((canvas.width - width) / 2, canvas.height - 82, width, 30);
      ctx.fillStyle = '#fff8e8';
      ctx.textAlign = 'center';
      ctx.fillText(state.ui.noticeText, canvas.width / 2, canvas.height - 64);
    }
    ctx.restore();
  }

  Game.ui3d = { drawUI3D };
})();
