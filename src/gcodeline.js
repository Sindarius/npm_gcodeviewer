'use strict';

import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Quaternion, Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'

export default class {
  constructor() {
    this.tool = 0;
    this.start;
    this.end;
    this.extruding = false;
    this.gcodeLineNumber = 0;
    this.color;
    this.feedRate = 0;
    this.layerHeight = 0;
  }

  length() {
    return this.distanceVector(this.start, this.end);
  }

  renderLine(scene) {
    var points = [this.start, this.end];
    let lineMesh = Mesh.CreateLines('lines', points, scene);
    lineMesh.enableEdgesRendering();
    lineMesh.edgesWidth = 10;
    lineMesh.edgesColor = new Color4(1, 1, 0, 1);
  }

  renderLineV2() {
    var tube = MeshBuilder.CreateTube('tube', {
      path: [this.start, this.end],
      radius: 0.2,
      tesselation: 4,
      sideOrientation: Mesh.FRONTSIDE,
      updatable: false,
    });
    tube.doNotSyncBoundingInfo = true;
    return tube;
  }

  distanceVector(v1, v2) {
    let dx = v1.x - v2.x;
    let dy = v1.y - v2.y;
    let dz = v1.z - v2.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  renderLineV3(p, invisible) {
    let length = this.distanceVector(this.start, this.end);
    let rot2 = Math.atan2(this.end.z - this.start.z, this.end.x - this.start.x);
    p.scaling.x = length;
    p.scaling.y = this.layerHeight;
    p.scaling.z = this.layerHeight * 2;
    p.rotation.y = -rot2;

    p.position.x = this.start.x + (length / 2) * Math.cos(rot2);
    p.position.y = this.start.y;
    p.position.z = this.start.z + (length / 2) * Math.sin(rot2);
    p.color = this.color;
    if (invisible) {
      p.materialIndex = 1;
    } else {
      p.materialIndex = 0;
    }

    p.props = {
      gcodeLineNumber: this.gcodeLineNumber,
      originalColor: this.color,
    };
  }


  renderLinev4(nozzleSize = 0.4, padding = 0){
    if(this.layerHeight === 0) {this.layerHeight = this.start.y; }
    let p = {};
    let length = this.distanceVector(this.start, this.end);
    let rot2 = Math.atan2(this.end.z - this.start.z, this.end.x - this.start.x);

    let len = length + padding; //add a little extra to each end to smooth out the hard corners a little

    p.matrix = Matrix.Compose(
      new Vector3( len, this.layerHeight, nozzleSize),
      Quaternion.FromEulerAngles(0,-rot2, 0),
      new Vector3(this.start.x + ( len / 2) * Math.cos(rot2),
       this.start.y, 
       this.start.z + ( len / 2) * Math.sin(rot2)));
    p.color = this.color;
    p.props = {
      gcodeLineNumber: this.gcodeLineNumber,
      originalColor: this.color,
    };

    return p;
  }

  renderParticle(p) {
    p.position.x = this.start.x;
    p.position.y = this.start.y;
    p.position.z = this.start.z;
    p.color = this.color;
  }

  getPoints() {
    return {
      points: [this.start, this.end],
      colors: [this.color, this.color],
    };
  }

  getColor() {
    if (this.extruding) {
      return new Color4(1, 1, 1, 1);
    }
    return new Color4(1, 0, 0, 1);
  }

  //X Z =  X Y printer space
  getVoxelSegments(voxelSize, voxelHeight, toolRadius = 0, additive) {
    let pointArray = new Array();
    let distance = this.distanceVector(this.start, this.end);
    if (distance < 0.1) return;
    let segments = Math.round(((distance / (voxelSize / 2)) - 1) * 100) / 100;

    let rot2 = Math.atan2(this.end.z - this.start.z, this.end.x - this.start.x);


    if (additive) {
      this.start.y -= voxelSize / 2;
      this.end.y -= voxelSize / 2;
    }

    let point = this.start.clone();
    let segCount = 0;
    pointArray.push(point.clone());



    let stepX = voxelSize / 2 * Math.cos(rot2);
    let stepZ = voxelSize / 2 * Math.sin(rot2);

    let stepY = 0;
    if (segments !== 0) {
      stepY = (this.end.y - this.start.y) / segments;
    }

    while (segCount < segments) {
      point.x += stepX;
      point.y += stepY;
      point.z += stepZ;
      pointArray.push(point.clone());

      //TODOJER : Deal with points within the diameter 
      //Include points that are potentially cut by a cutting tool.
      //This is a gross estimation and will need to be better calculated for round values
      if (toolRadius > voxelSize) {
        for (let pX = point.x - toolRadius; pX <= point.x + toolRadius; pX += voxelSize) {
          for (let pZ = point.z - toolRadius; pZ < point.z + toolRadius; pZ += voxelSize) {
            pointArray.push(new Vector3(pX, point.y, pZ));
          }
        }
      }
      segCount++;
    }

    pointArray.push(this.end.clone());

    if (this.layerHeight > voxelHeight && additive) {
      let depthPoints = [];
      for (let pointIdx = 0; pointIdx < pointArray.length; pointIdx++) {
        let pt = pointArray[pointIdx];
        for (let yOff = 1; yOff < (Math.ceil(this.layerHeight / voxelHeight)); yOff++) {
          depthPoints.push(new Vector3(pt.x, pt.y - (yOff * voxelHeight), pt.z))
        }
      }
      pointArray.push(...depthPoints);
    }
    return pointArray;
  }


}
