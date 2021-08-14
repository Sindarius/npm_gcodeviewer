import { BaseRenderer } from "./baserenderer";
import { VertexBuffer } from "@babylonjs/core/Meshes/buffer";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color4 } from "@babylonjs/core/Maths/math.color";

export default class LineRenderer extends BaseRenderer {

  constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools, meshIndex) {
    super(scene, specularColor, loadingProgressCallback, renderFuncs, tools);
    this.meshIndex = meshIndex ?? 0;
    this.additiveColor = new Color4(0, 1, 0, 0.8);
    this.travels = false;
  }

  render(lines) {
    let gcodeLineIndex = new Array();

    this.renderMode = 'Line Rendering';
    //Extrusion
    let lineArray = [];
    let colorArray = [];
    let additive = [];
    let completed = [];
    let transparentValue = this.vertexAlpha ? 0.25 : 0

    for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      let line = lines[lineIdx];
      let tool = this.tools[line.tool];

      gcodeLineIndex.push(line.gcodeLineNumber);
      let data = line.getPoints(this.scene);
      lineArray.push(data.points);
      colorArray.push(data.colors);
      additive.push(tool.isAdditive() && !this.travels);
      completed.push(false);
    }

    let lineMesh = MeshBuilder.CreateLineSystem(
      this.travels ? 'travels' : 'lineMesh',
      {
        lines: lineArray,
        colors: colorArray,
        updatable: true,
      },
      this.scene
    );



    lineArray = null;

    lineMesh.isVisible = true;
    lineMesh.isPickable = false;
    lineMesh.markVerticesDataAsUpdatable(VertexBuffer.ColorKind);
    lineMesh.material = new StandardMaterial("m", this.scene);
    lineMesh.material.backFaceCulling = false;
    lineMesh.material.forceDepthWrite = true;
    lineMesh.alphaIndex = this.meshIndex;
    lineMesh.renderingGroupId = 2;

    let minFilePosition = gcodeLineIndex[0]
    let maxFilePosition = gcodeLineIndex.slice(-1)[0];

    let lastPosition = 0;
    let scrubbing = false;
    let lastRendered = 0;
    let updateLines = () => {
      var colorData = lineMesh.getVerticesData(VertexBuffer.ColorKind);

      if (!colorData) {
        console.log("Error");
        return;
      }

      let renderTo = -1;
      let renderAhead = -1;

      if (scrubbing) {
      
        for (let idx = 0; idx < gcodeLineIndex.length; idx++) {
          let colorIdx = idx * 8;
          if (this.travels) {
            colorData[colorIdx + 3] = 0;
            colorData[colorIdx + 7] = 0;
          }
          else {
            if (gcodeLineIndex[idx] < this.currentFilePosition) {
              colorArray[idx][0].toArray(colorData, colorIdx);
              colorArray[idx][1].toArray(colorData, colorIdx + 4);
              colorData[colorIdx + 3] = 1;
              colorData[colorIdx + 7] = 1;
              completed[idx] = true;
            } else {
              colorData[colorIdx + 3] = additive[idx] ? transparentValue : 0;
              colorData[colorIdx + 7] = additive[idx] ? transparentValue : 0;
              completed[idx] = false;
            }
          }
        }
        lastRendered = 0;
        lineMesh.updateVerticesData(VertexBuffer.ColorKind, colorData, true);
      }


      for (var renderToIdx = lastRendered; renderToIdx < gcodeLineIndex.length; renderToIdx++) {
        if (gcodeLineIndex[renderToIdx] <= this.currentFilePosition) {
          renderTo = renderToIdx;
        }
        if (gcodeLineIndex[renderToIdx] <= this.currentFilePosition + this.lookAheadLength) {
          renderAhead = renderToIdx;
        }
      }

      let startIdx = completed.findIndex(l => l == false);

      for (let colorIdx = startIdx; colorIdx < renderTo; colorIdx++) {
        let index = colorIdx * 8;
        if (additive[colorIdx]) {
          if (colorData[index + 3] <= 0.5) {
            colorData[index] = this.progressColor.r;
            colorData[index + 1] = this.progressColor.g;
            colorData[index + 2] = this.progressColor.b;
            colorData[index + 3] = 0.9;
            colorData[index + 4] = this.progressColor.r;
            colorData[index + 5] = this.progressColor.g;
            colorData[index + 6] = this.progressColor.b;
            colorData[index + 7] = 0.9;
          }
          else if (colorData[index + 3] < 1) {
            colorData[index + 3] += 0.02;
            colorData[index + 7] += 0.02;
          }
          else if (colorData[index + 3] >= 1) {
            colorData[index] = colorArray[colorIdx][0].r;
            colorData[index + 1] = colorArray[colorIdx][0].g;
            colorData[index + 2] = colorArray[colorIdx][0].b;
            colorData[index + 3] = 1;
            colorData[index + 4] = colorArray[colorIdx][1].r;
            colorData[index + 5] = colorArray[colorIdx][1].g;
            colorData[index + 6] = colorArray[colorIdx][1].b;
            colorData[index + 7] = 1;
            completed[colorIdx] = true;
          }
        } else {
          /* Subtractive rendering */
          if (completed[colorIdx]) continue;
          if (colorData[index + 3] === 0) {
            colorData[index] = 1;
            colorData[index + 1] = 0;
            colorData[index + 2] = 0;
            colorData[index + 3] = 0.9;
            colorData[index + 4] = 1;
            colorData[index + 5] = 0;
            colorData[index + 6] = 0;
            colorData[index + 7] = 0.9;
          }
          else if (colorData[index + 3] < 1) {
            colorData[index + 3] += 0.02;
            colorData[index + 7] += 0.02;
          }
          else {
            colorData[index + 3] = 0.0001;
            colorData[index + 7] = 0.0001;
            completed[colorIdx] = true;
          }
        }
        lastRendered = colorIdx;
      }

      //render ahead
      for (let renderAheadIdx = renderTo; renderAheadIdx < renderAhead; renderAheadIdx++) {
        let index = renderAheadIdx * 8;
        colorData[index + 3] = 1;
        colorData[index + 7] = 1;
      }

      lineMesh.updateVerticesData(VertexBuffer.ColorKind, colorData, true);
    }

    let timeStamp = Date.now();
    let beforeRenderFunc = () => {
      if (this.isLoading || Date.now() - timeStamp < 200) return;
      timeStamp = Date.now();

      if (Math.abs(lastPosition - this.currentFilePosition) > this.scrubDistance) {
        scrubbing = true;
        lastPosition = 0
        updateLines();
      } else {
        if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
          scrubbing = false;
          updateLines();
        }
      }
      lastPosition = this.currentFilePosition;
    }
    this.renderFuncs.push(beforeRenderFunc);
    this.scene.registerBeforeRender(beforeRenderFunc);
  }


}