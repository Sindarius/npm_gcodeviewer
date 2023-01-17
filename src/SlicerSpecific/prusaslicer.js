import SlicerBase from './slicerbase' 
import { Color4 } from '@babylonjs/core/Maths/math.color' 
 
export default class PrusaSlicer extends SlicerBase { 
 
    constructor() { 
        super();                                                                                                     
 
        this.featureList = { 
            'Perimeter': { color: new Color4(1, 0.9, 0.3, 1), perimeter: false, support : false }, 
            'External perimeter': { color: new Color4(1, 0.5, 0.2, 1), perimeter: true , support : false}, 
            'Internal infill': { color: new Color4(0.59, 0.19, 0.16, 1), perimeter: false, support : false }, 
            'Solid infill': { color: new Color4(0.59, 0.19, 0.8, 1), perimeter: false , support : false}, 
            'Top solid infill': { color: new Color4(0.95, 0.25, 0.25, 1), perimeter: false , support : false}, 
            'Bridge infill': { color: new Color4(0.3, 0.5, 0.73, 1), perimeter: false , support : false}, 
            'Gap fill': { color: new Color4(1, 1, 1, 1), perimeter: false , support : false}, 
            'Skirt': { color: new Color4(0, 0.53, 0.43, 1), perimeter: false , support : false}, 
            'Skirt/Brim': { color: new Color4(0, 0.53, 0.43, 1), perimeter: false , support : false}, 
            'Supported material': { color: new Color4(0, 1, 0, 1), perimeter: false , support : true}, 
            'Supported material interface': { color: new Color4(0, 0.5, 0, 1), perimeter: false , support : true}, 
            'Custom': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : false}, 
            'Unknown': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : false}, 
 
            //Look up colors 
            'Support material': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : true}, 
            'Support material interface': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: false , support : true}, 
            'Overhang perimeter': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: true , support : false}, 
            'Wipe tower': { color: new Color4(0.5, 0.5, 0.5, 1), perimeter: true , support : false}, 
        } 
 
    } 
 
 
 
    isTypeComment(comment) { 
        if (comment.trim().startsWith(';TYPE:')){ 
            this.feature =  comment.substring(6).trim(); 
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
        return this.featureList.Unknown.color;
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
        for (let lineIdx = file.length - 350; lineIdx++; lineIdx < file.length){ 
            let line = file[lineIdx]; 
            //Pull out the nozzle diameter for each tool 
            if (line.includes('nozzle_diameter')) { 
                let equalSign = line.indexOf('=') + 1; 
                let diameters = line.substring(equalSign).split(','); 
                for (let toolIdx = 0; toolIdx < diameters.length; toolIdx++) {  
                    if (processor.tools.length < toolIdx) { 
                        processor.tools[toolIdx].diameter = diameters[toolIdx]; 
                    } 
                } 
            } 
        } 
    } 
     
}