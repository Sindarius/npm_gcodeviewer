'use strict';

import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';

import { Scene } from '@babylonjs/core/scene';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Axis, Space } from '@babylonjs/core/Maths/math.axis';
import { version } from '../package.json';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/core/Rendering/edgesRenderer';
import '@babylonjs/loaders/OBJ/';

import "@babylonjs/core/Engines/WebGPU/Extensions"
import { JRNozzle } from './models';
import './models';

//import '@babylonjs/core/Debug/debugLayer'
//import '@babylonjs/inspector'

import gcodeProcessor from './gcodeprocessor.js';
import Bed from './bed.js';
import BuildObjects from './buildobjects.js';
import Axes from './axes.js';
import { createViewBox, registerViewBoxCallback } from './viewbox';

export default class {
  constructor(canvas) {
    this.lastLoadKey = 'lastLoadFailed';
    this.fileData= null;
    this.fileDataArray= null;
    this.fileSize = 0;
    this.gcodeProcessor = new gcodeProcessor();
    this.maxHeight = 0;
    this.minHeight = 0;
    this.sceneBackgroundColor = '#000000';
    this.canvas = canvas;
    this.scene = {};
    this.loading = false;
    this.toolVisible = false;
    this.travelVisible = false;
    this.debug = false;
    this.zTopClipValue= 1000000;
    this.zBottomClipValue= -1000000;
    this.cancelHitTimer = 0;
    this.pause = false;
    this.hqNozzle = true;

    this.cameraInertia = localStorage.getItem('cameraInertia') === 'true';

    //objects
    this.bed = null;
    this.buildObjects= null;
    this.axes= null;

    this.renderQuality = Number(localStorage.getItem('renderQuality'));
    if (this.renderQuality === undefined || this.renderQuality === null) {
      this.renderQuality = 1;
    }

    this.renderTimeout = 1000;
    
  }
  getMaxHeight() {
    return this.maxHeight;
  }
  getMinHeight() {
    return this.minHeight;
  }

  setCameraType(arcRotate) {
    if (arcRotate) {
      this.scene.activeCamera = this.orbitCamera;
    } else {
      this.scene.activeCamera = this.flyCamera;
    }
  }
  setZClipPlane(top, bottom) {
    this.zTopClipValue = -top;
    this.zBottomClipValue = bottom;
    if (bottom > top) {
      this.zTopClipValue = bottom + 1;
    }
    this.scene.clipPlane = new Plane(0, 1, 0, this.zTopClipValue);
    this.scene.clipPlane2 = new Plane(0, -1, 0, this.zBottomClipValue);
    this.scene.render();
  }

  isArcRotateCameraStopped(camera) {
    return camera.inertialAlphaOffset === 0 && camera.inertialBetaOffset === 0 && camera.inertialRadiusOffset === 0 && camera.inertialPanningX === 0 && camera.inertialPanningY === 0;
  }

  async init(useWebGPU) {
    if(useWebGPU === undefined) useWebGPU = false;

    console.info(`GCode Viewer - Sindarius - ${version} `);

      
      const webGPUSupported = await WebGPUEngine.IsSupportedAsync;
      if (webGPUSupported && useWebGPU) {
        console.log("WebGPU Supported")
        this.engine = new WebGPUEngine(this.canvas, {doNotHandleContextLost : true} );
        await this.engine.initAsync();
        console.log(this.engine)
      }
      else {
        console.log("WebGPU Not Supported")
        this.engine = new Engine(this.canvas, true, {
          doNotHandleContextLost: true
        });
      }

  

    this.engine.enableOfflineSupport = false;
    this.scene = new Scene(this.engine);
    if (this.debug) {
       //this.scene.debugLayer.show({ embedMode: true });
    }
    this.scene.clearColor = Color3.FromHexString(this.getBackgroundColor());

    this.bed = new Bed(this.scene);
    this.bed.registerClipIgnore = (mesh) => {
      this.registerClipIgnore(mesh);
    };
    const bedCenter = this.bed.getCenter();

    // Add a camera to the scene and attach it to the canvas
    this.orbitCamera = new ArcRotateCamera('Camera', Math.PI / 2, 2.356194, 250, new Vector3(bedCenter.x, -2, bedCenter.y), this.scene);
    this.orbitCamera.attachControl(false);

    this.orbitCamera.invertRotation = false;
    this.orbitCamera.attachControl(this.canvas, false);
    this.orbitCamera.maxZ = 100000;
    this.orbitCamera.lowerRadiusLimit = 5;
    this.updateCameraInertiaProperties();

    // Add lights to the scene
    //var light1 = new HemisphericLight("light1", new Vector3(1, 1, 0), this.scene);
    var light2 = new PointLight('light2', new Vector3(0, 1, -1), this.scene);
    light2.diffuse = new Color3(1, 1, 1);
    light2.specular = new Color3(1, 1, 1);
    this.engine.runRenderLoop(() => {
      if (this.pause || (Date.now() - this.gcodeProcessor.lastUpdate > this.renderTimeout && this.isArcRotateCameraStopped(this.orbitCamera))) {
        return;
      }

      this.scene.render(true);
      //Update light 2 position
      light2.position = this.scene.cameras[0].position;
    });

    this.buildObjects = new BuildObjects(this.scene);
    this.buildObjects.getMaxHeight = () => {
      return this.gcodeProcessor.getMaxHeight();
    };
    this.buildObjects.registerClipIgnore = (mesh) => {
      this.registerClipIgnore(mesh);
    };
    this.bed.buildBed();

    this.axes = new Axes(this.scene);
    this.axes.registerClipIgnore = (mesh) => {
      this.registerClipIgnore(mesh);
    };
    this.axes.render();

    this.resetCamera();

    createViewBox(this.engine, this.scene, this.orbitCamera);
    registerViewBoxCallback((position) => {
      this.setCameraPosition(position);
    });

    setTimeout(() => {
      this.forceRender()
    }, 1000);
    
  }

