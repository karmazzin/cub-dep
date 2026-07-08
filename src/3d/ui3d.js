(() => {
  const Game = window.CubDep;

  function getSelectedBlockLabel(state) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    const stack = Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
    if (!stack || stack.id === Game.blocks.BLOCK.AIR) return 'Пусто';
    if (Game.inventory3d && Game.inventory3d.getStackLabel) return Game.inventory3d.getStackLabel(stack);
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
    const item = Game.interaction3d && Game.interaction3d.ITEM;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS;
    const block = Game.blocks && Game.blocks.BLOCK;
    if (eggTypes && eggTypes[id]) {
      drawSpawnEggIcon(ctx, x, y, slot, eggTypes[id]);
      return;
    }
    if (item && (id === item.SHRINK_POTION || id === item.GROW_POTION)) {
      drawPotionIcon(ctx, x, y, slot, id === item.SHRINK_POTION ? '#74c0fc' : '#f783ac', id === item.SHRINK_POTION ? '-' : '+');
      return;
    }
    if (item && id === item.FILLED_CHEST && block) id = block.CHEST;
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

  function drawPotionIcon(ctx, x, y, slot, color, sign) {
    const cx = x + slot / 2;
    const top = y + slot * 0.12;
    const w = slot * 0.42;
    const h = slot * 0.68;
    ctx.save();
    ctx.lineWidth = Math.max(2, slot * 0.04);

    const corkW = w * 0.28;
    const corkH = h * 0.12;
    ctx.fillStyle = '#9a6a3a';
    ctx.strokeStyle = '#4e3420';
    ctx.fillRect(cx - corkW / 2, top, corkW, corkH);
    ctx.strokeRect(cx - corkW / 2, top, corkW, corkH);

    const neckW = w * 0.34;
    const neckH = h * 0.24;
    ctx.fillStyle = 'rgba(224,248,255,0.78)';
    ctx.strokeStyle = 'rgba(214,246,255,0.95)';
    ctx.fillRect(cx - neckW / 2, top + corkH, neckW, neckH);
    ctx.strokeRect(cx - neckW / 2, top + corkH, neckW, neckH);

    const bx = cx - w * 0.5;
    const by = top + corkH + neckH * 0.74;
    const bh = h * 0.64;
    const r = Math.max(4, slot * 0.12);
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + w - r, by);
    ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
    ctx.lineTo(bx + w, by + bh - r);
    ctx.quadraticCurveTo(bx + w, by + bh, bx + w - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fillStyle = 'rgba(229,249,255,0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(215,247,255,0.98)';
    ctx.stroke();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(bx + w * 0.08, by + bh * 0.38, w * 0.84, bh * 0.48);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, by + bh * 0.38, w * 0.42, bh * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(bx + w * 0.22, by + bh * 0.18, w * 0.12, bh * 0.38);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.36)';
    ctx.lineWidth = Math.max(1.5, slot * 0.035);
    ctx.font = `bold ${Math.max(14, Math.floor(slot * 0.34))}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(sign, cx, by + bh * 0.64);
    ctx.fillText(sign, cx, by + bh * 0.64);
    ctx.restore();
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

  function fmtMs(value) {
    return Number.isFinite(value) ? value.toFixed(value >= 10 ? 0 : 1) : '0';
  }

  function getPerfText(state) {
    const perf = state && state.perf ? state.perf : {};
    const parts = [
      `gen:${fmtMs(perf.chunksMs)}`,
      `q:${fmtMs(perf.queueMs)}`,
      `ter:${fmtMs(perf.terrainMs)}`,
      `dec:${fmtMs(perf.decorateMs)}`,
      `mesh:${fmtMs(perf.meshMs)}`,
      `fl:${fmtMs(perf.fluidMs)}`,
      `ent:${fmtMs(perf.entitiesMs)}`,
      `r:${fmtMs(perf.renderMs)}`,
      `dq:${perf.dirtyChunks || 0}`,
      `mq:${perf.meshTasks || 0}`,
      `tq:${perf.terrainQueue || 0}/${perf.terrainPending || 0}`,
      `w:${perf.worker || '?'}`,
      `sp:${Number.isFinite(perf.syncProgress) ? Math.round(perf.syncProgress * 100) : 0}%`,
    ];
    if (perf.generationError) parts.push(`ge:${perf.generationError.column || '?'}`);
    return parts.join(' ');
  }

  function drawCompass(ctx, canvas, state) {
    const player = state.player;
    const waypoint = state.ui && state.ui.mapWaypoint;
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
    if (waypoint) {
      const dx = waypoint.x - player.x;
      const dz = waypoint.z - player.z;
      const distance = Math.round(Math.hypot(dx, dz));
      const targetYaw = Math.atan2(dx, dz);
      const relative = targetYaw - player.yaw;
      ctx.rotate(relative);
      ctx.fillStyle = '#61d6ff';
      ctx.strokeStyle = 'rgba(0,0,0,0.68)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -radius + 5);
      ctx.lineTo(mobile ? 6 : 8, -radius + (mobile ? 15 : 18));
      ctx.lineTo(0, -radius + (mobile ? 12 : 14));
      ctx.lineTo(mobile ? -6 : -8, -radius + (mobile ? 15 : 18));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-relative);
      ctx.fillStyle = '#f5f0df';
      ctx.font = mobile ? '11px Arial' : '12px Arial';
      ctx.fillText(`${distance} блоков`, 0, radius + (mobile ? 12 : 16));
    }
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

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function hexToRgb(hex) {
    const value = parseInt(String(hex || '#888888').replace('#', ''), 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function rgbToCss(rgb) {
    return `rgb(${Math.max(0, Math.min(255, Math.round(rgb.r)))},${Math.max(0, Math.min(255, Math.round(rgb.g)))},${Math.max(0, Math.min(255, Math.round(rgb.b)))})`;
  }

  function shadeRgb(rgb, amount) {
    return { r: rgb.r + amount, g: rgb.g + amount, b: rgb.b + amount };
  }

  function drawIsoCube(ctx, cx, cy, size, color, highlight) {
    const rgb = hexToRgb(color);
    const hw = size;
    const hh = size * 0.52;
    const depth = size * 0.82;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = rgbToCss(shadeRgb(rgb, 28));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + depth);
    ctx.lineTo(cx - hw, cy + depth);
    ctx.closePath();
    ctx.fillStyle = rgbToCss(shadeRgb(rgb, -22));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + depth);
    ctx.lineTo(cx + hw, cy + depth);
    ctx.closePath();
    ctx.fillStyle = rgbToCss(shadeRgb(rgb, -46));
    ctx.fill();
    ctx.strokeStyle = highlight ? 'rgba(255,223,122,0.92)' : 'rgba(0,0,0,0.34)';
    ctx.lineWidth = highlight ? 1.8 : 1;
    ctx.strokeRect(cx - hw + 0.5, cy - hh + 0.5, hw * 2 - 1, hh + depth - 1);
  }

  function drawCreativePreview(ctx, preview, x, y, width, height) {
    if (!preview || !Array.isArray(preview.blocks) || !preview.blocks.length) return;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS ? Game.blocks.BLOCK_COLORS : {};
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    ctx.fillStyle = 'rgba(245,240,223,0.72)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(preview.title || 'Превью', x + 8, y + 7, width - 16);

    const blocks = preview.blocks.slice().sort((a, b) => {
      const da = (a.x || 0) + (a.z || 0) + (a.y || 0) * 3;
      const db = (b.x || 0) + (b.z || 0) + (b.y || 0) * 3;
      return da - db;
    });
    const size = Math.max(5, Math.min(8, Math.floor(width / 24)));
    const originX = x + width * 0.5;
    const originY = y + height * 0.25;
    for (const block of blocks) {
      const bx = Number(block.x) || 0;
      const by = Number(block.y) || 0;
      const bz = Number(block.z) || 0;
      const px = originX + (bx - bz) * size * 1.25;
      const py = originY + (bx + bz) * size * 0.58 - by * size * 1.0;
      if (px < x - size || px > x + width + size || py < y || py > y + height + size) continue;
      drawIsoCube(ctx, px, py, size, colors[block.id] || '#888888', !!block.current);
    }
    ctx.restore();
  }

  function drawEducationPanel(ctx, canvas, state, top) {
    const hud = Game.education3d && Game.education3d.getHud ? Game.education3d.getHud(state) : null;
    if (!hud) return;
    const mobile = isMobileHud(canvas);
    const hasPreview = !!hud.creativePreview;
    const width = Math.min(canvas.width - (mobile ? 36 : 72), mobile ? canvas.width - 36 : (hasPreview ? 620 : 430));
    const x = mobile ? 18 : 18;
    const y = top;
    const previewWidth = hasPreview ? Math.min(170, width - 28) : 0;
    const previewHeight = hasPreview ? 118 : 0;
    const sidePreview = hasPreview && !mobile && width >= 560;
    const textWidth = sidePreview ? width - previewWidth - 40 : width - 28;
    ctx.font = '13px Arial';
    const taskLines = wrapText(ctx, hud.taskText, textWidth).slice(0, hasPreview ? 4 : 3);
    const textHeight = 74 + taskLines.length * 17;
    const height = sidePreview
      ? Math.max(textHeight, 24 + previewHeight)
      : textHeight + (hasPreview ? previewHeight + 12 : 0);
    ctx.fillStyle = 'rgba(8,12,16,0.68)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = hud.completed ? 'rgba(122,255,170,0.58)' : 'rgba(255,223,122,0.36)';
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffdf7a';
    ctx.font = 'bold 13px Arial';
    ctx.fillText(`${hud.subject}, урок ${hud.lesson} / ${hud.country}, ${hud.grade} класс`, x + 14, y + 11, width - 28);
    ctx.fillStyle = '#f5f0df';
    ctx.font = '13px Arial';
    ctx.fillText(`Монеты: ${hud.coins}/${hud.passCoins}${hud.completed ? '  ✓' : ''}`, x + 14, y + 31, width - 28);
    ctx.fillStyle = 'rgba(245,240,223,0.86)';
    for (let i = 0; i < taskLines.length; i += 1) {
      ctx.fillText(taskLines[i], x + 14, y + 53 + i * 17, textWidth);
    }
    if (hasPreview) {
      const previewX = sidePreview ? x + width - previewWidth - 14 : x + 14;
      const previewY = sidePreview ? y + 14 : y + 57 + taskLines.length * 17;
      drawCreativePreview(ctx, hud.creativePreview, previewX, previewY, sidePreview ? previewWidth : width - 28, previewHeight);
    }
    if (!hud.completed) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 14, y + height - 14, width - 28, 5);
      const progress = hud.taskCount > 0 ? Math.max(0, Math.min(1, hud.taskProgress / hud.taskCount)) : 0;
      ctx.fillStyle = '#ffdf7a';
      ctx.fillRect(x + 14, y + height - 14, (width - 28) * progress, 5);
    }
  }

  function drawUI3D(ctx, canvas, state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const rawScale = state && state.player && Number.isFinite(state.player.scale) ? state.player.scale : 1;
    const crosshairScale = Math.max(0.05, Math.min(64, rawScale));
    const outer = 8 * crosshairScale;
    const inner = 3 * crosshairScale;
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = Math.max(1, Math.min(3, crosshairScale));
    ctx.beginPath();
    ctx.moveTo(cx - outer, cy);
    ctx.lineTo(cx - inner, cy);
    ctx.moveTo(cx + inner, cy);
    ctx.lineTo(cx + outer, cy);
    ctx.moveTo(cx, cy - outer);
    ctx.lineTo(cx, cy - inner);
    ctx.moveTo(cx, cy + inner);
    ctx.lineTo(cx, cy + outer);
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
    const flightText = player.flying ? ` Полет${player.flightBoost ? '+' : ''}` : '';
    const hudText = mobile
      ? `X:${x} Y:${y} Z:${z}  Биом: ${getCurrentBiomeLabel(state)}${flightText}`
      : `FPS: ${Math.round(state.ui.fps || 0)} X: ${x} Y: ${y} Z: ${z} Биом: ${getCurrentBiomeLabel(state)}${flightText}`;
    ctx.font = '13px Arial';
    const panelWidth = Math.min(canvas.width - (mobile ? 122 : 36), Math.ceil(ctx.measureText(hudText).width + 24));
    ctx.fillStyle = 'rgba(8,12,16,0.58)';
    ctx.fillRect(18, 18, panelWidth, 26);
    ctx.fillStyle = '#f5f0df';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hudText, 30, 32, panelWidth - 18);
    if (!mobile) {
      const perfText = getPerfText(state);
      ctx.font = '12px Arial';
      const perfWidth = Math.min(canvas.width - 36, Math.ceil(ctx.measureText(perfText).width + 24));
      ctx.fillStyle = 'rgba(8,12,16,0.5)';
      ctx.fillRect(18, 48, perfWidth, 24);
      ctx.fillStyle = '#d8e6dc';
      ctx.fillText(perfText, 30, 61, perfWidth - 18);
    }
    drawEducationPanel(ctx, canvas, state, mobile ? 52 : 78);

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
    if (state.ui.lootTableLines && state.ui.lootTableLines.length) {
      const lines = state.ui.lootTableLines.slice(0, 8);
      ctx.font = mobile ? '12px Arial' : '13px Arial';
      const lineH = mobile ? 16 : 18;
      let panelW = 190;
      for (const line of lines) panelW = Math.max(panelW, Math.ceil(ctx.measureText(line).width + 24));
      panelW = Math.min(canvas.width - 32, panelW);
      const panelH = 16 + lines.length * lineH;
      const x = canvas.width - panelW - 18;
      const y = mobile ? 62 : 84;
      ctx.fillStyle = 'rgba(8,12,16,0.72)';
      ctx.fillRect(x, y, panelW, panelH);
      ctx.fillStyle = '#fff8e8';
      ctx.textAlign = 'left';
      for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], x + 12, y + 16 + i * lineH);
    }
    ctx.restore();
  }

  Game.ui3d = { drawUI3D, drawItemIcon, getMobileHudControl, isMobileHud };
})();
