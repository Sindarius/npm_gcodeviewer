/* eslint-disable */
export default class SlicerSpecificBase {
    constructor() {
        this.feature = null;
        this.perimeter = true;
        this.support = false;
        this.missingFeatures = []
    }

    isTypeComment(comment) { }
    getFeatureColor(comment) { }
    isPerimeter() { return this.perimeter; } // render all
    isSupport() { return this.support; } 

    reportMissingFeature(featureName){
        if(!this.missingFeatures.includes(featureName)){
            console.error(`Missing feature ${featureName}`);
            this.missingFeatures.push(featureName);
        }
    }
        

}