  setCameraPosition(lookVector) {
    const bedCenter = this.bed.getCenter();
    const bedSize = this.bed.getSize();
    this.scene.activeCamera.radius = bedSize.x * 1.5;
    this.scene.activeCamera.target = new Vector3(bedCenter.x, bedCenter.z, bedCenter.y);
    let target = Vector3.Zero();
    
    const zeros = (lookVector.x === 0 ? 1 :0) + (lookVector.y === 0 ? 1 : 0) + (lookVector.z === 0 ?  1 : 0);
    const distance = zeros === 2 ?  1.75 : 1.35;

    switch (lookVector.x) {
      case 1:
        target.x = bedCenter.x - bedSize.x * distance;
        break;
      case 0:
        target.x = bedCenter.x;
        break;
      case -1:
        target.x = bedCenter.x + bedSize.x * distance;
        break;
    }

    switch (lookVector.y) {
      case 1:
        target.y = bedCenter.z - bedSize.z * distance;
        break;
      case 0:
        target.y = bedCenter.z;
        break;
      case -1:
        target.y = bedCenter.z + bedSize.z * distance;
        break;
    }

    switch (lookVector.z) {
      case 1:
        target.z = bedCenter.y - bedSize.y * distance;
        break;
      case 0:
        target.z = bedCenter.y;
        break;
      case -1:
        target.z = bedCenter.y + bedSize.y * distance;
        break;
    }

    if (lookVector.x === 0 && lookVector.z === 0) {
      this.scene.activeCamera.target = new Vector3(bedCenter.x, 0, bedCenter.y);      
      this.scene.activeCamera.position = target;
      this.scene.activeCamera.alpha = (3 * Math.PI) / 2;
    }
    else{
      this.scene.activeCamera.position = target;
    }

    this.scene.render(true);
    this.scene.render(true);
  }

  resize() {
    this.engine.resize();
    this.scene.render(true);
  }

  refreshUI() {
    setTimeout(function () {}, 0);
  }

  resetCamera() {
    const bedCenter = this.bed.getCenter();
    const bedSize = this.bed.getSize();
    if (this.bed.isDelta) {
      this.scene.activeCamera.radius = bedCenter.x;
      this.scene.activeCamera.target = new Vector3(bedCenter.x, -2, bedCenter.y);
      this.scene.activeCamera.position = new Vector3(-bedSize.x, bedSize.z, -bedSize.x);
    } else {
      this.scene.activeCamera.radius = bedCenter.x * 3;
      this.scene.activeCamera.target = new Vector3(bedCenter.x, -2, bedCenter.y);
      this.scene.activeCamera.position = new Vector3(-bedSize.x / 2, bedSize.z, -bedSize.y / 2);
    }
    this.scene.render(true);
    this.scene.render(true);
  }

  lastLoadFailed() {
    if (!localStorage) return false;
    return localStorage.getItem(this.lastLoadKey) === 'true';
  }
  setLoadFlag() {
    if (localStorage) {
      localStorage.setItem(this.lastLoadKey, 'true');
    }
  }

  clearLoadFlag() {
    if (localStorage) {
      localStorage.setItem(this.lastLoadKey, '');
      localStorage.removeItem(this.lastLoadKey);
    }
  }

