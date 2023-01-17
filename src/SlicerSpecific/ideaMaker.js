import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class ideaMaker extends SlicerBase {

    constructor() {
        super();
        this.featureList = {
            'WALL-OUTER': { color : new Color4(0.47, 0.18, 0.18, 1 ), perimeter : true,  support : false},
            'WALL-INNER': { color : new Color4(0, 0.55 , 0, 1), perimeter : false,  support : false},
            'FILL': { color : new Color4(0.90, 0.20, 0.20, 1), perimeter : false ,  support : false},
            'SOLID-FILL': { color : new Color4(0.95, 0.25, 0.25, 1), perimeter : false ,  support : false},
            'BRIDGE': { color : new Color4(0.9, 0.15, 0.195, 1), perimeter : false ,  support : false},
            'SKIRT': {color :  new Color4(0.31, 0.12, 0.33, 1), perimeter : false ,  support : false},
            'SUPPORT': {color :  new Color4(0, 0.53, 0.43, 1), perimeter : false ,  support : true},
            'DENSE-SUPPORT': {color :  new Color4(0, 0.28 , 0.55, 1), perimeter : false ,  support : true},
            'RAFT': {color :  new Color4(0.59, 0.49, 0.2, 1), perimeter : false ,  support : false},
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
        return this.featureList.UNKNOWN.color;
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