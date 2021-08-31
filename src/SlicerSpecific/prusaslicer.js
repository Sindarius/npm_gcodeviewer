import SlicerBase from './slicerbase'
import { Color4 } from '@babylonjs/core/Maths/math.color'

export default class PrusaSlicer extends SlicerBase {

    constructor() {
        super();                                                                                                    

        this.colorList = {
            'Perimeter': { color: new Color4(1, 0.9, .3, 1), perimeter: true },
            'External perimeter': { color: new Color4(1, 0.5, .2, 1), perimeter: true },
            'Internal infill': { color: new Color4(.59, .19, .16, 1), perimeter: false },
            'Solid infill': { color: new Color4(.59, .19, .8, 1), perimeter: true },
            'Top solid infill': { color: new Color4(0.95, .25, .25, 1), perimeter: true },
            'Bridge infill': { color: new Color4(.3, .5, .73, 1), perimeter: false },
            'Gap fill': { color: new Color4(1, 1, 1, 1), perimeter: false },
            'Skirt': { color: new Color4(0, .53, .43, 1), perimeter: false },
            'Supported material': { color: new Color4(0, 1, 0, 1), perimeter: false },
            'Supported material interface': { color: new Color4(0, 0.5, 0, 1), perimeter: false },
            'Custom': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false },
            'Unknown': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false },

            //Look up colors
            'Support material': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false },
            'Support material interface': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false },
            'Overhang perimeter': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: true },
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
        return this.colorList['Unknown'].color;
    }

    isPerimeter(){
        return this.perimeter;
    }
}