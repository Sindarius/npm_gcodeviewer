import { Color4 } from '@babylonjs/core/Maths/math.color';

export const ToolType = {
   Extruder: 'Extruder',
   Endmill: 'Endmill'
};

const COLORSCALE = 0.3;

export default class Tool {
   constructor() {
      this.name = '';
      this.color = new Color4(0, 0, 1, 1);
      this.updateDarkerValue();
      this.diameter = 0.4; //default nozzle
      this.toolType = ToolType.Extruder;
   }

   get colorString() {
      return this.color.toHexString();
   }

   set colorString(value) {
      this.color = Color4.FromHexString(value + 'FF');
      this.updateDarkerValue();
   }

   updateDarkerValue() {
      if (this.color.r < 0.3 && this.color.g < 0.3 && this.color.b < 0.3) {
         this.colorDarker = this.color.add(new Color4(COLORSCALE, COLORSCALE, COLORSCALE, 0))
      } else {
         this.colorDarker = this.color.subtract(new Color4(COLORSCALE, COLORSCALE, COLORSCALE, 0))
      }
   }

   isAdditive() {
      return this.toolType === ToolType.Extruder;
   }

   getDiameter() {
      return this.diameter;
   }

   toJson() {
      return JSON.stringify(this);
   }

   static fromJson(jsonString) {
      let json;
      if (typeof jsonString === 'object') {
         json = jsonString;
      } else {
         json = JSON.parse(jsonString);
      }
      const tool = new Tool();
      tool.name = json.name;
      tool.color = new Color4(json.color.r, json.color.g, json.color.b, json.color.a);
      tool.diameter = parseFloat(json.diameter);
      tool.toolType = json.toolType;
      return tool;
   }
}

let loadedTools = new Array();

export function GetTool() {
   if (loadedTools.length === 0) {
      const toolString = window.localStorage.getItem('tools');
      if (toolString) {
         loadedTools.splice();
         const toolList = JSON.parse(toolString);
         toolList.forEach((t) => {
            const newTool = Tool.fromJson(t);
            loadedTools.push(newTool);
         });
      } else {
         for (let toolIdx = 0; toolIdx < 10; toolIdx++) {
            const tool = new Tool();
            tool.name = 'Tool #' + toolIdx;
            loadedTools.push(tool);
         }
      }
   }
   return loadedTools;
}

export function SaveTool() {
   const toolString = JSON.stringify(loadedTools);
   window.localStorage.setItem('tools', toolString);
}
