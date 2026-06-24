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

  function isMobileHud(canvas) {
    const coarse = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    return coarse || canvas.width <= 820;
  }

  function getMobileHotbarMetrics(canvas, state, count) {
    const visible = Math.min(5, count);
    const gap = 5;
    const slot = Math.max(36, Math.min(46, Math.floor((canvas.width - 110 - (visible - 1) * gap) / visible)));
    const width = visible * slot + (visible - 1) * gap;
    const selected = Number.isInteger(state.player.selectedHotbarIndex) ? state.player.selectedHotbarIndex : 0;
    const storedPage = state.ui && Number.isInteger(state.ui.mobileHotbarPage) ? state.ui.mobileHotbarPage : Math.floor(selected / visible);
    const maxPage = Math.max(0, Math.ceil(count / visible) - 1);
    const page = Math.max(0, Math.min(maxPage, storedPage));
    return {
      visible,
      gap,
      slot,
      width,
      page,
      startIndex: page * visible,
      startX: Math.round((canvas.width - width) / 2),
      y: canvas.height - slot - 12,
    };
  }

  function drawHotbar(ctx, canvas, state) {
    const hotbar = Game.inventory3d && Game.inventory3d.ensureHotbar ? Game.inventory3d.ensureHotbar(state) : [];
    if (!hotbar.length) return;

    const count = hotbar.length;
    if (isMobileHud(canvas)) {
      drawMobileHotbar(ctx, canvas, state, hotbar);
      return;
    }
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

  function drawMobileHotbar(ctx, canvas, state, hotbar) {
    const count = hotbar.length;
    const { visible, slot, gap, startX, y, startIndex, page } = getMobileHotbarMetrics(canvas, state, count);
    const selected = Number.isInteger(state.player.selectedHotbarIndex)
      ? state.player.selectedHotbarIndex
      : 0;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let local = 0; local < visible; local += 1) {
      const i = startIndex + local;
      if (i >= count) break;
      const x = startX + local * (slot + gap);
      const stack = hotbar[i];
      const isSelected = i === selected;
      ctx.fillStyle = stack
        ? (isSelected ? 'rgba(255,248,216,0.3)' : 'rgba(8,12,16,0.66)')
        : (isSelected ? 'rgba(255,248,216,0.16)' : 'rgba(8,12,16,0.36)');
      ctx.fillRect(x, y, slot, slot);
      ctx.strokeStyle = isSelected ? '#ffdf7a' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, slot - 1, slot - 1);
      if (stack) {
        drawItemIcon(ctx, stack.id, x, y, slot);
        ctx.fillStyle = '#ffdf7a';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(String(stack.count), x + slot - 5, y + slot - 7);
      }
    }
    ctx.fillStyle = 'rgba(245,240,223,0.86)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(getSelectedBlockLabel(state), canvas.width / 2, y - 12);
    if (count > visible) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = '11px Arial';
      ctx.fillText(`${page + 1}/${Math.ceil(count / visible)}`, canvas.width / 2, y + slot + 9);
    }
    ctx.restore();
  }

  function drawItemIcon(ctx, id, x, y, slot) {
    const eggTypes = Game.interaction3d && Game.interaction3d.SPAWN_EGG_TYPES;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS;
    const block = Game.blocks && Game.blocks.BLOCK;
    if (eggTypes && eggTypes[id]) {
      drawSpawnEggIcon(ctx, x, y, slot, eggTypes[id]);
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

  function spawnEggColors(type) {
    const palette = {
      sheep: ['#d8d0b8', '#f3ead3', '#8b6a42'],
      boar: ['#7b4b31', '#b0734e', '#2b1b14'],
      turtle: ['#5e8d4f', '#9dc36a', '#30442d'],
      snake: ['#c4a23f', '#6d7f2f', '#2f2a19'],
      goat: ['#b4afa0', '#ece5d4', '#5f594f'],
      fish: ['#4fa0b8', '#a7e1e4', '#23516a'],
    };
    return palette[type] || palette.sheep;
  }

  function drawSpawnEggIcon(ctx, x, y, slot, type) {
    const [base, spot, dark] = spawnEggColors(type);
    const cx = x + slot * 0.5;
    const cy = y + slot * 0.55;
    const w = slot * 0.38;
    const h = slot * 0.52;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = base;
    ctx.fillRect(Math.round(cx - w * 0.35), Math.round(cy - h * 0.5), Math.round(w * 0.7), Math.round(h * 0.18));
    ctx.fillRect(Math.round(cx - w * 0.5), Math.round(cy - h * 0.32), Math.round(w), Math.round(h * 0.64));
    ctx.fillRect(Math.round(cx - w * 0.34), Math.round(cy + h * 0.32), Math.round(w * 0.68), Math.round(h * 0.2));
    ctx.fillStyle = spot;
    ctx.fillRect(Math.round(cx - w * 0.22), Math.round(cy - h * 0.34), Math.round(w * 0.32), Math.round(h * 0.18));
    ctx.fillRect(Math.round(cx + w * 0.08), Math.round(cy + h * 0.12), Math.round(w * 0.28), Math.round(h * 0.16));
    ctx.fillStyle = dark;
    ctx.fillRect(Math.round(cx - w * 0.18), Math.round(cy - h * 0.02), 2, 2);
    ctx.fillRect(Math.round(cx + w * 0.12), Math.round(cy - h * 0.02), 2, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(Math.round(cx - w * 0.42), Math.round(cy + h * 0.12), Math.round(w * 0.84), 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.strokeRect(Math.round(cx - w * 0.5) + 0.5, Math.round(cy - h * 0.32) + 0.5, Math.round(w) - 1, Math.round(h * 0.64) - 1);
    ctx.restore();
  }

  function getCurrentBiomeLabel(state) {
    const player = state.player || {};
    const generation = Game.generation3d;
    if (!generation || !generation.getBiomeAt3D) return '...';
    const biome = generation.getBiomeAt3D(state, player.x || 0, player.z || 0);
    const labels = generation.BIOME_LABELS || {};
    return labels[biome] || biome || '...';
  }

  function drawCompass(ctx, canvas, state) {
    const player = state.player;
    const mobile = isMobileHud(canvas);
    const cx = mobile ? canvas.width - 42 : canvas.width - 74;
    const cy = mobile ? 88 : 64;
    const radius = mobile ? 24 : 34;
    const headingAngle = Math.PI - player.yaw;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,16,0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.translate(cx, cy);
    ctx.rotate(headingAngle);
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath();
    ctx.moveTo(0, mobile ? -17 : -24);
    ctx.lineTo(mobile ? 6 : 8, -5);
    ctx.lineTo(0, mobile ? -8 : -10);
    ctx.lineTo(mobile ? -6 : -8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-headingAngle);
    ctx.fillStyle = '#fff8e8';
    ctx.font = mobile ? 'bold 12px Arial' : 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -1);
    ctx.restore();
  }

  function circleHit(x, y, cx, cy, radius) {
    return Math.hypot(x - cx, y - cy) <= radius;
  }

  function getMobileControls(canvas, state) {
    const size = Math.min(canvas.width, canvas.height);
    const moveRadius = Math.max(46, Math.min(58, size * 0.14));
    const moveCx = 74;
    const moveCy = canvas.height - 120;
    const button = Math.max(26, Math.min(36, size * 0.085));
    return {
      move: { cx: moveCx, cy: moveCy, radius: moveRadius },
      break: { cx: canvas.width - 82, cy: canvas.height - 124, radius: button + 6 },
      place: { cx: canvas.width - 148, cy: canvas.height - 178, radius: button },
      jump: { cx: canvas.width - 46, cy: canvas.height - 206, radius: button },
      repair: { cx: canvas.width - 150, cy: canvas.height - 92, radius: Math.max(23, button - 5) },
      inventory: { cx: canvas.width - 96, cy: 34, radius: 23 },
      pause: { cx: canvas.width - 40, cy: 34, radius: 23 },
      hotbar: Game.inventory3d && Game.inventory3d.ensureHotbar
        ? getMobileHotbarMetrics(canvas, state, Game.inventory3d.ensureHotbar(state).length)
        : null,
    };
  }

  function getMobileHudControl(canvas, state, x, y) {
    if (!isMobileHud(canvas)) return null;
    const controls = getMobileControls(canvas, state);
    if (circleHit(x, y, controls.move.cx, controls.move.cy, controls.move.radius + 22)) {
      return { type: 'move', ...controls.move };
    }
    for (const type of ['break', 'place', 'jump', 'repair', 'inventory', 'pause']) {
      const control = controls[type];
      if (circleHit(x, y, control.cx, control.cy, control.radius)) return { type, ...control };
    }
    const hotbar = controls.hotbar;
    if (hotbar && y >= hotbar.y - 6 && y <= hotbar.y + hotbar.slot + 18) {
      for (let local = 0; local < hotbar.visible; local += 1) {
        const slotX = hotbar.startX + local * (hotbar.slot + hotbar.gap);
        if (x >= slotX && x <= slotX + hotbar.slot) {
          const index = hotbar.startIndex + local;
          return { type: 'hotbar', index, page: hotbar.page };
        }
      }
    }
    return null;
  }

  function drawCircleButton(ctx, control, drawIcon) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,16,0.5)';
    ctx.beginPath();
    ctx.arc(control.cx, control.cy, control.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,216,0.82)';
    ctx.fillStyle = 'rgba(255,248,216,0.82)';
    ctx.lineWidth = 3;
    drawIcon(ctx, control);
    ctx.restore();
  }

  function drawMobileControls(ctx, canvas, state) {
    if (!isMobileHud(canvas) || state.pause.open) return;
    const controls = getMobileControls(canvas, state);
    ctx.save();
    const move = controls.move;
    const dx = state.ui.mobileMoveX || 0;
    const dy = state.ui.mobileMoveY || 0;
    ctx.fillStyle = 'rgba(8,12,16,0.32)';
    ctx.beginPath();
    ctx.arc(move.cx, move.cy, move.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,216,0.58)';
    ctx.beginPath();
    ctx.arc(move.cx + dx * move.radius * 0.72, move.cy + dy * move.radius * 0.72, move.radius * 0.34, 0, Math.PI * 2);
    ctx.fill();

    drawCircleButton(ctx, controls.break, (iconCtx, c) => {
      iconCtx.beginPath();
      iconCtx.moveTo(c.cx - 10, c.cy + 10);
      iconCtx.lineTo(c.cx + 11, c.cy - 11);
      iconCtx.moveTo(c.cx + 3, c.cy - 14);
      iconCtx.lineTo(c.cx + 14, c.cy - 3);
      iconCtx.stroke();
    });
    drawCircleButton(ctx, controls.place, (iconCtx, c) => {
      iconCtx.strokeRect(c.cx - 10, c.cy - 10, 20, 20);
      iconCtx.beginPath();
      iconCtx.moveTo(c.cx - 10, c.cy - 10);
      iconCtx.lineTo(c.cx - 4, c.cy - 16);
      iconCtx.lineTo(c.cx + 16, c.cy - 16);
      iconCtx.lineTo(c.cx + 10, c.cy - 10);
      iconCtx.moveTo(c.cx + 10, c.cy + 10);
      iconCtx.lineTo(c.cx + 16, c.cy + 4);
      iconCtx.lineTo(c.cx + 16, c.cy - 16);
      iconCtx.stroke();
    });
    drawCircleButton(ctx, controls.jump, (iconCtx, c) => {
      iconCtx.beginPath();
      iconCtx.moveTo(c.cx, c.cy - 13);
      iconCtx.lineTo(c.cx + 11, c.cy + 4);
      iconCtx.lineTo(c.cx + 4, c.cy + 4);
      iconCtx.lineTo(c.cx + 4, c.cy + 14);
      iconCtx.lineTo(c.cx - 4, c.cy + 14);
      iconCtx.lineTo(c.cx - 4, c.cy + 4);
      iconCtx.lineTo(c.cx - 11, c.cy + 4);
      iconCtx.closePath();
      iconCtx.fill();
    });
    drawCircleButton(ctx, controls.repair, (iconCtx, c) => {
      iconCtx.beginPath();
      iconCtx.moveTo(c.cx - 11, c.cy + 9);
      iconCtx.lineTo(c.cx + 8, c.cy - 10);
      iconCtx.moveTo(c.cx + 2, c.cy - 13);
      iconCtx.lineTo(c.cx + 12, c.cy - 3);
      iconCtx.stroke();
    });
    drawCircleButton(ctx, controls.inventory, (iconCtx, c) => {
      for (let yy = 0; yy < 2; yy += 1) {
        for (let xx = 0; xx < 2; xx += 1) {
          iconCtx.strokeRect(c.cx - 10 + xx * 11, c.cy - 10 + yy * 11, 8, 8);
        }
      }
    });
    drawCircleButton(ctx, controls.pause, (iconCtx, c) => {
      iconCtx.lineWidth = 4;
      iconCtx.beginPath();
      iconCtx.moveTo(c.cx - 5, c.cy - 10);
      iconCtx.lineTo(c.cx - 5, c.cy + 10);
      iconCtx.moveTo(c.cx + 5, c.cy - 10);
      iconCtx.lineTo(c.cx + 5, c.cy + 10);
      iconCtx.stroke();
    });
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
    const mobile = isMobileHud(canvas);
    const hudText = mobile
      ? `X:${x} Y:${y} Z:${z}  Биом: ${getCurrentBiomeLabel(state)}`
      : `FPS: ${Math.round(state.ui.fps || 0)} X: ${x} Y: ${y} Z: ${z} Биом: ${getCurrentBiomeLabel(state)}`;
    ctx.font = '13px Arial';
    const panelWidth = Math.min(canvas.width - (mobile ? 122 : 36), Math.ceil(ctx.measureText(hudText).width + 24));
    ctx.fillStyle = 'rgba(8,12,16,0.58)';
    ctx.fillRect(18, 18, panelWidth, 26);
    ctx.fillStyle = '#f5f0df';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hudText, 30, 32, panelWidth - 18);

    drawHotbar(ctx, canvas, state);
    drawMobileControls(ctx, canvas, state);

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

  Game.ui3d = { drawUI3D, drawItemIcon, getMobileHudControl, isMobileHud };
})();
