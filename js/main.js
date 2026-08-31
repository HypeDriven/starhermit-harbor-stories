/* Harbor Stories — browser entry point. */
(function () {
'use strict';

var THREE = window.THREE;
var Rules = window.HSRules;
var Content = window.HSContent;

// ---------- constants ----------
var CELL = 1.0;          // world units per board cell (square)
var ITEM_RADIUS = 0.42;
var CAM_DIST = 9.5;      // camera distance from board center
var CAM_HEIGHT = 3.6;    // camera height above board plane

// ---------- module state ----------
var scene, camera, renderer, clock;
var boardGroup, itemMeshes = [], cellMeshes = [];
var taskPanelEl, hudScoreEl, hudMovesEl, msgEl;
var selectedCell = -1;   // r*cols+c or -1
var gameCfg = null;      // rules cfg object (has .board rows/cols)
var gameState = null;    // rules state
var threeReady = false;

function boardDims() { return { rows: gameCfg.board.rows, cols: gameCfg.board.cols }; }

// ---------- 3D scene setup ----------
function initThree() {
  if (threeReady) return;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 8 / 3, 0.1, 200);
    clock = new THREE.Clock();

    var amb = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(amb);
    var dir = new THREE.DirectionalLight(0xfff4e0, 0.9);
    dir.position.set(-6, 12, -8);
    scene.add(dir);

    // board plane (water)
    var waterGeo = new THREE.PlaneGeometry(CAM_DIST * 3, CAM_DIST * 3);
    var waterMat = new THREE.MeshBasicMaterial({ color: 0x1d4e7a });
    var waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    scene.add(waterMesh);

    // cells (wooden dock)
    for (var r = 0; r < gameCfg.board.rows; r++) {
      var rowArr = [];
      for (var c = 0; c < gameCfg.board.cols; c++) {
        var g = new THREE.BoxGeometry(CELL, CELL * 0.5, CELL);
        var m = new THREE.MeshLambertMaterial({ color: 0x8a6a3f });
        rowArr.push(new THREE.Mesh(g, m));
      }
      cellMeshes[r] = rowArr;
    }

    // items (tools) — spheres colored by chain
    var itemGeo = new THREE.SphereGeometry(ITEM_RADIUS, 24, 16);
    for (var r2 = 0; r2 < gameCfg.board.rows; r2++) {
      var rowArr2 = [];
      for (var c2 = 0; c2 < gameCfg.board.cols; c2++) {
        var m2 = new THREE.MeshLambertMaterial({ color: 0xffffff });
        rowArr2.push(new THREE.Mesh(itemGeo, m2));
      }
      itemMeshes[r2] = rowArres(r2);
    }

    // position everything on the board (origin-centered)
    var dims = boardDims();
    for (var rr = 0; rr < dims.rows; rr++) {
      for (var cc = 0; cc < dims.cols; cc++) {
        var x = cc - (dims.cols - 1) / 2, z = rr - (dims.rows - 1) / 2;
        cellMeshes[rr][cc].position.set(x, 0.5, z);
        itemMeshes[rr][cc].position.set(x, 1.0, z);
      }
    }

    camera.position.set(0, CAM_HEIGHT, CAM_DIST);
    threeReady = true;
  } catch (e) {
    window.console && console.error('three init failed', e);
    throw e;
  }
}

function itemMeshesRow(r) { return itemMeshes[r]; }
function rowArres(r) { var a=[]; for(var i=0;i<gameCfg.board.cols;i++)a.push(null); return a; }

// ---------- DOM / UI ----------
function initDOM() {
  document.getElementById('app').innerHTML =
    '<div class="hs-app">' +
      '<h1 class="hs-title-name">Harbor Stories</h1>' +
      '<p class="hs-tagline">A narrative merge puzzle. Merge tool chains, repair the coast, and reveal short story scenes.</p>' +
      '<button id="btn-start" class="hs-btn">Play</button>' +
    '</div>';

  var btn = document.getElementById('btn-start');
  if (btn) {
    btn.addEventListener('click', function () { startGame(); });
  }
}

function startGame() {
  // User gesture: unlock the audio context and confirm with the start sound.
  if (window.HSSfx) { window.HSSfx.unlock(); window.HSSfx.uiStart(); }
  initThree();
  // TODO: build full game UI and loop here.
}

// ---------- boot ----------
initDOM();

})();
