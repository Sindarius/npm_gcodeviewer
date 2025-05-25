import SlicerBase from './slicerbase';
import { Color4 } from '@babylonjs/core/Maths/math.color';

export default class OrcaSlicer extends SlicerBase {
   constructor() {
      super();

      this.featureList = {
         'Outer wall': {
            color: new Color4(1, 0.9, 0.3, 1),
            perimeter: true,
            support: false
         },
         'Inner wall': {
            color: new Color4(1, 0.49, 0.22, 1),
            perimeter: false,
            support: false
         },
         'Overhang wall': {
            color: new Color4(0.15, 0.16, 0.75, 1),
            perimeter: false,
            support: false
         },
         'Sparse infill': {
            color: new Color4(0.69, 0.19, 0.16, 1),
            perimeter: false,
            support: false
         },
         'Internal solid infill': {
            color: new Color4(0.59, 0.33, 0.8, 1),
            perimeter: false,
            support: false
         },
         'Top surface': {
            color: new Color4(0.7, 0.22, 0.22, 1),
            perimeter: true,
            support: false
         },

         'Bottom surface': {
            color: new Color4(0.4, 0.36, 0.78, 1),
            perimeter: true,
            support: false
         },

         Bridge: {
            color: new Color4(0.3, 0.5, 0.73, 1),
            perimeter: false,
            support: false
         },
         Custom: {
            color: new Color4(0.37, 0.82, 0.58, 1),
            perimeter: false,
            support: false
         },
         Support: {
            color: new Color4(0, 1, 0, 1),
            perimeter: false,
            support: true
         },
         'Support interface': {
            color: new Color4(0.12, 0.38, 0.13, 1),
            perimeter: false,
            support: true
         },
         'Prime tower': {
            color: new Color4(0.7, 0.89, 0.67, 1),
            perimeter: false,
            support: false
         },
         'Internal Bridge': {
            color: new Color4(0.3, 0.5, 0.73, 1),
            perimeter: false,
            support: false
         },
         'Skirt': {
            color: new Color4(0, 0.53, 0.43, 1),
            perimeter: false,
            support: false
         },
      };
   }

   isTypeComment(comment) {
      if (comment.trim().startsWith(';TYPE:')) {
         this.feature = comment.substring(6).trim();
         return true;
      }
      if (comment.trim().startsWith(';HEIGHT:')) {
         this.hasHeight = true;
         this.height = comment.substring(8).trim();
         return true;
      }
      return false;
   }
   getFeatureColor() {
      if (Object.prototype.hasOwnProperty.call(this.featureList, this.feature)) {
         try {
            return this.featureList[this.feature].color;
         } catch {
            this.reportMissingFeature(this.feature);
         }
      }
      return this.unknownFeatureColor;
   }

   isPerimeter() {
      try {
         return this.featureList[this.feature].perimeter;
      } catch {
         this.reportMissingFeature(this.feature);
         return true;
      }
   }

   isSupport() {
      try {
         return this.featureList[this.feature].support;
      } catch {
         this.reportMissingFeature(this.feature);
         return false;
      }
   }

   processComments(file, processor) {
      try {
         for (let lineIdx = file.length - 350; lineIdx < file.length - 1; lineIdx++) {
            const line = file[lineIdx];

            //Pull out the nozzle diameter for each tool
            if (line.includes('nozzle_diameter')) {
               const equalSign = line.indexOf('=') + 1;
               const diameter = Number(line.substring(equalSign));
               for (let toolIdx = 0; toolIdx < processor.tools.length; toolIdx++) {
                  if (processor.tools.length < toolIdx) {
                     processor.tools[toolIdx].diameter = diameter;
                  }
               }
            }
         }
      } catch (e) {
         console.error(e);
      }
   }
}
