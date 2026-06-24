(() => {
  const Game = window.CubDep;

  function createInput3D(canvas, getState) {
    const input = {
      keys: {},
      mouseDx: 0,
      mouseDy: 0,
      pointerLocked: false,
      draggingLook: false,
      lastMouseX: 0,
      lastMouseY: 0,
      primaryDown: false,
      breakPressed: false,
      placePressed: false,
      repairPressed: false,
      mobileMoveX: 0,
      mobileMoveY: 0,
      mobileJump: false,
      mobileActive: false,
    };
    const touches = new Map();
    const uiActions = [];
    let lastTouchTime = 0;

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function setMoveFromPoint(touch, point) {
      const dx = point.x - touch.cx;
      const dy = point.y - touch.cy;
      const len = Math.hypot(dx, dy);
      const radius = Math.max(1, touch.radius || 56);
      const scale = Math.min(1, len / radius);
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      input.mobileMoveX = nx * scale;
      input.mobileMoveY = ny * scale;
    }

    function releaseTouch(touch) {
      if (!touch) return;
      if (touch.type === 'move') {
        input.mobileMoveX = 0;
        input.mobileMoveY = 0;
      } else if (touch.type === 'break') {
        input.primaryDown = false;
      } else if (touch.type === 'jump') {
        input.mobileJump = false;
      }
      input.mobileActive = touches.size > 0;
    }

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR' && !input.keys.KeyR) input.repairPressed = true;
      input.keys[event.code] = true;
    });

    window.addEventListener('keyup', (event) => {
      input.keys[event.code] = false;
    });

    document.addEventListener('pointerlockchange', () => {
      input.pointerLocked = document.pointerLockElement === canvas;
      const state = getState && getState();
      if (state && state.ui) state.ui.pointerLocked = input.pointerLocked;
    });

    window.addEventListener('mousemove', (event) => {
      if (!input.pointerLocked && !input.draggingLook) return;
      let dx = event.movementX || 0;
      let dy = event.movementY || 0;
      if (!input.pointerLocked && input.draggingLook && dx === 0 && dy === 0) {
        dx = event.clientX - input.lastMouseX;
        dy = event.clientY - input.lastMouseY;
      }
      input.lastMouseX = event.clientX;
      input.lastMouseY = event.clientY;
      input.mouseDx += dx;
      input.mouseDy += dy;
    });

    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) input.primaryDown = false;
      input.draggingLook = false;
    });

    window.addEventListener('pointerup', (event) => {
      const touch = touches.get(event.pointerId);
      touches.delete(event.pointerId);
      releaseTouch(touch);
    });

    window.addEventListener('pointercancel', (event) => {
      const touch = touches.get(event.pointerId);
      touches.delete(event.pointerId);
      releaseTouch(touch);
    });

    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    canvas.addEventListener('mousedown', (event) => {
      if (performance.now() - lastTouchTime < 700) {
        event.preventDefault();
        return;
      }
      const state = getState && getState();
      if (!state || state.pause.open) return;
      input.draggingLook = true;
      input.lastMouseX = event.clientX;
      input.lastMouseY = event.clientY;
      if (event.button === 0) {
        input.primaryDown = true;
        input.breakPressed = true;
        if (Game.audio && Game.audio.unlock) Game.audio.unlock();
      }
      if (event.button === 2) {
        input.placePressed = true;
        if (Game.audio && Game.audio.unlock) Game.audio.unlock();
      }
      if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        const lockResult = canvas.requestPointerLock();
        if (lockResult && typeof lockResult.catch === 'function') lockResult.catch(() => {});
      }
      event.preventDefault();
    });

    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      lastTouchTime = performance.now();
      const state = getState && getState();
      if (!state || state.pause.open) return;
      const point = canvasPoint(event);
      const control = Game.ui3d && Game.ui3d.getMobileHudControl
        ? Game.ui3d.getMobileHudControl(canvas, state, point.x, point.y)
        : null;
      if (Game.audio && Game.audio.unlock) Game.audio.unlock();
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          // Some mobile browsers reject capture for interrupted gestures.
        }
      }
      input.mobileActive = true;
      if (control && control.type === 'move') {
        const touch = { type: 'move', cx: control.cx, cy: control.cy, radius: control.radius };
        touches.set(event.pointerId, touch);
        setMoveFromPoint(touch, point);
      } else if (control && control.type === 'break') {
        input.primaryDown = true;
        input.breakPressed = true;
        touches.set(event.pointerId, { type: 'break' });
      } else if (control && control.type === 'place') {
        input.placePressed = true;
        touches.set(event.pointerId, { type: 'tap' });
      } else if (control && control.type === 'jump') {
        input.mobileJump = true;
        touches.set(event.pointerId, { type: 'jump' });
      } else if (control && control.type === 'repair') {
        input.repairPressed = true;
        touches.set(event.pointerId, { type: 'tap' });
      } else if (control && control.type === 'inventory') {
        uiActions.push({ type: 'inventory' });
        touches.set(event.pointerId, { type: 'tap' });
      } else if (control && control.type === 'pause') {
        uiActions.push({ type: 'pause' });
        touches.set(event.pointerId, { type: 'tap' });
      } else if (control && control.type === 'hotbar') {
        uiActions.push({ type: 'hotbar', index: control.index });
        touches.set(event.pointerId, { type: 'hotbar', startX: point.x, page: control.page });
      } else {
        touches.set(event.pointerId, { type: 'look', x: point.x, y: point.y });
      }
      event.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') return;
      const touch = touches.get(event.pointerId);
      if (!touch) return;
      const point = canvasPoint(event);
      if (touch.type === 'move') {
        setMoveFromPoint(touch, point);
      } else if (touch.type === 'look') {
        input.mouseDx += point.x - touch.x;
        input.mouseDy += point.y - touch.y;
        touch.x = point.x;
        touch.y = point.y;
      } else if (touch.type === 'hotbar') {
        const dx = point.x - touch.startX;
        if (Math.abs(dx) > 42) {
          uiActions.push({ type: 'hotbarPage', delta: dx < 0 ? 1 : -1 });
          touch.startX = point.x;
        }
      }
      event.preventDefault();
    }, { passive: false });

    function consumeMouse() {
      const dx = input.mouseDx;
      const dy = input.mouseDy;
      input.mouseDx = 0;
      input.mouseDy = 0;
      return { dx, dy };
    }

    function consumeActions() {
      const actions = {
        breakPressed: input.breakPressed,
        placePressed: input.placePressed,
        repairPressed: input.repairPressed,
      };
      input.breakPressed = false;
      input.placePressed = false;
      input.repairPressed = false;
      return actions;
    }

    function consumeUiActions() {
      return uiActions.splice(0, uiActions.length);
    }

    function resetMovement() {
      input.mouseDx = 0;
      input.mouseDy = 0;
      input.breakPressed = false;
      input.placePressed = false;
      input.repairPressed = false;
      input.primaryDown = false;
      input.mobileMoveX = 0;
      input.mobileMoveY = 0;
      input.mobileJump = false;
      input.mobileActive = false;
      touches.clear();
      uiActions.length = 0;
    }

    return { input, consumeMouse, consumeActions, consumeUiActions, resetMovement };
  }

  Game.input3d = { createInput3D };
})();