  async processFile(fileContents) {
    this.clearScene();
    this.refreshUI();

    if (!fileContents) {
      this.fileData = 0;
      this.fileSize = 0;
    } else {
      this.fileData = fileContents;
      this.fileSize = fileContents.length;
    }

    this.fileDataArray = [];
    try{ 
      if(this.fileData !== null || this.fileData !== "") {
        this.fileDataArray = this.fileData.split('\n');
      } 
    }
    catch(e) {
      this.fileDataArray = [];
    }

    this.gcodeProcessor.setProgressColor(this.getProgressColor());
    this.gcodeProcessor.scene = this.scene;

    if (this.lastLoadFailed()) {
      console.error('Last rendering failed dropping to SBC quality');
      this.updateRenderQuality(1);
      this.clearLoadFlag();
    }
    this.setLoadFlag();

    await this.gcodeProcessor.processGcodeFile(fileContents, this.renderQuality);
    this.clearLoadFlag();

    await this.gcodeProcessor.createMesh(this.scene);
    this.gcodeProcessor.loadingComplete();
    this.maxHeight = this.gcodeProcessor.getMaxHeight();
    this.minHeight = this.gcodeProcessor.getMinHeight();
    this.toggleTravels(this.travelVisible);
    this.setCursorVisiblity(this.toolCursorVisible);
  }

  toggleTravels(visible) {
    for (const mesh of this.scene.meshes) {
      if (mesh.name === 'travels') {
        mesh.isVisible = visible;
      }
    }

    this.travelVisible = visible;
    this.scene.render(true);
  }
  getProgressColor() {
    let progressColor = localStorage.getItem('progressColor');
    if (progressColor === null) {
      progressColor = '#FFFFFF';
    }
    return progressColor;
  }
  setProgressColor(value) {
    localStorage.setItem('progressColor', value);
    this.gcodeProcessor.setProgressColor(value);
  }

  getBackgroundColor() {
    let color = localStorage.getItem('sceneBackgroundColor');
    if (color === null) {
      color = '#000000';
    }
    return color;
  }
  setBackgroundColor(color) {
    if (this.scene !== null && this.scene !== undefined) {
      if (color.length > 7) {
        color = color.substring(0, 7);
      }
      this.scene.clearColor = Color3.FromHexString(color);
      this.scene.render();
    }
    localStorage.setItem('sceneBackgroundColor', color);
  }
  clearScene(clearFileData) {
    if (this.fileData && clearFileData) {
      this.fileData = '';
    }
    this.gcodeProcessor.unregisterEvents();

    for (let idx = this.scene.meshes.length - 1; idx >= 0; idx--) {
      const sceneEntity = this.scene.meshes[idx];
      if (sceneEntity && this.debug) {
        console.log(`Disposing ${sceneEntity.name}`);
      }
      this.scene.removeMesh(sceneEntity);
      if (sceneEntity && typeof sceneEntity.dispose === 'function') {
        sceneEntity.dispose(false, true);
      }
    }

    for (let idx = this.scene.materials.length - 1; idx >= 0; idx--) {
      let sceneEntity = this.scene.materials[idx];
      if (sceneEntity.name !== 'solidMaterial') continue;
      if (sceneEntity && this.debug) {
        console.log(`Disposing ${sceneEntity.name}`);
      }
      this.scene.removeMaterial(sceneEntity);
      if (sceneEntity && typeof sceneEntity.dispose === 'function') {
        sceneEntity.dispose(false, true);
      }
    }

    if (this.toolCursor) {
      this.toolCursor.dispose(false, true);
      this.toolCursor = undefined;
    }

    this.buildtoolCursor();
    this.bed.buildBed();
    this.axes.render();
  }
  async reload() {
    this.clearScene();
    await this.processFile(this.fileData);
  }

