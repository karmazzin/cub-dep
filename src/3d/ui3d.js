(() => {
  const Game = window.CubDep;

  function getSelectedBlockLabel(state) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    const stack = Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
    if (!stack || stack.id === Game.blocks.BLOCK.AIR) return 'Пусто';
    return (labels && labels[stack.id]) || 'Блок';
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
    const hotbar = Game.inventory3d && Game.inventory3d.ensureHotbar ? Game.inventory3d.ensureHotbar(state) : [];
    if (!hotbar.length) return;

    const count = hotbar.length;
    const { slot, gap, startX, y } = getHotbarMetrics(canvas, count);
    const selected = Number.isInteger(state.player.selectedHotbarIndex)
      ? state.player.selectedHotbarIndex
      : 0;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i += 1) {
      const x = startX + i * (slot + gap);
      const stack = hotbar[i];
      const isSelected = i === selected;

      ctx.fillStyle = stack
        ? (isSelected ? 'rgba(255,248,216,0.28)' : 'rgba(8,12,16,0.62)')
        : (isSelected ? 'rgba(255,248,216,0.16)' : 'rgba(8,12,16,0.34)');
      ctx.fillRect(x, y, slot, slot);
      ctx.strokeStyle = isSelected ? '#ffdf7a' : 'rgba(255,255,255,0.24)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, slot - 1, slot - 1);

      if (stack) {
        drawItemIcon(ctx, stack.id, x, y, slot);
        ctx.fillStyle = '#ffdf7a';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(String(stack.count), x + slot - 5, y + slot - 7);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(i === 9 ? '0' : String(i + 1), x + 8, y + 8);
    }

    ctx.fillStyle = '#f5f0df';
    ctx.font = '14px Arial';
    ctx.fillText(getSelectedBlockLabel(state), canvas.width / 2, y - 14);
    ctx.restore();
  }

  function drawItemIcon(ctx, id, x, y, slot) {
    const item = Game.interaction3d && Game.interaction3d.ITEM;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS;
    const block = Game.blocks && Game.blocks.BLOCK;
    if (item && id === item.SHEEP_SPAWN_EGG) {
      drawSheepEggIcon(ctx, x, y, slot);
      return;
    }
    if (!Number.isFinite(id) || !block || id === block.AIR) return;
    const iconSize = Math.max(16, Math.floor(slot * 0.68));
    const iconX = x + Math.round((slot - iconSize) / 2);
    const iconY = y + Math.round((slot - iconSize) / 2) + 2;
    if (Game.renderer3d && Game.renderer3d.drawBlockIcon) {
      Game.renderer3d.drawBlockIcon(ctx, id, iconX, iconY, iconSize);
    } else {
      ctx.fillStyle = (colors && colors[id]) || '#8b8b8b';
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
    }
  }

  function drawSheepEggIcon(ctx, x, y, slot) {
    const cx = x + slot * 0.5;
    const cy = y + slot * 0.55;
    const w = slot * 0.38;
    const h = slot * 0.52;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(Math.round(cx - w * 0.35), Math.round(cy - h * 0.5), Math.round(w * 0.7), Math.round(h * 0.18));
    ctx.fillRect(Math.round(cx - w * 0.5), Math.round(cy - h * 0.32), Math.round(w), Math.round(h * 0.64));
    ctx.fillRect(Math.round(cx - w * 0.34), Math.round(cy + h * 0.32), Math.round(w * 0.68), Math.round(h * 0.2));
    ctx.fillStyle = '#f3ead3';
    ctx.fillRect(Math.round(cx - w * 0.22), Math.round(cy - h * 0.34), Math.round(w * 0.32), Math.round(h * 0.18));
    ctx.fillStyle = '#3a3128';
    ctx.fillRect(Math.round(cx - w * 0.18), Math.round(cy - h * 0.02), 2, 2);
    ctx.fillRect(Math.round(cx + w * 0.12), Math.round(cy - h * 0.02), 2, 2);
    ctx.fillStyle = '#8b6a42';
    ctx.fillRect(Math.round(cx - w * 0.42), Math.round(cy + h * 0.12), Math.round(w * 0.84), 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.strokeRect(Math.round(cx - w * 0.5) + 0.5, Math.round(cy - h * 0.32) + 0.5, Math.round(w) - 1, Math.round(h * 0.64) - 1);
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

    const player = state.player || {};
    const world = state.world || {};
    const spawnX = Math.floor((world.w || 0) / 2);
    const spawnY = Math.floor(world.h || 0);
    const spawnZ = Math.floor((world.d || 0) / 2);
    const x = Math.floor(player.x || 0) - spawnX;
    const y = Math.floor(player.y || 0) - spawnY;
    const z = Math.floor(player.z || 0) - spawnZ;
    const hudText = `FPS: ${Math.round(state.ui.fps || 0)} X: ${x} Y: ${y} Z: ${z}`;
    ctx.font = '13px Arial';
    const panelWidth = Math.ceil(ctx.measureText(hudText).width + 24);
    ctx.fillStyle = 'rgba(8,12,16,0.58)';
    ctx.fillRect(18, 18, panelWidth, 26);
    ctx.fillStyle = '#f5f0df';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hudText, 30, 32);

    drawHotbar(ctx, canvas, state);

    if (state.ui.noticeText) {
      const hotbar = Game.inventory3d && Game.inventory3d.ensureHotbar ? Game.inventory3d.ensureHotbar(state) : [];
      const hotbarTop = hotbar.length ? getHotbarMetrics(canvas, hotbar.length).y : canvas.height - 64;
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

  Game.ui3d = { drawUI3D, drawItemIcon };
})();
