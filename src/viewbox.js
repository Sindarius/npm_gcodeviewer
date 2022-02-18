import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { makeTextPlane } from './utils';
import { Axis, Space } from '@babylonjs/core/Maths/math.axis';
import { MeshBuilder } from '@babylonjs/core';

function buildPlane(scene, name, rotationVector) {
  var plane = makeTextPlane(scene, name, 'white', 'white', 6, 6, 90);
  plane.name = name;
  plane.lookAt(rotationVector);
  plane.position = rotationVector.scale(-3);
  if (name === 'Top') {
    plane.rotate(Axis.Z, Math.PI / 2, Space.LOCAL);
  }
  if (name === 'Bottom') {
    plane.rotate(Axis.Z, -Math.PI / 2, Space.LOCAL);
  }
  plane.metadata = {
    x: Math.sign(rotationVector.x),
    y: Math.sign(rotationVector.y),
    z: Math.sign(rotationVector.z)
  };
  plane.isPickable = true;
}

function buildCorner(scene, name, cornerVector) {
  var sphere = MeshBuilder.CreateSphere(name, { diameter: 1.1 }, scene);
  let position = Vector3.Zero();
  position.x = cornerVector.x - Math.sign(cornerVector.x) * 0.25;
  position.y = cornerVector.y - Math.sign(cornerVector.y) * 0.1;
  position.z = cornerVector.z - Math.sign(cornerVector.z) * 0.25;

  sphere.metadata = {
    x: Math.sign(cornerVector.x) * -1,
    y: Math.sign(cornerVector.y) * -1,
    z: Math.sign(cornerVector.z) * -1
  };

  sphere.position = position;
  sphere.isPickable = true;
}

function buildEdge(scene, name, edgeVector) {
  var box = MeshBuilder.CreateBox(name, { width: 0.35, height: 5.8, depth: 0.35 }, scene);

  let position = Vector3.Zero();
  if (edgeVector.y !== 0) {
    box.rotate(Axis.Z, Math.PI / 2, Space.WORLD);
    if (edgeVector.x !== 0) box.rotate(Axis.Y, Math.PI / 2, Space.WORLD);
    box.bakeCurrentTransformIntoVertices();
  }

  position.x = edgeVector.x - Math.sign(edgeVector.x) * 1;
  position.y = edgeVector.y - Math.sign(edgeVector.y) * 1;
  position.z = edgeVector.z - Math.sign(edgeVector.z) * 1;

  box.metadata = {
    x: Math.sign(edgeVector.x) * -1,
    y: Math.sign(edgeVector.y) * -1,
    z: Math.sign(edgeVector.z) * -1
  };
  box.position = position;
}

var ViewBoxCallback;

export function registerViewBoxCallback(func) {
  ViewBoxCallback = func;
}

export function createViewBox(engine, mainScene, mainCamera) {
  var scene2 = new Scene(engine);
  scene2.autoClear = false;

  var camera2 = new ArcRotateCamera('camera1', (5 * Math.PI) / 8, (5 * Math.PI) / 8, 13, new Vector3(0, 0, 0), scene2);

  // Where to display
  camera2.viewport = new Viewport(0.85, 0.85, 0.15, 0.15);
  camera2.viewport.toGlobal(200, 200);

  // Dupplicate scene info
  mainScene.afterRender = () => {
    scene2.render();
    camera2.alpha = mainCamera.alpha;
    camera2.beta = mainCamera.beta;
    camera2.radius = 15;
  };

  var light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene2);
  light.intensity = 0.8;
  var light2 = new HemisphericLight('light2', new Vector3(-1, -0.5, 0), scene2);
  light2.intensity = 0.8;

  /*********************Create Box***************/

  let x = 3.9;
  buildEdge(scene2, 'FrontLeft', new Vector3(-x, 0, -x));
  buildEdge(scene2, 'BackLeft', new Vector3(-x, 0, x));
  buildEdge(scene2, 'BackRight', new Vector3(x, 0, x));
  buildEdge(scene2, 'FrontRight', new Vector3(x, 0, -x));

  buildEdge(scene2, 'TopFront', new Vector3(0, x, -x));
  buildEdge(scene2, 'TopBack', new Vector3(0, x, x));
  buildEdge(scene2, 'TopLeft', new Vector3(-x, x, 0));
  buildEdge(scene2, 'TopRight', new Vector3(x, x, 0));

  buildEdge(scene2, 'BottomFront', new Vector3(0, -x, -x));
  buildEdge(scene2, 'BottomBack', new Vector3(0, -x, x));
  buildEdge(scene2, 'BottomLeft', new Vector3(-x, -x, 0));
  buildEdge(scene2, 'BottomRight', new Vector3(x, -x, 0));

  buildCorner(scene2, 'FrontTopLeft', new Vector3(-3, 3, -3));
  buildCorner(scene2, 'FrontTopRight', new Vector3(3, 3, -3));
  buildCorner(scene2, 'BackTopLeft', new Vector3(-3, 3, 3));
  buildCorner(scene2, 'BackTopRight', new Vector3(3, 3, 3));

  buildCorner(scene2, 'FrontBottomLeft', new Vector3(-3, -3, -3));
  buildCorner(scene2, 'FrontBottomRight', new Vector3(3, -3, -3));
  buildCorner(scene2, 'BackBottomLeft', new Vector3(-3, -3, 3));
  buildCorner(scene2, 'BackBottomRight', new Vector3(3, -3, 3));

  buildPlane(scene2, 'Front', new Vector3(0, 0, 1));
  buildPlane(scene2, 'Right', new Vector3(-1, 0, 0));
  buildPlane(scene2, 'Back', new Vector3(0, 0, -1));
  buildPlane(scene2, 'Left', new Vector3(1, 0, 0));
  buildPlane(scene2, 'Top', new Vector3(0, -1, 0));
  buildPlane(scene2, 'Bottom', new Vector3(0, 1, 0));

  scene2.onPointerDown = function (evt, pick) {
    if (pick.distance > 0 && ViewBoxCallback) {
      ViewBoxCallback(pick.pickedMesh.metadata);
      scene2.render(true);
    }
  };
}
