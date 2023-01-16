import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class Cura extends SlicerBase {

    constructor() {
        super();
        this.featureList = {
            'SKIN': { color :new Color4(1, 0.9, 0.3, 1), perimeter : true, support : false},
            'WALL-OUTER': { color : new Color4(1, 0.5, 0.2, 1), perimeter : true,  support : false},
            'WALL-INNER': { color : new Color4(0.59, 0.19, 0.16, 1), perimeter : false,  support : false},
            'FILL': { color : new Color4(0.95, 0.25, 0.25, 1), perimeter : false ,  support : false},
            'SKIRT': {color :  new Color4(0, 0.53, 0.43, 1), perimeter : false ,  support : false},
            'SUPPORT': {color :  new Color4(0, 0.53, 0.43, 1), perimeter : false ,  support : true},
            'CUSTOM': {color : new Color4(0.5, 0.5, 0.5, 1), perimeter : false,  support : false},
            'UNKNOWN':{color : new Color4(0.5, 0.5, 0.5, 1), perimeter : false,  support : false}
        }
    }

    isTypeComment(comment) {
        if (comment.trim().startsWith(';TYPE:')){
            this.feature = comment.substring(6).trim();
            return true;
        }
        return false;
    }
    getFeatureColor() {
        if (Object.prototype.hasOwnProperty.call(this.featureList, this.feature)) {
            try{
                return this.featureList[this.feature].color;
            }
            catch{
                this.reportMissingFeature(this.feature);
            }
        }
        return this.featureList['UNKNOWN'];
    }

    isPerimeter(){
        try{
            return this.featureList[this.feature].perimeter;
        }
        catch{
            this.reportMissingFeature(this.feature);
            return true;
        }
    }

    isSupport(){
        try{
            return this.featureList[this.feature].support;
        }
        catch{
            this.reportMissingFeature(this.feature);
            return false;
        }
    }

}