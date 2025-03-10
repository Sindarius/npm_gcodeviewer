import { BaseRenderer } from './baserenderer';
import { VertexBuffer } from '@babylonjs/core/Meshes/buffer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color4 } from '@babylonjs/core/Maths/math.color';

export default class LineRenderer extends BaseRenderer {
   constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools, meshIndex) {
      super(scene, specularColor, loadingProgressCallback, renderFuncs, tools);
      this.meshIndex = meshIndex ?? 0;
      this.additiveColor = new Color4(0, 1, 0, 0.8);
      this.travels = false;
      this.travelColorArray = [new Color4(1, 0, 0, 1), new Color4(1, 0, 0, 1)];
   }

   render(lines) {
      let gcodeLineIndex = new Array(lines.length);

      this.renderMode = 'Line Rendering';
      //Extrusion
      let lineArray = new Array(lines.length);
      let colorArray = new Array(lines.length);
      let additive = new Array(lines.length);
      let completed = new Array(lines.length);
      let tools = new Array(lines.length)
      let isPerimeter = new Array(lines.length);

      for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
         let line = lines[lineIdx];
         if (line == null) break;
         let tool = this.tools[line.tool];

         gcodeLineIndex[lineIdx] = line.gcodeFilePosition;
         let data = line.getPoints(this.scene);
         lineArray[lineIdx] = data.points;
         colorArray[lineIdx] = this.travels ?  this.travelColorArray : data.colors;
         tools[lineIdx] = line.tool;
         isPerimeter[lineIdx] = line.isPerimeter;
         additive[lineIdx] = tool.isAdditive() && !this.travels
         completed[lineIdx] = false;
      }

      let lineMesh = MeshBuilder.CreateLineSystem(
         this.travels ? 'travels' : 'lineMesh',
         {
            lines: lineArray,
            colors: colorArray,
            updatable: true
         },
         this.scene
      );

      lineArray = null;

      lineMesh.isVisible = true;
      lineMesh.isPickable = false;
      lineMesh.markVerticesDataAsUpdatable(VertexBuffer.ColorKind);
      lineMesh.material.backFaceCulling = false;
      lineMesh.material.forceDepthWrite = true;
      lineMesh.material.specularColor = this.specularColor;
      lineMesh.alphaIndex = this.meshIndex;
      lineMesh.renderingGroupId = 2;

      let minFilePosition = gcodeLineIndex[0];
      let maxFilePosition = gcodeLineIndex.slice(-1)[0];

      let lastPosition = 0;
      let scrubbing = false;
      let lastRendered = 0;

      let updateLines = () => {
         var colorData = lineMesh.getVerticesData(VertexBuffer.ColorKind);

         if (!colorData) {
            console.log('Error');
            return;
         }

         let renderTo = -1;
         let renderAhead = -1;

         if (scrubbing) {
            for (let idx = 0; idx < gcodeLineIndex.length; idx++) {
               let colorIdx = idx * 8;
               
               if (this.canUpdateColor() && !this.travels) {
                  if (!isPerimeter[idx]) {
                     colorArray[idx] = [this.tools[tools[idx]].colorDarker,this.tools[tools[idx]].colorDarker];
                  }
                  else {
                     colorArray[idx] = [this.tools[tools[idx]].color,this.tools[tools[idx]].color];
                  }
               }

               if (this.travels && !this.persistTravels) {
                  colorData[colorIdx + 3] = 0;
                  colorData[colorIdx + 7] = 0;
                  completed[idx] = gcodeLineIndex[idx] <= this.currentFilePosition;
               } else if (this.travels && this.persistTravels) {
                  colorArray[idx][0].toArray(colorData, colorIdx);
                  colorArray[idx][1].toArray(colorData, colorIdx + 4);
                  colorData[colorIdx + 3] =  gcodeLineIndex[idx] <= this.currentFilePosition ? 1 : 0;
                  colorData[colorIdx + 7] =  gcodeLineIndex[idx] <= this.currentFilePosition ? 1 : 0;
                  completed[idx] = gcodeLineIndex[idx] <= this.currentFilePosition;
               }
               else
               {
                  if (gcodeLineIndex[idx] <= this.currentFilePosition && !this.progressMode) {
                     colorArray[idx][0].toArray(colorData, colorIdx);
                     colorArray[idx][1].toArray(colorData, colorIdx + 4);
                     colorData[colorIdx + 3] = additive[idx] ? 1 : 0;
                     colorData[colorIdx + 7] = additive[idx] ? 1 : 0;
                     completed[idx] = true;
                  } else {
                     if (this.progressMode) {
                        colorArray[idx][0].toArray(colorData, colorIdx);
                        colorArray[idx][1].toArray(colorData, colorIdx + 4);
                        colorData[colorIdx + 3] = this.getTransparentValue();
                        colorData[colorIdx + 7] = this.getTransparentValue();
                     }
                     colorData[colorIdx + 3] = additive[idx] ? this.getTransparentValue() : 0;
                     colorData[colorIdx + 7] = additive[idx] ? this.getTransparentValue() : 0;
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
            if (gcodeLineIndex[renderToIdx] <= this.currentFilePosition) {
               renderAhead = renderToIdx;
            }
         }

         let startIdx = completed.findIndex((l) => l === false);

         for (let idx = startIdx; idx <= renderTo; idx++) {
            let colorIdx = idx * 8;
            if (additive[idx] || (this.travels && this.persistTravels)) {
               /*Additive Rendering*/
               if (completed[idx]) continue;

               if (this.progressMode) {
                  colorData[colorIdx] = this.progressColor.r;
                  colorData[colorIdx + 1] = this.progressColor.g;
                  colorData[colorIdx + 2] = this.progressColor.b;
                  colorData[colorIdx + 3] = 0.9;
                  colorData[colorIdx + 4] = this.progressColor.r;
                  colorData[colorIdx + 5] = this.progressColor.g;
                  colorData[colorIdx + 6] = this.progressColor.b;
                  colorData[colorIdx + 7] = 0.9;
               } else {
                  if (colorData[colorIdx + 3] <= 0.5) {
                     colorData[colorIdx] = this.progressColor.r;
                     colorData[colorIdx + 1] = this.progressColor.g;
                     colorData[colorIdx + 2] = this.progressColor.b;
                     colorData[colorIdx + 3] = 0.9;
                     colorData[colorIdx + 4] = this.progressColor.r;
                     colorData[colorIdx + 5] = this.progressColor.g;
                     colorData[colorIdx + 6] = this.progressColor.b;
                     colorData[colorIdx + 7] = 0.9;
                  } else if (colorData[colorIdx + 3] < 1) {
                     colorData[colorIdx + 3] += 0.02;
                     colorData[colorIdx + 7] += 0.02;
                  } else if (colorData[colorIdx + 3] >= 1) {
                     colorData[colorIdx] = colorArray[idx][0].r;
                     colorData[colorIdx + 1] = colorArray[idx][0].g;
                     colorData[colorIdx + 2] = colorArray[idx][0].b;
                     colorData[colorIdx + 3] = 1;
                     colorData[colorIdx + 4] = colorArray[idx][1].r;
                     colorData[colorIdx + 5] = colorArray[idx][1].g;
                     colorData[colorIdx + 6] = colorArray[idx][1].b;
                     colorData[colorIdx + 7] = 1;
                     completed[idx] = true;
                  }
               }
            } else {
               /* Subtractive rendering */
               if (completed[idx]) continue;
               if (colorData[colorIdx + 3] === 0) {
                  colorData[colorIdx] = 1;
                  colorData[colorIdx + 1] = 0;
                  colorData[colorIdx + 2] = 0;
                  colorData[colorIdx + 3] = 0.9;
                  colorData[colorIdx + 4] = 1;
                  colorData[colorIdx + 5] = 0;
                  colorData[colorIdx + 6] = 0;
                  colorData[colorIdx + 7] = 0.9;
               } else if (colorData[colorIdx + 3] < 1) {
                  colorData[colorIdx + 3] += 0.02;
                  colorData[colorIdx + 7] += 0.02;
               } else {
                  colorData[colorIdx + 3] = 0.0001;
                  colorData[colorIdx + 7] = 0.0001;
                  completed[idx] = true;
               }
            }
            lastRendered = idx;
         }

         //render ahead
         for (let renderAheadIdx = renderTo; renderAheadIdx < renderAhead; renderAheadIdx++) {
            let index = renderAheadIdx * 8;
            colorData[index + 3] = 1;
            colorData[index + 7] = 1;
         }

         lineMesh.updateVerticesData(VertexBuffer.ColorKind, colorData, true);
      };

      let timeStamp = Date.now();
      let beforeRenderFunc = () => {
         if (this.isLoading || Date.now() - timeStamp < 200) return;
         timeStamp = Date.now();

         if (this.doScrub(lastPosition, minFilePosition, maxFilePosition) || this.forceRedraw) {
            this.forceRedraw = false;
            scrubbing = true;

            for (let idx = 0; idx < completed.length; idx++) {
               completed[idx] = false;
            }

            lastRendered = 0;
            lastPosition = 0;
            updateLines();
         } else {
            if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
               scrubbing = false;
               updateLines();
            }
         }
         lastPosition = this.currentFilePosition;
      };
      this.renderFuncs.push(beforeRenderFunc);
      this.scene.registerBeforeRender(beforeRenderFunc);
   }
}
