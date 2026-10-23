/**
 * mouseFollow.js - Interactive Smoke Fluid Dynamics for JavaScript30 Dashboard
 *
 * Connects the mouse cursor with the existing realistic SVG smoke from index.html:
 * 1. Corner Plumes Repulsion & Parallax: Pushes, drifts, and swirls the JS (yellow)
 *    and TS (blue) smoke corners based on cursor proximity, parallax, and velocity wind.
 * 2. Dynamic Plume Vortex: Dynamically shifts the transform-origin of smoke plumes
 *    so the billow keyframe animations curl and pivot around the mouse disturbance.
 * 3. SVG Turbulence Modulation: Dynamically stirs the #realistic-smoke feTurbulence
 *    and feDisplacementMap based on mouse acceleration, simulating fluid turbulence.
 * 4. Organic Smoke Trail: Emits dissipating, curling smoke puffs behind the cursor
 *    that expand, drift with thermal buoyancy, and blend brand colors (JS to TS).
 * 5. Performance & A11y: Object-pooled DOM particles, rAF sleep-when-idle,
 *    and prefers-reduced-motion support.
 */

(() => {
  // Respect user accessibility preference for reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  function initSmokeInteraction() {
    const bgSmoke = document.querySelector('.bg-smoke');
    const jsSmoke = document.querySelector('.smoke-corner.js-smoke');
    const tsSmoke = document.querySelector('.smoke-corner.ts-smoke');
    const plumes = document.querySelectorAll('.smoke-plume');
    const feTurbulence = document.querySelector('#realistic-smoke feTurbulence');
    const feDisplacementMap = document.querySelector('#realistic-smoke feDisplacementMap');

    if (!bgSmoke || !jsSmoke || !tsSmoke) {
      return;
    }

    // Set GPU composition hints
    jsSmoke.style.willChange = 'transform';
    tsSmoke.style.willChange = 'transform';

    // Remove any legacy single-blob cursor if present
    const legacyCursor = bgSmoke.querySelector('.smoke-cursor');
    if (legacyCursor) {
      legacyCursor.remove();
    }

    // Create container for the smoke trail
    let trailContainer = bgSmoke.querySelector('.smoke-trail');
    if (!trailContainer) {
      trailContainer = document.createElement('div');
      trailContainer.className = 'smoke-trail';
      trailContainer.setAttribute('aria-hidden', 'true');
      Object.assign(trailContainer.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        overflow: 'hidden',
      });
      bgSmoke.appendChild(trailContainer);
    }

    // Object pool for smoke trail particles (no GC churn during mouse movement)
    const POOL_SIZE = 32;
    const particles = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'smoke-puff';
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '54px',
        height: '54px',
        borderRadius: '42% 58% 63% 37% / 46% 54% 46% 54%',
        pointerEvents: 'none',
        filter: 'url(#realistic-smoke)',
        opacity: '0',
        transform: 'translate3d(-9999px, -9999px, 0) scale(0)',
        willChange: 'transform, opacity',
      });
      trailContainer.appendChild(el);

      particles.push({
        element: el,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        scale: 0.6,
        startScale: 0.6,
        endScale: 2.2,
        rotation: 0,
        rotSpeed: 0,
        age: 0,
        life: 800,
        opacity: 0,
        ratio: 0.5,
      });
    }

    let poolIndex = 0;

    function spawnPuff(spawnX, spawnY, mouseVx, mouseVy, ratio) {
      const p = particles[poolIndex];
      poolIndex = (poolIndex + 1) % POOL_SIZE;

      p.active = true;
      p.x = spawnX + (Math.random() - 0.5) * 8;
      p.y = spawnY + (Math.random() - 0.5) * 8;

      // Drift physics: fraction of cursor velocity + upward thermal buoyancy
      p.vx = mouseVx * 0.15 + (Math.random() - 0.5) * 1.4;
      p.vy = mouseVy * 0.15 - (0.6 + Math.random() * 0.9);

      p.startScale = 0.5 + Math.random() * 0.25;
      p.endScale = 1.8 + Math.random() * 0.9;
      p.rotation = Math.random() * 360;
      p.rotSpeed = (Math.random() - 0.5) * 55;
      p.age = 0;
      p.life = 650 + Math.random() * 350; // 650ms - 1000ms duration
      p.opacity = 0.7;
      p.ratio = ratio;

      // Update color based on screen position (JS yellow on left, TS blue on right)
      const jsPercent = Math.round((1 - ratio) * 100);
      p.element.style.background = `radial-gradient(circle at 45% 45%,
        color-mix(in oklab, var(--brand-js-core) ${jsPercent}%, var(--brand-ts-core)) 0%,
        color-mix(in oklab, var(--brand-js) ${jsPercent}%, var(--brand-ts)) 38%,
        color-mix(in oklab, var(--brand-js-deep) ${jsPercent}%, var(--brand-ts-deep)) 64%,
        transparent 84%)`;
    }

    // Viewport dimensions (cached, refreshed on resize)
    let width = window.innerWidth;
    let height = window.innerHeight;

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      wakeLoop();
    }
    window.addEventListener('resize', onResize, { passive: true });

    // Mouse tracking state
    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      prevTargetX: width / 2,
      prevTargetY: height / 2,
      lastSpawnX: width / 2,
      lastSpawnY: height / 2,
      lastSpawnTime: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      isInside: false,
      lastMoveTime: 0,
    };

    const jsState = { x: 0, y: 0, rot: 0, scale: 1 };
    const tsState = { x: 0, y: 0, rot: 0, scale: 1 };
    const filterState = { scale: 160, freqX: 0.006, freqY: 0.009 };
    const originState = { x: 50, y: 50 };

    let lastAppliedFilterScale = 160;
    let isRunning = false;
    let lastFrameTime = performance.now();

    function lerp(start, end, factor) {
      return start + (end - start) * factor;
    }

    function wakeLoop() {
      if (!isRunning) {
        isRunning = true;
        lastFrameTime = performance.now();
        mouse.lastMoveTime = lastFrameTime;
        requestAnimationFrame(updateFrame);
      }
    }

    function onPointerMove(e) {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isInside = true;
      mouse.lastMoveTime = performance.now();

      // Check distance and time to emit trail puff along the cursor path
      const dx = mouse.targetX - mouse.lastSpawnX;
      const dy = mouse.targetY - mouse.lastSpawnY;
      const dist = Math.hypot(dx, dy);
      const timeSinceSpawn = mouse.lastMoveTime - mouse.lastSpawnTime;

      // Spawn puff when moved at least 14px or periodically when drifting
      if (dist >= 14 || (dist >= 5 && timeSinceSpawn > 35)) {
        const ratio = Math.max(0, Math.min(1, mouse.targetX / width));
        spawnPuff(mouse.targetX, mouse.targetY, mouse.vx, mouse.vy, ratio);
        mouse.lastSpawnX = mouse.targetX;
        mouse.lastSpawnY = mouse.targetY;
        mouse.lastSpawnTime = mouse.lastMoveTime;
      }

      wakeLoop();
    }

    function onPointerLeave() {
      mouse.isInside = false;
      mouse.targetX = width / 2;
      mouse.targetY = height / 2;
      wakeLoop();
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('blur', onPointerLeave, { passive: true });

    function updateFrame(now) {
      const dt = Math.min(now - lastFrameTime, 64);
      lastFrameTime = now;

      // 1. Mouse velocity and speed
      mouse.vx = mouse.targetX - mouse.prevTargetX;
      mouse.vy = mouse.targetY - mouse.prevTargetY;
      mouse.prevTargetX = mouse.targetX;
      mouse.prevTargetY = mouse.targetY;

      const rawSpeed = Math.hypot(mouse.vx, mouse.vy);
      mouse.speed = lerp(mouse.speed, rawSpeed, 0.2);

      // Smooth mouse position for corner/filter interaction
      mouse.x = lerp(mouse.x, mouse.targetX, 0.09);
      mouse.y = lerp(mouse.y, mouse.targetY, 0.09);

      const normX = (mouse.x / width) - 0.5;
      const normY = (mouse.y / height) - 0.5;
      const maxDist = Math.max(width, height) * 0.75;

      // 2. JavaScript Smoke Corner (Top-Left) Interaction
      const jsCenter = { x: width * 0.12, y: height * 0.12 };
      const dxJs = mouse.x - jsCenter.x;
      const dyJs = mouse.y - jsCenter.y;
      const distJs = Math.hypot(dxJs, dyJs);
      const proximityJs = Math.max(0, 1 - distJs / maxDist);

      const repelJsStrength = Math.pow(proximityJs, 1.5) * 65;
      const repelJsX = distJs > 0 ? -(dxJs / distJs) * repelJsStrength : 0;
      const repelJsY = distJs > 0 ? -(dyJs / distJs) * repelJsStrength : 0;

      const parallaxJsX = normX * 45;
      const parallaxJsY = normY * 45;
      const windJsX = Math.max(-30, Math.min(30, mouse.vx * 0.35));
      const windJsY = Math.max(-30, Math.min(30, mouse.vy * 0.35));

      const targetJsX = repelJsX + parallaxJsX + windJsX;
      const targetJsY = repelJsY + parallaxJsY + windJsY;
      const targetJsRot = normX * 6 + (mouse.vy * 0.04);
      const targetJsScale = 1 + proximityJs * 0.08;

      jsState.x = lerp(jsState.x, targetJsX, 0.06);
      jsState.y = lerp(jsState.y, targetJsY, 0.06);
      jsState.rot = lerp(jsState.rot, targetJsRot, 0.06);
      jsState.scale = lerp(jsState.scale, targetJsScale, 0.06);

      jsSmoke.style.transform = `translate3d(${jsState.x.toFixed(2)}px, ${jsState.y.toFixed(2)}px, 0) rotate(${jsState.rot.toFixed(2)}deg) scale(${jsState.scale.toFixed(3)})`;

      // 3. TypeScript Smoke Corner (Bottom-Right) Interaction
      const tsCenter = { x: width * 0.88, y: height * 0.88 };
      const dxTs = mouse.x - tsCenter.x;
      const dyTs = mouse.y - tsCenter.y;
      const distTs = Math.hypot(dxTs, dyTs);
      const proximityTs = Math.max(0, 1 - distTs / maxDist);

      const repelTsStrength = Math.pow(proximityTs, 1.5) * 65;
      const repelTsX = distTs > 0 ? -(dxTs / distTs) * repelTsStrength : 0;
      const repelTsY = distTs > 0 ? -(dyTs / distTs) * repelTsStrength : 0;

      const parallaxTsX = normX * 45;
      const parallaxTsY = normY * 45;
      const windTsX = Math.max(-30, Math.min(30, mouse.vx * 0.35));
      const windTsY = Math.max(-30, Math.min(30, mouse.vy * 0.35));

      const targetTsX = repelTsX + parallaxTsX + windTsX;
      const targetTsY = repelTsY + parallaxTsY + windTsY;
      const targetTsRot = -normX * 6 + (mouse.vy * 0.04);
      const targetTsScale = 1 + proximityTs * 0.08;

      tsState.x = lerp(tsState.x, targetTsX, 0.06);
      tsState.y = lerp(tsState.y, targetTsY, 0.06);
      tsState.rot = lerp(tsState.rot, targetTsRot, 0.06);
      tsState.scale = lerp(tsState.scale, targetTsScale, 0.06);

      tsSmoke.style.transform = `translate3d(${tsState.x.toFixed(2)}px, ${tsState.y.toFixed(2)}px, 0) rotate(${tsState.rot.toFixed(2)}deg) scale(${tsState.scale.toFixed(3)})`;

      // 4. Plumes Dynamic Transform Origin (Vortex effect)
      const targetOriginX = Math.max(20, Math.min(80, (mouse.x / width) * 100));
      const targetOriginY = Math.max(20, Math.min(80, (mouse.y / height) * 100));
      originState.x = lerp(originState.x, targetOriginX, 0.05);
      originState.y = lerp(originState.y, targetOriginY, 0.05);

      const originCss = `${originState.x.toFixed(1)}% ${originState.y.toFixed(1)}%`;
      plumes.forEach(plume => {
        plume.style.transformOrigin = originCss;
      });

      // 5. SVG Filter Turbulence Churn
      if (feDisplacementMap) {
        const targetFilterScale = 160 + Math.min(mouse.speed * 0.75, 60);
        filterState.scale = lerp(filterState.scale, targetFilterScale, 0.08);

        if (Math.abs(filterState.scale - lastAppliedFilterScale) > 0.25) {
          feDisplacementMap.setAttribute('scale', filterState.scale.toFixed(1));
          lastAppliedFilterScale = filterState.scale;
        }
      }

      if (feTurbulence) {
        const targetFreqX = 0.006 + normX * 0.001;
        const targetFreqY = 0.009 + normY * 0.0012;
        filterState.freqX = lerp(filterState.freqX, targetFreqX, 0.04);
        filterState.freqY = lerp(filterState.freqY, targetFreqY, 0.04);
        feTurbulence.setAttribute('baseFrequency', `${filterState.freqX.toFixed(5)} ${filterState.freqY.toFixed(5)}`);
      }

      // 6. Update Smoke Trail Particles
      let activePuffCount = 0;
      const timeScale = dt / 16.666;

      for (let i = 0; i < POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;

        p.age += dt;
        const progress = p.age / p.life;

        if (progress >= 1) {
          p.active = false;
          p.element.style.opacity = '0';
          p.element.style.transform = 'translate3d(-9999px, -9999px, 0) scale(0)';
          continue;
        }

        activePuffCount++;

        // Upward buoyancy & air resistance
        p.vy -= 0.05 * timeScale;
        p.vx *= Math.pow(0.97, timeScale);
        p.vy *= Math.pow(0.97, timeScale);

        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;

        // Dispersal: puff expands while fading away organically
        const currentScale = p.startScale + (p.endScale - p.startScale) * Math.sin((progress * Math.PI) / 2);
        const currentOpacity = Math.sin((1 - progress) * Math.PI * 0.5) * 0.65;
        const currentRot = p.rotation + p.rotSpeed * progress;

        p.element.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${currentRot.toFixed(1)}deg) scale(${currentScale.toFixed(2)})`;
        p.element.style.opacity = currentOpacity.toFixed(3);
      }

      // 7. Idle detection: sleep RAF loop when everything has settled to save CPU/battery
      const timeSinceMove = now - mouse.lastMoveTime;
      const isMotionSettled =
        Math.abs(jsState.x - targetJsX) < 0.1 &&
        Math.abs(jsState.y - targetJsY) < 0.1 &&
        Math.abs(tsState.x - targetTsX) < 0.1 &&
        Math.abs(tsState.y - targetTsY) < 0.1 &&
        mouse.speed < 0.05 &&
        activePuffCount === 0;

      if (!mouse.isInside && timeSinceMove > 1000 && isMotionSettled) {
        isRunning = false;
        return;
      }

      requestAnimationFrame(updateFrame);
    }

    wakeLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmokeInteraction);
  } else {
    initSmokeInteraction();
  }
})();
