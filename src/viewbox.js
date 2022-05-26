import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { makeTextPlane } from './utils';
import { Axis, Space } from '@babylonjs/core/Maths/math.axis';
import { MeshBuilder, StandardMaterial } from '@babylonjs/core';

var viewBoxScene = null;
var showView = true;


export function showViewBox(show){
  showView = show;
}

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


export let edgeMaterial = null;

function buildEdge(scene, name, edgeVector) {

  if(!edgeMaterial){
    edgeMaterial = new StandardMaterial("edgematerial", scene)
    edgeMaterial.diffuseColor = new Color3(0.5,0.5,0.5);
  }

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
  box.material= edgeMaterial;
}

var ViewBoxCallback;

export function registerViewBoxCallback(func) {
  ViewBoxCallback = func;
}

export function createViewBox(engine, mainScene, mainCamera) {
  viewBoxScene = new Scene(engine);
  viewBoxScene.autoClear = false;

  var camera2 = new ArcRotateCamera('camera1', (5 * Math.PI) / 8, (5 * Math.PI) / 8, 13, new Vector3(0, 0, 0), viewBoxScene);

  // Where to display
  camera2.viewport = new Viewport(0.85, 0.85, 0.15, 0.15);
  camera2.viewport.toGlobal(200, 200);

  // Dupplicate scene info
  mainScene.afterRender = () => {
    if(!showView) return;
    viewBoxScene.render();
    camera2.alpha = mainCamera.alpha;
    camera2.beta = mainCamera.beta;
    camera2.radius = 15;
  };

  var light = new HemisphericLight('light1', new Vector3(0, 1, 0), viewBoxScene);
  light.intensity = 0.8;
  var light2 = new HemisphericLight('light2', new Vector3(-1, -0.5, 0), viewBoxScene);
  light2.intensity = 0.8;

  /*********************Create Box***************/

  let x = 3.9;
  buildEdge(viewBoxScene, 'FrontLeft', new Vector3(-x, 0, -x));
  buildEdge(viewBoxScene, 'BackLeft', new Vector3(-x, 0, x));
  buildEdge(viewBoxScene, 'BackRight', new Vector3(x, 0, x));
  buildEdge(viewBoxScene, 'FrontRight', new Vector3(x, 0, -x));

  buildEdge(viewBoxScene, 'TopFront', new Vector3(0, x, -x));
  buildEdge(viewBoxScene, 'TopBack', new Vector3(0, x, x));
  buildEdge(viewBoxScene, 'TopLeft', new Vector3(-x, x, 0));
  buildEdge(viewBoxScene, 'TopRight', new Vector3(x, x, 0));

  buildEdge(viewBoxScene, 'BottomFront', new Vector3(0, -x, -x));
  buildEdge(viewBoxScene, 'BottomBack', new Vector3(0, -x, x));
  buildEdge(viewBoxScene, 'BottomLeft', new Vector3(-x, -x, 0));
  buildEdge(viewBoxScene, 'BottomRight', new Vector3(x, -x, 0));

  buildCorner(viewBoxScene, 'FrontTopLeft', new Vector3(-3, 3, -3));
  buildCorner(viewBoxScene, 'FrontTopRight', new Vector3(3, 3, -3));
  buildCorner(viewBoxScene, 'BackTopLeft', new Vector3(-3, 3, 3));
  buildCorner(viewBoxScene, 'BackTopRight', new Vector3(3, 3, 3));

  buildCorner(viewBoxScene, 'FrontBottomLeft', new Vector3(-3, -3, -3));
  buildCorner(viewBoxScene, 'FrontBottomRight', new Vector3(3, -3, -3));
  buildCorner(viewBoxScene, 'BackBottomLeft', new Vector3(-3, -3, 3));
  buildCorner(viewBoxScene, 'BackBottomRight', new Vector3(3, -3, 3));

  buildPlane(viewBoxScene, 'Front', new Vector3(0, 0, 1));
  buildPlane(viewBoxScene, 'Right', new Vector3(-1, 0, 0));
  buildPlane(viewBoxScene, 'Back', new Vector3(0, 0, -1));
  buildPlane(viewBoxScene, 'Left', new Vector3(1, 0, 0));
  buildPlane(viewBoxScene, 'Top', new Vector3(0, -1, 0));
  buildPlane(viewBoxScene, 'Bottom', new Vector3(0, 1, 0));

  viewBoxScene.onPointerDown = function (evt, pick) {
    if (pick.distance > 0 && ViewBoxCallback) {
      ViewBoxCallback(pick.pickedMesh.metadata);
      viewBoxScene.render(true);
    }
  };
}
