import { Color4 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Meshes/thinInstanceMesh';

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
      this.scrubDistance = 10;
      this.progressColor = new Color4(0, 1, 0, 1);
      this.isLoading = true;
      this.vertexAlpha = false;
      this.forceRedraw = false;
      this.material = null;
      this.fadeRate = 0.2;
       this.transparentValue = 0.25;
       this.renderRange = 0;
   }

   //Used for rendering visual
   updateFilePosition(position) {
      this.previousFilePosition = this.currentFilePosition;
      this.currentFilePosition = position;
   }

   updateLiveTrackingShowSolid(to) {
      this.liveTrackingShowSolid = to;
   }

   lerp(start, end, percent) {
      return start + (end - start) * percent;
   }

    doScrub(lastPosition, min, max) {
        return Math.abs(lastPosition - this.currentFilePosition) > 50000 || ( (this.currentFilePosition < lastPosition) &&  (Math.abs(lastPosition - this.currentFilePosition) > this.scrubDistance )
            && lastPosition >= min - 1000
            && lastPosition <= max + 1000
        )
   }
}
