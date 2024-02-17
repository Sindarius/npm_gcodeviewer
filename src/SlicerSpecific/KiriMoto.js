import SlicerBase from './slicerbase' 
import { Color4 } from '@babylonjs/core/Maths/math.color' 
 
export default class KiriMoto extends SlicerBase { 
 
    constructor() { 
        super();                                                                                                     
 
        this.featureList = { 
            'shells': { color: new Color4(1, 0.9, 0.3, 1), perimeter: true, support : false }, 
            'sparse infill': { color: new Color4(0.59, 0.19, 0.16, 1), perimeter: false, support : false }, 
            'solid fill': { color: new Color4(0.59, 0.19, 0.8, 1), perimeter: true , support : false}, 
            'Unknown': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : false}, 
 
            //Look up colors 
            'Support material': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : true}, 
            'Support material interface': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : true}, 
            'Overhang perimeter': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: true , support : false}, 
            'Wipe tower': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: true , support : false}, 
        } 
 
    } 
 
 
 
    isTypeComment(comment) { 
        if (comment.trim().startsWith('; feature')){ 
            this.feature =  comment.substring(9).trim(); 
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
        return this.unknownFeatureColor;
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
 
    isSupport() {  
        try{    
            return this.featureList[this.feature].support;} 
        catch{ 
            this.reportMissingFeature(this.feature); 
            return false; 
        } 
    }  
 
    //Settings are kept at the bottom of the file in PrusaSlicer gcode 
    processComments(file, processor) { 
        try {
            for (let lineIdx = file.length - 350; lineIdx < file.length - 1; lineIdx++) {
                const line = file[lineIdx];

                //Pull out the nozzle diameter for each tool
                if (line.includes('nozzle_diameter')) {
                    const equalSign = line.indexOf('=') + 1;
                    const diameters = line.substring(equalSign).split(',');
                    for (let toolIdx = 0; toolIdx < diameters.length; toolIdx++) {
                        if (processor.tools.length < toolIdx) {
                            processor.tools[toolIdx].diameter = diameters[toolIdx];
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    } 
     
}