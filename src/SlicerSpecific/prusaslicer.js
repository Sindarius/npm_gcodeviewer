import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class PrusaSlicer extends SlicerBase {

    constructor() {
        super();

        this.colorList = {
            'Perimeter': new Color4(1, 0.9, .3, 1),
            'External perimeter': new Color4(1, 0.5, .2, 1),
            'Internal infill': new Color4(.59, .19, .16, 1),
            'Solid infill': new Color4(.59, .19, .8, 1),
            'Top solid infill': new Color4(0.95, .25, .25, 1),
            'Bridge infill': new Color4(.3, .5, .73, 1),
            'Gap fill': new Color4(1, 1, 1, 1),
            'Skirt': new Color4(0, .53, .43, 1),
            'Supported material': new Color4(0, 1, 0, 1),
            'Supported material interface': new Color4(0, 0.5, 0, 1),
            'Custom': new Color4(0.5, 0.5, 0.5, 1),
            'Unknown': new Color4(0.5, 0.5, 0.5, 1)
        }

    }

    isTypeComment(comment) {
        return comment.trim().startsWith(';TYPE:');
    }
    getFeatureColor(comment) {
        var featureColor = comment.substring(6).trim();
        if (Object.prototype.hasOwnProperty.call(this.colorList, featureColor)) {
            return this.colorList[featureColor];
        }
        console.log(featureColor);
        return this.colorList['Unknown'];
    }

}