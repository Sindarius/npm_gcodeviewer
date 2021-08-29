import { Color4 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/thinInstanceMesh";

export class BaseRenderer {
    constructor(scene, specularColor, loadingProgressCallback, renderFuncs, tools) {
        this.scene = scene;
        this.specularColor = specularColor;
        this.loadingProgressCallback = loadingProgressCallback;
        this.renderFuncs = renderFuncs;
        this.solidMat;
        this.transparentMat;
        this.previousFilePosition = 0;
        this.currentFilePosition = 0;
        this.tools = tools;
        this.scrubDistance = 30000;
        this.progressColor = new Color4(0,1,0,1);
        this.isLoading = true;
        this.vertexAlpha = false;
        this.forceRedraw = false;
    }

        //Used for rendering visual
        updateFilePosition(position) {
            this.previousFilePosition = this.currentFilePosition;
            this.currentFilePosition = position;
        }
    
        updateLiveTrackingShowSolid(to){
            this.liveTrackingShowSolid = to;
        }
    
   

}