import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class Cura extends SlicerBase {

    constructor() {
        super();
        this.colorList = {
            'SKIN': { color :new Color4(1, 0.9, .3, 1), perimeter : true },
            'WALL-OUTER': { color : new Color4(1, 0.5, .2, 1), perimeter : true } ,
            'WALL-INNER': { color : new Color4(.59, .19, .16, 1), perimeter : false } ,
            'FILL': { color : new Color4(0.95, .25, .25, 1), perimeter : false},
            'SKIRT': {color :  new Color4(0, .53, .43, 1), perimeter : false} ,
            'CUSTOM': {color : new Color4(0.5, 0.5, 0.5, 1), perimeter : false},
            'UNKNOWN':{color : new Color4(0.5, 0.5, 0.5, 1), perimeter : false}
        }
    }

    isTypeComment(comment) {
        return comment.trim().startsWith(';TYPE:');
    }
    getFeatureColor(comment) {
        var featureColor = comment.substring(6).trim();
        if (Object.prototype.hasOwnProperty.call(this.colorList, featureColor)) {
            this.perimeter = this.colorList[featureColor].perimeter
            return this.colorList[featureColor].color;
        }
        return this.colorList['UNKNOWN'];
    }

    isPerimeter(){
        return this.perimeter;
    }

}