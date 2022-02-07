import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { makeTextPlane } from './utils';
import { Axis, Space } from '@babylonjs/core/Maths/math.axis';

function buildPlanes(scene, name, rotationVector) {
  var plane = makeTextPlane(scene, name, 'white', 'white', 6, 6);
  plane.name = name;
  plane.lookAt(rotationVector);
  plane.position = rotationVector.scale(-3);
  if (name === 'Top') {
    plane.rotate(Axis.Z, Math.PI / 2, Space.LOCAL);
  }
  if (name === 'Bottom') {
    plane.rotate(Axis.Z, -Math.PI / 2, Space.LOCAL);
  }
  plane.isPickable = true;
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
  buildPlanes(scene2, 'Front', new Vector3(0, 0, 1));
  buildPlanes(scene2, 'Right', new Vector3(-1, 0, 0));
  buildPlanes(scene2, 'Back', new Vector3(0, 0, -1));
  buildPlanes(scene2, 'Left', new Vector3(1, 0, 0));
  buildPlanes(scene2, 'Top', new Vector3(0, -1, 0));
  buildPlanes(scene2, 'Bottom', new Vector3(0, 1, 0));

  scene2.onPointerDown = function (evt, pick) {
    if (pick.distance > 0 && ViewBoxCallback) {
      ViewBoxCallback(scene2, pick.pickedMesh.name);
      
      scene2.render(true);
    }
  };
}