  getRenderMode() {
    return this.gcodeProcessor.renderMode;
  }
  setCursorVisiblity(visible) {
    if (this.scene === undefined) return;
    if (this.toolCursor === undefined) {
      this.buildtoolCursor();
    }
    this.toolCursorMesh.isVisible = visible;
    this.toolCursorVisible = visible;
    this.scene.render();
  }
  updateToolPosition(position) {
    let x = 0;
    let y = 0;
    let z = 0;
    this.buildtoolCursor();
    if(position instanceof Vector3){
      x = position.x;
      y = position.z;
      z = position.y;
    }
    else{
    for (var index = 0; index < position.length; index++) {
      switch (position[index].axes) {
        case 'X':
          {
            x = position[index].position;
          }
          break;
        case 'Y':
          {
            y = position[index].position;
          }
          break;
        case 'Z':
          {
            z = position[index].position * (this.gcodeProcessor.spreadLines ? this.gcodeProcessor.spreadLineAmount : 1);
          }
          break;
      }
    }
    }
    this.toolCursor.setAbsolutePosition(new Vector3(x, z, y));
    if (this.toolCursorMesh.isVisible) {
      this.scene.render();
    }
  }
  buildtoolCursor() {
    if (this.toolCursor !== undefined) return;
    this.toolCursor = new TransformNode('toolCursorContainer');

    SceneLoader.ShowLoadingScreen = false;
    SceneLoader.Append('', JRNozzle, this.scene, undefined, undefined, undefined, '.obj');
    if(this.hqNozzle){
      this.toolCursorMesh = this.scene.getMeshByName('JRNozzle');
      this.toolCursorMesh.parent = this.toolCursor;
      if (this.gcodeProcessor.zBelt) {
        this.toolCursorMesh.rotate(Axis.X, Math.PI / 2 - (45 * Math.PI / 180), Space.LOCAL);
      }
      else {
        this.toolCursorMesh.rotate(Axis.X, Math.PI / 2 - (Math.PI / 180), Space.LOCAL);
      }
      this.toolCursorMesh.rotate(Axis.Y, Math.PI, Space.LOCAL);
      this.toolCursorMesh.rotate(Axis.Z, Math.PI, Space.LOCAL);
      this.toolCursorMesh.scaling = new Vector3(-1, 1, 1);
    }
    else{
      //load cone version
    }

    this.toolCursorMesh.isVisible = this.toolCursorVisible;
    this.toolCursorMesh.renderingGroupId = 2;
    this.registerClipIgnore(this.toolCursorMesh);

    const mat = new StandardMaterial('nozzleMaterial', this.scene);
    this.toolCursorMesh.material = mat;
    mat.diffuseColor = new Color3(1.0, 0.766, 0.336);
  }
  updateRenderQuality(renderQuality) {
    this.renderQuality = renderQuality;
    if (localStorage) {
      localStorage.setItem('renderQuality', renderQuality);
    }
  }
  registerClipIgnore(mesh) {
    if (mesh === undefined || mesh === null) return;
    mesh.onBeforeRenderObservable.add(() => {
      this.scene.clipPlane = null;
      this.scene.clipPlane2 = null;
    });
    mesh.onAfterRenderObservable.add(() => {
      this.scene.clipPlane = new Plane(0, 1, 0, this.zTopClipValue);
      this.scene.clipPlane2 = new Plane(0, -1, 0, this.zBottomClipValue);
    });
  }
  updateCameraInertiaProperties() {
    if (this.cameraInertia) {
      this.orbitCamera.speed = 2;
      this.orbitCamera.inertia = 0.9;
      this.orbitCamera.panningInertia = 0.9;
      this.orbitCamera.inputs.attached.keyboard.angularSpeed = 0.005;
      this.orbitCamera.inputs.attached.keyboard.zoomingSensibility = 2;
      this.orbitCamera.inputs.attached.keyboard.panningSensibility = 2;
      this.orbitCamera.angularSensibilityX = 1000;
      this.orbitCamera.angularSensibilityY = 1000;
      this.orbitCamera.panningSensibility = 10;
      this.orbitCamera.wheelPrecision = 1;
    } else {
      this.orbitCamera.speed = 500;
      this.orbitCamera.inertia = 0;
      this.orbitCamera.panningInertia = 0;
      this.orbitCamera.inputs.attached.keyboard.angularSpeed = 0.05;
      this.orbitCamera.inputs.attached.keyboard.zoomingSensibility = 0.5;
      this.orbitCamera.inputs.attached.keyboard.panningSensibility = 0.5;
      this.orbitCamera.angularSensibilityX = 200;
      this.orbitCamera.angularSensibilityY = 200;
      this.orbitCamera.panningSensibility = 2;
      this.orbitCamera.wheelPrecision = 0.25;
    }
  }
  setCameraInertia(enabled) {
    this.cameraInertia = enabled;
    localStorage.setItem('cameraInertia', enabled);
    this.updateCameraInertiaProperties();
  }

  forceRender() {
    if (this.scene) {
      this.scene.render(true);
    }
  }

  getLayers(){
    return this.gcodeProcessor.layerDictionary;
  }

  getGCodeLine(numLines = 5){
    try{
      const startIdx = Math.max(0,this.gcodeProcessor.currentLineNumber - numLines);
      const endIdx = Math.min(this.gcodeProcessor.currentLineNumber, this.fileDataArray.length  - 1);
      return this.fileDataArray.slice(startIdx, endIdx).join('\r\n').trim();
    }
    catch{
      return ""
    }
  }

  getGCodeLineNumber(){
    return this.gcodeProcessor.currentLineNumber
  }

  goToGCodeLine(lineNumber){
    
  }

  simulateToolPosition(){
    this.updateToolPosition(this.gcodeProcessor.nozzlePosition);
  }

  setZBelt(enabled, angle) {
    this.gcodeProcessor.zBelt = enabled;
    if (enabled) {
      this.gcodeProcessor.setZBeltAngle(angle);
      this.toolCursorMesh.rotate(Axis.X, Math.PI / 2 - (angle * Math.PI/180), Space.LOCAL);      
    }
  }

}
