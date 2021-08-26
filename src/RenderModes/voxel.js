/*eslint-disable*/
'use strict';

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { pauseProcessing } from '../utils.js'
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { BaseRenderer } from './baserenderer.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

import '@babylonjs/core/Meshes/thinInstanceMesh'

//Track series of events that happen to a particle over time and when
class VoxelEvent {
    constructor(filePosition, add) {
        this.filePosition = filePosition;  //Position where operation happens
        this.add = add; //Additve or Subractive Operation
        this.complete = false;
    }
}

export default class VoxelRenderer extends BaseRenderer {

    static drawDelay = 5;
    constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools, voxelWidth, voxelHeight) {
        super(scene, specularColor, loadingProgressCallback, renderFuncs, tools)
        //Core items from GCodeProcessor
        this.voxelWidth = parseFloat(voxelWidth);
        this.voxelHeight = parseFloat(voxelHeight);
        this.solidMat;
        this.transparentMat;

        //used for rendering visuals
        this.hasSubtractive = false;
        this.lostInSpace = Matrix.Identity().setTranslation(new Vector3(10000, 10000, 10000));
        this.clearColor = new Color4(1, 0, 0, 0);

        this.additiveColor = new Color4(0, 1, 0, 0.8);
        this.subtractiveColor =new Color4(1, 0, 0, 0.8);
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
        let box = MeshBuilder.CreateBox('box', { width: this.voxelWidth, height: this.voxelHeight, depth: this.voxelWidth }, this.scene);
        box.hasVertexAlpha = true;
        box.updateFacetData = true;

        let material = new StandardMaterial("mat", this.scene);

        material.needDepthPrePass = true;
        material.forceDepthWrite = true;
        material.backFaceCulling = false;
        box.material = material;

        return box;
    }

    async render(lines) {
        this.isLoading = true;

        //X, Y, Z
        let x = parseInt(300 / this.voxelWidth) + 1 //Bed Size
        let z = x; //Default to a square computed bed for now    
        let y = parseInt(300 / this.voxelHeight) + 1  //Max Height


        let layers = new Array(z);
        for (let ystep = 0; ystep <= y; ystep++) {
            layers[ystep] = new Object();
        }

        let maxRenderedLayer = 0
        //        let layerMap = {}  //Layer Map  two key dictionary for quick lookup ithout an array
        let layerHeight = 0;
        let lastUpdate = new Date();
        /********************************************************************************************** */
        /*                                  Build the voxel model                                       */
        /********************************************************************************************** */
        for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            let gcodeLine = lines[lineIdx];
            let tool = this.tools[gcodeLine.tool];

            if (!gcodeLine.extruding) { continue; } //We only care about gcode lines which are performing an action such as extrusion or cutting

            let voxelArray = gcodeLine.getVoxelSegments(this.voxelWidth, this.voxelHeight, tool.getDiameter() / 2, tool.isAdditive());

            if (voxelArray === undefined || voxelArray.length === 0) continue;

            let voxelEvent = new VoxelEvent(gcodeLine.gcodeLineNumber, tool.isAdditive());
            for (let voxelIdx = 0; voxelIdx < voxelArray.length; voxelIdx++) {
                let voxel = voxelArray[voxelIdx];
                let idxX = Math.floor(voxel.x / this.voxelWidth);
                let idxY = Math.floor(voxel.y / this.voxelHeight);
                let idxZ = Math.floor(voxel.z / this.voxelWidth);

                if (idxY < 0) {
                    idxY = 0;
                }

                if (idxY != maxRenderedLayer && tool.isAdditive()) {
                    maxRenderedLayer = idxY;
                }

                if (tool.toolType === "Extruder") {

                    try {
                        var point = layers[idxY][idxX][idxZ];
                    }
                    catch (ex) {
                        point = null;
                    }

                    if (!point) {
                        try {
                            if (!layers[idxY].hasOwnProperty(idxX)) {
                                layers[idxY][idxX] = {};
                            }
                            layers[idxY][idxX][idxZ] = { color: gcodeLine.color, voxelEvents: [voxelEvent] };
                        }
                        catch (ex) {
                            console.log(ex);
                            console.log(`${idxX}  ${idxY} ${idxZ}`)
                        }
                    }
                    else {
                        //Find the point
                        //if (points.length > 0 && points[0].data && !points[0].data.voxelEvents.some(ev => ev.filePosition === voxelEvent.filePosition)) {
                        point.voxelEvents.push(voxelEvent);
                        //}
                    }
                }
                else { //Deal with cutting operation
                    this.hasSubtractive = true;
                    for (let cutY = idxY; cutY <= maxRenderedLayer + 1; cutY++) {
                        try {
                            if (layers[cutY][idxX][idxZ]) {
                                layers[cutY][idxX][idxZ].voxelEvents.push(voxelEvent);
                            } else {
                                if (!layers[cutY].hasOwnProperty(idxX)) {
                                    layers[cutY][idxX] = {};
                                }
                                layers[cutY][idxX][idxZ] = { color: gcodeLine.color, voxelEvents: [voxelEvent] }
                            }
                        }
                        catch {
                            if (cutY < 0) continue;
                            if (!layers[cutY].hasOwnProperty(idxX)) {
                                layers[cutY][idxX] = {};
                            }
                            layers[cutY][idxX][idxZ] = { color: gcodeLine.color, voxelEvents: [voxelEvent] }
                        }

                    }
                }
            }
            lines[lineIdx] = null;

            if (lineIdx % 10000 === 0 || (new Date() - lastUpdate > 5000)) {
                lastUpdate = new Date();
                this.loadingProgressCallback(lineIdx / lines.length, "Generating Voxel Map...");
                await pauseProcessing();
            }
        }

        this.loadingProgressCallback(lineIdx / lines.length, "Rendering Voxel...");

        

        let particleCount = 0;
        /********************************************************************************************** */
        /*                                 Build the 3d model                                           */
        /********************************************************************************************** */
        for (let vy = 0; vy < maxRenderedLayer; vy++) {
            let layerParticles = [];
            if (layers[vy] === undefined) continue;

            let minFilePosition = 999999999999;
            let maxFilePosition = -999999999999;
            for (let [x, zValues] of Object.entries(layers[vy])) {
                for (let [z, voxel] of Object.entries(zValues)) {

                    if (voxel.voxelEvents[0].filePosition < minFilePosition)
                        minFilePosition = voxel.voxelEvents[0].filePosition;

                    if (voxel.voxelEvents.slice()[0].filePosition > maxFilePosition)
                        maxFilePosition = voxel.voxelEvents[0].filePosition;
                    voxel.color.a = 1;
                    let p = {
                        matrix: Matrix.Identity(),
                        color: voxel.color.clone(),
                        voxelEvents: voxel.voxelEvents,
                        lastDrawnCount: 0
                    }
                    p.matrix.setTranslation(new Vector3(x * this.voxelWidth, vy * this.voxelHeight, z * this.voxelWidth))
                    layerParticles.push(p)
                }
            }
            particleCount += layerParticles.length;
            layers[vy] = null;
            let box = this.buildBox();

            box.alphaIndex = vy;
            box.renderingGroupId = 1;

            let matrixData = new Float32Array(16 * layerParticles.length);
            let colorData = new Float32Array(4 * layerParticles.length);

            for (let particleIdx = 0; particleIdx < layerParticles.length; particleIdx++) {
                let particle = layerParticles[particleIdx];

                try {
                    if (particle) {
                        particle.matrix.copyToArray(matrixData, 16 * particleIdx);
                        particle.color.toArray(colorData, 4 * particleIdx);
                        if (!this.hasSubtractive) {
                            delete particle.matrix; //optimization to free up memory
                        }
                    }
                    else {
                        // console.log(particle)
                    }
                }
                catch (ex) {
                    console.log(ex);
                }
            }

            box.thinInstanceSetBuffer("matrix", matrixData, 16);
            box.thinInstanceSetBuffer("color", colorData, 4);
            box.thinInstanceRefreshBoundingInfo();

            let updateVoxels = () => {
                //let particleUpdated = true;
                let hasSubtract = false;
                let hasMove = false;

                for (let particleIdx = 0; particleIdx < layerParticles.length; particleIdx++) {
                    let particle = layerParticles[particleIdx];

                    if (scrubbing) {
                        this.clearColor.toArray(colorData, particleIdx * 4);
                        if(this.hasSubtractive){
                            this.lostInSpace.copyToArray(matrixData, particleIdx * 16);
                        }
                    }


                    var lastEvent = particle.voxelEvents.filter(ev => ev.filePosition < this.currentFilePosition).slice(-1)[0];

                    if (lastEvent === null || lastEvent === undefined) continue;  //|| lastEvent.complete

                    if (lastEvent.add) {
                        if (lastEvent.filePosition > lastPosition && lastEvent.filePosition <= this.currentFilePosition) {
                            particle.lastDrawnCount = 0;
                            if(this.hasSubtractive){
                                particle.matrix.copyToArray(matrixData, particleIdx * 16);
                            }
                        }
                        if (scrubbing) {
                            particle.lastDrawnCount = VoxelRenderer.drawDelay;
                        }
                        if (particle.lastDrawnCount < VoxelRenderer.drawDelay) {
                            this.additiveColor.toArray(colorData, particleIdx * 4);
                            particle.lastDrawnCount++;
                        }
                        else {
                            particle.color.toArray(colorData, particleIdx * 4);
                            if (this.hasSubtractive) {
                                particle.matrix.copyToArray(matrixData, particleIdx * 16);
                                //lastEvent.complete = true;
                            }
                        }


                    }
                    else {
                        if (lastEvent.filePosition >= lastPosition && lastEvent.filePosition <= this.currentFilePosition) {
                            particle.lastDrawnCount = 0;
                        }
                        if (scrubbing) {
                            particle.lastDrawnCount = VoxelRenderer.drawDelay;
                        }
                        if (particle.lastDrawnCount < VoxelRenderer.drawDelay) {
                            this.subtractiveColor.toArray(colorData, particleIdx * 4);
                            particle.lastDrawnCount++;
                        }
                        else {
                            hasSubtract = true;
                            this.clearColor.toArray(colorData, particleIdx * 4);
                            if (this.hasSubtractive) {
                                this.lostInSpace.copyToArray(matrixData, particleIdx * 16);
                            }
                            hasMove = true;
                        }
                    }
                }
                box.thinInstanceBufferUpdated('color');
                if (hasSubtract) {
                    box.thinInstanceRefreshBoundingInfo();
                }
                if (hasMove) {
                    box.thinInstanceRefreshBoundingInfo();
                    box.thinInstanceBufferUpdated('matrix');
                }
            }


            let lastPosition = 0;
            let firstPass = true;
            let scrubbing = false;

            let timeStamp = Date.now()
            //Start particle animation
            let beforeRenderFunc = () => {
                if (this.isLoading) return;
                if (Date.now() - timeStamp < 200) {
                    return;
                }
                timeStamp = Date.now();
                //Deal with time scrubbing
                if (Math.abs(lastPosition - this.currentFilePosition) > this.scrubDistance || firstPass || this.forceRedraw) {
                    scrubbing = true;
                    this.forceRedraw = false;
                    //reset flags
                    for (let particleIdx = 0; particleIdx < layerParticles.length; particleIdx++) {
                        let particle = layerParticles[particleIdx];
                        particle.voxelEvents.forEach(p => p.complete = false);
                    }

                    updateVoxels();
                    firstPass = false;
                } else {
                    if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
                        scrubbing = false;
                        updateVoxels();
                    }
                }
                lastPosition = this.currentFilePosition;
            }


            if (this.loadingProgressCallback) {
                this.loadingProgressCallback(vy / maxRenderedLayer, 'Rendering Voxels...');
            }

            //Register animation functions to main loop but keep track of them for deregistration later
            this.renderFuncs.push(beforeRenderFunc); //track our registered function
            this.scene.registerBeforeRender(beforeRenderFunc); //register render function

            if (new Date() - lastUpdate > 1000) {
                lastUpdate = new Date()
                await pauseProcessing();
            }
        }

        this.isLoading= false;
        this.loadingProgressCallback(1);
        layers = null;
    }

}
