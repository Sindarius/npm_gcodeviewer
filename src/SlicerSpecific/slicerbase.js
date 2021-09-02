/* eslint-disable */
export default class SlicerSpecificBase {
    constructor() {
        this.feature = null;
        this.perimeter = true;
        this.support = false;
    }

    isTypeComment(comment) { }
    getFeatureColor(comment) { }
    isPerimeter() { return this.perimeter; } // render all
    isSupport() { return this.support; } 

}