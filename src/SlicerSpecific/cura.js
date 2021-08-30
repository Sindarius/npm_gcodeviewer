import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class Cura extends SlicerBase {

    constructor() {
        super();

        this.colorList = {
            'SKIN': new Color4(1, 0.9, .3, 1),
            'WALL-OUTER': new Color4(1, 0.5, .2, 1),
            'WALL-INNER': new Color4(.59, .19, .16, 1),
            'FILL': new Color4(0.95, .25, .25, 1),
            'SKIRT': new Color4(0, .53, .43, 1),
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
        return this.colorList['Unknown'];
    }

}