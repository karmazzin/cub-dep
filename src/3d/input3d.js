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
    };

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

    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    canvas.addEventListener('mousedown', (event) => {
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

    function resetMovement() {
      input.mouseDx = 0;
      input.mouseDy = 0;
      input.breakPressed = false;
      input.placePressed = false;
      input.repairPressed = false;
      input.primaryDown = false;
    }

    return { input, consumeMouse, consumeActions, resetMovement };
  }

  Game.input3d = { createInput3D };
})();
