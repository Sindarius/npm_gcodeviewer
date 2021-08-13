/* eslint-disable */
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { BaseRenderer } from './baserenderer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { SolidParticleSystem } from '@babylonjs/core/Particles/solidParticleSystem';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Particle } from '@babylonjs/core/Particles/particle';

export default class BlockRenderer extends BaseRenderer {

    constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools, meshIndex) {
        super(scene, specularColor, loadingProgressCallback, renderFuncs, tools);
        this.meshIndex = meshIndex ?? 0;

        this.additiveColor = new Color4(0, 1, 0, 0.8);
    }

    
    arrayMax(arr) {
        var len = arr.length, max = -Infinity;
        while (len--) {
          if (Number(arr[len].layerHeight) > max) {
            max = Number(arr[len].layerHeight);
          }
        }
        return max;
      };

    render(lines) {
        let gcodeLineIndex = new Array();
        let originalColor = new Array();
        let completed = new Array();

        this.renderMode = 'Mesh Rendering';
        let box = MeshBuilder.CreateBox('box', { width: 1, height: 1, depth: 1 }, this.scene);

        let l = lines;
        let minFilePosition = lines[0].gcodeLineNumber
        let maxFilePosition = lines.slice(-1)[0].gcodeLineNumber;


        let particleBuilder = (particle, i, s) => {
            l[s].renderLineV3(particle, true);
            originalColor.push(particle.color);
            gcodeLineIndex.push(particle.props.gcodeLineNumber);
            completed.push(false);
        };

        let sps = new SolidParticleSystem('gcodemodel', this.scene, {
            updatable: true,
            enableMultiMaterial: true,
            useVertexAlpha: true
        });

        sps.addShape(box, lines.length, {
            positionFunction: particleBuilder,
        });

        sps.buildMesh();



        let transparentValue = this.lineVertexAlpha ? this.materialTransparency : 1;
        if (this.liveTracking) {
            transparentValue = this.liveTrackingShowSolid ? transparentValue : 0
        }

        //Build out solid and transparent material.
        let solidMat = new StandardMaterial('solidMaterial', this.scene);
        solidMat.specularColor = this.specularColor;
        let transparentMat = new StandardMaterial('transparentMaterial', this.scene);
        transparentMat.specularColor = this.specularColor;
        transparentMat.alpha = 0;// this.liveTrackingShowSolid ? this.materialTransparency : transparentValue;
        transparentMat.needAlphaTesting = () => true;
        transparentMat.separateCullingPass = true;
        transparentMat.backFaceCulling = true;

        sps.setMultiMaterial([solidMat, transparentMat]);
        sps.setParticles();
        sps.computeSubMeshes();
        sps.mesh.alphaIndex = this.meshIndex;
        sps.mesh.isPickable = false;
        sps.mesh.doNotSyncBoundingInfo = true;


        let lastPosition = 0;
        let firstPass = true;
        let scrubbing = false;

        sps.updateParticle = (particle) => {
            if (scrubbing) {
                particle.color = originalColor[particle.idx];
                if (gcodeLineIndex[particle.idx] < this.currentFilePosition) {
                    particle.color.a = 1;
                    particle.materialIndex = 0;
                    completed[particle.idx] = true;
                    return;
                }
                else {
                    particle.color.a = 0;
                    particle.materialIndex = 1;
                    completed[particle.idx] = false;
                }

            }
            if (completed[particle.idx]) return;

            if (gcodeLineIndex[particle.idx] < this.currentFilePosition && particle.color.a < 0.5) {
                particle.color = this.progressColor;
                particle.color.a = 0.9;
                particle.materialIndex = 0;
            }

            if (particle.color.a > 0.5 && particle.color.a < 1) {
                particle.color.a += 0.02;
            }

            if (particle.color.a >= 1 && !completed[particle.idx]) {
                particle.color = originalColor[particle.idx];
                particle.color.a = 1;
                completed[particle.idx] = true;
                lastPosition = gcodeLineIndex[particle.idx];
            }


        };



        let timeStamp = Date.now();
        let beforeRenderFunc = () => {
            if (this.isLoading || Date.now() - timeStamp < 200) return;
            timeStamp = Date.now();
            if (Math.abs(lastPosition - this.currentFilePosition) > this.scrubDistance || firstPass) {
                scrubbing = true;
                lastPosition = 0;
                for (let idx = 0; idx < completed.length; idx++) {
                    completed[idx] = false;
                }
                sps.setParticles();
                sps.computeSubMeshes();
                firstPass = false;
            } else if (this.currentFilePosition >= minFilePosition - 30000 && this.currentFilePosition <= maxFilePosition + 30000) {
                scrubbing = false;
                sps.setParticles();
                sps.computeSubMeshes();
            }
            lastPosition = this.currentFilePosition;
        }


        this.isLoading = false;
        this.renderFuncs.push(beforeRenderFunc);
        this.scene.registerBeforeRender(beforeRenderFunc);
        this.scene.clearCachedVertexData();


    }



}