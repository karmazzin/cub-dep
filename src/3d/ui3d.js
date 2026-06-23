(() => {
  const Game = window.CubDep;

  function getSelectedBlockLabel(state) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    if (state.player.selectedBlock === Game.blocks.BLOCK.AIR) return 'Пусто';
    return (labels && labels[state.player.selectedBlock]) || 'Блок';
  }

  function getHotbarMetrics(canvas, count) {
    const gap = 4;
    const maxWidth = Math.max(120, canvas.width - 24);
    const slot = Math.max(20, Math.min(42, Math.floor((maxWidth - (count - 1) * gap) / count)));
    const width = count * slot + (count - 1) * gap;
    return {
      gap,
      slot,
      width,
      startX: Math.round((canvas.width - width) / 2),
      y: canvas.height - slot - 22,
    };
  }

  function drawHotbar(ctx, canvas, state) {
    const hotbar = Game.interaction3d && Game.interaction3d.HOTBAR_BLOCKS;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS;
    const block = Game.blocks && Game.blocks.BLOCK;
    if (!hotbar || !colors || !block) return;

    const count = hotbar.length;
    const { slot, gap, startX, y } = getHotbarMetrics(canvas, count);
    const selected = Number.isInteger(state.player.selectedHotbarIndex)
      ? state.player.selectedHotbarIndex
      : hotbar.indexOf(state.player.selectedBlock);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i += 1) {
      const x = startX + i * (slot + gap);
      const blockId = hotbar[i];
      const isSelected = i === selected;

      ctx.fillStyle = isSelected ? 'rgba(255,248,216,0.28)' : 'rgba(8,12,16,0.62)';
      ctx.fillRect(x, y, slot, slot);
      ctx.strokeStyle = isSelected ? '#ffdf7a' : 'rgba(255,255,255,0.24)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, slot - 1, slot - 1);

      if (Number.isFinite(blockId) && blockId !== block.AIR) {
        const iconSize = Math.max(16, Math.floor(slot * 0.68));
        const iconX = x + Math.round((slot - iconSize) / 2);
        const iconY = y + Math.round((slot - iconSize) / 2) + 2;
        if (Game.renderer3d && Game.renderer3d.drawBlockIcon) {
          Game.renderer3d.drawBlockIcon(ctx, blockId, iconX, iconY, iconSize);
        } else {
          ctx.fillStyle = colors[blockId] || '#8b8b8b';
          ctx.fillRect(iconX, iconY, iconSize, iconSize);
        }
      }

      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '10px Arial';
      ctx.fillText(i === 9 ? '0' : String(i + 1), x + 8, y + 8);
    }

    ctx.fillStyle = '#f5f0df';
    ctx.font = '14px Arial';
    ctx.fillText(getSelectedBlockLabel(state), canvas.width / 2, y - 14);
    ctx.restore();
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

    drawHotbar(ctx, canvas, state);

    if (state.ui.noticeText) {
      const hotbar = Game.interaction3d && Game.interaction3d.HOTBAR_BLOCKS;
      const hotbarTop = hotbar ? getHotbarMetrics(canvas, hotbar.length).y : canvas.height - 64;
      const noticeY = Math.max(52, hotbarTop - 48);
      ctx.fillStyle = 'rgba(8,12,16,0.62)';
      const width = Math.min(canvas.width - 36, Math.max(180, ctx.measureText(state.ui.noticeText).width + 32));
      ctx.fillRect((canvas.width - width) / 2, noticeY, width, 30);
      ctx.fillStyle = '#fff8e8';
      ctx.textAlign = 'center';
      ctx.fillText(state.ui.noticeText, canvas.width / 2, noticeY + 18);
    }
    ctx.restore();
  }

  Game.ui3d = { drawUI3D };
})();
