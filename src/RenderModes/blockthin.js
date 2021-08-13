/* eslint-disable */
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { BaseRenderer } from './baserenderer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Space } from '@babylonjs/core/Maths/math.axis';

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
                this.solidMat.dispose()
                this.solidMat = null;
            }
            catch {
                ;
            }
        }

        if (this.transparentMat) {
            try {
                this.transparentMat.dispose()
                this.transparentMat = null;
            }
            catch {
                ;
            }
        }

        //build the box
        let box = MeshBuilder.CreateBox('box', { width: 1, height: 1, depth: 1}, this.scene);
        //box.hasVertexAlpha = true;
        //box.updateFacetData = true;

        let material = new StandardMaterial("mat", this.scene);
        //material.needDepthPrePass = true;
        //material.forceDepthWrite = true;
        //material.backFaceCulling = true;
        
        box.material = material;
        return box;
    }


    render(lines) {


        let segments = new Array();
        let gcodeLineIndex = new Array(); //file index when segmenet is rendered

        //Process the gcode and extra extrusions
        for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            let line = lines[lineIdx];
            let tool = this.tools[line.tool];

            if (!line.extruding) { continue; }

            let segment = line.renderLinev4();
            let data = {};
            data.matrix = segment.matrix;
            data.color = segment.color;
            segments.push(data);
            gcodeLineIndex.push(segment.props.gcodeLineNumber);
        }

        let matrixData = new Float32Array(16 * segments.length);
        let colorData = new Float32Array(4 * segments.length);
        let completed = new Array();

        for (var segIdx = 0; segIdx < segments.length; segIdx++) {
            let segment = segments[segIdx];
            segment.matrix.copyToArray(matrixData, segIdx * 16);
            segment.color.toArray(colorData, segIdx * 4)
            completed.push(false);
        }

        let box = this.buildBox();
        box.thinInstanceSetBuffer('matrix', matrixData, 16);
        box.thinInstanceSetBuffer('color', colorData, 4);
        box.thinInstanceRefreshBoundingInfo();
        box.alphaIndex = this.meshIndex;
        box.renderingGroupId = 2;

        let updateSegments = () => {
            let colorUpdated = scrubbing;
            let positionUpdated = scrubbing;
            for (let idx = 0; idx < segments.length; idx++) {

                let colorIdx = idx * 4;

                if (scrubbing) {
                    if (gcodeLineIndex[idx] < this.currentFilePosition) {
                        segments[idx].color.toArray(colorData, colorIdx);
                        segments[idx].matrix.copyToArray(matrixData, idx * 16);
                        colorData[colorIdx + 3] = 1;
                        completed[idx] = true;
                    }
                    else {
                        this.lostInSpace.copyToArray(matrixData, idx * 16);
                        colorData[colorIdx + 3] = 0;
                        completed[idx] = false;
                    }
                    continue;
                }

                
                if (completed[idx]) continue;

                
                if (gcodeLineIndex[idx] < this.currentFilePosition && colorData[colorIdx + 3] < 0.5) {
                    this.progressColor.toArray(colorData, colorIdx);
                    colorData[colorIdx + 3] = 0.9;
                    colorUpdated = true;
                    segments[idx].matrix.copyToArray(matrixData, idx * 16);
                    positionUpdated = true;
                    continue;
                }

                if (colorData[colorIdx + 3] > 0.5 && colorData[colorIdx + 3] < 1) {
                    colorData[colorIdx + 3] += 0.02;
                }

                if (colorData[colorIdx + 3] >= 1 && !completed[idx]) {
                    segments[idx].color.toArray(colorData, colorIdx);
                    colorData[colorIdx + 3] = 1;
                    completed[idx] = true;
                    colorUpdated = true;
                }
            }
            if (colorUpdated) {
                box.thinInstanceBufferUpdated('color');
            }
            if (positionUpdated) {
                box.thinInstanceBufferUpdated('matrix')
                box.thinInstanceRefreshBoundingInfo();
            }

        }

        let minFilePosition = lines[0].gcodeLineNumber
        let maxFilePosition = lines.slice(-1)[0].gcodeLineNumber;

        let lastPosition = 0;
        let scrubbing = false;

        let timeStamp = Date.now();
        let beforeRenderFunc = () => {
            if (this.isLoading || Date.now() - timeStamp < 200) return;
            timeStamp = Date.now();

            if (Math.abs(lastPosition - this.currentFilePosition) > this.scrubDistance) {
                scrubbing = true;
                lastPosition = 0;
                for (let idx = 0; idx < completed.length; idx++) {
                    completed[idx] = false;
                }
                updateSegments();
            } else if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
                scrubbing = false;
                updateSegments();
            }
           
            lastPosition = this.currentFilePosition;
        }
        
        this.renderFuncs.push(beforeRenderFunc);
        this.scene.registerBeforeRender(beforeRenderFunc);


    }



}