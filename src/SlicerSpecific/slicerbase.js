import { Color4 } from '@babylonjs/core/Maths/math.color';

/* eslint-disable */
export default class SlicerSpecificBase {
    constructor() {
        this.feature = null;
        this.perimeter = true;
        this.support = false;
        this.missingFeatures = []
        this.hasHeight = false;
        this.height = 0.2;
    }

    unknownFeatureColor = new Color4(0.5, 0.5, 0.5, 1);

    isTypeComment(comment) { return false; }
    getFeatureColor(comment) { return new Color4(1, 1, 1, 1) }
    isPerimeter() { return this.perimeter; } // render all
    isSupport() { return this.support; } 

    //Inherited versions to look for slicer specific comments like tool size, etc.
    processComments(file, processor) { }

    reportMissingFeature(featureName){
        if(!this.missingFeatures.includes(featureName)){
            console.error(`Missing feature ${featureName}`);
            this.missingFeatures.push(featureName);
        }
    }
        

}