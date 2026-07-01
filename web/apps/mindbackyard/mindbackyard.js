"use strict";

(function () {
  const HALLWAY_PALETTES = ["white", "dusk", "moonlit"];
  const HALLWAY_DOOR_SIDE = { left: "left", right: "right" };
  const CHAMBER_KINDS = [
    "zenGarden",
    "floatingOrbs",
    "rainWindow",
    "minimalLibrary",
    "solitaryObject",
    "tactileNoise",
    "fireflies",
    "perspectiveRoom"
  ];

  const CHAMBER_META = {
    zenGarden: { title: "Zen pebble garden", subtitle: "" },
    floatingOrbs: { title: "Floating orbs", subtitle: "" },
    rainWindow: { title: "Rain window", subtitle: "" },
    minimalLibrary: { title: "Minimal library", subtitle: "" },
    solitaryObject: { title: "Single light", subtitle: "" },
    tactileNoise: { title: "Tactile Noise", subtitle: "" },
    fireflies: { title: "Firefly glade", subtitle: "" },
    perspectiveRoom: { title: "Perspective Room", subtitle: "Things are not always what they seem." }
  };

  const state = {
    currentSpace: { type: "hallway", segment: 0, palette: "white" },
    hallwayBeforeChamber: null,
    facingDoor: null
  };

  const ui = {
    hallway: document.getElementById("mbyHallway"),
    hallwaySvg: document.getElementById("mbyHallwaySvg"),
    doorLayer: document.getElementById("mbyDoorLayer"),
    doorFace: document.getElementById("mbyDoorFace"),
    backToHallBtn: document.getElementById("mbyBackToHallBtn"),
    openDoorBtn: document.getElementById("mbyOpenDoorBtn"),
    faceDoorCaption: document.getElementById("mbyFaceDoorCaption"),
    faceDoorGlyph: document.getElementById("mbyFaceDoorGlyph"),
    chamber: document.getElementById("mbyChamber"),
    chamberAtmosphere: document.getElementById("mbyChamberAtmosphere"),
    chamberTitle: document.getElementById("mbyChamberTitle"),
    chamberSubtitle: document.getElementById("mbyChamberSubtitle"),
    exitChamberBtn: document.getElementById("mbyExitChamberBtn"),
    spaceLabel: document.getElementById("mbySpaceLabel"),
    hintLabel: document.getElementById("mbyHintLabel")
  };

  function init() {
    bindGestures();
    bindActions();
    render();
  }

  function bindActions() {
    ui.backToHallBtn.addEventListener("click", function () {
      state.facingDoor = null;
      render();
    });

    ui.openDoorBtn.addEventListener("click", function () {
      if (!state.facingDoor) return;
      openFacingDoor(state.facingDoor.side, state.facingDoor.segmentStepsAhead);
    });

    ui.exitChamberBtn.addEventListener("click", exitChamberToHallway);

    window.addEventListener("keydown", function (event) {
      if (state.currentSpace.type !== "hallway") return;
      if (event.key === "ArrowUp") advanceHallway(1);
      if (event.key === "ArrowDown") advanceHallway(-1);
    });
  }

  function bindGestures() {
    let startX = 0;
    let startY = 0;
    let startAt = 0;

    ui.hallway.addEventListener("pointerdown", function (event) {
      startX = event.clientX;
      startY = event.clientY;
      startAt = Date.now();
    });

    ui.hallway.addEventListener("pointerup", function (event) {
      if (state.currentSpace.type !== "hallway") return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const distance = Math.hypot(dx, dy);
      if (distance < 12 && Date.now() - startAt < 260) {
        ui.hintLabel.textContent = "Swipe up/down to walk the hall. Tap a door to explore another space.";
        return;
      }
      if (distance <= 40) return;
      if (Math.abs(dy) < Math.abs(dx) * 0.75) return;
      if (dy < 0) advanceHallway(1);
      else advanceHallway(-1);
    });

    let chamberStartX = 0;
    let chamberStartY = 0;
    ui.chamber.addEventListener("pointerdown", function (event) {
      chamberStartX = event.clientX;
      chamberStartY = event.clientY;
    });
    ui.chamber.addEventListener("pointerup", function (event) {
      if (state.currentSpace.type !== "chamber") return;
      const dx = event.clientX - chamberStartX;
      const dy = event.clientY - chamberStartY;
      if (dy > 70 || Math.abs(dx) > 90) {
        exitChamberToHallway();
      }
    });
  }

  function advanceHallway(delta) {
    if (state.currentSpace.type !== "hallway") return;
    state.currentSpace.segment = wrapInt32(state.currentSpace.segment + delta);
    state.facingDoor = null;
    render();
  }

  function openFacingDoor(side, segmentStepsAhead) {
    if (state.currentSpace.type !== "hallway") return;
    const curSeg = state.currentSpace.segment;
    const palette = state.currentSpace.palette;
    const hallwayBeforeTap = {
      type: "hallway",
      segment: curSeg,
      palette: palette
    };
    const tapSeg = wrapInt32(curSeg + segmentStepsAhead);
    const destination = destinationForDoorTap(tapSeg, palette, side);

    if (segmentStepsAhead === 1) {
      state.currentSpace.segment = wrapInt32(state.currentSpace.segment + 1);
    }

    if (destination.type === "chamber") {
      state.hallwayBeforeChamber = hallwayBeforeTap;
      state.currentSpace = destination;
    } else {
      state.currentSpace = destination;
    }

    state.facingDoor = null;
    render();
  }

  function exitChamberToHallway() {
    if (state.currentSpace.type !== "chamber") return;
    if (state.hallwayBeforeChamber) {
      state.currentSpace = state.hallwayBeforeChamber;
    } else {
      state.currentSpace = { type: "hallway", segment: 0, palette: "white" };
    }
    state.hallwayBeforeChamber = null;
    render();
  }

  function destinationForDoorTap(segment, palette, side) {
    if (doorOpensChamber(segment, palette, side)) {
      return { type: "chamber", kind: chamberKindForDoorTap(segment, palette, side) };
    }
    return randomizedHallwayViaDoor(side);
  }

  function randomizedHallwayViaDoor(side) {
    const base = randomIntInclusive(-10000, 10000);
    const salt = side === HALLWAY_DOOR_SIDE.left ? 17389 : 26093;
    const segment = wrapInt32(base ^ salt);
    const palette = HALLWAY_PALETTES[randomIntInclusive(0, HALLWAY_PALETTES.length - 1)];
    return { type: "hallway", segment: segment, palette: palette };
  }

  function doorOpensChamber(segment, palette, side) {
    const seed = mixSeed(segment, palette, side);
    const rng = makeLCG(seed);
    return Number(rng.next() % 100n) < 35;
  }

  function chamberKindForDoorTap(segment, palette, side) {
    const seed = wrapU64(mixSeed(segment, palette, side) + 0xC0FFEE01n);
    const rng = makeLCG(seed);
    const idx = Number(rng.next() % BigInt(CHAMBER_KINDS.length));
    return CHAMBER_KINDS[idx];
  }

  function hallwayDoorSides(segment, palette) {
    let salt = wrapU64(signedIntToU64(wrapInt32(segment * 1064679697)));
    salt = wrapU64(salt * 33n);
    salt = wrapU64(salt ^ paletteSeed(palette));
    const rng = makeLCG(salt === 0n ? 0x9E3779B97F4A7C15n : salt);
    const roll = Number(rng.next() % 100n);
    if (roll < 14) return [];
    if (roll < 58) return [rng.next() % 2n === 0n ? HALLWAY_DOOR_SIDE.left : HALLWAY_DOOR_SIDE.right];
    return [HALLWAY_DOOR_SIDE.left, HALLWAY_DOOR_SIDE.right];
  }

  function mixSeed(segment, palette, side) {
    let salt = wrapU64(signedIntToU64(wrapInt32(segment * 1064679697)));
    salt = wrapU64(salt * 33n);
    salt = wrapU64(salt ^ paletteSeed(palette));
    salt = wrapU64(salt ^ (side === HALLWAY_DOOR_SIDE.left ? 0xD00D10CCn : 0xCAFE2E11n));
    salt = wrapU64(salt ^ 0x4B591D00n);
    return salt === 0n ? 0x9E3779B97F4A7C15n : salt;
  }

  function paletteSeed(palette) {
    if (palette === "white") return 0x11n;
    if (palette === "dusk") return 0x22n;
    return 0x33n;
  }

  function render() {
    const isHallway = state.currentSpace.type === "hallway";
    const isFacingDoor = Boolean(state.facingDoor);
    const isChamber = state.currentSpace.type === "chamber";

    ui.hallway.hidden = !isHallway || isFacingDoor;
    ui.doorFace.hidden = !isFacingDoor;
    ui.chamber.hidden = !isChamber;

    if (isHallway) renderHallway();
    if (isFacingDoor) renderFacingDoor();
    if (isChamber) renderChamber();
    renderSpaceLabel();
  }

  function renderSpaceLabel() {
    if (state.currentSpace.type === "hallway") {
      ui.spaceLabel.textContent = "hallway(segment: " + state.currentSpace.segment + ", palette: " + state.currentSpace.palette + ")";
      return;
    }
    ui.spaceLabel.textContent = "chamber(kind: " + state.currentSpace.kind + ")";
  }

  function renderHallway() {
    const segment = state.currentSpace.segment;
    const palette = state.currentSpace.palette;
    const nearSides = hallwayDoorSides(segment, palette);
    const aheadSides = hallwayDoorSides(wrapInt32(segment + 1), palette);

    ui.hallway.className = "mby-hallway-stage is-" + palette;
    ui.hallwaySvg.innerHTML = buildHallwayWireframeSVG(segment, palette);
    ui.doorLayer.innerHTML = "";

    aheadSides.forEach(function (side) {
      ui.doorLayer.appendChild(makeDoorButton(side, 1, true));
    });
    nearSides.forEach(function (side) {
      ui.doorLayer.appendChild(makeDoorButton(side, 0, false));
    });
  }

  function makeDoorButton(side, segmentStepsAhead, isAhead) {
    const quad = hallwayDoorQuad(side, isAhead ? "ahead" : "near");
    if (!quad) return document.createElement("span");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mby-door-btn" + (isAhead ? " is-ahead" : "") + (side === "left" ? " is-left" : " is-right");
    button.setAttribute("aria-label", isAhead ? "Door ahead" : "Door");

    const plate = document.createElement("span");
    plate.className = "mby-door-plate";
    plate.style.clipPath = "polygon(" + quad.points.map(function (pt) {
      return pt.x.toFixed(2) + "% " + pt.y.toFixed(2) + "%";
    }).join(", ") + ")";
    button.appendChild(plate);

    button.style.left = quad.left.toFixed(3) + "%";
    button.style.top = quad.top.toFixed(3) + "%";
    button.style.width = quad.width.toFixed(3) + "%";
    button.style.height = quad.height.toFixed(3) + "%";

    button.addEventListener("click", function () {
      state.facingDoor = { side: side, segmentStepsAhead: segmentStepsAhead };
      render();
    });
    return button;
  }

  function hallwayDoorQuad(side, plane) {
    const u0 = plane === "ahead" ? 0.83 : 0.38;
    const u1 = plane === "ahead" ? 0.93 : 0.62;
    const frame = side === "left"
      ? doorFrameLeft(u0, u1)
      : doorFrameRight(u0, u1);

    const minX = Math.min(frame[0].x, frame[1].x, frame[2].x, frame[3].x);
    const maxX = Math.max(frame[0].x, frame[1].x, frame[2].x, frame[3].x);
    const minY = Math.min(frame[0].y, frame[1].y, frame[2].y, frame[3].y);
    const maxY = Math.max(frame[0].y, frame[1].y, frame[2].y, frame[3].y);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return {
      left: (minX / 1000) * 100,
      top: (minY / 1800) * 100,
      width: (width / 1000) * 100,
      height: (height / 1800) * 100,
      points: frame.map(function (pt) {
        return {
          x: ((pt.x - minX) / width) * 100,
          y: ((pt.y - minY) / height) * 100
        };
      })
    };
  }

  function doorFrameLeft(u0, u1) {
    const lt0 = leftWallVerticalTop(u0);
    const lb0 = leftWallVerticalBottom(u0);
    const lt1 = leftWallVerticalTop(u1);
    const lb1 = leftWallVerticalBottom(u1);
    return [lt0, lt1, lb1, lb0];
  }

  function doorFrameRight(u0, u1) {
    const rt0 = rightWallVerticalTop(u0);
    const rb0 = rightWallVerticalBottom(u0);
    const rt1 = rightWallVerticalTop(u1);
    const rb1 = rightWallVerticalBottom(u1);
    return [rt0, rt1, rb1, rb0];
  }

  function leftWallVerticalTop(u) {
    return pointLerp({ x: 0, y: 0 }, { x: 500, y: 560 }, clamp01(u));
  }

  function leftWallVerticalBottom(u) {
    return pointLerp({ x: 0, y: 1800 }, { x: 500, y: 560 }, clamp01(u));
  }

  function rightWallVerticalTop(u) {
    return pointLerp({ x: 1000, y: 0 }, { x: 500, y: 560 }, clamp01(u));
  }

  function rightWallVerticalBottom(u) {
    return pointLerp({ x: 1000, y: 1800 }, { x: 500, y: 560 }, clamp01(u));
  }

  function pointLerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }

  function clamp01(v) {
    return Math.min(0.995, Math.max(0.02, v));
  }

  function renderFacingDoor() {
    const palette = (state.currentSpace.type === "hallway" ? state.currentSpace.palette : "white");
    ui.doorFace.className = "mby-door-face is-" + palette;
    ui.faceDoorGlyph.className = "mby-face-door-glyph is-" + palette;
    ui.faceDoorCaption.textContent = "Door";
  }

  function renderChamber() {
    const kind = state.currentSpace.kind;
    const meta = CHAMBER_META[kind];
    ui.chamber.className = "mby-chamber is-" + kind;
    ui.chamberTitle.textContent = meta ? meta.title : kind;
    ui.chamberSubtitle.textContent = meta ? meta.subtitle : "";
    ui.chamberSubtitle.hidden = !ui.chamberSubtitle.textContent;
    ui.chamberAtmosphere.innerHTML = chamberAtmosphereHTML(kind);
  }

  function chamberAtmosphereHTML(kind) {
    if (kind === "zenGarden") return "<div class=\"mby-pebbles\"><span></span><span></span><span></span><span></span></div>";
    if (kind === "floatingOrbs") return "<div class=\"mby-orbs\"><span></span><span></span><span></span><span></span><span></span></div>";
    if (kind === "rainWindow") return "<div class=\"mby-rain\"></div>";
    if (kind === "minimalLibrary") return "<div class=\"mby-library\"></div>";
    if (kind === "solitaryObject") return "<div class=\"mby-solitary\"></div>";
    if (kind === "tactileNoise") return "<div class=\"mby-noise\"></div>";
    if (kind === "fireflies") return "<div class=\"mby-fireflies\"><span></span><span></span><span></span><span></span><span></span><span></span></div>";
    return "<div class=\"mby-perspective\"></div>";
  }

  function buildHallwayWireframeSVG(segment, palette) {
    const phosphor = palette === "white" ? "#E8F6FF" : (palette === "dusk" ? "#F9B66B" : "#63F29D");
    const phase = ((segment * 0.32) % 1 + 1) % 1;
    const lines = [];
    lines.push("<line x1=\"0\" y1=\"1800\" x2=\"500\" y2=\"560\"/>");
    lines.push("<line x1=\"1000\" y1=\"1800\" x2=\"500\" y2=\"560\"/>");
    lines.push("<line x1=\"0\" y1=\"0\" x2=\"500\" y2=\"560\"/>");
    lines.push("<line x1=\"1000\" y1=\"0\" x2=\"500\" y2=\"560\"/>");

    for (let i = 1; i < 14; i += 1) {
      let u = Math.pow((i + phase) / 14, 1.15);
      if (u > 0.98) u -= 0.12;
      if (u < 0.03 || u > 0.99) continue;
      const lx = 0 + u * (500 - 0);
      const ly = 1800 + u * (560 - 1800);
      const rx = 1000 + u * (500 - 1000);
      const ry = 1800 + u * (560 - 1800);
      lines.push("<line x1=\"" + lx.toFixed(2) + "\" y1=\"" + ly.toFixed(2) + "\" x2=\"" + rx.toFixed(2) + "\" y2=\"" + ry.toFixed(2) + "\"/>");
    }

    for (let i = 1; i < 10; i += 1) {
      let u = Math.pow((i + phase) / 10, 1.12);
      if (u > 0.98) u -= 0.1;
      if (u < 0.03 || u > 0.99) continue;
      const lx = 0 + u * (500 - 0);
      const ly = 0 + u * (560 - 0);
      const rx = 1000 + u * (500 - 1000);
      const ry = 0 + u * (560 - 0);
      lines.push("<line x1=\"" + lx.toFixed(2) + "\" y1=\"" + ly.toFixed(2) + "\" x2=\"" + rx.toFixed(2) + "\" y2=\"" + ry.toFixed(2) + "\"/>");
    }

    return "<g class=\"mby-wire\" style=\"--phosphor:" + phosphor + "\">" + lines.join("") + "</g>";
  }

  function randomIntInclusive(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function wrapInt32(value) {
    return Number(BigInt.asIntN(32, BigInt(value)));
  }

  function signedIntToU64(int32Value) {
    return BigInt.asUintN(64, BigInt(int32Value));
  }

  function wrapU64(value) {
    return BigInt.asUintN(64, value);
  }

  function makeLCG(seed) {
    let stateU64 = wrapU64(seed);
    return {
      next: function () {
        stateU64 = wrapU64(stateU64 * 6364136223846793005n + 1n);
        return stateU64;
      }
    };
  }

  init();
})();
