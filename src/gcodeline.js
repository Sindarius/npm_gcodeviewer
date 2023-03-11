'use strict';

import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Quaternion, Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'


const PIOVER2 = Math.PI / 2;
const VECDIV2 = new Vector3(2, 2, 2);
export default class {
  constructor() {
    this.tool = 0;
    this.start = Vector3.Zero();
    this.end = Vector3.Zero();;
    this.extruding = false;
    this.gcodeLineNumber = 0;
    this.gcodeFilePosition = 0;
    this.color = null;
    this.feedRate = 0;
    this.layerHeight = 0;
  }

  length() {
    return Vector3.Distance(this.start, this.end);
  }

  renderLine(scene) {
    var points = [this.start, this.end];
    let lineMesh = MeshBuilder.CreateLines('lines', points, scene);
    lineMesh.enableEdgesRendering();
    lineMesh.edgesWidth = 10;
    lineMesh.edgesColor = new Color4(1, 1, 0, 1);
  }

  //This method is used to calculate the matrix used to visualize with meshes like cube and cylinder
  renderLinev4(nozzleSize = 0.4, padding = 0){
    if(this.layerHeight === 0) {this.layerHeight = this.start.y; }
    let p = {};
    
    let length = this.length() + padding;
    let midPoint = this.start.add(this.end).divide(VECDIV2);

    let v = this.end.subtract(this.start);
    let r = Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2) + Math.pow(v.z, 2));
    let phi = Math.atan2(v.z, v.x);
    let theta = Math.acos(v.y / r);

      p.matrix = Matrix.Compose(
      new Vector3(length, this.layerHeight, nozzleSize),
      Quaternion.FromEulerVector(new Vector3(0, -phi, PIOVER2 - theta)),
      midPoint);
    p.color = this.color;
    p.props = {
      gcodeLineNumber: this.gcodeLineNumber,
      gcodeFilePosition: this.gcodeFilePosition,
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
    let distance = Vector3.Distance(this.start, this.end);
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
