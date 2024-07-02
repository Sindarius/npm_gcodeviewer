import { Color4 } from '@babylonjs/core/Maths/math.color';
import { BaseRenderer } from './baserenderer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

export default class BlockTIRenderer extends BaseRenderer {
   constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools, meshIndex) {
      super(scene, specularColor, loadingProgressCallback, renderFuncs, tools);
      this.meshIndex = meshIndex ?? 0;
      this.lostInSpace = Matrix.Identity().setTranslation(new Vector3(10000, 10000, 10000));
      this.additiveColor = new Color4(0, 1, 0, 0.8);
   }

   buildBox() {
      if (this.solidMat) {
         try {
            this.solidMat.dispose();
            this.solidMat = null;
         } catch {
            console.warn('nothing to dispose');
         }
      }

      if (this.transparentMat) {
         try {
            this.transparentMat.dispose();
            this.transparentMat = null;
         } catch {
            console.warn('nothing to dispose');
         }
      }

      //build the box
      let box = MeshBuilder.CreateBox('box', { width: 1, height: 1, depth: 1, sideOrientation: Mesh.FRONTSIDE }, this.scene);
      this.material = new StandardMaterial('mat', this.scene);
      this.material.specularColor = this.specularColor;
      box.material = this.material;
      if (this.vertexAlpha) {
         box.hasVertexAlpha = true;
         box.material.forceDepthWrite = true;
         box.material.alpha = 0.99;
      }
      return box;
   }

   render(lines) {
      let segments = new Array(lines.length);
      let segmentCount = 0;
      let gcodeLineIndex = new Array(lines.length); //file index when segmenet is rendered
      //Process the gcode and extra extrusions
      for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
         let line = lines[lineIdx];
         if (line == null) break;
         let tool = this.tools[line.tool];

         if (!line.extruding) {
            continue;
         }

         let segment = line.renderLinev4(this.g1AsExtrusion ? 1 : tool.getDiameter(), 0.1);
         let data = {};
         data.matrix = segment.matrix;
         data.color = segment.color;
         data.tool = line.tool;

         segments[segmentCount++] = data;
         gcodeLineIndex[lineIdx] = segment.props.gcodeFilePosition;
      }

      let matrixData = new Float32Array(16 * segmentCount);
      let colorData = new Float32Array(4 * segmentCount);
      let completed = new Array(segmentCount);

      for (var segIdx = 0; segIdx < segmentCount; segIdx++) {
         let segment = segments[segIdx];
         segment.matrix.copyToArray(matrixData, segIdx * 16);
         segment.color.toArray(colorData, segIdx * 4);
         colorData[segIdx * 4 + 3] = this.getTransparentValue();
         completed[lineIdx] = false;
      }

      let box = this.buildBox();
      box.alphaIndex = this.meshIndex;
      box.renderingGroupId = 2;
      box.thinInstanceSetBuffer('matrix', matrixData, 16, false);
      box.thinInstanceSetBuffer('color', colorData, 4, false);
      box.thinInstanceRefreshBoundingInfo();

      let updateSegments = () => {
         let colorUpdated = scrubbing;
         let positionUpdated = scrubbing;
         for (let idx = 0; idx < segmentCount; idx++) {
            let matrixIdx = idx * 16;
            let colorIdx = idx * 4;

            if (this.canUpdateColor()) {
               segments[idx].color = this.hasMixing ? segments[idx].color : this.tools[segments[idx].tool].color;
            }

            if (scrubbing && !this.progressMode) {
               if (gcodeLineIndex[idx] <= this.currentFilePosition) {
                  segments[idx].color.toArray(colorData, colorIdx);
                  segments[idx].matrix.copyToArray(matrixData, idx * 16);
                  colorData[colorIdx + 3] = 1;
                  completed[idx] = true;
               } else {
                  if (this.getTransparentValue() === 0) {
                     this.lostInSpace.copyToArray(matrixData, idx * 16);
                  } else {
                     segments[idx].matrix.copyToArray(matrixData, idx * 16);
                  }
                  colorData[colorIdx + 3] = this.getTransparentValue();
                  completed[idx] = false;
               }
               continue;
            }

            if (completed[idx]) continue;

            if (this.progressMode) {
               if (gcodeLineIndex[idx] <= this.currentFilePosition) {
                  colorData[colorIdx] = this.progressColor.r;
                  colorData[colorIdx + 1] = this.progressColor.g;
                  colorData[colorIdx + 2] = this.progressColor.b;
                  colorData[colorIdx + 3] = 1;
                  colorUpdated = true;
                  continue;
               } else {
                  segments[idx].color.toArray(colorData, colorIdx);
                  colorData[colorIdx + 3] = this.getTransparentValue();
                  colorUpdated = true;
                  segments[idx].matrix.copyToArray(matrixData, matrixIdx);
                  positionUpdated = true;
               }
            } else {
               if (gcodeLineIndex[idx] <= this.currentFilePosition && colorData[colorIdx + 3] < 0.5) {
                  if(this.renderAnimation) this.progressColor.toArray(colorData, colorIdx);
                  colorData[colorIdx + 3] = this.renderAnimation ?  0.9 : 2;
                  colorUpdated = true;
                  segments[idx].matrix.copyToArray(matrixData, matrixIdx);
                  positionUpdated = true;
                  if(this.renderAnimation) continue;
               }


               if (colorData[colorIdx + 3] > 0.5 && colorData[colorIdx + 3] < 1) {
                  colorData[colorIdx + 3] += 0.02;
                  let percent = (colorData[colorIdx + 3] - 0.9) * 10;
                  colorData[colorIdx] = this.lerp(this.progressColor.r, segments[idx].color.r, percent);
                  colorData[colorIdx + 1] = this.lerp(this.progressColor.g, segments[idx].color.g, percent);
                  colorData[colorIdx + 2] = this.lerp(this.progressColor.b, segments[idx].color.b, percent);
                  colorUpdated = true;
               }

               if (colorData[colorIdx + 3] >= 1 && !completed[idx]) {
                  segments[idx].color.toArray(colorData, colorIdx);
                  colorData[colorIdx + 3] = 1;
                  completed[idx] = true;
                  colorUpdated = true;
               }
            }
         }
         if (colorUpdated) {
            box.thinInstanceBufferUpdated('color');
         }
         if (positionUpdated) {
            box.thinInstanceBufferUpdated('matrix');
            box.thinInstanceRefreshBoundingInfo();
         }
      };

      if (lines.length === 0) return;

      let minFilePosition = lines[0].gcodeFilePosition;
      let maxFilePosition = lines.slice(-1)[0].gcodeFilePosition;

      let lastPosition = 0;
      let scrubbing = false;
      let meshFrozen = false;

      this.timeStamp = Date.now();
      let beforeRenderFunc = () => {
         if (this.isLoading || Date.now() - this.timeStamp < 200) return;
         this.timeStamp = Date.now();

         if (this.doScrub(lastPosition, minFilePosition, maxFilePosition) || this.forceRedraw) {
            scrubbing = true;
            this.forceRedraw = false;
            lastPosition = 0;
            for (let idx = 0; idx < completed.length; idx++) {
               completed[idx] = false;
            }

            if (meshFrozen) {
               box.unfreezeWorldMatrix();
            }
            updateSegments();
         } else if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
            scrubbing = false;

            if (meshFrozen) {
               box.unfreezeWorldMatrix();
            }

            updateSegments();
         } else {
            if (!meshFrozen) {
               box.freezeWorldMatrix();
               meshFrozen = true;
            }
         }

         lastPosition = this.currentFilePosition;
      };

      this.renderFuncs.push(beforeRenderFunc);
      this.scene.registerBeforeRender(beforeRenderFunc);
   }
}
